/**
 * @file Case Study Service
 * @description Service layer for case study-related operations
 */

const CaseStudy = require('./case-study-model');
const Service = require('../services/service-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');

/**
 * Case Study Service
 * Handles all case study-related business logic
 */
class CaseStudyService {
  /**
   * Get all case studies with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Case studies with pagination info
   */
  static async getCaseStudies(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Add filters
      if (filters.industry) {
        query['client.industry'] = filters.industry;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }
      
      if (filters.status) {
        query.status = filters.status;
      } else {
        // Default to published case studies only
        query.status = 'published';
      }
      
      if (filters.featured === true || filters.featured === 'true') {
        query.featured = true;
      }
      
      if (filters.serviceId) {
        query.services = mongoose.Types.ObjectId(filters.serviceId);
      }
      
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { summary: { $regex: filters.search, $options: 'i' } },
          { 'client.name': { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Handle permissions if user role provided
      if (filters.userRole && filters.userRole !== 'admin') {
        query.$or = [
          { 'permissions.isPublic': true },
          { 
            'permissions.requiresAuthentication': true,
            'permissions.allowedRoles': filters.userRole
          }
        ];
      }
      
      // Get total count
      const totalCount = await CaseStudy.countDocuments(query);
      
      // Execute query with pagination
      const caseStudies = await CaseStudy.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({ 
          path: 'services', 
          select: 'name slug category',
          // Add this to handle missing references
          match: { _id: { $exists: true } } 
        })
        .populate('consultants', 'profile.firstName profile.lastName professional.title')
        .lean();
      
      return {
        caseStudies,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching case studies:', error);
      throw error;
    }
  }

  /**
   * Get case study by ID or slug
   * @param {string} identifier - Case study ID or slug
   * @param {Object} options - Optional flags for including related data and tracking
   * @returns {Object} Case study data
   */
  static async getCaseStudyById(identifier, options = {}) {
    try {
      let query;
      
      // Check if identifier is a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        query = { _id: identifier };
      } else {
        // Otherwise, treat as slug
        query = { slug: identifier };
      }
      
      // If checking permissions
      if (options.userRole && options.userRole !== 'admin') {
        query.$or = [
          { 'permissions.isPublic': true },
          { 
            'permissions.requiresAuthentication': true,
            'permissions.allowedRoles': options.userRole
          }
        ];
      }
      
      // Create base query
      let caseStudyQuery = CaseStudy.findOne(query);
      
      // Include related data if requested
      if (options.includeServices) {
        caseStudyQuery = caseStudyQuery.populate('services', 'name slug category description.short');
      }
      
      if (options.includeConsultants) {
        caseStudyQuery = caseStudyQuery.populate('consultants', 'profile.firstName profile.lastName profile.avatarUrl professional.title');
      }
      
      if (options.includeRelatedCaseStudies) {
        caseStudyQuery = caseStudyQuery.populate('relatedCaseStudies', 'title slug summary media.featuredImage');
      }
      
      const caseStudy = await caseStudyQuery.exec();
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      // Increment view count if tracking views
      if (options.trackView) {
        caseStudy.analytics.views += 1;
        await caseStudy.save();
      }
      
      return caseStudy;
    } catch (error) {
      logger.error(`Error fetching case study by identifier ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Create new case study
   * @param {Object} caseStudyData - Case study data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created case study
   */
  static async createCaseStudy(caseStudyData, userId) {
    try {
      // Check if slug already exists
      if (caseStudyData.slug) {
        const existingCaseStudy = await CaseStudy.findOne({ slug: caseStudyData.slug });
        if (existingCaseStudy) {
          throw new Error('A case study with this slug already exists');
        }
      }
      
      // Create new case study
      const caseStudy = new CaseStudy({
        ...caseStudyData,
        createdBy: userId,
        updatedBy: userId
      });
      
      await caseStudy.save();
      
      return caseStudy;
    } catch (error) {
      logger.error('Error creating case study:', error);
      throw error;
    }
  }

  /**
   * Update case study
   * @param {string} caseStudyId - Case study ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated case study
   */
  static async updateCaseStudy(caseStudyId, updateData, userId) {
    try {
      const caseStudy = await CaseStudy.findById(caseStudyId);
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== caseStudy.slug) {
        const existingCaseStudy = await CaseStudy.findOne({ slug: updateData.slug });
        if (existingCaseStudy && !existingCaseStudy._id.equals(caseStudyId)) {
          throw new Error('A case study with this slug already exists');
        }
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
          caseStudy[key] = updateData[key];
        }
      });
      
      // Update metadata
      caseStudy.updatedBy = userId;
      
      await caseStudy.save();
      
      return caseStudy;
    } catch (error) {
      logger.error(`Error updating case study ${caseStudyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete case study
   * @param {string} caseStudyId - Case study ID
   * @returns {boolean} Success status
   */
  static async deleteCaseStudy(caseStudyId) {
    try {
      const caseStudy = await CaseStudy.findById(caseStudyId);
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      await caseStudy.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting case study ${caseStudyId}:`, error);
      throw error;
    }
  }

  /**
   * Change case study status
   * @param {string} caseStudyId - Case study ID
   * @param {string} status - New status ('draft', 'published', 'archived')
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated case study
   */
  static async changeCaseStudyStatus(caseStudyId, status, userId) {
    try {
      if (!['draft', 'published', 'archived'].includes(status)) {
        throw new Error('Invalid status value');
      }
      
      const caseStudy = await CaseStudy.findById(caseStudyId);
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      caseStudy.status = status;
      caseStudy.updatedBy = userId;
      
      await caseStudy.save();
      
      return caseStudy;
    } catch (error) {
      logger.error(`Error changing case study status ${caseStudyId}:`, error);
      throw error;
    }
  }

  /**
   * Upload case study image
   * @param {string} caseStudyId - Case study ID
   * @param {Object} file - Image file
   * @param {string} type - Image type ('featured', 'gallery')
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated case study
   */
  static async uploadCaseStudyImage(caseStudyId, file, type, userId) {
    try {
      const caseStudy = await CaseStudy.findById(caseStudyId);
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'case-studies');
      
      // Update case study based on image type
      if (type === 'featured') {
        caseStudy.media.featuredImage = uploadResult.url;
      } else if (type === 'gallery') {
        if (!caseStudy.media.gallery) {
          caseStudy.media.gallery = [];
        }
        caseStudy.media.gallery.push(uploadResult.url);
      } else if (type === 'client-logo') {
        caseStudy.client.logo = uploadResult.url;
      } else if (type === 'testimonial-avatar') {
        caseStudy.testimonial.avatar = uploadResult.url;
      } else {
        throw new Error('Invalid image type specified');
      }
      
      caseStudy.updatedBy = userId;
      
      await caseStudy.save();
      
      return caseStudy;
    } catch (error) {
      logger.error(`Error uploading case study image ${caseStudyId}:`, error);
      throw error;
    }
  }

  /**
   * Upload downloadable file for case study
   * @param {string} caseStudyId - Case study ID
   * @param {Object} file - File to upload
   * @param {Object} fileInfo - Information about the file
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated case study
   */
  static async uploadCaseStudyFile(caseStudyId, file, fileInfo, userId) {
    try {
      const caseStudy = await CaseStudy.findById(caseStudyId);
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Validate file info
      if (!fileInfo.title) {
        throw new Error('File title is required');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'case-study-downloads');
      
      // Prepare download object
      const download = {
        title: fileInfo.title,
        file: uploadResult.url,
        type: fileInfo.type || file.mimetype.split('/')[1],
        size: fileInfo.size || `${Math.round(file.size / 1024)} KB`,
        isPublic: fileInfo.isPublic !== undefined ? fileInfo.isPublic : true
      };
      
      // Add to downloads array
      if (!caseStudy.downloads) {
        caseStudy.downloads = [];
      }
      
      caseStudy.downloads.push(download);
      caseStudy.updatedBy = userId;
      
      await caseStudy.save();
      
      return caseStudy;
    } catch (error) {
      logger.error(`Error uploading case study file ${caseStudyId}:`, error);
      throw error;
    }
  }

  /**
   * Record download analytics
   * @param {string} caseStudyId - Case study ID
   * @param {string} downloadId - Download ID
   * @returns {boolean} Success status
   */
  static async recordDownload(caseStudyId, downloadId) {
    try {
      const caseStudy = await CaseStudy.findById(caseStudyId);
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      // Increment download count
      caseStudy.analytics.downloads += 1;
      
      await caseStudy.save();
      
      return true;
    } catch (error) {
      logger.error(`Error recording download for case study ${caseStudyId}:`, error);
      throw error;
    }
  }

  /**
   * Get related services for a case study
   * @param {string} caseStudyId - Case study ID
   * @returns {Array} Related services
   */
  static async getRelatedServices(caseStudyId) {
    try {
      const caseStudy = await CaseStudy.findById(caseStudyId).populate('services');
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      // Extract service IDs and industries
      const serviceIds = caseStudy.services.map(service => service._id);
      const industry = caseStudy.client.industry;
      
      // Find other services with the same industry
      const relatedServices = await Service.find({
        _id: { $nin: serviceIds },
        industries: industry,
        status: 'published'
      })
        .limit(3)
        .select('name slug category description.short media.featuredImage')
        .lean();
      
      return relatedServices;
    } catch (error) {
      logger.error(`Error getting related services for case study ${caseStudyId}:`, error);
      throw error;
    }
  }

  /**
   * Get featured case studies
   * @param {number} limit - Maximum number of case studies to return
   * @returns {Array} Featured case studies
   */
  static async getFeaturedCaseStudies(limit = 3) {
    try {
      const featuredCaseStudies = await CaseStudy.find({
        featured: true,
        status: 'published',
        'permissions.isPublic': true
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('services', 'name slug')
        .select('title slug summary client.industry media.featuredImage')
        .lean();
      
      return featuredCaseStudies;
    } catch (error) {
      logger.error('Error getting featured case studies:', error);
      throw error;
    }
  }

  /**
   * Get case study industries with counts
   * @returns {Array} Industries with case study counts
   */
  static async getCaseStudyIndustries() {
    try {
      const industries = await CaseStudy.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$client.industry', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      return industries.map(ind => ({
        name: ind._id,
        count: ind.count
      }));
    } catch (error) {
      logger.error('Error getting case study industries:', error);
      throw error;
    }
  }

  /**
   * Get popular case study tags
   * @param {number} limit - Maximum number of tags to return
   * @returns {Array} Tags with counts
   */
  static async getPopularTags(limit = 10) {
    try {
      const tags = await CaseStudy.aggregate([
        { $match: { status: 'published' } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);
      
      return tags.map(tag => ({
        name: tag._id,
        count: tag.count
      }));
    } catch (error) {
      logger.error('Error getting popular case study tags:', error);
      throw error;
    }
  }
}

module.exports = CaseStudyService;