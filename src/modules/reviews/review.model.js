const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Buyer is required']
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Comment is required'],
    trim: true,
    minlength: [10, 'Comment must be at least 10 characters'],
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },
  images: [{
    type: String
  }],
  attributes: [{
    key: {
      type: String,
      trim: true
    },
    value: {
      type: String,
      trim: true
    },
    rating: {
      type: Number,
      min: [1, 'Attribute rating must be at least 1'],
      max: [5, 'Attribute rating cannot exceed 5']
    }
  }],
  verifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpful: {
    count: {
      type: Number,
      default: 0
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  reported: {
    count: {
      type: Number,
      default: 0
    },
    reasons: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: {
        type: String,
        enum: ['SPAM', 'INAPPROPRIATE', 'FALSE_INFO', 'OTHER']
      },
      comment: String,
      reportedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'],
    default: 'PENDING'
  },
  moderatorNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Moderator notes cannot exceed 500 characters']
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  reply: {
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Reply cannot exceed 2000 characters']
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    repliedAt: {
      type: Date
    },
    updatedAt: {
      type: Date
    }
  },
  helpfulVotes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  flags: {
    hasImages: {
      type: Boolean,
      default: false
    },
    hasReply: {
      type: Boolean,
      default: false
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    }
  },
  editHistory: [{
    comment: String,
    rating: Number,
    editedAt: {
      type: Date,
      default: Date.now
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceType: String
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      delete ret.helpfulVotes;
      delete ret.reported;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      delete ret.helpfulVotes;
      delete ret.reported;
      return ret;
    }
  }
});

ReviewSchema.virtual('buyerInfo', {
  ref: 'User',
  localField: 'buyer',
  foreignField: '_id',
  justOne: true,
  select: 'name profileImage verified'
});

ReviewSchema.virtual('productInfo', {
  ref: 'Product',
  localField: 'product',
  foreignField: '_id',
  justOne: true,
  select: 'title images slug'
});

ReviewSchema.virtual('vendorInfo', {
  ref: 'Vendor',
  localField: 'vendor',
  foreignField: '_id',
  justOne: true,
  select: 'storeName storeLogo'
});

ReviewSchema.virtual('isHelpful').get(function() {
  return this.helpful.count > 0;
});

ReviewSchema.virtual('age').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
});

ReviewSchema.pre('save', function(next) {
  this.flags.hasImages = this.images && this.images.length > 0;
  this.flags.hasReply = !!this.reply && !!this.reply.comment;
  
  if (this.helpfulVotes && this.helpfulVotes.length > 0) {
    this.helpful.count = this.helpfulVotes.length;
    this.helpful.users = this.helpfulVotes.map(vote => vote.user);
  }

  if (this.images && this.images.length > 5) {
    this.images = this.images.slice(0, 5);
  }

  if (this.status === 'APPROVED' && !this.moderatedBy) {
    this.moderatedBy = null;
    this.moderatedAt = new Date();
  }

  next();
});

ReviewSchema.pre('validate', function(next) {
  if (this.rating < 1 || this.rating > 5) {
    next(new Error('Rating must be between 1 and 5'));
  }

  if (this.attributes) {
    for (const attr of this.attributes) {
      if (attr.rating && (attr.rating < 1 || attr.rating > 5)) {
        next(new Error('Attribute rating must be between 1 and 5'));
      }
    }
  }

  next();
});

ReviewSchema.index({ product: 1 });
ReviewSchema.index({ vendor: 1 });
ReviewSchema.index({ buyer: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ status: 1 });
ReviewSchema.index({ 'helpful.count': -1 });
ReviewSchema.index({ createdAt: -1 });
ReviewSchema.index({ verifiedPurchase: 1 });
ReviewSchema.index({ product: 1, buyer: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);