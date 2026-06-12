const pool = require('./db');

async function audit(req, action, details) {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user ? req.user.id : null, action, details ? String(details).slice(0, 500) : null, ip]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { audit };
