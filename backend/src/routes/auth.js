// ── Auth Routes ───────────────────────────────────────────────────────────────
// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { githubRedirect, githubCallback, getMe, logout } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.get('/github', authLimiter, githubRedirect);
router.get('/github/callback', authLimiter, githubCallback);
router.post('/logout', authLimiter, logout);
router.get('/me', authenticate, getMe);

module.exports = router;
