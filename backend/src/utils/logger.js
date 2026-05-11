const winston = require('winston');

function formatMeta(rest) {
  const meta = {};
  for (const [k, v] of Object.entries(rest)) {
    if (typeof k !== 'string') continue;
    if (k === 'splat' || k === 'level' || k === 'timestamp') continue;
    if (k.startsWith('Symbol(')) continue;
    try {
      meta[k] = v;
    } catch {
      meta[k] = String(v);
    }
  }
  return meta;
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { level, message, timestamp, stack, ...rest } = info;
    const meta = formatMeta(rest);
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const head = `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
    return stack ? `${head}\n${stack}` : head;
  })
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = { logger };
