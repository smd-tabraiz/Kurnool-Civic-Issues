const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved'],
    required: true,
  },
  message: {
    type: String,
    default: '',
  },
  image: {
    type: String,
    default: '',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 2000,
    },
    originalDescription: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    issueType: {
      type: String,
      required: [true, 'Issue type is required'],
      enum: ['road', 'power', 'water', 'health', 'sanitation', 'other'],
    },
    location: {
      area: {
        type: String,
        required: [true, 'Area/Village is required'],
        trim: true,
      },
      district: {
        type: String,
        default: 'Kurnool',
      },
      state: {
        type: String,
        default: 'Andhra Pradesh',
      },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    image: {
      type: String,
      default: '',
    },
    resolvedImage: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'resolved'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'low',
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    upvoteCount: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timeline: [timelineEntrySchema],
    isSpam: {
      type: Boolean,
      default: false,
    },
    autoClassified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for search
issueSchema.index({ title: 'text', description: 'text', 'location.area': 'text' });
issueSchema.index({ issueType: 1, status: 1 });
issueSchema.index({ 'location.area': 1 });
issueSchema.index({ createdAt: -1 });

// ===== HYBRID PRIORITY SYSTEM =====
// Priority levels: low(1) < medium(2) < high(3) < urgent(4)
const PRIORITY_LEVELS = { low: 1, medium: 2, high: 3, urgent: 4 };
const PRIORITY_NAMES = { 1: 'low', 2: 'medium', 3: 'high', 4: 'urgent' };

// Emergency keywords → auto-assign priority
const KEYWORD_RULES = {
  urgent: [
    'death', 'died', 'killed', 'fatal', 'collapse', 'collapsed', 'explosion', 'exploded',
    'fire', 'burning', 'electrocution', 'electrocuted', 'flood', 'flooding', 'drowning',
    'gas leak', 'bridge crack', 'bridge collapse', 'building collapse', 'stampede',
    'epidemic', 'outbreak', 'fainting', 'unconscious', 'life threatening', 'emergency',
    'child injured', 'children injured', 'mass casualty', 'toxic', 'poisoning',
    'bomb', 'blast', 'earthquake', 'landslide', 'cyclone', 'tsunami',
  ],
  high: [
    'accident', 'injured', 'injury', 'hospital', 'ambulance', 'bleeding', 'fracture',
    'contaminated', 'sewage mixing', 'no water supply', 'no electricity', 'power cut',
    'dangerous', 'unsafe', 'risk', 'hazard', 'broken bridge', 'deep pothole',
    'pregnant', 'disease', 'dengue', 'malaria', 'cholera', 'diarrhea', 'infection',
    'stray dog attack', 'bite', 'snake', 'electric wire', 'high tension', 'transformer',
    'no doctor', 'medicine shortage', 'closed hospital',
  ],
  medium: [
    'pothole', 'road damage', 'street light', 'water supply', 'drainage', 'garbage',
    'sanitation', 'broken road', 'dust pollution', 'noise pollution', 'traffic',
    'speed breaker', 'waterlogging', 'mosquito', 'stray dog', 'stray animal',
    'bad condition', 'poor condition', 'not working', 'not functioning', 'complaint',
    'encroachment', 'illegal', 'corruption', 'overflowing', 'clogged', 'blocked',
  ],
};

// Category base priority (health issues inherently more critical)
const CATEGORY_BASE_PRIORITY = {
  health: 2,      // medium — involves human lives
  power: 1,       // low — but keywords can escalate
  water: 1,       // low — but keywords can escalate
  road: 1,        // low
  sanitation: 1,   // low
  other: 1,        // low
};

// Analyze text to determine priority from keywords
issueSchema.statics.analyzeTextPriority = function (text) {
  const lowerText = (text || '').toLowerCase();

  for (const keyword of KEYWORD_RULES.urgent) {
    if (lowerText.includes(keyword)) return { level: 4, matchedKeyword: keyword };
  }
  for (const keyword of KEYWORD_RULES.high) {
    if (lowerText.includes(keyword)) return { level: 3, matchedKeyword: keyword };
  }
  for (const keyword of KEYWORD_RULES.medium) {
    if (lowerText.includes(keyword)) return { level: 2, matchedKeyword: keyword };
  }
  return { level: 1, matchedKeyword: null };
};

// Calculate initial priority when issue is first created (text + category)
issueSchema.statics.calculateInitialPriority = function (title, description, category) {
  const fullText = `${title} ${description}`;
  const textAnalysis = this.analyzeTextPriority(fullText);
  const categoryBase = CATEGORY_BASE_PRIORITY[category] || 1;

  // Take the HIGHER of text-based and category-based priority
  const initialLevel = Math.max(textAnalysis.level, categoryBase);

  return {
    priority: PRIORITY_NAMES[initialLevel],
    level: initialLevel,
    source: textAnalysis.matchedKeyword ? 'keyword' : 'category',
    matchedKeyword: textAnalysis.matchedKeyword,
  };
};

// Update priority based on upvotes — can only ESCALATE, never downgrade
issueSchema.methods.updatePriority = function () {
  let upvotePriority = 1; // low
  if (this.upvoteCount >= 50) upvotePriority = 4;       // urgent
  else if (this.upvoteCount >= 25) upvotePriority = 3;   // high
  else if (this.upvoteCount >= 10) upvotePriority = 2;   // medium

  // Get current priority level
  const currentLevel = PRIORITY_LEVELS[this.priority] || 1;

  // Final priority = MAX(current text-based, upvote-based)
  // This ensures priority can only go UP, never DOWN
  const finalLevel = Math.max(currentLevel, upvotePriority);
  this.priority = PRIORITY_NAMES[finalLevel];
};

module.exports = mongoose.model('Issue', issueSchema);

