'use strict';

module.exports = async () => {
  try {
    const { closeHttpServer } = require('../server');
    await closeHttpServer();
  } catch {
    /* server module may not have started a listener in unit tests */
  }
};
