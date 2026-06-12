const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../auth');
const { audit } = require('../audit');
const { emitToAll } = require('../sockets');

// PUBLIC display state — names and photos only, never scores.
router.get('/state', async (req, res) => {
  const [[phase]] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'display_phase'");
  const [[event]] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'event_name'");
  const [candidates] = await pool.query(
    'SELECT candidate_id, candidate_number, candidate_name, municipality, age, photo, is_top5, is_top3 FROM candidates ORDER BY candidate_number'
  );

  // Latest stored ranking order (rank only — no scores) for announcements
  async function latest(stage, limit) {
    const [rows] = await pool.query(
      `SELECT rk.rank_no, c.candidate_id, c.candidate_number, c.candidate_name, c.municipality, c.photo
         FROM rankings rk JOIN candidates c ON c.candidate_id = rk.candidate_id
        WHERE rk.stage = ? AND rk.batch_id = (
          SELECT batch_id FROM rankings WHERE stage = ? ORDER BY generated_at DESC LIMIT 1)
        ORDER BY rk.rank_no LIMIT ?`,
      [stage, stage, limit]
    );
    return rows;
  }

  const top5 = await latest('TOP5', 5);
  const top3 = await latest('TOP3', 3);
  const finalRanks = await latest('FINAL', 3);

  res.json({
    phase: phase ? phase.setting_value : 'candidates',
    eventName: event ? event.setting_value : 'Miss Dumalinao 2026',
    candidates,
    top5: top5.map(({ rank_no, ...c }) => c),       // unordered reveal, no ranks
    top3: top3.map(({ rank_no, ...c }) => c),
    winner: finalRanks.length ? finalRanks : null,   // ranks needed for winner/runners-up
  });
});

// Admin: control what the projection screen shows
router.patch('/phase', verifyToken, requireRole('admin'), async (req, res) => {
  const { phase } = req.body || {};
  if (!['candidates', 'top5', 'top3', 'winner'].includes(phase)) return res.status(400).json({ error: 'Invalid phase' });
  await pool.query("UPDATE settings SET setting_value = ? WHERE setting_key = 'display_phase'", [phase]);
  await audit(req, 'DISPLAY_PHASE', `Projection switched to: ${phase}`);
  emitToAll('display:update', { phase });
  res.json({ ok: true });
});

module.exports = router;
