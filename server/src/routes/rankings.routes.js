const router = require('express').Router();
const { v4: uuid } = require('uuid');
const pool = require('../db');
const { verifyToken, requireRole } = require('../auth');
const { audit } = require('../audit');
const { emitToStaff, emitToAll } = require('../sockets');
const { roundRanking } = require('../compute');

router.use(verifyToken);

// Live computed rankings per round (staff only — never exposed to display role)
router.get('/preliminary', requireRole('admin', 'tabulator'), async (req, res) => {
  res.json(await roundRanking('PRELIM'));
});
router.get('/top5-round', requireRole('admin', 'tabulator'), async (req, res) => {
  res.json(await roundRanking('TOP5', (c) => c.is_top5));
});
router.get('/final-round', requireRole('admin', 'tabulator'), async (req, res) => {
  res.json(await roundRanking('FINAL', (c) => c.is_top3));
});

// Stored ranking history
router.get('/history/:stage', requireRole('admin', 'tabulator'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT rk.*, c.candidate_number, c.candidate_name, c.municipality, u.full_name AS generated_by_name
       FROM rankings rk
       JOIN candidates c ON c.candidate_id = rk.candidate_id
       JOIN users u ON u.user_id = rk.generated_by
      WHERE rk.stage = ? ORDER BY rk.generated_at DESC, rk.rank_no`,
    [req.params.stage.toUpperCase()]
  );
  res.json(rows);
});

async function storeRanking(stage, entries, userId) {
  const batchId = uuid();
  for (const e of entries) {
    await pool.query(
      'INSERT INTO rankings (stage, candidate_id, rank_no, score, generated_by, batch_id) VALUES (?, ?, ?, ?, ?, ?)',
      [stage, e.candidate_id, e.rank, e.overall, userId, batchId]
    );
  }
  return batchId;
}

// GENERATE TOP 5 — from preliminary overall scores
router.post('/generate-top5', requireRole('admin'), async (req, res) => {
  if (req.body.confirm !== true) return res.status(400).json({ error: 'Confirmation required' });
  const { results } = await roundRanking('PRELIM');
  const incomplete = results.filter((r) => r.overall === 0).length;
  if (incomplete === results.length) return res.status(409).json({ error: 'No submitted preliminary scores yet' });

  const top5 = results.slice(0, 5);
  await pool.query('UPDATE candidates SET is_top5 = 0');
  for (const c of top5) await pool.query('UPDATE candidates SET is_top5 = 1 WHERE candidate_id = ?', [c.candidate_id]);
  await storeRanking('PRELIM', results, req.user.id);
  await storeRanking('TOP5', top5, req.user.id);
  await pool.query("UPDATE rounds SET status = 'locked' WHERE round_code = 'PRELIM'");
  await pool.query("UPDATE categories c JOIN rounds r ON r.round_id = c.round_id SET c.status = 'locked' WHERE r.round_code = 'PRELIM'");

  await audit(req, 'TOP5_GENERATED', top5.map((c) => `#${c.candidate_number} ${c.candidate_name}`).join(', '));
  emitToStaff('rankings:update', { stage: 'TOP5' });
  emitToAll('stage:advanced', { stage: 'TOP5' });
  res.json({ top5 });
});

// GENERATE TOP 3 — from Top 5 Q&A weighted average
router.post('/generate-top3', requireRole('admin'), async (req, res) => {
  if (req.body.confirm !== true) return res.status(400).json({ error: 'Confirmation required' });
  const { results } = await roundRanking('TOP5', (c) => c.is_top5);
  if (!results.length || results.every((r) => r.overall === 0)) {
    return res.status(409).json({ error: 'No submitted Top 5 Q&A scores yet' });
  }

  const top3 = results.slice(0, 3);
  await pool.query('UPDATE candidates SET is_top3 = 0');
  for (const c of top3) await pool.query('UPDATE candidates SET is_top3 = 1 WHERE candidate_id = ?', [c.candidate_id]);
  await storeRanking('TOP3', top3, req.user.id);

  // BACK TO ZERO: previous scores are retained for the record, but the final
  // ranking reads only the FINAL round's Q&A scores — earlier rounds cannot
  // affect the winner.
  await pool.query("UPDATE rounds SET status = 'locked' WHERE round_code = 'TOP5'");
  await pool.query("UPDATE categories c JOIN rounds r ON r.round_id = c.round_id SET c.status = 'locked' WHERE r.round_code = 'TOP5'");

  await audit(req, 'TOP3_GENERATED', `Top 3: ${top3.map((c) => `#${c.candidate_number} ${c.candidate_name}`).join(', ')}`);
  emitToStaff('rankings:update', { stage: 'TOP3' });
  emitToAll('stage:advanced', { stage: 'TOP3' });
  res.json({ top3 });
});

// GENERATE FINAL RANKING — winner = highest Final Q&A score
router.post('/generate-final', requireRole('admin'), async (req, res) => {
  if (req.body.confirm !== true) return res.status(400).json({ error: 'Confirmation required' });
  const { results } = await roundRanking('FINAL', (c) => c.is_top3);
  if (!results.length || results.every((r) => r.overall === 0)) {
    return res.status(409).json({ error: 'No submitted Final Q&A scores yet' });
  }
  await storeRanking('FINAL', results, req.user.id);
  await pool.query("UPDATE rounds SET status = 'locked' WHERE round_code = 'FINAL'");
  await pool.query("UPDATE categories c JOIN rounds r ON r.round_id = c.round_id SET c.status = 'locked' WHERE r.round_code = 'FINAL'");

  await audit(req, 'FINAL_RANKING_GENERATED', `Winner: #${results[0].candidate_number} ${results[0].candidate_name}`);
  emitToStaff('rankings:update', { stage: 'FINAL' });
  emitToAll('stage:advanced', { stage: 'FINAL' });
  res.json({ final: results });
});

module.exports = router;
