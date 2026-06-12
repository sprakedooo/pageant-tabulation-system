const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MINUTES || 15) * 60 * 1000;

// In-memory last-activity tracker keyed by token jti — enforces the
// 15-minute inactivity timeout independently of JWT expiry.
const lastActivity = new Map();

function signToken(user, jti) {
  return jwt.sign(
    { sub: user.user_id, role: user.role_name, name: user.full_name, judgeId: user.judge_id || null, jti },
    SECRET,
    { expiresIn: '12h' }
  );
}

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, SECRET);
    const last = lastActivity.get(payload.jti);
    if (last !== undefined && Date.now() - last > TIMEOUT_MS) {
      lastActivity.delete(payload.jti);
      return res.status(401).json({ error: 'Session expired due to inactivity' });
    }
    lastActivity.set(payload.jti, Date.now());
    req.user = { id: payload.sub, role: payload.role, name: payload.name, judgeId: payload.judgeId, jti: payload.jti };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

function touchSession(jti) {
  lastActivity.set(jti, Date.now());
}

function endSession(jti) {
  lastActivity.delete(jti);
}

module.exports = { signToken, verifyToken, requireRole, touchSession, endSession, SECRET };
