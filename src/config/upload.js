const multer = require('multer');
const path = require('path');

// Debug helper
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] MULTER: ${message}`);
  if (data !== null) {
    console.log(`[${timestamp}] MULTER Data:`, JSON.stringify(data, null, 2));
  }
};

// Memory storage configuration
const storage = multer.memoryStorage();

// File filter with better validation
const fileFilter = (req, file, cb) => {
  debugLog('=== MULTER FILE FILTER ===');
  debugLog('File received:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  debugLog('File validation:', {
    extname: extname,
    mimetype: mimetype,
    hasExtension: path.extname(file.originalname),
    isImage: file.mimetype.startsWith('image/')
  });

  if (mimetype && extname && file.mimetype.startsWith('image/')) {
    debugLog('✓ File accepted:', file.originalname);
    cb(null, true);
  } else {
    debugLog('✗ Invalid file type:', {
      mimetype: file.mimetype,
      originalname: file.originalname
    });
    cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF, WebP)!'), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 1 // Maximum 1 file for single upload
  },
  fileFilter: fileFilter
});

// Single file upload middleware
const singleUpload = (req, res, next) => {
  debugLog('=== SINGLE UPLOAD MIDDLEWARE START ===');
  debugLog('Request headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });

  const uploadSingle = upload.single('image');
  
  uploadSingle(req, res, (err) => {
    if (err) {
      debugLog('Multer upload error:', err.message);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          message: 'File too large. Maximum size is 5MB' 
        });
      }
      
      if (err.message.includes('Only image files')) {
        return res.status(400).json({ 
          message: 'Invalid file type. Only image files are allowed (JPEG, JPG, PNG, GIF, WebP)' 
        });
      }
      
      return res.status(400).json({ 
        message: 'File upload failed', 
        error: err.message 
      });
    }

    // Log successful upload
    if (req.file) {
      debugLog('✓ File uploaded successfully:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        bufferLength: req.file.buffer?.length || 0
      });
    } else {
      debugLog('No file uploaded');
    }

    debugLog('Request body after multer:', req.body);
    next();
  });
};

// Multiple files upload middleware
const multipleUpload = (req, res, next) => {
  debugLog('=== MULTIPLE UPLOAD MIDDLEWARE START ===');
  
  const uploadMultiple = upload.array('images', 10);
  
  uploadMultiple(req, res, (err) => {
    if (err) {
      debugLog('Multer upload error:', err.message);
      return res.status(400).json({ 
        message: 'File upload failed', 
        error: err.message 
      });
    }

    if (req.files && req.files.length > 0) {
      debugLog(`✓ ${req.files.length} files uploaded successfully`);
      req.files.forEach((file, index) => {
        debugLog(`File ${index + 1}:`, {
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        });
      });
    } else {
      debugLog('No files uploaded');
    }

    next();
  });
};

// Debug middleware
const debugMulter = (req, res, next) => {
  debugLog('=== DEBUG MULTER MIDDLEWARE ===');
  debugLog('Request method:', req.method);
  debugLog('Request URL:', req.originalUrl);
  debugLog('Request headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  debugLog('Request body keys:', Object.keys(req.body));
  
  // Log form data if any
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (key !== 'image') { // Skip image field which is a file
        debugLog(`Body field "${key}":`, req.body[key]);
      }
    });
  }
  
  next();
};

module.exports = {
  singleUpload,
  multipleUpload,
  debugMulter,
  upload
};