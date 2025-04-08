/**
 * @file File Service
 * @description Service for file upload, storage, and management with multiple providers
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const cloudinary = require('cloudinary').v2;
const mime = require('mime-types');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * File Service
 * Handles file uploads, processing, and storage across different providers
 */
class FileService {
  constructor() {
    this.initialize();
  }

  /**
   * Initialize file service and set up storage providers
   */
  initialize() {
    try {
      // Set up storage providers based on configuration
      this.provider = config.storage.provider;
      
      switch (this.provider) {
        case 's3':
          this.initializeS3();
          break;
          
        case 'cloudinary':
          this.initializeCloudinary();
          break;
          
        case 'local':
        default:
          this.initializeLocalStorage();
          break;
      }
      
      logger.info('File service initialized', {
        provider: this.provider
      });
    } catch (error) {
      logger.error('Failed to initialize file service', { error });
      throw error;
    }
  }

  /**
   * Initialize AWS S3 client
   */
  initializeS3() {
    try {
      this.s3Client = new S3Client({
        region: config.storage.s3.region,
        credentials: {
          accessKeyId: config.storage.s3.accessKeyId,
          secretAccessKey: config.storage.s3.secretAccessKey
        }
      });
      
      this.s3Bucket = config.storage.s3.bucket;
      this.s3BaseUrl = config.storage.s3.baseUrl;
      
      logger.debug('S3 storage provider initialized');
    } catch (error) {
      logger.error('Failed to initialize S3 client', { error });
      throw error;
    }
  }

  /**
   * Initialize Cloudinary client
   */
  initializeCloudinary() {
    try {
      cloudinary.config({
        cloud_name: config.storage.cloudinary.cloudName,
        api_key: config.storage.cloudinary.apiKey,
        api_secret: config.storage.cloudinary.apiSecret,
        secure: true
      });
      
      this.cloudinaryFolder = config.storage.cloudinary.folder;
      
      logger.debug('Cloudinary storage provider initialized');
    } catch (error) {
      logger.error('Failed to initialize Cloudinary', { error });
      throw error;
    }
  }

  /**
   * Initialize local file storage
   */
  initializeLocalStorage() {
    try {
      this.uploadsDir = config.storage.local.uploadsDir;
      this.baseUrl = config.storage.local.baseUrl;
      
      // Create uploads directory if it doesn't exist
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
        logger.debug(`Created uploads directory: ${this.uploadsDir}`);
      }
      
      // Create subdirectories for different file types
      const subDirs = ['images', 'documents', 'profile-pictures', 'organization-logos', 'portfolio'];
      
      for (const dir of subDirs) {
        const fullPath = path.join(this.uploadsDir, dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
      }
      
      logger.debug('Local storage provider initialized');
    } catch (error) {
      logger.error('Failed to initialize local storage', { error });
      throw error;
    }
  }

