const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (roles = []) => {
  // If roles is string, convert to array
  if (typeof roles === 'string') {
    roles = [roles];
  }

  // Normalize allowed roles to uppercase
  const allowedRoles = roles.map(role => role.toUpperCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role ? req.user.role.toUpperCase() : '';

    if (allowedRoles.length && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Not authorized to access this route' });
    }

    next();
  };
};

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.authorize = authorize;