const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const {
  listReports,
  getReport,
  getReportMarkdown,
  confirmRemediation,
} = require('../controllers/reportsController');

router.use(authenticate);
router.get('/', listReports);

router.get('/:id/markdown', [param('id').isUUID()], getReportMarkdown);
router.post('/:id/confirm-remediation', [param('id').isUUID()], confirmRemediation);
router.get('/:id', [param('id').isUUID()], getReport);

module.exports = router;