  /**
   * Create a unique filename for uploaded files
   * @param {string} originalFilename - Original filename
   * @returns {string} Unique filename
   */
  createUniqueFilename(originalFilename) {
    const extension = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, extension);
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    
    // Create a URL-friendly filename
    const sanitizedBaseName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40);
    
    return `${sanitizedBaseName}-${timestamp}-${randomId}${extension}`;
  }

  /**
   * Determine content type of a file
   * @param {Object} file - File object
   * @returns {string} MIME type
   */
  getContentType(file) {
    // Use provided mimetype if available
    if (file.mimetype) {
      return file.mimetype;
    }
    
    // Try to determine from filename
    const contentType = mime.lookup(file.originalname || file.filename);
    return contentType || 'application/octet-stream';
  }

  /**
   * Upload a file
   * @param {Object} file - File object (e.g., from multer)
   * @param {string} folder - Destination folder
   * @param {Object} options - Upload options
   * @returns {Object} Upload result
   */
  async uploadFile(file, folder = 'documents', options = {}) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Generate a unique filename
      const uniqueFilename = this.createUniqueFilename(file.originalname);
      
      // Get the content type
      const contentType = this.getContentType(file);
      
      // Handle different storage providers
      let result;
      
      switch (this.provider) {
        case 's3':
          result = await this.uploadToS3(file, uniqueFilename, folder, contentType, options);
          break;
          
        case 'cloudinary':
          result = await this.uploadToCloudinary(file, uniqueFilename, folder, options);
          break;
          
        case 'local':
        default:
          result = await this.uploadToLocalStorage(file, uniqueFilename, folder, options);
          break;
      }
      
      logger.info('File uploaded successfully', {
        provider: this.provider,
        folder,
        filename: uniqueFilename,
        size: file.size
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to upload file', {
        error,
        originalFilename: file.originalname,
        folder
      });
      
      throw error;
    }
  }

  /**
   * Upload file to AWS S3
   * @param {Object} file - File object
   * @param {string} filename - Unique filename
   * @param {string} folder - Destination folder
   * @param {string} contentType - File content type
   * @param {Object} options - Upload options
   * @returns {Object} Upload result
   */
  async uploadToS3(file, filename, folder, contentType, options) {
    const key = `${folder}/${filename}`;
    
    // Process image file if needed
    let fileBuffer = file.buffer;
    
    if (contentType.startsWith('image/') && options.resize) {
      fileBuffer = await this.processImage(file.buffer, options.resize);
    }
    
    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: options.acl || 'public-read',
      Metadata: {
        originalFilename: file.originalname
      }
    });
    
    await this.s3Client.send(command);
    
    // Determine dimensions for images
    let width, height;
    if (contentType.startsWith('image/')) {
      const metadata = await sharp(fileBuffer).metadata();
      width = metadata.width;
      height = metadata.height;
    }
    
    // Construct the URL
    const url = `${this.s3BaseUrl}/${key}`;
    
    return {
      url,
      key,
      filename,
      originalName: file.originalname,
      size: fileBuffer.length,
      mimeType: contentType,
      storage: 's3',
      width,
      height,
      folder
    };
  }

  /**
   * Upload file to Cloudinary
   * @param {Object} file - File object
   * @param {string} filename - Unique filename
   * @param {string} folder - Destination folder
   * @param {Object} options - Upload options
   * @returns {Object} Upload result
   */
  async uploadToCloudinary(file, filename, folder, options) {
    // Determine Cloudinary folder path
    const folderPath = this.cloudinaryFolder ? `${this.cloudinaryFolder}/${folder}` : folder;
    
    // Extract file extension
    const extension = path.extname(filename).substring(1);
    
    // Get the file buffer
    const fileBuffer = file.buffer;
    
    // Create a promise to handle the upload
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadOptions = {
        public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension
        folder: folderPath,
        resource_type: 'auto',
        overwrite: true
      };
      
      // Add transformation options for images
      if (file.mimetype.startsWith('image/') && options.resize) {
        uploadOptions.transformation = [
          {
            width: options.resize.width,
            height: options.resize.height,
            crop: options.resize.crop || 'limit'
          }
        ];
      }
      
      // Upload stream
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      // Convert buffer to stream and pipe to upload
      const Readable = require('stream').Readable;
      const stream = new Readable();
      stream.push(fileBuffer);
      stream.push(null);
      stream.pipe(uploadStream);
    });
    
    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      storage: 'cloudinary',
      width: uploadResult.width,
      height: uploadResult.height,
      folder,
      format: uploadResult.format
    };
  }

  /**
   * Upload file to local storage
   * @param {Object} file - File object
   * @param {string} filename - Unique filename
   * @param {string} folder - Destination folder
   * @param {Object} options - Upload options
   * @returns {Object} Upload result
   */
  async uploadToLocalStorage(file, filename, folder, options) {
    // Create folder path
    const folderPath = path.join(this.uploadsDir, folder);
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    const filePath = path.join(folderPath, filename);
    
    // Process image file if needed
    let fileBuffer = file.buffer;
    let width, height;
    
    if (file.mimetype.startsWith('image/') && options.resize) {
      fileBuffer = await this.processImage(file.buffer, options.resize);
      
      // Get image dimensions
      const metadata = await sharp(fileBuffer).metadata();
      width = metadata.width;
      height = metadata.height;
    }
    
    // Write file to disk
    fs.writeFileSync(filePath, fileBuffer);
    
    // Construct the URL
    const url = `${this.baseUrl}/${folder}/${filename}`;
    
    return {
      url,
      path: filePath,
      filename,
      originalName: file.originalname,
      size: fileBuffer.length,
      mimeType: file.mimetype,
      storage: 'local',
      width,
      height,
      folder
    };
  }

  /**
   * Process image file (resize, compress)
   * @param {Buffer} buffer - Image buffer
   * @param {Object} options - Processing options
   * @returns {Buffer} Processed image buffer
   */
  async processImage(buffer, options) {
    try {
      let sharpInstance = sharp(buffer);
      
      // Apply resizing if dimensions provided
      if (options.width || options.height) {
        sharpInstance = sharpInstance.resize(options.width, options.height, {
          fit: options.fit || 'cover',
          withoutEnlargement: true
        });
      }
      
      // Apply quality setting for JPEG/PNG
      if (options.quality) {
        sharpInstance = sharpInstance.jpeg({ quality: options.quality })
                                   .png({ quality: options.quality });
      }
      
      // Convert format if specified
      if (options.format) {
        sharpInstance = sharpInstance.toFormat(options.format, { quality: options.quality });
      }
      
      return await sharpInstance.toBuffer();
    } catch (error) {
      logger.error('Failed to process image', { error });
      // Return original buffer if processing fails
      return buffer;
    }
  }

  /**
   * Upload profile picture with optimizations
   * @param {Object} file - File object
   * @returns {Object} Upload result
   */
  async uploadProfilePicture(file) {
    // Verify the file is an image
    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Profile picture must be an image file');
    }
    
    // Upload with specific options for profile pictures
    return this.uploadFile(file, 'profile-pictures', {
      resize: {
        width: 300,
        height: 300,
        fit: 'cover',
        quality: 85
      }
    });
  }

  /**
   * Upload organization logo with optimizations
   * @param {Object} file - File object
   * @returns {Object} Upload result
   */
  async uploadOrganizationLogo(file) {
    // Verify the file is an image
    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Logo must be an image file');
    }
    
    // Upload with specific options for logos
    return this.uploadFile(file, 'organization-logos', {
      resize: {
        width: 400,
        height: 400,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
        quality: 90
      }
    });
  }

  /**
   * Delete a file
   * @param {Object} fileDetails - File details
   * @returns {boolean} Success status
   */
  async deleteFile(fileDetails) {
    try {
      if (!fileDetails) {
        throw new Error('File details are required');
      }
      
      // Handle different storage providers
      switch (fileDetails.storage) {
        case 's3':
          await this.deleteFromS3(fileDetails.key);
          break;
          
        case 'cloudinary':
          await this.deleteFromCloudinary(fileDetails.publicId);
          break;
          
        case 'local':
        default:
          await this.deleteFromLocalStorage(fileDetails.path);
          break;
      }
      
      logger.info('File deleted successfully', {
        storage: fileDetails.storage,
        filename: fileDetails.filename
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete file', {
        error,
        fileDetails
      });
      
      throw error;
    }
  }

  /**
   * Delete file from AWS S3
   * @param {string} key - S3 object key
   * @returns {boolean} Success status
   */
  async deleteFromS3(key) {
    const command = new DeleteObjectCommand({
      Bucket: this.s3Bucket,
      Key: key
    });
    
    await this.s3Client.send(command);
    return true;
  }

  /**
   * Delete file from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @returns {Object} Deletion result
   */
  async deleteFromCloudinary(publicId) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Delete file from local storage
   * @param {string} filePath - File path
   * @returns {boolean} Success status
   */
  async deleteFromLocalStorage(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  }
}

// Create and export singleton instance
const fileService = new FileService();
module.exports = fileService;