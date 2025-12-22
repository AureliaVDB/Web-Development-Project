// Admin middleware - checks if user has admin role
const requireAdmin = (req, res, next) => {
  // authenticateToken should run first to set req.user
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

module.exports = requireAdmin;
