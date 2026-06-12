const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const pool = require('../db');
const { signToken, verifyToken, endSession } = require('../auth');
const { audit } = require('../audit');

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  const [rows] = await pool.query(
    `SELECT u.user_id, u.username, u.password_hash, u.full_name, u.status, r.role_name, j.judge_id, j.status AS judge_status
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       LEFT JOIN judges j ON j.user_id = u.user_id
      WHERE u.username = ?`,
    [username]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  if (user.status !== 'active' || (user.role_name === 'judge' && user.judge_status !== 'active')) {
    return res.status(403).json({ error: 'Account is deactivated. Contact the administrator.' });
  }

  const token = signToken(user, uuid());
  req.user = { id: user.user_id };
  await audit(req, 'LOGIN', `${user.username} (${user.role_name}) logged in`);

  res.json({
    token,
    user: { id: user.user_id, username: user.username, fullName: user.full_name, role: user.role_name, judgeId: user.judge_id },
  });
});

router.post('/logout', verifyToken, async (req, res) => {
  endSession(req.user.jti);
  await audit(req, 'LOGOUT', `${req.user.name} logged out`);
  res.json({ ok: true });
});

router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
