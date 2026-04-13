const Issue = require('../models/Issue');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendCompletionEmail } = require('../utils/emailService');
const { parseIssueWithAI } = require('../utils/aiService');

// Approximate coordinates for Kurnool District areas (for fallback map placement)
const kurnoolCoords = {
  'Kurnool City': { lat: 15.8281, lng: 78.0373 },
  'Nandyal': { lat: 15.4800, lng: 78.4800 },
  'Adoni': { lat: 15.6300, lng: 77.2800 },
  'Yemmiganur': { lat: 15.7333, lng: 77.4833 },
  'Dhone': { lat: 15.3833, lng: 77.8833 },
  'Nandikotkur': { lat: 15.8667, lng: 78.2667 },
  'Allagadda': { lat: 15.1333, lng: 78.5833 },
  'Atmakur': { lat: 15.8833, lng: 78.5833 },
  'Kodumur': { lat: 15.6833, lng: 77.8667 },
  'Mantralayam': { lat: 15.9333, lng: 77.4333 },
  'Gudur': { lat: 15.7667, lng: 77.8167 },
  'Pattikonda': { lat: 15.4000, lng: 77.5000 },
  'Banaganapalle': { lat: 15.3167, lng: 78.2333 },
  'Koilkuntla': { lat: 15.2333, lng: 78.1500 },
  'Srisailam': { lat: 16.0833, lng: 78.8667 },
  'Orvakal': { lat: 15.6667, lng: 78.1167 },
};

// Simple AI classification based on keywords (Fallback)
const classifyIssueType = (description) => {
  const desc = description.toLowerCase();
  const categories = {
    road: ['road', 'pothole', 'highway', 'street', 'traffic', 'bridge', 'footpath', 'pavement', 'tar', 'asphalt', 'rodu', 'rahadari'],
    power: ['power', 'electricity', 'transformer', 'current', 'voltage', 'wire', 'pole', 'blackout', 'outage', 'light', 'vidyut', 'current'],
    water: ['water', 'pipe', 'drainage', 'sewage', 'tap', 'bore', 'tank', 'supply', 'flood', 'leak', 'neeru', 'nilla'],
    health: ['hospital', 'clinic', 'doctor', 'medicine', 'health', 'disease', 'ambulance', 'medical', 'pharmacy', 'sanitation', 'aarogyam'],
    sanitation: ['garbage', 'waste', 'dump', 'trash', 'clean', 'hygiene', 'toilet', 'drain', 'smell', 'mosquito', 'chetha'],
  };

  for (const [type, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => desc.includes(kw))) {
      return type;
    }
  }
  return null;
};

