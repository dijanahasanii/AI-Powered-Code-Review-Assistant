'use strict';

/**
 * Jest runs globalTeardown in a separate context — setupFiles env is not applied there.
 * Load test env before requiring server (which loads database.js and exits without SUPABASE_*).
 */
module.exports = async () => {
  require('./setup.js');

  try {
    const { closeHttpServer } = require('../server');
    await closeHttpServer();
  } catch {
    /* server module may not have started a listener in unit tests */
  }
};
