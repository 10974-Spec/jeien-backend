const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: true
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
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    title: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    image: {
      type: String,
      required: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    attributes: [{
      key: String,
      value: String
    }],
    variant: {
      sku: String,
      attributes: [{
        key: String,
        value: String
      }]
    }
  }],
  deliveryAddress: {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    additionalInfo: {
      type: String,
      trim: true,
      maxlength: [500, 'Additional info cannot exceed 500 characters']
    }
  },
  shippingAddress: {
    fullName: String,
    phone: String,
    country: String,
    city: String,
    street: String,
    postalCode: String
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: [0, 'Shipping cost cannot be negative']
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: [0, 'Tax amount cannot be negative']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  commissionAmount: {
    type: Number,
    default: 0,
    min: [0, 'Commission amount cannot be negative']
  },
  vendorAmount: {
    type: Number,
    default: 0,
    min: [0, 'Vendor amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['MPESA', 'PAYPAL', 'CARD', 'CASH_ON_DELIVERY']
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
    default: 'PENDING'
  },
  paymentDetails: {
    transactionId: String,
    reference: String,
    provider: String,
    paidAt: Date,
    currency: {
      type: String,
      default: 'KES'
    },
    receiptUrl: String,
    notes: String
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'ON_HOLD'],
    default: 'PENDING'
  },
  shippingMethod: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  shippingProvider: {
    type: String,
    trim: true
  },
  estimatedDelivery: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  customerNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Customer notes cannot exceed 500 characters']
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceType: String,
    browser: String
  },
  flags: {
    isGift: {
      type: Boolean,
      default: false
    },
    giftMessage: String,
    requiresSignature: {
      type: Boolean,
      default: false
    },
    isFragile: {
      type: Boolean,
      default: false
    },
    isExpress: {
      type: Boolean,
      default: false
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

OrderSchema.virtual('buyerInfo', {
  ref: 'User',
  localField: 'buyer',
  foreignField: '_id',
  justOne: true
});

OrderSchema.virtual('vendorInfo', {
  ref: 'Vendor',
  localField: 'vendor',
  foreignField: '_id',
  justOne: true
});

OrderSchema.virtual('productInfo', {
  ref: 'Product',
  localField: 'items.product',
  foreignField: '_id',
  justOne: false
});

OrderSchema.pre('save', function(next) {
  if (this.isNew) {
    this.orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  
  if (!this.shippingAddress || Object.keys(this.shippingAddress).length === 0) {
    this.shippingAddress = { ...this.deliveryAddress };
  }
  
  if (this.vendorAmount === 0 && this.totalAmount > 0 && this.commissionAmount === 0) {
    this.vendorAmount = this.totalAmount;
  } else if (this.commissionAmount > 0) {
    this.vendorAmount = this.totalAmount - this.commissionAmount;
  }
  
  next();
});

OrderSchema.pre('validate', function(next) {
  if (this.items && this.items.length === 0) {
    next(new Error('Order must contain at least one item'));
  }
  
  const calculatedTotal = this.subtotal + this.shippingCost + this.taxAmount - this.discountAmount;
  if (Math.abs(calculatedTotal - this.totalAmount) > 0.01) {
    next(new Error('Total amount calculation is incorrect'));
  }
  
  next();
});

OrderSchema.index({ orderId: 1 }, { unique: true });
OrderSchema.index({ buyer: 1 });
OrderSchema.index({ vendor: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'paymentDetails.transactionId': 1 });
OrderSchema.index({ trackingNumber: 1 });
OrderSchema.index({ 'deliveryAddress.phone': 1 });
OrderSchema.index({ 'deliveryAddress.email': 1 });
OrderSchema.index({ totalAmount: -1 });

module.exports = mongoose.model('Order', OrderSchema);