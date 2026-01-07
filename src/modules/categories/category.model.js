const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Category name must be at least 2 characters'],
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  image: {
    type: String,
    default: null
  },
  icon: {
    type: String,
    default: null
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  commissionRate: {
    type: Number,
    default: parseFloat(process.env.DEFAULT_COMMISSION_RATE || 10),
    min: [0, 'Commission rate cannot be negative'],
    max: [50, 'Commission rate cannot exceed 50%']
  },
  featured: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
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
    totalProducts: {
      type: Number,
      default: 0
    },
    totalVendors: {
      type: Number,
      default: 0
    },
    totalSales: {
      type: Number,
      default: 0
    }
  },
  filters: {
    attributes: [{
      name: String,
      type: {
        type: String,
        enum: ['text', 'number', 'boolean', 'select', 'multiselect']
      },
      values: [String],
      required: Boolean,
      searchable: Boolean
    }],
    priceRanges: [{
      min: Number,
      max: Number,
      label: String
    }]
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

CategorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  justOne: false
});

CategorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  justOne: false
});

CategorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  
  if (this.commissionRate === undefined) {
    this.commissionRate = parseFloat(process.env.DEFAULT_COMMISSION_RATE || 10);
  }
  
  next();
});

CategorySchema.pre('validate', function(next) {
  if (this.parent && this.parent.equals(this._id)) {
    next(new Error('Category cannot be its own parent'));
  }
  next();
});

CategorySchema.index({ name: 1 }, { unique: true });
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parent: 1 });
CategorySchema.index({ active: 1 });
CategorySchema.index({ featured: 1 });
CategorySchema.index({ sortOrder: 1 });
CategorySchema.index({ 'stats.totalProducts': -1 });
CategorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Category', CategorySchema);