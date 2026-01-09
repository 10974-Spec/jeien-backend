const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Debug helper
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] UPLOAD UTIL: ${message}`);
  if (data !== null) {
    console.log(`[${timestamp}] UPLOAD UTIL Data:`, JSON.stringify(data, null, 2));
  }
};

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Convert buffer to stream
const bufferToStream = (buffer) => {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
};

// MAIN UPLOAD FUNCTION - SIMPLIFIED
const uploadToCloudinary = async (fileBuffer, folder = 'general', options = {}) => {
  debugLog('=== UPLOAD TO CLOUDINARY START ===');
  debugLog('Upload details:', {
    folder: folder,
    bufferLength: fileBuffer?.length || 0,
    bufferType: typeof fileBuffer,
    isBuffer: Buffer.isBuffer(fileBuffer),
    options: options
  });

  // Validate buffer
  if (!fileBuffer) {
    debugLog('ERROR: No buffer provided');
    throw new Error('No file buffer provided');
  }

  if (!Buffer.isBuffer(fileBuffer)) {
    debugLog('ERROR: fileBuffer is not a Buffer');
    debugLog('Buffer type:', typeof fileBuffer);
    debugLog('Buffer value:', fileBuffer);
    throw new Error('Invalid buffer format - expected Buffer');
  }

  if (fileBuffer.length === 0) {
    debugLog('ERROR: Empty buffer provided');
    throw new Error('Empty file buffer');
  }

  return new Promise((resolve, reject) => {
    try {
      // Configure upload options - SIMPLIFIED
      const uploadOptions = {
        folder: folder,
        resource_type: 'image', // Force image type
        use_filename: true,
        unique_filename: true,
        overwrite: false
      };

      // Add filename if provided
      if (options.originalname) {
        const filename = options.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
        const sanitized = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
        uploadOptions.public_id = `${folder}/${sanitized}_${Date.now()}`;
      }

      debugLog('Cloudinary upload options:', uploadOptions);

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            debugLog('Cloudinary upload error:', error);
            debugLog('Error details:', {
              message: error.message,
              http_code: error.http_code,
              name: error.name
            });
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            debugLog('Cloudinary upload successful:', {
              url: result.secure_url,
              public_id: result.public_id,
              format: result.format,
              bytes: result.bytes,
              width: result.width,
              height: result.height
            });
            resolve(result.secure_url);
          }
        }
      );

      // Convert buffer to stream and pipe it
      const bufferStream = bufferToStream(fileBuffer);
      bufferStream.pipe(uploadStream);

      // Handle stream errors
      bufferStream.on('error', (error) => {
        debugLog('Buffer stream error:', error);
        reject(new Error(`Buffer stream error: ${error.message}`));
      });

      uploadStream.on('error', (error) => {
        debugLog('Upload stream error:', error);
        reject(new Error(`Upload stream error: ${error.message}`));
      });

    } catch (error) {
      debugLog('Error in upload process:', error);
      debugLog('Error stack:', error.stack);
      reject(new Error(`Upload process failed: ${error.message}`));
    }
  });
};

// UPLOAD MULTIPLE IMAGES - FIXED FUNCTION
const uploadMultipleImages = async (files, folder = 'products') => {
  debugLog('=== UPLOAD MULTIPLE IMAGES START ===');
  debugLog('Number of files:', files.length);
  debugLog('Folder:', folder);

  try {
    const uploadPromises = files.map((file, index) => {
      debugLog(`Processing file ${index + 1}:`, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        bufferLength: file.buffer?.length || 0
      });

      return uploadToCloudinary(file.buffer, folder, {
        originalname: file.originalname,
        mimetype: file.mimetype
      });
    });

    debugLog('Starting upload of all images...');
    const results = await Promise.all(uploadPromises);
    debugLog('All images uploaded successfully:', results.length);
    
    return results;

  } catch (error) {
    debugLog('ERROR in uploadMultipleImages:', error.message);
    debugLog('ERROR stack:', error.stack);
    throw error;
  }
};

// DELETE MULTIPLE IMAGES - FIXED FUNCTION
const deleteMultipleImages = async (imageUrls) => {
  debugLog('=== DELETE MULTIPLE IMAGES START ===');
  debugLog('Number of images to delete:', imageUrls.length);
  
  try {
    if (!imageUrls || imageUrls.length === 0) {
      debugLog('No images to delete');
      return [];
    }

    const deletePromises = imageUrls.map(async (imageUrl) => {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = imageUrl.split('/');
        const filenameWithExtension = urlParts[urlParts.length - 1];
        const publicId = filenameWithExtension.split('.')[0];
        const folder = urlParts[urlParts.length - 2];
        
        const fullPublicId = `${folder}/${publicId}`;
        debugLog('Deleting image with public_id:', fullPublicId);
        
        const result = await cloudinary.uploader.destroy(fullPublicId);
        return { url: imageUrl, success: result.result === 'ok' };
      } catch (error) {
        debugLog(`Failed to delete image ${imageUrl}:`, error.message);
        return { url: imageUrl, success: false, error: error.message };
      }
    });

    const results = await Promise.all(deletePromises);
    const successful = results.filter(r => r.success).length;
    
    debugLog(`Delete results: ${successful}/${results.length} successful`);
    return results;

  } catch (error) {
    debugLog('ERROR in deleteMultipleImages:', error.message);
    debugLog('ERROR stack:', error.stack);
    throw error;
  }
};

// Simplified upload single image function
const uploadSingleImage = async (file, folder = 'general') => {
  debugLog('=== UPLOAD SINGLE IMAGE ===');
  debugLog('File details:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    bufferLength: file.buffer?.length || 0
  });

  try {
    if (!file || !file.buffer) {
      debugLog('ERROR: No file or buffer provided');
      throw new Error('No file or buffer provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      debugLog('ERROR: Invalid file type:', file.mimetype);
      throw new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      debugLog('ERROR: File too large:', file.size);
      throw new Error(`File too large: ${file.size} bytes. Maximum size: ${maxSize} bytes (5MB)`);
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(file.buffer, folder, {
      originalname: file.originalname,
      mimetype: file.mimetype
    });

    debugLog('Image uploaded successfully:', result);
    return result;

  } catch (error) {
    debugLog('ERROR in uploadSingleImage:', error.message);
    debugLog('ERROR stack:', error.stack);
    throw error;
  }
};

// Delete from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  debugLog('Deleting from Cloudinary:', publicId);
  
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    debugLog('Cloudinary deletion result:', result);
    return result;
  } catch (error) {
    debugLog('Cloudinary deletion error:', error);
    throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
  }
};

// Test Cloudinary connection
const testCloudinaryConnection = async () => {
  debugLog('=== TESTING CLOUDINARY CONNECTION ===');
  
  try {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || 
        !process.env.CLOUDINARY_API_KEY || 
        !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary environment variables are not set');
    }

    debugLog('Cloudinary configuration found:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not set',
      api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set'
    });

    // Simple test by checking Cloudinary configuration
    await cloudinary.api.ping();
    debugLog('Cloudinary connection successful!');
    
    return { success: true, message: 'Cloudinary is configured and accessible' };

  } catch (error) {
    debugLog('Cloudinary connection test failed:', error.message);
    throw error;
  }
};

module.exports = { 
  uploadToCloudinary, 
  uploadSingleImage,
  uploadMultipleImages,  // ADDED THIS
  deleteFromCloudinary,
  deleteMultipleImages,  // ADDED THIS
  testCloudinaryConnection 
};