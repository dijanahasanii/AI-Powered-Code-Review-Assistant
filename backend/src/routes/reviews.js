const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const {
  listReviews,
  getReview,
  triggerReview,
  triggerLatestReview,
  retryPendingAnalyze,
  getStats,
} = require('../controllers/reviewsController');

router.use(authenticate);
router.get('/', listReviews);
router.get('/stats', getStats);

router.post('/retry/:id', [param('id').isUUID()], retryPendingAnalyze);

router.post('/trigger', [
  body('repositoryId').isUUID(),
  body('commitSha').isLength({ min: 7, max: 40 }),
], triggerReview);

router.post('/trigger/latest', [body('repositoryId').isUUID()], triggerLatestReview);

router.get('/:id', getReview);

module.exports = router;
