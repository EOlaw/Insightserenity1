/**
 * @file Report Service
 * @description Service layer for report-related operations
 */

const Report = require('./report-model');
const ReportTemplate = require('./template-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');
const fs = require('fs').promises;
const path = require('path');

/**
 * Report Service
 * Handles all report-related business logic
 */
class ReportService {
  /**
   * Get all reports with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Reports with pagination info
   */
  static async getReports(filters = {}, options = {}) {
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
      if (filters.client) {
        query.client = mongoose.Types.ObjectId(filters.client);
      }
      
      if (filters.consultant) {
        query.consultant = mongoose.Types.ObjectId(filters.consultant);
      }
      
      if (filters.project) {
        query.project = mongoose.Types.ObjectId(filters.project);
      }
      
      if (filters.organization) {
        query.organization = mongoose.Types.ObjectId(filters.organization);
      }
      
      if (filters.template) {
        query.template = mongoose.Types.ObjectId(filters.template);
      }
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.isTemplate !== undefined) {
        query.isTemplate = filters.isTemplate;
      } else {
        // By default, exclude templates
        query.isTemplate = false;
      }
      
      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        
        if (filters.dateTo) {
          const dateTo = new Date(filters.dateTo);
          dateTo.setHours(23, 59, 59, 999); // End of day
          query.createdAt.$lte = dateTo;
        }
      }
      
      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        query['metadata.tags'] = { $in: filters.tags };
      }
      
      // Search filter
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { 'metadata.reportNumber': { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const totalCount = await Report.countDocuments(query);
      
      // Execute query with pagination
      const reports = await Report.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('client', 'company.name')
        .populate('consultant', 'profile.firstName profile.lastName professional.title')
        .populate('project', 'name')
        .populate('template', 'name category')
        .lean();
      
      return {
        reports,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching reports:', error);
      throw error;
    }
  }

  /**
   * Get report by ID
   * @param {string} reportId - Report ID
   * @param {Object} options - Optional flags for including related data
   * @returns {Object} Report data
   */
  static async getReportById(reportId, options = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        throw new Error('Invalid report ID format');
      }
      
      // Create base query
      let reportQuery = Report.findById(reportId);
      
      // Include related data if requested
      if (options.includeClient) {
        reportQuery = reportQuery.populate('client', 'company.name profile.firstName profile.lastName');
      }
      
      if (options.includeConsultant) {
        reportQuery = reportQuery.populate('consultant', 'profile.firstName profile.lastName professional.title');
      }
      
      if (options.includeProject) {
        reportQuery = reportQuery.populate('project', 'name description');
      }
      
      if (options.includeTemplate) {
        reportQuery = reportQuery.populate('template', 'name category description');
      }
      
      if (options.includeCreator) {
        reportQuery = reportQuery.populate('createdBy', 'profile.firstName profile.lastName');
      }
      
      if (options.includePublisher) {
        reportQuery = reportQuery.populate('publishedBy', 'profile.firstName profile.lastName');
      }
      
      const report = await reportQuery.exec();
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      // Track view if shared publicly
      if (options.trackView && report.sharing.isPublic) {
        await report.recordView();
      }
      
      return report;
    } catch (error) {
      logger.error(`Error fetching report by ID ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Create new report from template
   * @param {Object} reportData - Report data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created report
   */
  static async createReport(reportData, userId) {
    try {
      // Validate template
      if (!reportData.template || !mongoose.Types.ObjectId.isValid(reportData.template)) {
        throw new Error('Valid template ID is required');
      }
      
      const template = await ReportTemplate.findById(reportData.template);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Increment template usage count
      await template.incrementUsage();
      
      // Create report structure from template
      const sections = [];
      
      if (template.structure && template.structure.sections) {
        template.structure.sections.forEach(templateSection => {
          sections.push({
            title: templateSection.title,
            content: templateSection.defaultContent || '',
            type: templateSection.type,
            order: templateSection.order
          });
        });
      }
      
      // Create new report
      const report = new Report({
        title: reportData.title || template.name,
        description: reportData.description || template.description,
        template: template._id,
        client: reportData.client,
        project: reportData.project,
        consultant: reportData.consultant,
        organization: reportData.organization,
        data: reportData.data || {},
        sections: sections,
        metadata: {
          periodStart: reportData.periodStart,
          periodEnd: reportData.periodEnd,
          tags: reportData.tags || []
        },
        status: 'draft',
        isTemplate: false,
        createdBy: userId,
        updatedBy: userId
      });
      
      await report.save();
      
      return report;
    } catch (error) {
      logger.error('Error creating report:', error);
      throw error;
    }
  }

  /**
   * Update report
   * @param {string} reportId - Report ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated report
   */
  static async updateReport(reportId, updateData, userId) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      // Cannot update published reports unless explicitly changing status
      if (report.status === 'published' && 
          updateData.status !== 'archived' && 
          !updateData.forceUpdate) {
        throw new Error('Cannot update a published report. Archive it first or use forceUpdate flag.');
      }
      
      // Update allowed fields
      if (updateData.title) report.title = updateData.title;
      if (updateData.description) report.description = updateData.description;
      
      // Update sections if provided
      if (updateData.sections) {
        // Validate sections
        if (!Array.isArray(updateData.sections)) {
          throw new Error('Sections must be an array');
        }
        
        report.sections = updateData.sections;
      }
      
      // Update individual section if provided
      if (updateData.sectionId && updateData.sectionContent) {
        const sectionIndex = report.sections.findIndex(
          section => section._id.toString() === updateData.sectionId
        );
        
        if (sectionIndex === -1) {
          throw new Error('Section not found');
        }
        
        report.sections[sectionIndex].content = updateData.sectionContent;
      }
      
      // Update metadata
      if (updateData.metadata) {
        report.metadata = {
          ...report.metadata,
          ...updateData.metadata
        };
      }
      
      // Update data object
      if (updateData.data) {
        report.data = {
          ...report.data,
          ...updateData.data
        };
      }
      
      // Update status
      if (updateData.status) {
        report.status = updateData.status;
        
        if (updateData.status === 'published' && report.status !== 'published') {
          report.publishedAt = new Date();
          report.publishedBy = userId;
        }
      }
      
      // Update sharing settings
      if (updateData.sharing) {
        report.sharing = {
          ...report.sharing,
          ...updateData.sharing
        };
      }
      
      // Update permissions
      if (updateData.permissions) {
        report.permissions = {
          ...report.permissions,
          ...updateData.permissions
        };
      }
      
      // Set updater
      report.updatedBy = userId;
      
      await report.save();
      
      return report;
    } catch (error) {
      logger.error(`Error updating report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Delete report
   * @param {string} reportId - Report ID
   * @returns {boolean} Success status
   */
  static async deleteReport(reportId) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      // Delete any associated files
      if (report.files && report.files.length > 0) {
        // This would integrate with your file storage service
        for (const file of report.files) {
          try {
            await fileService.deleteFile(file.url);
          } catch (fileError) {
            logger.warn(`Failed to delete file ${file.url}:`, fileError);
            // Continue with deletion even if file removal fails
          }
        }
      }
      
      // Delete rendered report files if they exist
      if (report.renderedReport) {
        if (report.renderedReport.pdf) {
          try {
            await fileService.deleteFile(report.renderedReport.pdf);
          } catch (fileError) {
            logger.warn(`Failed to delete PDF file:`, fileError);
          }
        }
      }
      
      await report.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Publish report
   * @param {string} reportId - Report ID
   * @param {string} userId - User ID publishing the report
   * @returns {Object} Published report
   */
  static async publishReport(reportId, userId) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      if (report.status === 'published') {
        return report; // Already published
      }
      
      // Generate rendered versions if they don't exist
      if (!report.renderedReport || !report.renderedReport.html) {
        await report.renderToHtml();
      }
      
      if (!report.renderedReport || !report.renderedReport.pdf) {
        await report.generatePdf();
      }
      
      // Publish the report
      await report.publishReport(userId);
      
      return report;
    } catch (error) {
      logger.error(`Error publishing report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Archive report
   * @param {string} reportId - Report ID
   * @param {string} userId - User ID archiving the report
   * @returns {Object} Archived report
   */
  static async archiveReport(reportId, userId) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      if (report.status === 'archived') {
        return report; // Already archived
      }
      
      await report.archiveReport(userId);
      
      return report;
    } catch (error) {
      logger.error(`Error archiving report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Submit feedback for a report
   * @param {string} reportId - Report ID
   * @param {number} rating - Client rating (1-5)
   * @param {string} comments - Client comments
   * @returns {Object} Updated report
   */
  static async submitFeedback(reportId, rating, comments) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      // Validate rating
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      
      await report.submitFeedback(rating, comments);
      
      // Also update template rating if available
      if (report.template) {
        try {
          const template = await ReportTemplate.findById(report.template);
          if (template) {
            await template.addRating(rating);
          }
        } catch (templateError) {
          logger.warn(`Failed to update template rating:`, templateError);
          // Continue even if template update fails
        }
      }
      
      return report;
    } catch (error) {
      logger.error(`Error submitting feedback for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Upload file for a report
   * @param {string} reportId - Report ID
   * @param {Object} file - File to upload
   * @param {Object} fileInfo - Information about the file
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated report
   */
  static async uploadReportFile(reportId, file, fileInfo, userId) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Validate file info
      if (!fileInfo.name) {
        throw new Error('File name is required');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'reports/files');
      
      // Prepare file object
      const fileObject = {
        name: fileInfo.name || file.originalname,
        url: uploadResult.url,
        type: file.mimetype,
        size: file.size,
        uploadedAt: new Date()
      };
      
      // Add to files array
      if (!report.files) {
        report.files = [];
      }
      
      report.files.push(fileObject);
      report.updatedBy = userId;
      
      await report.save();
      
      return {
        report,
        file: fileObject
      };
    } catch (error) {
      logger.error(`Error uploading file for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Remove file from a report
   * @param {string} reportId - Report ID
   * @param {string} fileId - File ID to remove
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated report
   */
  static async removeReportFile(reportId, fileId, userId) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      // Find the file
      const fileIndex = report.files.findIndex(file => file._id.toString() === fileId);
      
      if (fileIndex === -1) {
        throw new Error('File not found in report');
      }
      
      const file = report.files[fileIndex];
      
      // Delete file from storage
      try {
        await fileService.deleteFile(file.url);
      } catch (fileError) {
        logger.warn(`Failed to delete file ${file.url}:`, fileError);
        // Continue even if file deletion fails
      }
      
      // Remove from files array
      report.files.splice(fileIndex, 1);
      report.updatedBy = userId;
      
      await report.save();
      
      return report;
    } catch (error) {
      logger.error(`Error removing file from report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Generate shareable link for a report
   * @param {string} reportId - Report ID
   * @param {Object} options - Sharing options
   * @param {string} userId - Updating user ID
   * @returns {Object} Sharing details
   */
  static async generateShareableLink(reportId, options, userId) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      // Generate access code if not provided
      const accessCode = options.accessCode || 
        Math.random().toString(36).substring(2, 10).toUpperCase();
      
      // Set expiry date if provided
      let expiresAt = null;
      if (options.expiresIn) {
        expiresAt = new Date();
        expiresAt.setTime(expiresAt.getTime() + options.expiresIn * 1000);
      }
      
      // Update sharing settings
      report.sharing = {
        isPublic: true,
        accessCode: accessCode,
        expiresAt: expiresAt,
        allowDownload: options.allowDownload !== false,
        allowPrint: options.allowPrint !== false,
        viewCount: 0
      };
      
      report.updatedBy = userId;
      
      await report.save();
      
      return {
        url: `${process.env.APP_URL || 'https://insightserenityss.com'}/reports/shared/${report._id}?code=${accessCode}`,
        accessCode: accessCode,
        expiresAt: expiresAt,
        allowDownload: report.sharing.allowDownload,
        allowPrint: report.sharing.allowPrint
      };
    } catch (error) {
      logger.error(`Error generating shareable link for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Disable sharing for a report
   * @param {string} reportId - Report ID
   * @param {string} userId - Updating user ID
   * @returns {boolean} Success status
   */
  static async disableSharing(reportId, userId) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      report.sharing = {
        isPublic: false,
        accessCode: null,
        expiresAt: null,
        allowDownload: false,
        allowPrint: false,
        viewCount: report.sharing ? report.sharing.viewCount : 0
      };
      
      report.updatedBy = userId;
      
      await report.save();
      
      return true;
    } catch (error) {
      logger.error(`Error disabling sharing for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Verify access to a shared report
   * @param {string} reportId - Report ID
   * @param {string} accessCode - Access code
   * @returns {Object} Report if access is granted
   */
  static async verifySharedAccess(reportId, accessCode) {
    try {
      const report = await Report.findById(reportId);
      
      if (!report) {
        throw new Error('Report not found');
      }
      
      // Check if sharing is enabled
      if (!report.sharing || !report.sharing.isPublic) {
        throw new Error('This report is not publicly shared');
      }
      
      // Check if access code matches
      if (report.sharing.accessCode !== accessCode) {
        throw new Error('Invalid access code');
      }
      
      // Check if sharing has expired
      if (report.sharing.expiresAt && new Date() > report.sharing.expiresAt) {
        throw new Error('Sharing link has expired');
      }
      
      // Track view
      await report.recordView();
      
      return report;
    } catch (error) {
      logger.error(`Error verifying shared access for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Get templates with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Templates with pagination info
   */
  static async getTemplates(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = { isArchived: false };
      
      // Add filters
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.industry) {
        query.industry = filters.industry;
      }
      
      if (filters.isPublic) {
        query['permissions.isPublic'] = true;
      }
      
      // Search filter
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const totalCount = await ReportTemplate.countDocuments(query);
      
      // Execute query with pagination
      const templates = await ReportTemplate.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'profile.firstName profile.lastName')
        .lean();
      
      return {
        templates,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching report templates:', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   * @param {string} templateId - Template ID
   * @returns {Object} Template data
   */
  static async getTemplateById(templateId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new Error('Invalid template ID format');
      }
      
      const template = await ReportTemplate.findById(templateId)
        .populate('createdBy', 'profile.firstName profile.lastName')
        .populate('updatedBy', 'profile.firstName profile.lastName')
        .populate({
          path: 'reportsCount'
        });
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      return template;
    } catch (error) {
      logger.error(`Error fetching template by ID ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Create new template
   * @param {Object} templateData - Template data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created template
   */
  static async createTemplate(templateData, userId) {
    try {
      // Create new template
      const template = new ReportTemplate({
        ...templateData,
        createdBy: userId,
        updatedBy: userId,
        version: {
          number: '1.0.0',
          date: new Date(),
          changelog: 'Initial version'
        }
      });
      
      await template.save();
      
      return template;
    } catch (error) {
      logger.error('Error creating report template:', error);
      throw error;
    }
  }

  /**
   * Update template
   * @param {string} templateId - Template ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated template
   */
  static async updateTemplate(templateId, updateData, userId) {
    try {
      const template = await ReportTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Handle version update
      if (updateData.newVersion) {
        // Parse current version
        const versionParts = template.version.number.split('.').map(Number);
        
        // Increment version based on update type
        if (updateData.versionType === 'major') {
          versionParts[0] += 1;
          versionParts[1] = 0;
          versionParts[2] = 0;
        } else if (updateData.versionType === 'minor') {
          versionParts[1] += 1;
          versionParts[2] = 0;
        } else {
          // Patch by default
          versionParts[2] += 1;
        }
        
        // Set new version data
        updateData.version = {
          number: versionParts.join('.'),
          date: new Date(),
          changelog: updateData.changelog || 'Updated template'
        };
        
        delete updateData.newVersion;
        delete updateData.versionType;
        delete updateData.changelog;
      }
      
      // Update allowed fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
          template[key] = updateData[key];
        }
      });
      
      // Set updater
      template.updatedBy = userId;
      
      await template.save();
      
      return template;
    } catch (error) {
      logger.error(`Error updating template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Archive template
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID
   * @returns {Object} Archived template
   */
  static async archiveTemplate(templateId, userId) {
    try {
      const template = await ReportTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      await template.archive(userId);
      
      return template;
    } catch (error) {
      logger.error(`Error archiving template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Restore archived template
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID
   * @returns {Object} Restored template
   */
  static async restoreTemplate(templateId, userId) {
    try {
      const template = await ReportTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      await template.restore(userId);
      
      return template;
    } catch (error) {
      logger.error(`Error restoring template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Duplicate template
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID
   * @param {string} newName - New template name (optional)
   * @returns {Object} Duplicated template
   */
  static async duplicateTemplate(templateId, userId, newName = null) {
    try {
      const template = await ReportTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      const duplicatedTemplate = await template.duplicate(userId, newName);
      
      return duplicatedTemplate;
    } catch (error) {
      logger.error(`Error duplicating template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Get report statistics
   * @param {Object} filters - Filter criteria
   * @returns {Object} Report statistics
   */
  static async getReportStats(filters = {}) {
    try {
      const stats = {};
      
      // Count by status
      const statusCounts = await Report.countByStatus();
      
      stats.statusCounts = {};
      statusCounts.forEach(item => {
        stats.statusCounts[item._id] = item.count;
      });
      
      // Total reports count
      stats.totalReports = await Report.countDocuments({ isTemplate: false });
      
      // Reports by date (last 12 months)
      const lastYear = new Date();
      lastYear.setMonth(lastYear.getMonth() - 11);
      lastYear.setDate(1);
      lastYear.setHours(0, 0, 0, 0);
      
      const reportsByMonth = await Report.aggregate([
        { 
          $match: { 
            createdAt: { $gte: lastYear },
            isTemplate: false
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]);
      
      stats.reportsByMonth = reportsByMonth.map(item => ({
        year: item._id.year,
        month: item._id.month,
        count: item.count
      }));
      
      // Most used templates
      const topTemplates = await Report.aggregate([
        { $match: { isTemplate: false } },
        { $group: { _id: "$template", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
      
      // Get template details
      if (topTemplates.length > 0) {
        const templateIds = topTemplates.map(item => item._id);
        const templateDetails = await ReportTemplate.find(
          { _id: { $in: templateIds } },
          'name category'
        );
        
        stats.topTemplates = topTemplates.map(item => {
          const template = templateDetails.find(
            t => t._id.toString() === item._id.toString()
          );
          
          return {
            _id: item._id,
            name: template ? template.name : 'Unknown Template',
            category: template ? template.category : null,
            count: item.count
          };
        });
      } else {
        stats.topTemplates = [];
      }
      
      // Reports by client
      const topClients = await Report.aggregate([
        { $match: { isTemplate: false } },
        { $group: { _id: "$client", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
      
      // Get client details
      if (topClients.length > 0) {
        const Client = mongoose.model('Client');
        const clientIds = topClients.map(item => item._id);
        const clientDetails = await Client.find(
          { _id: { $in: clientIds } },
          'company.name'
        ).populate('user', 'profile.firstName profile.lastName');
        
        stats.topClients = topClients.map(item => {
          const client = clientDetails.find(
            c => c._id.toString() === item._id.toString()
          );
          
          return {
            _id: item._id,
            name: client ? (client.company.name || `${client.user.profile.firstName} ${client.user.profile.lastName}`) : 'Unknown Client',
            count: item.count
          };
        });
      } else {
        stats.topClients = [];
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting report statistics:', error);
      throw error;
    }
  }
}

module.exports = ReportService;