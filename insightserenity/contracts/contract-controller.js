/**
 * @file Contract Controller
 * @description Controller for handling contract-related HTTP requests
 */

const ContractService = require('./contract-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Contract Controller
 * Handles HTTP requests related to contract management
 */
class ContractController {
  /**
   * Get all contracts with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getContracts(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        status: req.query.status,
        project: req.query.project,
        partyId: req.query.partyId || req.user.id,
        partyRole: req.query.partyRole,
        createdBy: req.query.createdBy,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        template: req.query.template,
        search: req.query.search
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };
      
      const result = await ContractService.getContracts(filters, options);
      
      res.status(200).json({
        success: true,
        contracts: result.contracts,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting contracts:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve contracts'
      });
    }
  }

  /**
   * Get contract by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getContractById(req, res) {
    try {
      const contractId = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeTemplate: req.query.includeTemplate === 'true',
        includeProject: req.query.includeProject === 'true',
        includeCreator: req.query.includeCreator === 'true',
        includeAmendments: req.query.includeAmendments === 'true',
        includeOriginalContract: req.query.includeOriginalContract === 'true',
        recordView: req.query.recordView === 'true',
        userId: req.user.id
      };
      
      const contract = await ContractService.getContractById(contractId, options);
      
      res.status(200).json({
        success: true,
        contract
      });
    } catch (error) {
      logger.error(`Error getting contract ${req.params.id}:`, error);
      
      if (error.message === 'Contract not found') {
        return res.status(404).json({
          success: false,
          message: 'Contract not found'
        });
      }
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve contract'
      });
    }
  }

  /**
   * Create new contract
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createContract(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      // Add user's IP and user agent
      const createdFrom = {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };
      
      const contractData = {
        ...req.body,
        createdFrom
      };
      
      const newContract = await ContractService.createContract(contractData, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Contract created successfully',
        contract: newContract
      });
    } catch (error) {
      logger.error('Error creating contract:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create contract'
      });
    }
  }

  /**
   * Update contract
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateContract(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const contractId = req.params.id;
      const updatedContract = await ContractService.updateContract(contractId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Contract updated successfully',
        contract: updatedContract
      });
    } catch (error) {
      logger.error(`Error updating contract ${req.params.id}:`, error);
      
      if (error.message === 'Contract not found') {
        return res.status(404).json({
          success: false,
          message: 'Contract not found'
        });
      }
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update contract'
      });
    }
  }

  /**
   * Change contract status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changeContractStatus(req, res) {
    try {
      const { status, reason } = req.body;
      const contractId = req.params.id;
      
      if (!status || !['draft', 'pending_signature', 'active', 'completed', 'terminated', 'expired', 'amended'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }
      
      const updatedContract = await ContractService.changeContractStatus(
        contractId, 
        status, 
        req.user.id, 
        reason
      );
      
      res.status(200).json({
        success: true,
        message: `Contract status changed to ${status} successfully`,
        contract: updatedContract
      });
    } catch (error) {
      logger.error(`Error changing contract status ${req.params.id}:`, error);
      
      if (error.message === 'Contract not found') {
        return res.status(404).json({
          success: false,
          message: 'Contract not found'
        });
      }
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to change contract status'
      });
    }
  }

  /**
   * Sign contract
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async signContract(req, res) {
    try {
      const contractId = req.params.id;
      const { signatureData } = req.body;
      
      const updatedContract = await ContractService.signContract(
        contractId, 
        req.user.id, 
        signatureData
      );
      
      res.status(200).json({
        success: true,
        message: 'Contract signed successfully',
        contract: updatedContract
      });
    } catch (error) {
      logger.error(`Error signing contract ${req.params.id}:`, error);
      
      if (error.message === 'Contract not found') {
        return res.status(404).json({
          success: false,
          message: 'Contract not found'
        });
      }
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to sign contract'
      });
    }
  }

  /**
   * Generate contract PDF
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateContractPdf(req, res) {
    try {
      const contractId = req.params.id;
      
      const pdfBuffer = await ContractService.generateContractPdf(contractId, req.user.id);
      
      // Set response headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contract-${contractId}.pdf"`);
      
      // Send PDF buffer
      res.status(200).send(pdfBuffer);
    } catch (error) {
      logger.error(`Error generating contract PDF ${req.params.id}:`, error);
      
      if (error.message === 'Contract not found') {
        return res.status(404).json({
          success: false,
          message: 'Contract not found'
        });
      }
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate contract PDF'
      });
    }
  }

  /**
   * Upload contract file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadContractFile(req, res) {
    const uploadMiddleware = upload.single('file');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Contract file upload error:', err);
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
        
        const contractId = req.params.id;
        const isAttachment = req.query.isAttachment !== 'false';
        
        const updatedContract = await ContractService.uploadContractFile(
          contractId,
          req.file,
          req.user.id,
          isAttachment
        );
        
        res.status(200).json({
          success: true,
          message: 'File uploaded successfully',
          files: updatedContract.files
        });
      } catch (error) {
        logger.error(`Error processing contract file ${req.params.id}:`, error);
        
        if (error.message === 'Contract not found') {
          return res.status(404).json({
            success: false,
            message: 'Contract not found'
          });
        }
        
        if (error.message.includes('permission')) {
          return res.status(403).json({
            success: false,
            message: error.message
          });
        }
        
        res.status(400).json({
          success: false,
          message: error.message || 'Failed to upload file'
        });
      }
    });
  }

  /**
   * Remove contract file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeContractFile(req, res) {
    try {
      const contractId = req.params.id;
      const fileId = req.params.fileId;
      
      await ContractService.removeContractFile(contractId, fileId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'File removed successfully'
      });
    } catch (error) {
      logger.error(`Error removing contract file ${req.params.id}:`, error);
      
      if (error.message === 'Contract not found' || error.message === 'File not found in contract') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to remove file'
      });
    }
  }

  /**
   * Get user's contract statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserContractStats(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Only allow users to see their own stats unless admin
      if (userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view these statistics'
        });
      }
      
      const stats = await ContractService.getUserContractStats(userId);
      
      res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error(`Error getting user contract stats:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve contract statistics'
      });
    }
  }

  /**
   * Get contract templates
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTemplates(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        type: req.query.type,
        category: req.query.category,
        status: req.query.status,
        search: req.query.search,
        userId: req.user.id,
        includePrivate: req.query.includePrivate === 'true'
      };
      
      // Extract options
      const options = {
        sortField: req.query.sortField || 'title',
        sortOrder: req.query.sortOrder || 'asc',
        page: req.query.page,
        limit: req.query.limit
      };
      
      const templates = await ContractService.getTemplates(filters, options);
      
      res.status(200).json({
        success: true,
        templates
      });
    } catch (error) {
      logger.error('Error getting contract templates:', error);
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
      
      const options = {
        userId: req.user.id
      };
      
      const template = await ContractService.getTemplateById(templateId, options);
      
      res.status(200).json({
        success: true,
        template
      });
    } catch (error) {
      logger.error(`Error getting template ${req.params.id}:`, error);
      
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
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
      
      const newTemplate = await ContractService.createTemplate(req.body, req.user.id);
      
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
      const updatedTemplate = await ContractService.updateTemplate(templateId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        template: updatedTemplate
      });
    } catch (error) {
      logger.error(`Error updating template ${req.params.id}:`, error);
      
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      
      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update template'
      });
    }
  }

  /**
   * Generate contract content from template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateContractContent(req, res) {
    try {
      const templateId = req.params.id;
      const { variables } = req.body;
      
      if (!variables) {
        return res.status(400).json({
          success: false,
          message: 'Variables object is required'
        });
      }
      
      const content = await ContractService.generateContractContent(templateId, variables);
      
      res.status(200).json({
        success: true,
        content
      });
    } catch (error) {
      logger.error(`Error generating contract content from template ${req.params.id}:`, error);
      
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate contract content'
      });
    }
  }
}

module.exports = ContractController;