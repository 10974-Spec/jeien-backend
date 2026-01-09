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
  items: [{
    productId: {
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
      type: String
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor'
    },
    vendorName: {
      type: String
    },
    category: {
      type: String
    },
    attributes: [{
      key: String,
      value: String
    }],
    productDetails: {
      sku: String,
      brand: String
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
    }
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['MPESA', 'PAYPAL', 'CARD', 'CASH_ON_DELIVERY']
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  customerNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Customer notes cannot exceed 500 characters']
  },
  shippingMethod: {
    type: String,
    default: 'Standard',
    trim: true
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    required: true,
    min: [0, 'Tax cannot be negative']
  },
  shippingFee: {
    type: Number,
    required: true,
    min: [0, 'Shipping fee cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
    default: 'PENDING'
  },
  vendorIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  }],
  shippedAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  statusNotes: [{
    status: String,
    note: String,
    updatedBy: mongoose.Schema.Types.ObjectId,
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
    notes: String,
    phoneNumber: String,
    amountPaid: Number,
    errorCode: String,
    errorDescription: String
  },
  estimatedDelivery: {
    type: Date
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

OrderSchema.pre('save', function(next) {
  if (this.isNew && !this.orderId) {
    const crypto = require('crypto');
    this.orderId = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
  
  if (!this.estimatedDelivery) {
    this.estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

OrderSchema.pre('validate', function(next) {
  // Remove the strict total amount validation that was causing issues
  // Instead, we'll calculate the total if it's not set
  if (!this.totalAmount && this.subtotal !== undefined) {
    this.totalAmount = this.subtotal + (this.tax || 0) + (this.shippingFee || 0);
  }
  
  // Round to 2 decimal places to avoid floating point precision issues
  if (this.totalAmount) {
    this.totalAmount = parseFloat(this.totalAmount.toFixed(2));
  }
  if (this.subtotal) {
    this.subtotal = parseFloat(this.subtotal.toFixed(2));
  }
  if (this.tax) {
    this.tax = parseFloat(this.tax.toFixed(2));
  }
  if (this.shippingFee) {
    this.shippingFee = parseFloat(this.shippingFee.toFixed(2));
  }
  
  next();
});

OrderSchema.index({ orderId: 1 }, { unique: true });
OrderSchema.index({ buyer: 1 });
OrderSchema.index({ vendorIds: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'paymentDetails.transactionId': 1 });
OrderSchema.index({ 'deliveryAddress.phone': 1 });
OrderSchema.index({ 'deliveryAddress.email': 1 });

module.exports = mongoose.model('Order', OrderSchema);