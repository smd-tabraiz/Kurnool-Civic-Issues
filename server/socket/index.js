const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const Comment = require('../models/Comment');
const { sendCompletionEmail } = require('../utils/emailService');

const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join user's personal room for notifications
    socket.on('joinRoom', (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their notification room`);
    });

    // --- REAL-TIME DATA FETCHING ---
    socket.on('fetch_issues', async (filters, callback) => {
      try {
        const query = { isSpam: false };
        if (filters?.issueType && filters.issueType !== 'all') query.issueType = filters.issueType;
        if (filters?.status && filters.status !== 'all') query.status = filters.status;
        
        const issues = await Issue.find(query)
          .populate('reportedBy', 'name email avatar')
          .sort('-createdAt')
          .limit(50);
        
        callback({ success: true, data: issues });
      } catch (error) {
        callback({ success: false, message: error.message });
      }
    });

    // --- REAL-TIME ISSUE DETAILS ---
    socket.on('fetch_issue', async (id, callback) => {
      try {
        const issue = await Issue.findById(id).populate('reportedBy', 'name email avatar');
        callback({ success: true, data: issue });
      } catch (error) { callback({ success: false, message: error.message }); }
    });

    // --- REAL-TIME COMMENTS ---
    socket.on('fetch_comments', async (issueId, callback) => {
      try {
        const comments = await Comment.find({ issue: issueId }).populate('user', 'name avatar').sort('-createdAt');
        callback({ success: true, data: comments });
      } catch (error) { callback({ success: false, message: error.message }); }
    });

    socket.on('add_comment', async ({ issueId, userId, text, isOfficial }, callback) => {
      try {
        const comment = await Comment.create({ issue: issueId, user: userId, text, isOfficial });
        await comment.populate('user', 'name avatar');
        await Issue.findByIdAndUpdate(issueId, { $inc: { commentCount: 1 } });
        
        io.emit('newComment', comment);
        
        callback({ success: true, data: comment });
      } catch (error) { callback({ success: false, message: error.message }); }
    });

    // --- REAL-TIME UPVOTING ---
    socket.on('toggle_upvote', async ({ issueId, userId }, callback) => {
      try {
        const issue = await Issue.findById(issueId);
        if (!issue) return callback({ success: false, message: 'Not found' });
        
        const index = issue.upvotes.indexOf(userId);
        let hasUpvoted = false;
        
        if (index === -1) {
            issue.upvotes.push(userId);
            issue.upvoteCount += 1;
            hasUpvoted = true;
        } else {
            issue.upvotes.splice(index, 1);
            issue.upvoteCount -= 1;
        }
        
        issue.updatePriority();
        await issue.save();
        
        io.emit('issueUpdated', { issueId, upvoteCount: issue.upvoteCount, priority: issue.priority, hasUpvoted });
        callback({ success: true, data: { hasUpvoted, upvoteCount: issue.upvoteCount, priority: issue.priority } });
      } catch (error) { callback({ success: false, message: error.message }); }
    });

    // --- REAL-TIME STATUS UPDATES ---
    socket.on('update_status', async ({ issueId, status, message, adminId }, callback) => {
      try {
        const issue = await Issue.findById(issueId);
        if (!issue) return callback({ success: false, message: 'Issue not found' });

        issue.status = status;
        issue.timeline.push({
          status,
          message: message || `Status updated to ${status}`,
          updatedBy: adminId,
        });

        await issue.save();

        // Broadcast change globally
        io.emit('statusUpdate', { issueId, status, timeline: issue.timeline });

        // Private notification to reporter
        io.to(issue.reportedBy.toString()).emit('notification', {
          type: 'status_update',
          message: `Your issue "${issue.title}" status changed to ${status}`,
          issueId: issue._id,
        });

        // Send Email Notification if resolved
        if (status === 'resolved') {
          await issue.populate('reportedBy', 'name email');
          if (issue.reportedBy && issue.reportedBy.email) {
            sendCompletionEmail(issue.reportedBy.email, issue.reportedBy.name, issue.title);
          }
        }

        callback({ success: true, data: issue });
      } catch (error) {
        callback({ success: false, message: error.message });
      }
    });

    socket.on('leaveRoom', (userId) => {
      socket.leave(userId);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocket;
