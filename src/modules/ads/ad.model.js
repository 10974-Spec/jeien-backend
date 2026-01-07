const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Ad title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  image: {
    type: String,
    required: [false, 'Ad image is required']
  },
  thumbnail: {
    type: String
  },
  link: {
    type: String,
    required: [true, 'Ad link is required'],
    trim: true
  },
  linkType: {
    type: String,
    enum: ['PRODUCT', 'CATEGORY', 'VENDOR', 'URL', 'PROMOTION'],
    default: 'URL'
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'linkType'
  },
  owner: {
    type: String,
    required: [true, 'Owner type is required'],
    enum: ['ADMIN', 'VENDOR']
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'owner'
  },
  position: {
    type: String,
    required: [true, 'Ad position is required'],
    enum: ['HOME_TOP', 'HOME_MIDDLE', 'HOME_BOTTOM', 'CATEGORY_TOP', 'PRODUCT_SIDEBAR', 'CHECKOUT', 'SEARCH_RESULTS']
  },
  type: {
    type: String,
    enum: ['BANNER', 'SLIDER', 'POPUP', 'SIDEBAR', 'INLINE'],
    default: 'BANNER'
  },
  active: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  priority: {
    type: Number,
    default: 0,
    min: [0, 'Priority cannot be negative'],
    max: [10, 'Priority cannot exceed 10']
  },
  budget: {
    total: {
      type: Number,
      min: [0, 'Budget cannot be negative'],
      default: 0
    },
    spent: {
      type: Number,
      min: [0, 'Spent amount cannot be negative'],
      default: 0
    },
    dailyLimit: {
      type: Number,
      min: [0, 'Daily limit cannot be negative'],
      default: 0
    },
    costPerClick: {
      type: Number,
      min: [0, 'Cost per click cannot be negative'],
      default: 0
    },
    costPerView: {
      type: Number,
      min: [0, 'Cost per view cannot be negative'],
      default: 0
    }
  },
  targeting: {
    countries: [{
      type: String,
      uppercase: true,
      trim: true
    }],
    cities: [{
      type: String,
      trim: true
    }],
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    minPrice: {
      type: Number,
      min: [0, 'Minimum price cannot be negative']
    },
    maxPrice: {
      type: Number,
      min: [0, 'Maximum price cannot be negative']
    },
    devices: [{
      type: String,
      enum: ['DESKTOP', 'MOBILE', 'TABLET']
    }],
    userRoles: [{
      type: String,
      enum: ['BUYER', 'VENDOR', 'ADMIN']
    }]
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    ctr: {
      type: Number,
      default: 0,
      min: [0, 'CTR cannot be negative'],
      max: [100, 'CTR cannot exceed 100']
    },
    lastViewed: {
      type: Date
    },
    lastClicked: {
      type: Date
    }
  },
  settings: {
    frequency: {
      type: Number,
      default: 1,
      min: [1, 'Frequency must be at least 1'],
      max: [10, 'Frequency cannot exceed 10']
    },
    rotation: {
      type: Boolean,
      default: true
    },
    closeable: {
      type: Boolean,
      default: true
    },
    backgroundColor: {
      type: String,
      default: '#FFFFFF'
    },
    textColor: {
      type: String,
      default: '#000000'
    }
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

AdSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.active && 
         this.startDate <= now && 
         this.endDate >= now &&
         (this.budget.total === 0 || this.budget.spent < this.budget.total) &&
         (this.budget.dailyLimit === 0 || this.getDailySpent() < this.budget.dailyLimit);
});

AdSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

AdSchema.virtual('budgetRemaining').get(function() {
  return this.budget.total - this.budget.spent;
});

AdSchema.methods.getDailySpent = function() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (!this.stats.dailyStats) return 0;
  
  const todayStat = this.stats.dailyStats.find(stat => 
    new Date(stat.date).toDateString() === startOfDay.toDateString()
  );
  
  return todayStat ? todayStat.spent : 0;
};

AdSchema.pre('save', function(next) {
  if (this.stats.views > 0 && this.stats.clicks > 0) {
    this.stats.ctr = (this.stats.clicks / this.stats.views) * 100;
  }

  if (!this.thumbnail && this.image) {
    this.thumbnail = this.image;
  }

  if (this.linkType === 'PRODUCT' || this.linkType === 'CATEGORY' || this.linkType === 'VENDOR') {
    if (!this.targetId) {
      next(new Error(`targetId is required for linkType: ${this.linkType}`));
    }
  }

  next();
});

AdSchema.pre('validate', function(next) {
  if (this.budget.dailyLimit > 0 && this.budget.total > 0 && this.budget.dailyLimit > this.budget.total) {
    next(new Error('Daily limit cannot exceed total budget'));
  }

  if (this.targeting.minPrice && this.targeting.maxPrice && this.targeting.minPrice > this.targeting.maxPrice) {
    next(new Error('Minimum price cannot exceed maximum price'));
  }

  next();
});

AdSchema.index({ position: 1 });
AdSchema.index({ owner: 1, ownerId: 1 });
AdSchema.index({ active: 1 });
AdSchema.index({ startDate: 1 });
AdSchema.index({ endDate: 1 });
AdSchema.index({ 'stats.views': -1 });
AdSchema.index({ 'stats.clicks': -1 });
AdSchema.index({ priority: -1 });
AdSchema.index({ createdAt: -1 });
AdSchema.index({ linkType: 1, targetId: 1 });

module.exports = mongoose.model('Ad', AdSchema);