const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const { supabase } = require('../config/database');
const { getJwtFromRequest } = require('../utils/authCookie');

const authenticate = async (req, res, next) => {
  try {
    const token = getJwtFromRequest(req);
    if (!token) {
      throw new AppError('No token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists in database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, github_id, username, email, avatar_url')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      throw new AppError('User not found', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate };
