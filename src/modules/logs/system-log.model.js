const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema({
    level: {
        type: String,
        enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'],
        default: 'INFO'
    },
    category: {
        type: String,
        enum: ['PAYMENT', 'ORDER', 'SYSTEM', 'AUTH'],
        default: 'SYSTEM'
    },
    message: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Index for fast retrieval
SystemLogSchema.index({ createdAt: -1 });
SystemLogSchema.index({ category: 1, createdAt: -1 });
SystemLogSchema.index({ level: 1 });

module.exports = mongoose.model('SystemLog', SystemLogSchema);
