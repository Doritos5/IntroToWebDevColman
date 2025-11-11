const Log = require('../models/logModel');
const logger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const message = `${method} ${url}`;
    console.log(`[${timestamp}] ${method} ${url}`);
    Log.create({
    level: 'info',
    message,
    meta: { method, url, timestamp }
  }).catch((err) => {
    console.error('[Logger] Failed to save log', err.message);
  });

  next();
};

const logError = (msg, error, meta = {}) => {
  console.error('[ERROR]', msg, error?.message || '');

  Log.create({
    level: 'error',
    message: msg,
    meta: {
      ...meta,
      error: error
        ? { message: error.message, stack: error.stack }
        : undefined
    }
  }).catch((err) => {
    console.error('[Logger] Failed to save error log', err.message);
  });
};

const logInfo = (msg, meta = {}) => {
  const timestamp = new Date().toISOString();

  console.log('[INFO]', `[${timestamp}]`, msg, meta);

  Log.create({
    level: 'info',
    message: msg,
    meta: { ...meta, timestamp }
  }).catch((err) => {
    console.error('[Logger] Failed to save info log', err.message);
  });
};

module.exports = { logger, logInfo, logError };