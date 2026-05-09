const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { listRepos, listGithubRepos, connectRepo, disconnectRepo } = require('../controllers/reposController');

const validateConnect = [
  body('githubRepoId').isNumeric().withMessage('githubRepoId must be a number'),
  body('fullName').matches(/^[\w.-]+\/[\w.-]+$/).withMessage('Invalid fullName format'),
  body('name').isString().notEmpty(),
];

router.use(authenticate);
router.get('/', listRepos);
router.get('/github', listGithubRepos);
router.post('/', validateConnect, connectRepo);
router.delete('/:id', param('id').isUUID(), disconnectRepo);

module.exports = router;
