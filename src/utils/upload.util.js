const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Debug helper
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] UPLOAD_UTIL: ${message}`);
  if (data !== null) {
    console.log(`[${timestamp}] UPLOAD_UTIL Data:`, data);
  }
};

const extractPublicId = (url) => {
  if (!url) return null;
  try {
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^\.]+)?$/);
    return matches ? matches[1] : null;
  } catch (error) {
    return null;
  }
};

const uploadMultipleImages = async (files, folder = 'products') => {
  debugLog('=== UPLOAD MULTIPLE IMAGES START ===');
  debugLog('Files received count:', files ? files.length : 0);

  if (!files || files.length === 0) {
    throw new Error('No images provided');
  }

  // First, check what we actually received
  debugLog('File inspection:', {
    firstFile: files[0] ? {
      hasBuffer: !!files[0].buffer,
      bufferType: files[0].buffer ? typeof files[0].buffer : 'no buffer',
      bufferLength: files[0].buffer ? files[0].buffer.length : 0,
      originalname: files[0].originalname,
      mimetype: files[0].mimetype,
      size: files[0].size
    } : 'No files'
  });

  // Check if files have buffers
  const filesWithBuffers = files.filter(file => file.buffer && file.buffer.length > 0);
  
  if (filesWithBuffers.length === 0) {
    debugLog('ERROR: No files have buffers!');
    debugLog('All files:', files.map(f => ({
      name: f.originalname,
      hasBuffer: !!f.buffer,
      bufferLength: f.buffer ? f.buffer.length : 0
    })));
    throw new Error('All uploaded files are empty. Please check your file upload configuration.');
  }

  debugLog(`Files with buffers: ${filesWithBuffers.length}/${files.length}`);

  const uploadPromises = filesWithBuffers.map((file, index) => {
    return new Promise((resolve, reject) => {
      debugLog(`Uploading file ${index + 1}: ${file.originalname} (${file.size} bytes)`);
      
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
          overwrite: false
        },
        (error, result) => {
          if (error) {
            debugLog(`Upload failed for ${file.originalname}:`, error.message);
            reject(new Error(`Failed to upload ${file.originalname}: ${error.message}`));
          } else {
            debugLog(`Upload successful for ${file.originalname}:`, result.secure_url);
            resolve(result.secure_url);
          }
        }
      );

      // Create a stream from buffer
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);
      
      bufferStream.pipe(uploadStream);
    });
  });

  try {
    const uploadedUrls = await Promise.all(uploadPromises);
    debugLog(`Successfully uploaded ${uploadedUrls.length} images`);
    return uploadedUrls;
  } catch (error) {
    debugLog('Multiple image upload failed:', error.message);
    throw new Error(`Failed to upload images: ${error.message}`);
  }
};

const uploadSingleImage = async (file, folder = 'profiles') => {
  debugLog('=== UPLOAD SINGLE IMAGE START ===');
  
  if (!file) {
    throw new Error('No file provided');
  }

  if (!file.buffer || file.buffer.length === 0) {
    debugLog('ERROR: File has no buffer or empty buffer:', {
      name: file.originalname,
      hasBuffer: !!file.buffer,
      bufferLength: file.buffer ? file.buffer.length : 0
    });
    throw new Error('File data is empty');
  }

  return new Promise((resolve, reject) => {
    debugLog(`Uploading single file: ${file.originalname}`);
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) {
          debugLog('Upload error:', error);
          reject(new Error(`Upload failed: ${error.message}`));
        } else {
          debugLog('Upload successful:', result.secure_url);
          resolve(result.secure_url);
        }
      }
    );

    // Create stream from buffer
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);
    
    bufferStream.pipe(uploadStream);
  });
};

const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;
  
  const publicId = extractPublicId(imageUrl);
  if (!publicId) return;
  
  try {
    await cloudinary.uploader.destroy(publicId);
    debugLog(`Deleted image: ${publicId}`);
  } catch (error) {
    debugLog('Delete error:', error.message);
  }
};

const deleteMultipleImages = async (imageUrls) => {
  if (!imageUrls || imageUrls.length === 0) return;
  
  const deletePromises = imageUrls.map(url => {
    const publicId = extractPublicId(url);
    return publicId ? cloudinary.uploader.destroy(publicId) : Promise.resolve();
  });
  
  await Promise.all(deletePromises);
  debugLog(`Deleted ${imageUrls.length} images`);
};

const validateImageFile = (file) => {
  debugLog('=== VALIDATE IMAGE FILE ===');
  debugLog('File info:', {
    name: file?.originalname,
    hasBuffer: !!file?.buffer,
    bufferLength: file?.buffer?.length || 0,
    size: file?.size,
    type: file?.mimetype
  });

  if (!file) {
    throw new Error('No file provided');
  }

  if (!file.originalname) {
    throw new Error('Missing filename');
  }

  if (!file.mimetype) {
    throw new Error('Missing file type');
  }

  // CRITICAL FIX: Check if file has ANY data at all
  if (!file.buffer && !file.path && file.size === 0) {
    debugLog('ERROR: File has no data at all');
    throw new Error('File is completely empty');
  }

  // If buffer exists but is empty
  if (file.buffer && file.buffer.length === 0) {
    debugLog('ERROR: Buffer exists but is empty');
    throw new Error('File buffer is empty');
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WebP`);
  }

  // Check file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 10MB)`);
  }

  if (file.size <= 0) {
    throw new Error('File is empty');
  }

  debugLog('File validation passed');
  return true;
};

module.exports = {
  uploadMultipleImages,
  uploadSingleImage,
  deleteImage,
  deleteMultipleImages,
  validateImageFile,
  extractPublicId
};