// @desc    Check for duplicate issues
// @route   GET /api/issues/check-duplicate
exports.checkDuplicate = async (req, res) => {
  try {
    const { area, title } = req.query;
    if (!area || !title) return res.json({ success: true, isDuplicate: false });

    // Look for similar open issues in the EXACT SAME area
    const issues = await Issue.find({
      'location.area': area,
      status: { $ne: 'resolved' },
      isSpam: false
    });
    
    // Very simple similarity match (if any word > 4 chars matches)
    const titleWords = title.toLowerCase().split(' ').filter(w => w.length > 4);
    
    let potentialMatch = null;
    if (titleWords.length > 0) {
      potentialMatch = issues.find(i => {
        const existingTitle = i.title.toLowerCase();
        return titleWords.some(tw => existingTitle.includes(tw));
      });
    }

    if (potentialMatch) {
      return res.json({
        success: true,
        isDuplicate: true,
        match: potentialMatch
      });
    }
    
    res.json({ success: true, isDuplicate: false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new issue
// @route   POST /api/issues
exports.createIssue = async (req, res) => {
  try {
    const { title, description, issueType, area, lat, lng } = req.body;

    let finalDescription = description;
    let finalIssueType = issueType;
    let autoClassified = false;
    let finalPriority = null;
    
    // Attempt Advanced NLP parsing via Gemini
    const aiResult = await parseIssueWithAI(`Title: ${title}\nDescription: ${description}`);
    
    if (aiResult) {
      finalDescription = aiResult.description || description;
      
      // Override empty or 'auto' categories with AI categorization
      if (!finalIssueType || finalIssueType === 'auto') {
         finalIssueType = aiResult.category;
         autoClassified = true;
      }
      finalPriority = aiResult.priority;
    } else {
      // Fallback to auto-classify if no issue type provided and AI fails
      if (!finalIssueType || finalIssueType === 'auto') {
        const classified = classifyIssueType(description);
        if (classified) {
          finalIssueType = classified;
          autoClassified = true;
        } else {
          finalIssueType = 'other';
          autoClassified = true;
        }
      }
    }

    // ===== PRIORITY ASSIGNMENT =====
    let priorityAnalysis;
    if (finalPriority) {
      priorityAnalysis = { priority: finalPriority, source: 'Gemini AI', matchedKeyword: null };
    } else {
      priorityAnalysis = Issue.calculateInitialPriority(title, finalDescription, finalIssueType);
    }

    const issueData = {
      title,
      description: finalDescription,
      originalDescription: description,
      issueType: finalIssueType,
      location: {
        area: area || 'Kurnool City',
        district: 'Kurnool',
        state: 'Andhra Pradesh',
        coordinates: {
          lat: lat ? parseFloat(lat) : (kurnoolCoords[area]?.lat + (Math.random() * 0.02 - 0.01) || 15.8281 + (Math.random() * 0.04 - 0.02)),
          lng: lng ? parseFloat(lng) : (kurnoolCoords[area]?.lng + (Math.random() * 0.02 - 0.01) || 78.0373 + (Math.random() * 0.04 - 0.02)),
        },
      },
      reportedBy: req.user._id,
      autoClassified,
      priority: priorityAnalysis.priority,  // Set AI-determined priority
      timeline: [
        {
          status: 'pending',
          message: `Issue reported by citizen. AI Priority: ${priorityAnalysis.priority.toUpperCase()}${priorityAnalysis.matchedKeyword ? ` (detected: "${priorityAnalysis.matchedKeyword}")` : ` (based on ${priorityAnalysis.source})`}`,
          updatedBy: req.user._id,
        },
      ],
    };

    // Handle image upload
    if (req.file) {
      issueData.image = req.file.path || req.file.filename;
    }

    const issue = await Issue.create(issueData);
    await issue.populate('reportedBy', 'name email avatar');

    // Award 10 Civic Points for reporting an issue
    try {
      const user = await User.findById(req.user._id);
      if (user) {
        user.civicPoints += 10;
        await user.save();
      }
    } catch(e) {}

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
      req.app.get('io').emit('newIssue', issue);
    }

    res.status(201).json({
      success: true,
      data: issue,
      priorityAnalysis: {
        priority: priorityAnalysis.priority,
        source: priorityAnalysis.source,
        matchedKeyword: priorityAnalysis.matchedKeyword,
        message: priorityAnalysis.matchedKeyword
          ? `Detected emergency keyword "${priorityAnalysis.matchedKeyword}" → Priority set to ${priorityAnalysis.priority.toUpperCase()}`
          : `Priority set to ${priorityAnalysis.priority.toUpperCase()} based on ${priorityAnalysis.source}`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all issues with filters
// @route   GET /api/issues
exports.getIssues = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      issueType,
      status,
      location,
      search,
      sort = '-createdAt',
      priority,
      reportedBy,
    } = req.query;

    const query = { isSpam: false };
    
    if (reportedBy) query.reportedBy = reportedBy;

    if (issueType && issueType !== 'all') query.issueType = issueType;
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (location) query['location.area'] = { $regex: location, $options: 'i' };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.area': { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Issue.countDocuments(query);
    const issues = await Issue.find(query)
      .populate('reportedBy', 'name email avatar')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: issues,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single issue
// @route   GET /api/issues/:id
exports.getIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'name email avatar')
      .populate('timeline.updatedBy', 'name role');

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    res.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Toggle upvote on issue
// @route   PUT /api/issues/:id/upvote
exports.toggleUpvote = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    const userId = req.user._id;
    const hasUpvoted = issue.upvotes.includes(userId);

    if (hasUpvoted) {
      issue.upvotes = issue.upvotes.filter((id) => id.toString() !== userId.toString());
    } else {
      issue.upvotes.push(userId);
    }

    issue.upvoteCount = issue.upvotes.length;
    issue.updatePriority();
    await issue.save();

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('issueUpdated', {
        issueId: issue._id,
        upvoteCount: issue.upvoteCount,
        priority: issue.priority,
      });
    }

    res.json({
      success: true,
      data: {
        upvoteCount: issue.upvoteCount,
        hasUpvoted: !hasUpvoted,
        priority: issue.priority,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update issue status (Admin only)
// @route   PUT /api/issues/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status, message } = req.body;

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    let resolvedImagePath = '';
    if (req.file) {
      resolvedImagePath = req.file.path || req.file.filename;
      if (status === 'resolved') {
        issue.resolvedImage = resolvedImagePath;
      }
    }

    issue.status = status;
    issue.timeline.push({
      status,
      message: message || `Status updated to ${status}`,
      updatedBy: req.user._id,
      image: resolvedImagePath
    });

    await issue.save();
    
    // Populate for the response so the UI has all info immediately
    await issue.populate([
      { path: 'reportedBy', select: 'name email avatar' },
      { path: 'timeline.updatedBy', select: 'name' }
    ]);

    // Create notification
    const reporterId = issue.reportedBy._id || issue.reportedBy;
    await Notification.create({
      user: reporterId,
      type: 'status_update',
      title: 'Issue Status Updated',
      message: `Your issue "${issue.title}" has been updated to ${status}`,
      issue: issue._id,
    });

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('statusUpdate', {
        issueId: issue._id,
        status: issue.status,
        timeline: issue.timeline,
      });

      // Send notification via socket
      req.app.get('io').to(reporterId.toString()).emit('notification', {
        type: 'status_update',
        message: `Your issue "${issue.title}" status changed to ${status}`,
        issueId: issue._id,
      });
    }

    // Notify via email if resolved and award civic points
    if (status === 'resolved') {
      // Award 50 Civic Points for having an issue verified and solved
      try {
        const user = await User.findById(reporterId);
        if (user) {
          user.civicPoints += 50;
          await user.save();
        }
      } catch(e) {}
      
      if (issue.reportedBy && issue.reportedBy.email) {
        sendCompletionEmail(issue.reportedBy.email, issue.reportedBy.name, issue.title);
      }
    }

    // Send response ONCE at the end
    res.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete issue (Admin or Owner)
// @route   DELETE /api/issues/:id
exports.deleteIssue = async (req, res) => {
  try {
    console.log(`[DELETE] Attempting to delete issue: ${req.params.id} by user: ${req.user.email} (Role: ${req.user.role})`);
    
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      console.log(`[DELETE] Issue ${req.params.id} not found`);
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    // Only admin or issue owner can delete
    const isOwner = issue.reportedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    console.log(`[DELETE] User permissions - IsAdmin: ${isAdmin}, IsOwner: ${isOwner}`);

    if (!isAdmin && !isOwner) {
      console.log(`[DELETE] Unauthorized attempt by ${req.user.email}`);
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this issue',
      });
    }

    await Issue.findByIdAndDelete(req.params.id);
    console.log(`[DELETE] Successfully deleted issue ${req.params.id}`);

    if (req.app.get('io')) {
      req.app.get('io').emit('issueDeleted', { issueId: req.params.id });
    }

    res.json({
      success: true,
      message: 'Issue deleted successfully',
    });
  } catch (error) {
    console.error(`[DELETE] Error deleting issue:`, error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Mark issue as spam (Admin only)
// @route   PUT /api/issues/:id/spam
exports.markAsSpam = async (req, res) => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { isSpam: true },
      { new: true }
    );

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    res.json({
      success: true,
      message: 'Issue marked as spam',
      data: issue,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get analytics data (Admin)
// @route   GET /api/issues/analytics
exports.getAnalytics = async (req, res) => {
  try {
    // Total counts
    const totalIssues = await Issue.countDocuments({ isSpam: false });
    const pendingIssues = await Issue.countDocuments({ status: 'pending', isSpam: false });
    const inProgressIssues = await Issue.countDocuments({ status: 'in-progress', isSpam: false });
    const resolvedIssues = await Issue.countDocuments({ status: 'resolved', isSpam: false });

    // Category-wise
    const categoryStats = await Issue.aggregate([
      { $match: { isSpam: false } },
      {
        $group: {
          _id: '$issueType',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Location-wise
    const locationStats = await Issue.aggregate([
      { $match: { isSpam: false } },
      {
        $group: {
          _id: '$location.area',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);

    // Monthly trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await Issue.aggregate([
      {
        $match: {
          isSpam: false,
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Priority distribution
    const priorityStats = await Issue.aggregate([
      { $match: { isSpam: false } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent urgent issues
    const urgentIssues = await Issue.find({
      priority: { $in: ['high', 'urgent'] },
      isSpam: false,
      status: { $ne: 'resolved' },
    })
      .sort('-upvoteCount')
      .limit(5)
      .populate('reportedBy', 'name');

    res.json({
      success: true,
      data: {
        overview: {
          total: totalIssues,
          pending: pendingIssues,
          inProgress: inProgressIssues,
          resolved: resolvedIssues,
        },
        categoryStats,
        locationStats,
        monthlyTrends,
        priorityStats,
        urgentIssues,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get map data (all issues with coordinates)
// @route   GET /api/issues/map
exports.getMapData = async (req, res) => {
  try {
    const issues = await Issue.find({
      isSpam: false,
    })
      .select('title issueType status location upvoteCount priority')
      .limit(500);

    // Retroactively patch coordinate fallbacks for past issues in-memory before sending to client
    const mappedIssues = issues.map(issue => {
      const issueObj = issue.toObject();
      if (!issueObj.location.coordinates || issueObj.location.coordinates.lat === null) {
        const area = issueObj.location.area;
        issueObj.location.coordinates = {
          lat: (kurnoolCoords[area]?.lat + (Math.random() * 0.02 - 0.01) || 15.8281 + (Math.random() * 0.04 - 0.02)),
          lng: (kurnoolCoords[area]?.lng + (Math.random() * 0.02 - 0.01) || 78.0373 + (Math.random() * 0.04 - 0.02)),
        };
      }
      return issueObj;
    });

    res.json({
      success: true,
      data: mappedIssues,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
