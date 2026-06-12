const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { verifyToken, requireRole } = require('../auth');
const { audit } = require('../audit');
const { emitToStaff } = require('../sockets');

router.use(verifyToken, requireRole('admin'));

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT j.judge_id, j.status, u.user_id, u.username, u.full_name
       FROM judges j JOIN users u ON u.user_id = j.user_id ORDER BY j.judge_id`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { full_name, username, password } = req.body || {};
  if (!full_name || !username || !password) return res.status(400).json({ error: 'Full name, username and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const hash = await bcrypt.hash(password, 10);
    const [u] = await conn.query(
      "INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?, ?, ?, (SELECT role_id FROM roles WHERE role_name = 'judge'))",
      [username, hash, full_name]
    );
    const [j] = await conn.query('INSERT INTO judges (user_id) VALUES (?)', [u.insertId]);
    await conn.commit();
    await audit(req, 'JUDGE_CREATE', `${full_name} (${username})`);
    emitToStaff('judges:changed', {});
    res.status(201).json({ judge_id: j.insertId });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists' });
    throw err;
  } finally {
    conn.release();
  }
});

router.put('/:id', async (req, res) => {
  const { full_name, username, password } = req.body || {};
  const [[judge]] = await pool.query('SELECT user_id FROM judges WHERE judge_id = ?', [req.params.id]);
  if (!judge) return res.status(404).json({ error: 'Judge not found' });
  const fields = ['full_name = ?', 'username = ?'];
  const params = [full_name, username];
  if (password) {
    fields.push('password_hash = ?');
    params.push(await bcrypt.hash(password, 10));
  }
  params.push(judge.user_id);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, params);
  await audit(req, 'JUDGE_UPDATE', `${full_name} (${username})`);
  emitToStaff('judges:changed', {});
  res.json({ ok: true });
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await pool.query('UPDATE judges SET status = ? WHERE judge_id = ?', [status, req.params.id]);
  await audit(req, 'JUDGE_STATUS', `Judge #${req.params.id} → ${status}`);
  emitToStaff('judges:changed', {});
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const [[judge]] = await pool.query(
    'SELECT j.user_id, u.full_name FROM judges j JOIN users u ON u.user_id = j.user_id WHERE j.judge_id = ?',
    [req.params.id]
  );
  if (!judge) return res.status(404).json({ error: 'Judge not found' });
  const [[hasScores]] = await pool.query('SELECT COUNT(*) AS n FROM scores WHERE judge_id = ?', [req.params.id]);
  if (hasScores.n > 0) return res.status(409).json({ error: 'Judge has recorded scores. Deactivate instead of deleting.' });
  await pool.query('DELETE FROM users WHERE user_id = ?', [judge.user_id]); // cascades to judges
  await audit(req, 'JUDGE_DELETE', judge.full_name);
  emitToStaff('judges:changed', {});
  res.json({ ok: true });
});

module.exports = router;
