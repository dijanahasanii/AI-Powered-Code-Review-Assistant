const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const {
  listRepos,
  listGithubRepos,
  connectRepo,
  disconnectRepo,
  syncRepoWebhook,
  listBranches,
} = require('../controllers/reposController');

function assertValid(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors
      .array()
      .map((e) => e.msg)
      .join('; ');
    return res.status(400).json({ success: false, error: msg || 'Invalid request' });
  }
  next();
}

const validateConnect = [
  body('githubRepoId').isNumeric().withMessage('githubRepoId must be a number'),
  body('fullName').matches(/^[\w.-]+\/[\w.-]+$/).withMessage('Invalid fullName format'),
  body('name').isString().notEmpty(),
];

router.use(authenticate);
router.get('/', listRepos);
router.get('/github', listGithubRepos);
router.post('/', validateConnect, connectRepo);
router.get('/:id/branches', param('id').isUUID(), assertValid, listBranches);
router.post('/:id/sync-webhook', param('id').isUUID(), assertValid, syncRepoWebhook);
router.delete('/:id', param('id').isUUID(), assertValid, disconnectRepo);

module.exports = router;
