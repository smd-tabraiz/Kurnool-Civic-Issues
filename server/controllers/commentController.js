const Comment = require('../models/Comment');
const Issue = require('../models/Issue');
const Notification = require('../models/Notification');

// @desc    Add comment to issue
// @route   POST /api/comments/:issueId
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const issue = await Issue.findById(req.params.issueId);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    const comment = await Comment.create({
      issue: req.params.issueId,
      user: req.user._id,
      text,
      isOfficial: req.user.role === 'admin',
    });

    await comment.populate('user', 'name email avatar role');

    // Update comment count
    issue.commentCount = await Comment.countDocuments({ issue: issue._id });
    await issue.save();

    // Create notification for issue owner (if commenter is not the owner)
    if (issue.reportedBy.toString() !== req.user._id.toString()) {
      const notificationType = req.user.role === 'admin' ? 'admin_response' : 'comment';
      await Notification.create({
        user: issue.reportedBy,
        type: notificationType,
        title: req.user.role === 'admin' ? 'Official Response' : 'New Comment',
        message: `${req.user.name} commented on "${issue.title}"`,
        issue: issue._id,
      });

      // Emit socket notification
      if (req.app.get('io')) {
        req.app.get('io').to(issue.reportedBy.toString()).emit('notification', {
          type: notificationType,
          message: `${req.user.name} commented on "${issue.title}"`,
          issueId: issue._id,
        });

        req.app.get('io').emit('newComment', {
          issueId: issue._id,
          comment,
          commentCount: issue.commentCount,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get comments for an issue
// @route   GET /api/comments/:issueId
exports.getComments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const total = await Comment.countDocuments({ issue: req.params.issueId });
    const comments = await Comment.find({ issue: req.params.issueId })
      .populate('user', 'name email avatar role')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: comments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Only admin or comment owner can delete
    if (req.user.role !== 'admin' && comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    const issueId = comment.issue;
    await Comment.findByIdAndDelete(req.params.id);

    // Update comment count
    const issue = await Issue.findById(issueId);
    if (issue) {
      issue.commentCount = await Comment.countDocuments({ issue: issueId });
      await issue.save();
    }

    res.json({
      success: true,
      message: 'Comment deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
