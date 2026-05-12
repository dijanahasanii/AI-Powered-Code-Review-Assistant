const express = require('express');
const router = express.Router();
const { handleGithubWebhook, describeGithubWebhookEndpoint } = require('../controllers/webhookController');

// Note: body is raw Buffer — express.raw() applied in server.js for this path
router.get('/github', describeGithubWebhookEndpoint);
router.post('/github', handleGithubWebhook);

module.exports = router;
