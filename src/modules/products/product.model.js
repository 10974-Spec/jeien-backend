const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true,
    minlength: [3, 'Product title must be at least 3 characters'],
    maxlength: [200, 'Product title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    set: v => parseFloat(v.toFixed(2))
  },
  comparePrice: {
    type: Number,
    min: [0, 'Compare price cannot be negative'],
    set: v => v ? parseFloat(v.toFixed(2)) : null
  },
  costPrice: {
    type: Number,
    min: [0, 'Cost price cannot be negative'],
    set: v => v ? parseFloat(v.toFixed(2)) : null
  },
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  sku: {
    type: String,
    trim: true,
    uppercase: true
  },
  barcode: {
    type: String,
    trim: true
  },
  images: [{
    type: String,
    required: [true, 'At least one image is required']
  }],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor is required']
  },
  brand: {
    type: String,
    trim: true
  },
  attributes: [{
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    },
    display: {
      type: String,
      trim: true
    }
  }],
  specifications: [{
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    }
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  approved: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['PHYSICAL', 'DIGITAL', 'SERVICE'],
    default: 'PHYSICAL'
  },
  weight: {
    type: Number,
    min: [0, 'Weight cannot be negative']
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'in', 'm'],
      default: 'cm'
    }
  },
  shipping: {
    required: {
      type: Boolean,
      default: true
    },
    cost: {
      type: Number,
      min: [0, 'Shipping cost cannot be negative'],
      default: 0
    },
    freeShipping: {
      type: Boolean,
      default: false
    },
    estimatedDays: {
      min: Number,
      max: Number
    }
  },
  seo: {
    title: {
      type: String,
      maxlength: [70, 'SEO title cannot exceed 70 characters']
    },
    description: {
      type: String,
      maxlength: [160, 'SEO description cannot exceed 160 characters']
    },
    keywords: [{
      type: String,
      trim: true
    }]
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    sales: {
      type: Number,
      default: 0
    },
    revenue: {
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
    },
    wishlistCount: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    }
  },
  variants: [{
    sku: String,
    price: Number,
    comparePrice: Number,
    stock: Number,
    attributes: [{
      key: String,
      value: String
    }],
    images: [String]
  }],
  relatedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  returnPolicy: {
    days: {
      type: Number,
      min: [0, 'Return days cannot be negative'],
      default: 14
    },
    accepted: {
      type: Boolean,
      default: true
    },
    conditions: String
  },
  warranty: {
    period: {
      type: Number,
      min: [0, 'Warranty period cannot be negative']
    },
    unit: {
      type: String,
      enum: ['days', 'months', 'years'],
      default: 'months'
    },
    details: String
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

ProductSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
  justOne: false
});

ProductSchema.virtual('isOnSale').get(function() {
  return this.comparePrice && this.comparePrice > this.price;
});

ProductSchema.virtual('discountPercentage').get(function() {
  if (!this.comparePrice || this.comparePrice <= this.price) return 0;
  return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
});

ProductSchema.virtual('isInStock').get(function() {
  return this.stock > 0;
});

ProductSchema.virtual('isLowStock').get(function() {
  return this.stock > 0 && this.stock <= 10;
});

ProductSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  if (this.comparePrice && this.comparePrice <= this.price) {
    this.comparePrice = null;
  }

  if (this.images && this.images.length > 10) {
    this.images = this.images.slice(0, 10);
  }

  if (!this.shortDescription && this.description) {
    this.shortDescription = this.description.substring(0, 500);
  }

  next();
});

ProductSchema.pre('validate', function(next) {
  if (this.images && this.images.length === 0) {
    next(new Error('At least one image is required'));
  }
  next();
});

ProductSchema.index({ title: 'text', description: 'text', tags: 'text', brand: 'text' });
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ vendor: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ approved: 1 });
ProductSchema.index({ published: 1 });
ProductSchema.index({ featured: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ 'stats.sales': -1 });
ProductSchema.index({ 'stats.averageRating': -1 });
ProductSchema.index({ 'stats.views': -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Product', ProductSchema);