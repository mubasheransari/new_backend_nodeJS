const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    return res.status(401).json({ isSuccess: false, message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = payload;
    return next();
  } catch (_e) {
    return res.status(401).json({ isSuccess: false, message: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ isSuccess: false, message: 'Unauthorized' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ isSuccess: false, message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
