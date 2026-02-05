const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const [users] = await db.execute(
      'SELECT id, email FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = users[0];
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Check if user is staff
const requireStaff = async (req, res, next) => {
  try {
    const [roles] = await db.execute(
      'SELECT role FROM user_roles WHERE user_id = ?',
      [req.userId]
    );

    if (roles.length === 0) {
      return res.status(403).json({ error: 'Staff access required' });
    }

    req.userRole = roles[0].role;
    next();
  } catch (error) {
    console.error('Staff check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const [roles] = await db.execute(
      'SELECT role FROM user_roles WHERE user_id = ? AND role = ?',
      [req.userId, 'admin']
    );

    if (roles.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

module.exports = { authenticate, requireStaff, requireAdmin };
