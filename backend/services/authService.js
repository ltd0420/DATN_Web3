const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and return decoded payload
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key',
      { clockTolerance: 300 }
    );
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  verifyToken
};

