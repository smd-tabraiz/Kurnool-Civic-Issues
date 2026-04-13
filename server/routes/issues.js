const express = require('express');
const router = express.Router();
const {
  createIssue,
  getIssues,
  getIssue,
  toggleUpvote,
  updateStatus,
  deleteIssue,
  markAsSpam,
  getAnalytics,
  getMapData,
  checkDuplicate,
} = require('../controllers/issueController');
const { protect, adminOnly } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Public routes
router.get('/check-duplicate', checkDuplicate);
router.get('/', getIssues);
router.get('/map', getMapData);
router.get('/analytics', getAnalytics);
router.get('/:id', getIssue);

// Protected routes
router.post('/', protect, upload.single('image'), createIssue);
router.put('/:id/upvote', protect, toggleUpvote);
router.delete('/:id', protect, deleteIssue);

// Admin routes
router.put('/:id/status', protect, adminOnly, upload.single('image'), updateStatus);
router.put('/:id/spam', protect, adminOnly, markAsSpam);

module.exports = router;
