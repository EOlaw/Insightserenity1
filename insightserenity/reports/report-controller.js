/**
 * @file Report Controller
 * @description Controller for handling report-related HTTP requests
 */

const ReportService = require('./report-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for report files
});

/**
 * Report Controller
 * Handles HTTP requests related to report management
 */
class ReportController {
  /**
   * Get all reports with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getReports(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        client: req.query.client,
        consultant: req.query.consultant,
        project: req.query.project,
        organization: req.query.organization,
        template: req.query.template,
        status: req.query.status,
        isTemplate: req.query.isTemplate === 'true',
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        tags: req.query.tags ? req.query.tags.split(',') : null,
        search: req.query.search
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await ReportService.getReports(filters, options);
      
      res.status(200).json({
        success: true,
        reports: result.reports,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting reports:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve reports'
      });
    }
  }

  /**
   * Get report by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getReportById(req, res) {
    try {
      const reportId = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeClient: req.query.includeClient === 'true',
        includeConsultant: req.query.includeConsultant === 'true',
        includeProject: req.query.includeProject === 'true',
        includeTemplate: req.query.includeTemplate === 'true',
        includeCreator: req.query.includeCreator === 'true',
        includePublisher: req.query.includePublisher === 'true',
        trackView: req.query.trackView === 'true'
      };
      
      const report = await ReportService.getReportById(reportId, options);
      
      res.status(200).json({
        success: true,
        report
      });
    } catch (error) {
      logger.error(`Error getting report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve report'
      });
    }
  }

  /**
   * Create new report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createReport(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newReport = await ReportService.createReport(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Report created successfully',
        report: newReport
      });
    } catch (error) {
      logger.error('Error creating report:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create report'
      });
    }
  }

  /**
   * Update report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateReport(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const reportId = req.params.id;
      const updatedReport = await ReportService.updateReport(reportId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Report updated successfully',
        report: updatedReport
      });
    } catch (error) {
      logger.error(`Error updating report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update report'
      });
    }
  }

  /**
   * Delete report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteReport(req, res) {
    try {
      const reportId = req.params.id;
      await ReportService.deleteReport(reportId);
      
      res.status(200).json({
        success: true,
        message: 'Report deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to delete report'
      });
    }
  }

  /**
   * Publish report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async publishReport(req, res) {
    try {
      const reportId = req.params.id;
      const publishedReport = await ReportService.publishReport(reportId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Report published successfully',
        report: {
          id: publishedReport._id,
          status: publishedReport.status,
          publishedAt: publishedReport.publishedAt,
          publishedBy: publishedReport.publishedBy
        }
      });
    } catch (error) {
      logger.error(`Error publishing report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to publish report'
      });
    }
  }

  /**
   * Archive report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async archiveReport(req, res) {
    try {
      const reportId = req.params.id;
      const archivedReport = await ReportService.archiveReport(reportId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Report archived successfully',
        report: {
          id: archivedReport._id,
          status: archivedReport.status
        }
      });
    } catch (error) {
      logger.error(`Error archiving report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to archive report'
      });
    }
  }

  /**
   * Submit feedback for a report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitFeedback(req, res) {
    try {
      const reportId = req.params.id;
      const { rating, comments } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating is required and must be between 1 and 5'
        });
      }
      
      const report = await ReportService.submitFeedback(reportId, rating, comments || '');
      
      res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully',
        feedback: report.feedback
      });
    } catch (error) {
      logger.error(`Error submitting feedback for report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to submit feedback'
      });
    }
  }

  /**
   * Upload file for a report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadReportFile(req, res) {
    const uploadMiddleware = upload.single('file');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Report file upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'Error uploading file'
        });
      }
      
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No file uploaded'
          });
        }
        
        const reportId = req.params.id;
        const fileInfo = {
          name: req.body.name || req.file.originalname
        };
        
        const result = await ReportService.uploadReportFile(
          reportId,
          req.file,
          fileInfo,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'File uploaded successfully',
          file: result.file
        });
      } catch (error) {
        logger.error(`Error processing report file ${req.params.id}:`, error);
        res.status(error.message === 'Report not found' ? 404 : 500).json({
          success: false,
          message: error.message || 'Failed to process file'
        });
      }
    });
  }

  /**
   * Remove file from a report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeReportFile(req, res) {
    try {
      const reportId = req.params.id;
      const fileId = req.params.fileId;
      
      await ReportService.removeReportFile(reportId, fileId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'File removed successfully'
      });
    } catch (error) {
      logger.error(`Error removing file from report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' || error.message === 'File not found in report' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to remove file'
      });
    }
  }

  /**
   * Generate shareable link for a report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateShareableLink(req, res) {
    try {
      const reportId = req.params.id;
      const options = {
        accessCode: req.body.accessCode,
        expiresIn: req.body.expiresIn ? parseInt(req.body.expiresIn) : null, // In seconds
        allowDownload: req.body.allowDownload !== false,
        allowPrint: req.body.allowPrint !== false
      };
      
      const shareDetails = await ReportService.generateShareableLink(reportId, options, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Shareable link generated successfully',
        sharing: shareDetails
      });
    } catch (error) {
      logger.error(`Error generating shareable link for report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to generate shareable link'
      });
    }
  }

  /**
   * Disable sharing for a report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async disableSharing(req, res) {
    try {
      const reportId = req.params.id;
      
      await ReportService.disableSharing(reportId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Sharing disabled successfully'
      });
    } catch (error) {
      logger.error(`Error disabling sharing for report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to disable sharing'
      });
    }
  }

  /**
   * Access shared report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async accessSharedReport(req, res) {
    try {
      const reportId = req.params.id;
      const accessCode = req.query.code;
      
      if (!accessCode) {
        return res.status(400).json({
          success: false,
          message: 'Access code is required'
        });
      }
      
      const report = await ReportService.verifySharedAccess(reportId, accessCode);
      
      res.status(200).json({
        success: true,
        report: {
          id: report._id,
          title: report.title,
          description: report.description,
          sections: report.sections,
          renderedReport: report.renderedReport,
          metadata: report.metadata,
          sharing: {
            allowDownload: report.sharing.allowDownload,
            allowPrint: report.sharing.allowPrint
          }
        }
      });
    } catch (error) {
      logger.error(`Error accessing shared report ${req.params.id}:`, error);
      res.status(error.message === 'Report not found' ? 404 : 403).json({
        success: false,
        message: error.message || 'Failed to access shared report'
      });
    }
  }

  /**
   * Get all templates with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTemplates(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        category: req.query.category,
        industry: req.query.industry,
        isPublic: req.query.isPublic === 'true',
        search: req.query.search
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await ReportService.getTemplates(filters, options);
      
      res.status(200).json({
        success: true,
        templates: result.templates,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve templates'
      });
    }
  }

  /**
   * Get template by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTemplateById(req, res) {
    try {
      const templateId = req.params.id;
      
      const template = await ReportService.getTemplateById(templateId);
      
      res.status(200).json({
        success: true,
        template
      });
    } catch (error) {
      logger.error(`Error getting template ${req.params.id}:`, error);
      res.status(error.message === 'Template not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve template'
      });
    }
  }

  /**
   * Create new template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createTemplate(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newTemplate = await ReportService.createTemplate(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        template: newTemplate
      });
    } catch (error) {
      logger.error('Error creating template:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create template'
      });
    }
  }

  /**
   * Update template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateTemplate(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const templateId = req.params.id;
      const updatedTemplate = await ReportService.updateTemplate(templateId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        template: updatedTemplate
      });
    } catch (error) {
      logger.error(`Error updating template ${req.params.id}:`, error);
      res.status(error.message === 'Template not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update template'
      });
    }
  }

  /**
   * Archive template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async archiveTemplate(req, res) {
    try {
      const templateId = req.params.id;
      
      await ReportService.archiveTemplate(templateId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Template archived successfully'
      });
    } catch (error) {
      logger.error(`Error archiving template ${req.params.id}:`, error);
      res.status(error.message === 'Template not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to archive template'
      });
    }
  }

  /**
   * Restore archived template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async restoreTemplate(req, res) {
    try {
      const templateId = req.params.id;
      
      await ReportService.restoreTemplate(templateId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Template restored successfully'
      });
    } catch (error) {
      logger.error(`Error restoring template ${req.params.id}:`, error);
      res.status(error.message === 'Template not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to restore template'
      });
    }
  }

  /**
   * Duplicate template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async duplicateTemplate(req, res) {
    try {
      const templateId = req.params.id;
      const newName = req.body.name;
      
      const duplicatedTemplate = await ReportService.duplicateTemplate(templateId, req.user.id, newName);
      
      res.status(200).json({
        success: true,
        message: 'Template duplicated successfully',
        template: {
          id: duplicatedTemplate._id,
          name: duplicatedTemplate.name
        }
      });
    } catch (error) {
      logger.error(`Error duplicating template ${req.params.id}:`, error);
      res.status(error.message === 'Template not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to duplicate template'
      });
    }
  }

  /**
   * Get report statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getReportStats(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        timeframe: req.query.timeframe || 'all'
      };
      
      const stats = await ReportService.getReportStats(filters);
      
      res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting report statistics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve report statistics'
      });
    }
  }
}

module.exports = ReportController;