const { logger } = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // JSON body too large (express.json)
  if (
    err?.status === 413 ||
    err?.type === 'entity.too.large' ||
    /entity too large|request entity too large/i.test(String(err.message))
  ) {
    logger.warn(`413 Payload too large: ${req.url}`);
    return res.status(413).json({
      success: false,
      error: 'Request body is too large. Reduce payload size or increase the Express JSON limit if appropriate.',
    });
  }

  let { statusCode = 500, message } = err;

  // Supabase / PostgreSQL errors
  if (err.code === '23505') {
    statusCode = 409;
    message = 'Resource already exists';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Only log server errors (5xx) with stack trace
  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${message}`, { stack: err.stack, url: req.url });
  } else {
    logger.warn(`${statusCode} - ${message}`, { url: req.url });
  }

  // Never expose internal details in production
  const responseMessage =
    process.env.NODE_ENV === 'production' && statusCode >= 500
      ? 'Internal server error'
      : message;

  res.status(statusCode).json({
    success: false,
    error: responseMessage,
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && { stack: err.stack }),
  });
};

module.exports = { errorHandler, AppError };
