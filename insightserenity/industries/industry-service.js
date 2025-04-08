/**
 * @file Industry Service
 * @description Service layer for industry-related operations
 */

const Industry = require('./industry-model');
const Service = require('../services/service-model');
const CaseStudy = require('../case-studies/case-study-model');
const Consultant = require('../users/consultant-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');

/**
 * Industry Service
 * Handles all industry-related business logic
 */
class IndustryService {
  /**
   * Get all industries with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Industries with pagination info
   */
  static async getIndustries(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'name';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Add filters
      if (filters.status) {
        query.status = filters.status;
      } else {
        // Default to published industries only
        query.status = 'published';
      }
      
      if (filters.featured === true || filters.featured === 'true') {
        query.featured = true;
      }
      
      if (filters.expertiseLevel) {
        query.expertiseLevel = filters.expertiseLevel;
      }
      
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { 'description.short': { $regex: filters.search, $options: 'i' } },
          { 'description.detailed': { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const totalCount = await Industry.countDocuments(query);
      
      // Execute query with pagination
      let industriesQuery = Industry.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);
        
      // Handle population of related data
      if (options.includeServiceOfferings) {
        industriesQuery = industriesQuery.populate('serviceOfferings', 'name slug description.short');
      }
      
      if (options.includeCaseStudies) {
        industriesQuery = industriesQuery.populate('caseStudies', 'title slug summary client.name');
      }
      
      if (options.includeConsultants) {
        industriesQuery = industriesQuery.populate('consultants', 'profile.firstName profile.lastName professional.title');
      }
      
      if (options.includeRelatedIndustries) {
        industriesQuery = industriesQuery.populate('relatedIndustries', 'name slug description.short');
      }
      
      const industries = await industriesQuery.lean();
      
      return {
        industries,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching industries:', error);
      throw error;
    }
  }

  /**
   * Get industry by ID or slug
   * @param {string} identifier - Industry ID or slug
   * @param {Object} options - Optional flags for including related data and tracking
   * @returns {Object} Industry data
   */
  static async getIndustryById(identifier, options = {}) {
    try {
      let query;
      
      // Check if identifier is a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        query = { _id: identifier };
      } else {
        // Otherwise, treat as slug
        query = { slug: identifier };
      }
      
      // Include status filter if not showing all
      if (!options.showAll) {
        query.status = 'published';
      }
      
      // Create base query
      let industryQuery = Industry.findOne(query);
      
      // Include related data if requested
      if (options.includeServiceOfferings) {
        industryQuery = industryQuery.populate('serviceOfferings', 'name slug description.short media.featuredImage');
      }
      
      if (options.includeCaseStudies) {
        industryQuery = industryQuery.populate('caseStudies', 'title slug summary client.name media.featuredImage');
      }
      
      if (options.includeConsultants) {
        industryQuery = industryQuery.populate('consultants', 'profile.firstName profile.lastName profile.avatarUrl professional.title');
      }
      
      if (options.includeRelatedIndustries) {
        industryQuery = industryQuery.populate('relatedIndustries', 'name slug description.short featuredImage');
      }
      
      const industry = await industryQuery.exec();
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      // Increment view count if tracking views
      if (options.trackView) {
        industry.analytics.views += 1;
        await industry.save();
      }
      
      return industry;
    } catch (error) {
      logger.error(`Error fetching industry by identifier ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Create new industry
   * @param {Object} industryData - Industry data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created industry
   */
  static async createIndustry(industryData, userId) {
    try {
      // Check if slug already exists
      if (industryData.slug) {
        const existingIndustry = await Industry.findOne({ slug: industryData.slug });
        if (existingIndustry) {
          throw new Error('An industry with this slug already exists');
        }
      }
      
      // Create new industry
      const industry = new Industry({
        ...industryData,
        createdBy: userId,
        updatedBy: userId
      });
      
      await industry.save();
      
      return industry;
    } catch (error) {
      logger.error('Error creating industry:', error);
      throw error;
    }
  }

  /**
   * Update industry
   * @param {string} industryId - Industry ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async updateIndustry(industryId, updateData, userId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== industry.slug) {
        const existingIndustry = await Industry.findOne({ slug: updateData.slug });
        if (existingIndustry && !existingIndustry._id.equals(industryId)) {
          throw new Error('An industry with this slug already exists');
        }
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
          industry[key] = updateData[key];
        }
      });
      
      // Update metadata
      industry.updatedBy = userId;
      
      await industry.save();
      
      return industry;
    } catch (error) {
      logger.error(`Error updating industry ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Delete industry
   * @param {string} industryId - Industry ID
   * @returns {boolean} Success status
   */
  static async deleteIndustry(industryId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      // Check if there are any services referencing this industry
      const servicesCount = await Service.countDocuments({ industries: industryId });
      if (servicesCount > 0) {
        throw new Error(`Cannot delete industry that is referenced by ${servicesCount} services`);
      }
      
      // Check if there are any case studies referencing this industry
      const caseStudiesCount = await CaseStudy.countDocuments({ 'client.industry': industry.name });
      if (caseStudiesCount > 0) {
        throw new Error(`Cannot delete industry that is referenced by ${caseStudiesCount} case studies`);
      }
      
      // Remove this industry from any consultants' expertise
      await Consultant.updateMany(
        { 'expertise.industries': industry.name },
        { $pull: { 'expertise.industries': industry.name } }
      );
      
      // Remove this industry from any other industries' related industries
      await Industry.updateMany(
        { relatedIndustries: industryId },
        { $pull: { relatedIndustries: industryId } }
      );
      
      await industry.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting industry ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Change industry status
   * @param {string} industryId - Industry ID
   * @param {string} status - New status ('draft', 'published', 'archived')
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async changeIndustryStatus(industryId, status, userId) {
    try {
      if (!['draft', 'published', 'archived'].includes(status)) {
        throw new Error('Invalid status value');
      }
      
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      industry.status = status;
      industry.updatedBy = userId;
      
      await industry.save();
      
      return industry;
    } catch (error) {
      logger.error(`Error changing industry status ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Upload industry image (featured or banner)
   * @param {string} industryId - Industry ID
   * @param {Object} file - Image file
   * @param {string} type - Image type ('featured', 'banner')
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async uploadIndustryImage(industryId, file, type, userId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
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
      const uploadResult = await fileService.uploadFile(file, 'industries');
      
      // Update industry based on image type
      if (type === 'featured') {
        industry.featuredImage = uploadResult.url;
      } else if (type === 'banner') {
        industry.banner = uploadResult.url;
      } else {
        throw new Error('Invalid image type specified');
      }
      
      industry.updatedBy = userId;
      
      await industry.save();
      
      return industry;
    } catch (error) {
      logger.error(`Error uploading industry image ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Add a service offering to an industry
   * @param {string} industryId - Industry ID
   * @param {string} serviceId - Service ID
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async addServiceOffering(industryId, serviceId, userId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      const service = await Service.findById(serviceId);
      
      if (!service) {
        throw new Error('Service not found');
      }
      
      // Check if service is already added
      if (industry.serviceOfferings.includes(serviceId)) {
        throw new Error('This service is already associated with the industry');
      }
      
      // Add service to industry
      industry.serviceOfferings.push(serviceId);
      industry.updatedBy = userId;
      
      await industry.save();
      
      // Add industry to service's industries if not already there
      if (!service.industries.includes(industry.name)) {
        service.industries.push(industry.name);
        await service.save();
      }
      
      return industry;
    } catch (error) {
      logger.error(`Error adding service offering to industry ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a service offering from an industry
   * @param {string} industryId - Industry ID
   * @param {string} serviceId - Service ID
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async removeServiceOffering(industryId, serviceId, userId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      // Check if service exists in industry
      if (!industry.serviceOfferings.includes(serviceId)) {
        throw new Error('This service is not associated with the industry');
      }
      
      // Remove service from industry
      industry.serviceOfferings = industry.serviceOfferings.filter(id => !id.equals(serviceId));
      industry.updatedBy = userId;
      
      await industry.save();
      
      // Remove industry from service's industries
      const service = await Service.findById(serviceId);
      if (service) {
        service.industries = service.industries.filter(ind => ind !== industry.name);
        await service.save();
      }
      
      return industry;
    } catch (error) {
      logger.error(`Error removing service offering from industry ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Add a case study to an industry
   * @param {string} industryId - Industry ID
   * @param {string} caseStudyId - Case Study ID
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async addCaseStudy(industryId, caseStudyId, userId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      const caseStudy = await CaseStudy.findById(caseStudyId);
      
      if (!caseStudy) {
        throw new Error('Case study not found');
      }
      
      // Check if case study is already added
      if (industry.caseStudies.includes(caseStudyId)) {
        throw new Error('This case study is already associated with the industry');
      }
      
      // Add case study to industry
      industry.caseStudies.push(caseStudyId);
      industry.updatedBy = userId;
      
      await industry.save();
      
      // Update case study's client industry if not already set
      if (!caseStudy.client.industry || caseStudy.client.industry !== industry.name) {
        caseStudy.client.industry = industry.name;
        await caseStudy.save();
      }
      
      return industry;
    } catch (error) {
      logger.error(`Error adding case study to industry ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a case study from an industry
   * @param {string} industryId - Industry ID
   * @param {string} caseStudyId - Case Study ID
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async removeCaseStudy(industryId, caseStudyId, userId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      // Check if case study exists in industry
      if (!industry.caseStudies.includes(caseStudyId)) {
        throw new Error('This case study is not associated with the industry');
      }
      
      // Remove case study from industry
      industry.caseStudies = industry.caseStudies.filter(id => !id.equals(caseStudyId));
      industry.updatedBy = userId;
      
      await industry.save();
      
      return industry;
    } catch (error) {
      logger.error(`Error removing case study from industry ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Add a consultant to an industry
   * @param {string} industryId - Industry ID
   * @param {string} consultantId - Consultant ID
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async addConsultant(industryId, consultantId, userId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      const consultant = await Consultant.findById(consultantId);
      
      if (!consultant) {
        throw new Error('Consultant not found');
      }
      
      // Check if consultant is already added
      if (industry.consultants.includes(consultantId)) {
        throw new Error('This consultant is already associated with the industry');
      }
      
      // Add consultant to industry
      industry.consultants.push(consultantId);
      industry.updatedBy = userId;
      
      await industry.save();
      
      // Add industry to consultant's expertise if not already there
      if (!consultant.expertise.industries.includes(industry.name)) {
        consultant.expertise.industries.push(industry.name);
        await consultant.save();
      }
      
      return industry;
    } catch (error) {
      logger.error(`Error adding consultant to industry ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a consultant from an industry
   * @param {string} industryId - Industry ID
   * @param {string} consultantId - Consultant ID
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated industry
   */
  static async removeConsultant(industryId, consultantId, userId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      // Check if consultant exists in industry
      if (!industry.consultants.includes(consultantId)) {
        throw new Error('This consultant is not associated with the industry');
      }
      
      // Remove consultant from industry
      industry.consultants = industry.consultants.filter(id => !id.equals(consultantId));
      industry.updatedBy = userId;
      
      await industry.save();
      
      // Remove industry from consultant's expertise
      const consultant = await Consultant.findById(consultantId);
      if (consultant) {
        consultant.expertise.industries = consultant.expertise.industries.filter(ind => ind !== industry.name);
        await consultant.save();
      }
      
      return industry;
    } catch (error) {
      logger.error(`Error removing consultant from industry ${industryId}:`, error);
      throw error;
    }
  }

  /**
   * Get expertise distribution
   * Returns counts of consultants by industry for analytics
   * @returns {Array} Industry expertise distribution
   */
  static async getExpertiseDistribution() {
    try {
      const industries = await Industry.find({ status: 'published' })
        .select('name consultants')
        .populate('consultants', '_id')
        .lean();
      
      return industries.map(industry => ({
        name: industry.name,
        consultantsCount: industry.consultants ? industry.consultants.length : 0
      })).sort((a, b) => b.consultantsCount - a.consultantsCount);
    } catch (error) {
      logger.error('Error getting industry expertise distribution:', error);
      throw error;
    }
  }

  /**
   * Record contact request for an industry
   * @param {string} industryId - Industry ID
   * @returns {boolean} Success status
   */
  static async recordContactRequest(industryId) {
    try {
      const industry = await Industry.findById(industryId);
      
      if (!industry) {
        throw new Error('Industry not found');
      }
      
      industry.analytics.contactRequests += 1;
      
      // Calculate conversion rate
      if (industry.analytics.views > 0) {
        industry.analytics.conversionRate = 
          (industry.analytics.contactRequests / industry.analytics.views) * 100;
      }
      
      await industry.save();
      
      return true;
    } catch (error) {
      logger.error(`Error recording contact request for industry ${industryId}:`, error);
      throw error;
    }
  }
}

module.exports = IndustryService;