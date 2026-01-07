const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true
  },
  storeName: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true,
    minlength: [3, 'Store name must be at least 3 characters'],
    maxlength: [100, 'Store name cannot exceed 100 characters']
  },
  storeLogo: {
    type: String,
    default: null
  },
  storeBanner: {
    type: String,
    default: null
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  bankDetails: {
    provider: {
      type: String,
      enum: ['MPESA', 'BANK', 'PAYPAL', 'OTHER'],
      default: 'MPESA'
    },
    accountName: {
      type: String,
      trim: true
    },
    accountNumber: {
      type: String,
      trim: true
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    },
    branch: {
      type: String,
      trim: true
    }
  },
  contactInfo: {
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  active: {
    type: Boolean,
    default: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  commissionRate: {
    type: Number,
    default: null,
    min: [0, 'Commission rate cannot be negative'],
    max: [50, 'Commission rate cannot exceed 50%']
  },
  settings: {
    autoApproveProducts: {
      type: Boolean,
      default: true
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [1, 'Low stock threshold must be at least 1']
    },
    allowReviews: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    totalProducts: {
      type: Number,
      default: 0
    },
    totalSales: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5']
    },
    totalReviews: {
      type: Number,
      default: 0
    }
  },
  performance: {
    lastMonthSales: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    fulfillmentRate: {
      type: Number,
      default: 0
    }
  },
  socialLinks: {
    website: {
      type: String,
      trim: true
    },
    facebook: {
      type: String,
      trim: true
    },
    twitter: {
      type: String,
      trim: true
    },
    instagram: {
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

VendorSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'vendor',
  justOne: false
});

VendorSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'vendor',
  justOne: false
});

VendorSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'vendor',
  justOne: false
});

VendorSchema.index({ user: 1 }, { unique: true });
VendorSchema.index({ storeName: 1 });
VendorSchema.index({ active: 1 });
VendorSchema.index({ verified: 1 });
VendorSchema.index({ 'stats.totalSales': -1 });
VendorSchema.index({ 'stats.averageRating': -1 });
VendorSchema.index({ createdAt: -1 });

VendorSchema.pre('save', function(next) {
  if (this.isModified('storeName')) {
    this.storeName = this.storeName.trim();
  }
  next();
});

module.exports = mongoose.model('Vendor', VendorSchema);