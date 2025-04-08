/**
 * @file Service Service
 * @description Service layer for service-related operations
 */

const Service = require('./service-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');

/**
 * Service Service
 * Handles all service-related business logic
 */
class ServiceService {
  /**
   * Get all services with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Services with pagination info
   */
  static async getServices(filters = {}, options = {}) {
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
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.status) {
        query.status = filters.status;
      } else {
        // Default to published services only
        query.status = 'published';
      }
      
      if (filters.industry) {
        query.industries = filters.industry;
      }
      
      if (filters.pricingModel) {
        query['pricing.model'] = filters.pricingModel;
      }
      
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { 'description.short': { $regex: filters.search, $options: 'i' } },
          { 'description.detailed': { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const totalCount = await Service.countDocuments(query);
      
      // Execute query with pagination
      const services = await Service.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('consultants', 'professional.title profile.firstName profile.lastName profile.avatarUrl')
        .lean();
      
      return {
        services,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching services:', error);
      throw error;
    }
  }

  /**
   * Get service by ID or slug
   * @param {string} identifier - Service ID or slug
   * @param {Object} options - Optional flags for including related data
   * @returns {Object} Service data
   */
  static async getServiceById(identifier, options = {}) {
    try {
      let query;
      
      // Check if identifier is a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        query = { _id: identifier };
      } else {
        // Otherwise, treat as slug
        query = { slug: identifier };
      }
      
      // Create base query
      let serviceQuery = Service.findOne(query);
      
      // Include related data if requested
      if (options.includeConsultants) {
        serviceQuery = serviceQuery.populate('consultants', 'professional.title profile.firstName profile.lastName profile.avatarUrl');
      }
      
      if (options.includeCaseStudies) {
        serviceQuery = serviceQuery.populate('caseStudies');
      }
      
      if (options.includeTestimonials) {
        serviceQuery = serviceQuery.populate('testimonials');
      }
      
      if (options.includeRelatedServices) {
        serviceQuery = serviceQuery.populate('relatedServices', 'name slug description.short media.featuredImage');
      }
      
      const service = await serviceQuery.exec();
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      // Increment view count if tracking views
      if (options.trackView) {
        service.analytics.views += 1;
        await service.save();
      }
      
      return service;
    } catch (error) {
      logger.error(`Error fetching service by identifier ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Create new service
   * @param {Object} serviceData - Service data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created service
   */
  static async createService(serviceData, userId) {
    try {
      // Check if slug already exists
      if (serviceData.slug) {
        const existingService = await Service.findOne({ slug: serviceData.slug });
        if (existingService) {
          throw new Error('A service with this slug already exists');
        }
      }
      
      // Create new service
      const service = new Service({
        ...serviceData,
        createdBy: userId,
        updatedBy: userId
      });
      
      await service.save();
      
      return service;
    } catch (error) {
      logger.error('Error creating service:', error);
      throw error;
    }
  }

  /**
   * Update service
   * @param {string} serviceId - Service ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated service
   */
  static async updateService(serviceId, updateData, userId) {
    try {
      const service = await Service.findById(serviceId);
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== service.slug) {
        const existingService = await Service.findOne({ slug: updateData.slug });
        if (existingService && !existingService._id.equals(serviceId)) {
          throw new Error('A service with this slug already exists');
        }
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
          service[key] = updateData[key];
        }
      });
      
      // Update metadata
      service.updatedBy = userId;
      
      await service.save();
      
      return service;
    } catch (error) {
      logger.error(`Error updating service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Delete service
   * @param {string} serviceId - Service ID
   * @returns {boolean} Success status
   */
  static async deleteService(serviceId) {
    try {
      const service = await Service.findById(serviceId);
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      await service.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Change service status
   * @param {string} serviceId - Service ID
   * @param {string} status - New status ('draft', 'published', 'archived')
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated service
   */
  static async changeServiceStatus(serviceId, status, userId) {
    try {
      if (!['draft', 'published', 'archived'].includes(status)) {
        throw new Error('Invalid status value');
      }
      
      const service = await Service.findById(serviceId);
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      service.status = status;
      service.updatedBy = userId;
      
      await service.save();
      
      return service;
    } catch (error) {
      logger.error(`Error changing service status ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Upload service image
   * @param {string} serviceId - Service ID
   * @param {Object} file - Image file
   * @param {string} type - Image type ('featured', 'gallery')
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated service
   */
  static async uploadServiceImage(serviceId, file, type, userId) {
    try {
      const service = await Service.findById(serviceId);
      
      if (!service) {
        throw new Error('Service not found');
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
      const uploadResult = await fileService.uploadFile(file, 'services');
      
      // Update service based on image type
      if (type === 'featured') {
        service.media.featuredImage = uploadResult.url;
      } else if (type === 'gallery') {
        if (!service.media.gallery) {
          service.media.gallery = [];
        }
        service.media.gallery.push(uploadResult.url);
      } else {
        throw new Error('Invalid image type specified');
      }
      
      service.updatedBy = userId;
      
      await service.save();
      
      return service;
    } catch (error) {
      logger.error(`Error uploading service image ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get related services
   * @param {string} serviceId - Service ID
   * @param {number} limit - Maximum number of related services
   * @returns {Array} Related services
   */
  static async getRelatedServices(serviceId, limit = 3) {
    try {
      const service = await Service.findById(serviceId);
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      // Find services in the same category
      const relatedServices = await Service.find({
        _id: { $ne: serviceId },
        category: service.category,
        status: 'published'
      })
        .limit(limit)
        .select('name slug description.short media.featuredImage')
        .lean();
      
      return relatedServices;
    } catch (error) {
      logger.error(`Error getting related services ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Record service inquiry
   * @param {string} serviceId - Service ID
   * @returns {boolean} Success status
   */
  static async recordServiceInquiry(serviceId) {
    try {
      const service = await Service.findById(serviceId);
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      service.analytics.inquiries += 1;
      
      // Calculate conversion rate
      if (service.analytics.views > 0) {
        service.analytics.conversionRate = 
          (service.analytics.inquiries / service.analytics.views) * 100;
      }
      
      await service.save();
      
      return true;
    } catch (error) {
      logger.error(`Error recording service inquiry ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get service categories with counts
   * @returns {Array} Categories with service counts
   */
  static async getServiceCategories() {
    try {
      const categories = await Service.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      return categories.map(cat => ({
        name: cat._id,
        count: cat.count
      }));
    } catch (error) {
      logger.error('Error getting service categories:', error);
      throw error;
    }
  }

  /**
   * Get service industries with counts
   * @returns {Array} Industries with service counts
   */
  static async getServiceIndustries() {
    try {
      const industries = await Service.aggregate([
        { $match: { status: 'published' } },
        { $unwind: '$industries' },
        { $group: { _id: '$industries', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      return industries.map(ind => ({
        name: ind._id,
        count: ind.count
      }));
    } catch (error) {
      logger.error('Error getting service industries:', error);
      throw error;
    }
  }
}

module.exports = ServiceService;