const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../auth');
const { audit } = require('../audit');
const { emitToAll } = require('../sockets');

router.use(verifyToken);

// All categories with criteria, grouped by round
router.get('/', async (req, res) => {
  const [cats] = await pool.query(
    `SELECT c.*, r.round_code, r.round_name, r.status AS round_status
       FROM categories c JOIN rounds r ON r.round_id = c.round_id
      ORDER BY r.sequence, c.sequence`
  );
  const [crits] = await pool.query('SELECT * FROM criteria ORDER BY category_id, sequence');
  const byCat = {};
  for (const cr of crits) (byCat[cr.category_id] = byCat[cr.category_id] || []).push(cr);
  res.json(cats.map((c) => ({ ...c, criteria: byCat[c.category_id] || [] })));
});

// The category judges should currently score
router.get('/active', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, r.round_code FROM categories c JOIN rounds r ON r.round_id = c.round_id
      WHERE c.status = 'active' ORDER BY r.sequence, c.sequence LIMIT 1`
  );
  if (!rows.length) return res.json(null);
  const cat = rows[0];
  const [criteria] = await pool.query('SELECT * FROM criteria WHERE category_id = ? ORDER BY sequence', [cat.category_id]);
  res.json({ ...cat, criteria });
});

// Activate / lock a category for scoring (admin)
router.patch('/:id/status', requireRole('admin'), async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'active', 'locked'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (status === 'active') {
    // Only one category may be active at a time
    await pool.query("UPDATE categories SET status = 'locked' WHERE status = 'active'");
    await pool.query(
      `UPDATE rounds r JOIN categories c ON c.round_id = r.round_id
          SET r.status = 'active' WHERE c.category_id = ? AND r.status = 'pending'`,
      [req.params.id]
    );
  }
  await pool.query('UPDATE categories SET status = ? WHERE category_id = ?', [status, req.params.id]);
  const [[cat]] = await pool.query('SELECT category_name FROM categories WHERE category_id = ?', [req.params.id]);
  await audit(req, status === 'locked' ? 'SCORING_LOCK' : 'CATEGORY_STATUS', `${cat.category_name} → ${status}`);
  emitToAll('category:status', { categoryId: Number(req.params.id), status });
  res.json({ ok: true });
});

module.exports = router;
