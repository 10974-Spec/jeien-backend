const multer = require('multer');
const path = require('path');

// Memory storage configuration
const storage = multer.memoryStorage({
  // This ensures buffers are created properly
  destination: function (req, file, cb) {
    cb(null, '');
  },
  filename: function (req, file, cb) {
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  console.log('=== MULTER FILE FILTER ===');
  console.log('File:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    console.log('File accepted:', file.originalname);
    return cb(null, true);
  } else {
    console.error('Invalid file type:', file.mimetype);
    return cb(new Error('Only image files are allowed!'), false);
  }
};

// Multer configuration with proper limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // Maximum 10 files
    parts: 20, // Maximum 20 parts (fields + files)
    headerPairs: 50 // Maximum 50 header key=>value pairs
  },
  fileFilter: fileFilter
});

const singleUpload = upload.single('image');
const multipleUpload = upload.array('images', 10);

// Debug middleware to check what multer receives
const debugMulter = (req, res, next) => {
  console.log('=== MULTER DEBUG MIDDLEWARE ===');
  console.log('Request headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  console.log('Request body keys:', Object.keys(req.body));
  next();
};

module.exports = {
  singleUpload,
  multipleUpload,
  debugMulter,
  upload
};