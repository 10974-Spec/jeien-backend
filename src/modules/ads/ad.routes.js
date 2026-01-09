const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { vendorOrAdmin, adminOnly } = require('../../middlewares/role.middleware');
const { singleUpload } = require('../../config/multer');

const {
  createAd,
  getAllAds,
  getAdById,
  updateAd,
  deleteAd,
  getActiveAds,
  trackAdView,
  trackAdClick,
  getAdAnalytics,
  approveAd
} = require('./ad.controller');

// Add logging middleware
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Test route to debug file upload
router.post('/test-upload', (req, res, next) => {
  console.log('Test upload route hit');
  
  singleUpload(req, res, function(err) {
    if (err) {
      console.error('Multer error in test route:', err);
      return res.status(400).json({ 
        message: 'File upload failed', 
        error: err.message 
      });
    }
    
    console.log('File uploaded successfully in test route:', req.file);
    console.log('Request body in test route:', req.body);
    
    res.json({
      success: true,
      message: 'File received',
      file: req.file,
      body: req.body
    });
  });
});

// Debug route for simple file upload test
router.post('/debug-upload', (req, res) => {
  console.log('=== DEBUG UPLOAD ROUTE HIT ===');
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'authorization': req.headers['authorization'] ? 'Present' : 'Missing'
  });
  
  singleUpload(req, res, function(err) {
    if (err) {
      console.error('Debug upload - Multer error:', err);
      return res.status(400).json({ 
        success: false,
        message: 'File upload failed',
        error: err.message,
        errorType: err.name
      });
    }
    
    console.log('Debug upload - req.file:', req.file);
    console.log('Debug upload - req.body:', req.body);
    
    res.json({
      success: true,
      message: 'File received',
      file: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename
      } : null,
      body: req.body,
      headers: {
        contentType: req.headers['content-type']
      }
    });
  });
});

// Routes with file upload - FIXED VERSION
router.post('/', authenticate, vendorOrAdmin, (req, res, next) => {
  console.log('=== POST /ads ROUTE START ===');
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'authorization': req.headers['authorization'] ? 'Present' : 'Missing'
  });
  
  singleUpload(req, res, function(err) {
    if (err) {
      console.error('=== MULTER UPLOAD ERROR ===');
      console.error('Error:', err);
      console.error('Error message:', err.message);
      return res.status(400).json({ 
        message: 'File upload failed', 
        error: err.message 
      });
    }
    
    console.log('=== MULTER UPLOAD COMPLETE ===');
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
    
    // Check if file was uploaded
    if (!req.file) {
      console.error('=== NO FILE DETECTED ===');
      console.log('Available request properties:', Object.keys(req));
      return res.status(400).json({ 
        message: 'Ad image is required',
        receivedFields: Object.keys(req.body),
        contentType: req.headers['content-type']
      });
    }
    
    console.log('=== FILE UPLOAD SUCCESS ===');
    console.log('File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferLength: req.file.buffer?.length || 0
    });
    
    // Now call the controller function with next
    next();
  });
}, createAd); // Pass createAd as the next middleware

router.get('/', authenticate, vendorOrAdmin, getAllAds);
router.get('/active', getActiveAds);
router.get('/:id', authenticate, vendorOrAdmin, getAdById);

// Update route with file upload - FIXED VERSION
router.put('/:id', authenticate, vendorOrAdmin, (req, res, next) => {
  console.log('=== PUT /ads/:id ROUTE START ===');
  
  singleUpload(req, res, function(err) {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ message: err.message });
    }
    
    console.log('Update route - req.file:', req.file);
    console.log('Update route - req.body:', req.body);
    
    // Now call the controller function with next
    next();
  });
}, updateAd); // Pass updateAd as the next middleware

router.delete('/:id', authenticate, vendorOrAdmin, deleteAd);

router.post('/:id/view', trackAdView);
router.post('/:id/click', trackAdClick);
router.get('/:id/analytics', authenticate, vendorOrAdmin, getAdAnalytics);

router.put('/:id/approve', authenticate, adminOnly, approveAd);

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Ad route error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = router;