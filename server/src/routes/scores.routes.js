const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../auth');
const { audit } = require('../audit');
const { emitToStaff, emitToJudges } = require('../sockets');
const { round3, scoreMatrix } = require('../compute');

router.use(verifyToken);

// Candidates eligible for a category (Top5/Final rounds only include advancers)
async function eligibleCandidates(categoryId) {
  const [[cat]] = await pool.query(
    'SELECT r.round_code FROM categories c JOIN rounds r ON r.round_id = c.round_id WHERE c.category_id = ?',
    [categoryId]
  );
  if (!cat) return null;
  let where = '';
  if (cat.round_code === 'TOP5') where = 'WHERE is_top5 = 1';
  if (cat.round_code === 'FINAL') where = 'WHERE is_top3 = 1';
  const [rows] = await pool.query(`SELECT * FROM candidates ${where} ORDER BY candidate_number`);
  return rows;
}

// Judge: my scores for the active category, with eligible candidates
router.get('/mine/:categoryId', requireRole('judge'), async (req, res) => {
  const categoryId = Number(req.params.categoryId);
  const candidates = await eligibleCandidates(categoryId);
  if (!candidates) return res.status(404).json({ error: 'Category not found' });
  const [scores] = await pool.query(
    `SELECT s.score_id, s.candidate_id, s.total, s.status, sd.criterion_id, sd.value
       FROM scores s LEFT JOIN score_details sd ON sd.score_id = s.score_id
      WHERE s.judge_id = ? AND s.category_id = ? AND s.archived = 0`,
    [req.user.judgeId, categoryId]
  );
  const byCandidate = {};
  for (const row of scores) {
    const e = (byCandidate[row.candidate_id] = byCandidate[row.candidate_id] || { status: row.status, total: row.total, details: {} });
    if (row.criterion_id) e.details[row.criterion_id] = Number(row.value);
  }
  res.json({ candidates, scores: byCandidate });
});

// Judge: autosave a draft score for one candidate
router.put('/draft', requireRole('judge'), async (req, res) => {
  const { candidateId, categoryId, details } = req.body || {};
  if (!candidateId || !categoryId || !Array.isArray(details)) return res.status(400).json({ error: 'Invalid payload' });

  const [[cat]] = await pool.query('SELECT status FROM categories WHERE category_id = ?', [categoryId]);
  if (!cat || cat.status !== 'active') return res.status(409).json({ error: 'This category is not open for scoring' });

  const [criteria] = await pool.query('SELECT criterion_id, weight FROM criteria WHERE category_id = ?', [categoryId]);
  const weights = Object.fromEntries(criteria.map((c) => [c.criterion_id, Number(c.weight)]));
  for (const d of details) {
    const v = Number(d.value);
    if (!weights[d.criterion_id] || !(v >= 1 && v <= 100)) {
      return res.status(400).json({ error: 'Each criterion score must be between 1 and 100' });
    }
  }
  const total = round3(details.reduce((sum, d) => sum + Number(d.value) * weights[d.criterion_id], 0) / 100);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(
      'SELECT score_id, status FROM scores WHERE judge_id = ? AND candidate_id = ? AND category_id = ? AND archived = 0 FOR UPDATE',
      [req.user.judgeId, candidateId, categoryId]
    );
    if (existing.length && existing[0].status === 'submitted') {
      await conn.rollback();
      return res.status(409).json({ error: 'Score already submitted. Ask the admin to unlock it.' });
    }
    let scoreId;
    if (existing.length) {
      scoreId = existing[0].score_id;
      await conn.query('UPDATE scores SET total = ? WHERE score_id = ?', [total, scoreId]);
      await conn.query('DELETE FROM score_details WHERE score_id = ?', [scoreId]);
    } else {
      const [ins] = await conn.query(
        'INSERT INTO scores (judge_id, candidate_id, category_id, total) VALUES (?, ?, ?, ?)',
        [req.user.judgeId, candidateId, categoryId, total]
      );
      scoreId = ins.insertId;
    }
    for (const d of details) {
      await conn.query('INSERT INTO score_details (score_id, criterion_id, value) VALUES (?, ?, ?)', [scoreId, d.criterion_id, d.value]);
    }
    await conn.commit();
    res.json({ ok: true, total });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// Judge: final submit (locks the score)
router.post('/submit', requireRole('judge'), async (req, res) => {
  const { candidateId, categoryId } = req.body || {};
  const [[score]] = await pool.query(
    'SELECT s.score_id, s.status, (SELECT COUNT(*) FROM score_details WHERE score_id = s.score_id) AS n FROM scores s WHERE judge_id = ? AND candidate_id = ? AND category_id = ? AND archived = 0',
    [req.user.judgeId, candidateId, categoryId]
  );
  if (!score) return res.status(404).json({ error: 'No draft score found. Enter scores first.' });
  if (score.status === 'submitted') return res.status(409).json({ error: 'Already submitted' });
  const [[{ required }]] = await pool.query('SELECT COUNT(*) AS required FROM criteria WHERE category_id = ?', [categoryId]);
  if (score.n < required) return res.status(400).json({ error: 'All criteria must be scored before submitting' });

  const [result] = await pool.query(
    "UPDATE scores SET status = 'submitted', submitted_at = NOW() WHERE score_id = ? AND status = 'draft'",
    [score.score_id]
  );
  if (!result.affectedRows) return res.status(409).json({ error: 'Already submitted' }); // double-submit guard

  await audit(req, 'SCORE_SUBMIT', `Judge ${req.user.name} submitted candidate #${candidateId}, category #${categoryId}`);
  emitToStaff('score:submitted', { judgeId: req.user.judgeId, candidateId, categoryId });
  emitToStaff('rankings:update', { categoryId });
  res.json({ ok: true });
});

// Admin: unlock a submitted score so the judge can edit
router.post('/unlock', requireRole('admin'), async (req, res) => {
  const { judgeId, candidateId, categoryId } = req.body || {};
  const [result] = await pool.query(
    "UPDATE scores SET status = 'draft', submitted_at = NULL WHERE judge_id = ? AND candidate_id = ? AND category_id = ? AND archived = 0",
    [judgeId, candidateId, categoryId]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Score not found' });
  await audit(req, 'SCORE_UNLOCK', `Unlocked judge #${judgeId}, candidate #${candidateId}, category #${categoryId}`);
  emitToJudges('score:unlocked', { judgeId, candidateId, categoryId });
  emitToStaff('rankings:update', { categoryId });
  res.json({ ok: true });
});

// Admin/Tabulator: live score matrix per category
router.get('/matrix/:categoryId', requireRole('admin', 'tabulator'), async (req, res) => {
  res.json(await scoreMatrix(Number(req.params.categoryId)));
});

module.exports = router;
