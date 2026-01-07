const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Debug helper
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] CLOUDINARY: ${message}`);
  if (data !== null) {
    console.log(`[${timestamp}] CLOUDINARY Data:`, JSON.stringify(data, null, 2));
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

const uploadToCloudinary = async (fileBuffer, folder = 'products', options = {}) => {
  debugLog('=== CLOUDINARY UPLOAD START ===');
  debugLog('Upload details:', {
    folder: folder,
    bufferLength: fileBuffer?.length || 0,
    options: options
  });

  // Validate buffer
  if (!fileBuffer || fileBuffer.length === 0) {
    debugLog('ERROR: Empty buffer provided');
    throw new Error('Empty file buffer');
  }

  if (!Buffer.isBuffer(fileBuffer)) {
    debugLog('ERROR: fileBuffer is not a Buffer');
    throw new Error('Invalid buffer format');
  }

  return new Promise((resolve, reject) => {
    try {
      // Configure upload options
      const uploadOptions = {
        folder: folder,
        resource_type: 'auto', // Auto-detect resource type
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' }, // Limit maximum dimensions
          { quality: 'auto:good' } // Auto optimize quality
        ]
      };

      // Add filename if provided
      if (options.originalname) {
        const filename = options.originalname.split('.')[0];
        uploadOptions.public_id = `${folder}/${filename}`;
      }

      debugLog('Cloudinary upload options:', uploadOptions);

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            debugLog('Cloudinary upload error:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            debugLog('Cloudinary upload successful:', {
              url: result.secure_url,
              public_id: result.public_id,
              format: result.format,
              bytes: result.bytes
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
      reject(new Error(`Upload process failed: ${error.message}`));
    }
  });
};

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

// Test function
const testCloudinaryConnection = async () => {
  debugLog('Testing Cloudinary connection...');
  
  try {
    // Create a simple test image (tiny red dot)
    const testBuffer = Buffer.from(
      'R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=',
      'base64'
    );
    
    debugLog('Test buffer created:', { length: testBuffer.length });
    
    const result = await uploadToCloudinary(testBuffer, 'test');
    debugLog('Cloudinary connection test successful:', result);
    return result;
  } catch (error) {
    debugLog('Cloudinary connection test failed:', error.message);
    throw error;
  }
};

module.exports = { 
  uploadToCloudinary, 
  deleteFromCloudinary,
  testCloudinaryConnection 
};