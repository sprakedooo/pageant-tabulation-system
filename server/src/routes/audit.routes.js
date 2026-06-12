const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../auth');

router.get('/', verifyToken, requireRole('admin', 'tabulator'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const [rows] = await pool.query(
    `SELECT a.log_id, a.action, a.details, a.ip_address, a.created_at,
            COALESCE(u.full_name, 'System') AS user_name
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id
      ORDER BY a.created_at DESC, a.log_id DESC LIMIT ?`,
    [limit]
  );
  res.json(rows);
});

module.exports = router;
