/**
 * @file Contract Service
 * @description Service layer for contract-related operations
 */

const Contract = require('./contract-model');
const ContractTemplate = require('./template-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');
const emailService = require('../services/email-service');
const { generatePdf } = require('../utils/pdf-generator');

/**
 * Contract Service
 * Handles all contract-related business logic
 */
class ContractService {
  /**
   * Get contracts with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Contracts with pagination info
   */
  static async getContracts(filters = {}, options = {}) {
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
      
      // Add status filter
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query.status = { $in: filters.status };
        } else {
          query.status = filters.status;
        }
      }
      
      // Add project filter
      if (filters.project) {
        query.project = mongoose.Types.ObjectId(filters.project);
      }
      
      // Add party filter (find contracts where entity is a party)
      if (filters.partyId) {
        query['parties.entity'] = mongoose.Types.ObjectId(filters.partyId);
      }
      
      // Add party role filter
      if (filters.partyRole && filters.partyId) {
        query['parties'] = {
          $elemMatch: {
            entity: mongoose.Types.ObjectId(filters.partyId),
            role: filters.partyRole
          }
        };
      }
      
      // Add creator filter
      if (filters.createdBy) {
        query['metadata.createdBy'] = mongoose.Types.ObjectId(filters.createdBy);
      }
      
      // Add date range filter
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }
      
      // Add template filter
      if (filters.template) {
        query.template = mongoose.Types.ObjectId(filters.template);
      }
      
      // Add search term filter
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { contractNumber: { $regex: filters.search, $options: 'i' } },
          { 'parties.name': { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const totalCount = await Contract.countDocuments(query);
      
      // Execute query with pagination
      const contracts = await Contract.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('template', 'title type')
        .populate('project', 'title status')
        .populate('metadata.createdBy', 'profile.firstName profile.lastName')
        .lean();
      
      return {
        contracts,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching contracts:', error);
      throw error;
    }
  }

  /**
   * Get contract by ID
   * @param {string} contractId - Contract ID
   * @param {Object} options - Optional flags and user info
   * @returns {Object} Contract data
   */
  static async getContractById(contractId, options = {}) {
    try {
      let contractQuery = Contract.findById(contractId);
      
      // Include related data if requested
      if (options.includeTemplate) {
        contractQuery = contractQuery.populate('template', 'title type description');
      }
      
      if (options.includeProject) {
        contractQuery = contractQuery.populate('project', 'title status');
      }
      
      if (options.includeCreator) {
        contractQuery = contractQuery.populate('metadata.createdBy', 'profile.firstName profile.lastName email profile.avatarUrl');
      }
      
      if (options.includeAmendments) {
        contractQuery = contractQuery.populate('amendments', 'title contractNumber status');
      }
      
      if (options.includeOriginalContract) {
        contractQuery = contractQuery.populate('originalContract', 'title contractNumber status');
      }
      
      const contract = await contractQuery.exec();
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if user has permission to view
      if (options.userId && !contract.canUserView(options.userId)) {
        throw new Error('You do not have permission to view this contract');
      }
      
      // Record view if requested
      if (options.recordView && options.userId) {
        await contract.recordView(options.userId);
      }
      
      return contract;
    } catch (error) {
      logger.error(`Error fetching contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Create new contract
   * @param {Object} contractData - Contract data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created contract
   */
  static async createContract(contractData, userId) {
    try {
      // Check if template exists and user has permission to use it
      if (contractData.template) {
        const template = await ContractTemplate.findById(contractData.template);
        
        if (!template) {
          throw new Error('Template not found');
        }
        
        if (!template.canUserUse(userId)) {
          throw new Error('You do not have permission to use this template');
        }
        
        // Increment template usage count
        template.metadata.usage.contractsCreated += 1;
        template.metadata.usage.lastUsed = new Date();
        await template.save();
        
        // Generate contract content from template if not provided
        if (!contractData.content && contractData.templateVariables) {
          contractData.content = template.generateContent(contractData.templateVariables);
        }
      }
      
      // Ensure content exists
      if (!contractData.content) {
        throw new Error('Contract content is required');
      }
      
      // Create new contract
      const contract = new Contract({
        ...contractData,
        metadata: {
          createdBy: userId,
          createdFrom: contractData.createdFrom || {}
        },
        permissions: {
          canEdit: [userId],
          canView: [userId]
        }
      });
      
      // Set any additional user permissions
      if (contractData.permissions) {
        if (contractData.permissions.canEdit) {
          contract.permissions.canEdit = Array.from(new Set([
            ...contract.permissions.canEdit, 
            ...contractData.permissions.canEdit
          ]));
        }
        
        if (contractData.permissions.canView) {
          contract.permissions.canView = Array.from(new Set([
            ...contract.permissions.canView, 
            ...contractData.permissions.canView
          ]));
        }
      }
      
      // Add parties to viewers automatically
      contract.parties.forEach(party => {
        if (party.entity && party.entityType === 'User') {
          if (!contract.permissions.canView.some(id => id.equals(party.entity))) {
            contract.permissions.canView.push(party.entity);
          }
        }
      });
      
      await contract.save();
      
      return contract;
    } catch (error) {
      logger.error('Error creating contract:', error);
      throw error;
    }
  }

  /**
   * Update contract
   * @param {string} contractId - Contract ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated contract
   */
  static async updateContract(contractId, updateData, userId) {
    try {
      const contract = await Contract.findById(contractId);
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if user has permission to edit
      if (!contract.canUserEdit(userId)) {
        throw new Error('You do not have permission to edit this contract');
      }
      
      // Prevent editing of signed contracts unless creating amendment
      if (contract.status !== 'draft' && !updateData.createAmendment) {
        throw new Error('Cannot edit contracts that are not in draft status');
      }
      
      // Handle creating an amendment
      if (updateData.createAmendment) {
        delete updateData.createAmendment;
        return contract.createAmendment(updateData, userId);
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'contractNumber' && key !== 'metadata') {
          contract[key] = updateData[key];
        }
      });
      
      // Add to history
      contract.history.push({
        action: 'edited',
        timestamp: new Date(),
        user: userId,
        details: 'Contract updated'
      });
      
      await contract.save();
      
      return contract;
    } catch (error) {
      logger.error(`Error updating contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Change contract status
   * @param {string} contractId - Contract ID
   * @param {string} status - New status
   * @param {string} userId - User ID making the change
   * @param {string} reason - Optional reason for status change
   * @returns {Object} Updated contract
   */
  static async changeContractStatus(contractId, status, userId, reason = '') {
    try {
      const contract = await Contract.findById(contractId);
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if user has permission to edit
      if (!contract.canUserEdit(userId)) {
        throw new Error('You do not have permission to change this contract status');
      }
      
      // Validate status transition
      const validTransitions = {
        draft: ['pending_signature', 'terminated'],
        pending_signature: ['draft', 'active', 'terminated'],
        active: ['completed', 'terminated', 'amended'],
        completed: [],
        terminated: [],
        expired: [],
        amended: []
      };
      
      if (!validTransitions[contract.status].includes(status)) {
        throw new Error(`Cannot change status from ${contract.status} to ${status}`);
      }
      
      // Update contract status
      contract.status = status;
      
      // Set analytics data for sent contracts
      if (status === 'pending_signature' && !contract.analytics.sentAt) {
        contract.analytics.sentAt = new Date();
      }
      
      // Add to history
      const details = reason 
        ? `Contract status changed to ${status}: ${reason}`
        : `Contract status changed to ${status}`;
      
      contract.history.push({
        action: status === 'pending_signature' ? 'sent' : status,
        timestamp: new Date(),
        user: userId,
        details
      });
      
      await contract.save();
      
      // Send email notifications based on status change
      if (status === 'pending_signature') {
        await this.sendSignatureRequests(contract);
      } else if (status === 'active') {
        await this.sendContractActivatedNotifications(contract);
      }
      
      return contract;
    } catch (error) {
      logger.error(`Error changing contract status ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Sign contract by user
   * @param {string} contractId - Contract ID
   * @param {string} userId - Signing user ID
   * @param {Object} signatureData - Signature data (image, etc.)
   * @returns {Object} Updated contract
   */
  static async signContract(contractId, userId, signatureData = {}) {
    try {
      const contract = await Contract.findById(contractId);
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if user can sign
      if (!contract.canUserSign(userId)) {
        throw new Error('You do not have permission to sign this contract');
      }
      
      // Process signature
      await contract.signByUser(userId, signatureData);
      
      // Send notifications if all parties have signed
      if (contract.status === 'active') {
        await this.sendContractActivatedNotifications(contract);
      }
      
      return contract;
    } catch (error) {
      logger.error(`Error signing contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Generate contract PDF
   * @param {string} contractId - Contract ID
   * @param {string} userId - User ID requesting the PDF
   * @returns {Buffer} PDF buffer
   */
  static async generateContractPdf(contractId, userId) {
    try {
      const contract = await Contract.findById(contractId)
        .populate('template', 'title type')
        .populate('project', 'title');
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if user has permission to view
      if (!contract.canUserView(userId)) {
        throw new Error('You do not have permission to view this contract');
      }
      
      // Generate PDF
      const pdfBuffer = await generatePdf({
        title: contract.title,
        contractNumber: contract.contractNumber,
        content: contract.content,
        parties: contract.parties,
        details: {
          status: contract.status,
          created: contract.createdAt,
          template: contract.template ? contract.template.title : null,
          project: contract.project ? contract.project.title : null
        }
      });
      
      return pdfBuffer;
    } catch (error) {
      logger.error(`Error generating contract PDF ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Upload contract file
   * @param {string} contractId - Contract ID
   * @param {Object} file - File to upload
   * @param {string} userId - User ID uploading the file
   * @param {boolean} isAttachment - Whether file is an attachment
   * @returns {Object} Updated contract
   */
  static async uploadContractFile(contractId, file, userId, isAttachment = true) {
    try {
      const contract = await Contract.findById(contractId);
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if user has permission to edit
      if (!contract.canUserEdit(userId)) {
        throw new Error('You do not have permission to upload files to this contract');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'contracts');
      
      // Add file to contract
      if (!contract.files) {
        contract.files = [];
      }
      
      contract.files.push({
        name: file.originalname,
        type: file.mimetype,
        url: uploadResult.url,
        uploadedBy: userId,
        uploadedAt: new Date(),
        isAttachment
      });
      
      // Add to history
      contract.history.push({
        action: 'edited',
        timestamp: new Date(),
        user: userId,
        details: `File "${file.originalname}" uploaded to contract`
      });
      
      await contract.save();
      
      return contract;
    } catch (error) {
      logger.error(`Error uploading contract file ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Remove contract file
   * @param {string} contractId - Contract ID
   * @param {string} fileId - File ID to remove
   * @param {string} userId - User ID removing the file
   * @returns {Object} Updated contract
   */
  static async removeContractFile(contractId, fileId, userId) {
    try {
      const contract = await Contract.findById(contractId);
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if user has permission to edit
      if (!contract.canUserEdit(userId)) {
        throw new Error('You do not have permission to remove files from this contract');
      }
      
      // Find file in contract
      const fileIndex = contract.files.findIndex(file => file._id.toString() === fileId);
      
      if (fileIndex === -1) {
        throw new Error('File not found in contract');
      }
      
      const fileName = contract.files[fileIndex].name;
      
      // Remove file from contract
      contract.files.splice(fileIndex, 1);
      
      // Add to history
      contract.history.push({
        action: 'edited',
        timestamp: new Date(),
        user: userId,
        details: `File "${fileName}" removed from contract`
      });
      
      await contract.save();
      
      return contract;
    } catch (error) {
      logger.error(`Error removing contract file ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's contract statistics
   * @param {string} userId - User ID
   * @returns {Object} Contract statistics
   */
  static async getUserContractStats(userId) {
    try {
      const stats = {};
      
      // Total contracts
      stats.totalContracts = await Contract.countDocuments({
        'parties.entity': userId,
        'parties.entityType': 'User'
      });
      
      // Contracts by status
      const statusCounts = await Contract.aggregate([
        {
          $match: {
            'parties.entity': mongoose.Types.ObjectId(userId),
            'parties.entityType': 'User'
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      stats.statusCounts = {};
      statusCounts.forEach(item => {
        stats.statusCounts[item._id] = item.count;
      });
      
      // Pending signature contracts
      stats.pendingSignature = await Contract.countDocuments({
        'parties.entity': userId,
        'parties.entityType': 'User',
        'parties.signed': false,
        status: 'pending_signature'
      });
      
      // Expiring soon contracts (30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      stats.expiringSoon = await Contract.countDocuments({
        'parties.entity': userId,
        'parties.entityType': 'User',
        status: 'active',
        expiresAt: { $exists: true, $ne: null, $lte: thirtyDaysFromNow }
      });
      
      // Recent contracts
      stats.recentContracts = await Contract.find({
        'parties.entity': userId,
        'parties.entityType': 'User'
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title contractNumber status createdAt')
        .lean();
      
      return stats;
    } catch (error) {
      logger.error(`Error getting user contract stats for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send contract signature requests
   * @param {Object} contract - Contract object
   * @returns {boolean} Success status
   */
  static async sendSignatureRequests(contract) {
    try {
      // Get user data for each party
      const User = mongoose.model('User');
      
      for (const party of contract.parties) {
        if (!party.signed) {
          let userEmail, userName;
          
          if (party.entityType === 'User') {
            const user = await User.findById(party.entity);
            
            if (user) {
              userEmail = user.email;
              userName = `${user.profile.firstName} ${user.profile.lastName}`;
            } else {
              userEmail = party.email;
              userName = party.name;
            }
          } else {
            userEmail = party.email;
            userName = party.name;
          }
          
          // Skip if no email
          if (!userEmail) continue;
          
          // Send email notification
          await emailService.sendContractSignatureRequest(
            userEmail,
            {
              name: userName,
              contractTitle: contract.title,
              contractNumber: contract.contractNumber,
              contractUrl: `/contracts/${contract._id}/sign`,
              expiresAt: contract.expiresAt
            }
          );
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`Error sending contract signature requests:`, error);
      throw error;
    }
  }

  /**
   * Send contract activated notifications
   * @param {Object} contract - Contract object
   * @returns {boolean} Success status
   */
  static async sendContractActivatedNotifications(contract) {
    try {
      // Get creator email
      const User = mongoose.model('User');
      const creator = await User.findById(contract.metadata.createdBy);
      
      if (creator) {
        await emailService.sendContractActivatedNotification(
          creator.email,
          {
            name: `${creator.profile.firstName} ${creator.profile.lastName}`,
            contractTitle: contract.title,
            contractNumber: contract.contractNumber,
            contractUrl: `/contracts/${contract._id}`
          }
        );
      }
      
      // Notify all parties
      for (const party of contract.parties) {
        let userEmail, userName;
        
        if (party.entityType === 'User') {
          const user = await User.findById(party.entity);
          
          if (user && !user._id.equals(contract.metadata.createdBy)) {
            userEmail = user.email;
            userName = `${user.profile.firstName} ${user.profile.lastName}`;
          } else {
            userEmail = party.email;
            userName = party.name;
          }
        } else {
          userEmail = party.email;
          userName = party.name;
        }
        
        // Skip if no email or if this is the creator
        if (!userEmail || (creator && userEmail === creator.email)) continue;
        
        // Send email notification
        await emailService.sendContractActivatedNotification(
          userEmail,
          {
            name: userName,
            contractTitle: contract.title,
            contractNumber: contract.contractNumber,
            contractUrl: `/contracts/${contract._id}`
          }
        );
      }
      
      return true;
    } catch (error) {
      logger.error(`Error sending contract activated notifications:`, error);
      throw error;
    }
  }

  /**
   * Get templates with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Array} Templates
   */
  static async getTemplates(filters = {}, options = {}) {
    try {
      let query = {};
      
      // Add type filter
      if (filters.type) {
        query.type = filters.type;
      }
      
      // Add category filter
      if (filters.category) {
        query.category = filters.category;
      }
      
      // Add status filter (default to active)
      if (filters.status) {
        query.status = filters.status;
      } else {
        query.status = 'active';
      }
      
      // Add jurisdiction filter
      if (filters.jurisdiction) {
        if (filters.jurisdiction.country) {
          query['jurisdiction.country'] = filters.jurisdiction.country;
        }
        
        if (filters.jurisdiction.state) {
          query['jurisdiction.state'] = filters.jurisdiction.state;
        }
      }
      
      // Add search filter
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Handle access control
      if (filters.userId) {
        if (!filters.includePrivate) {
          // Only show public templates and templates the user can use
          query.$or = [
            { isPublic: true },
            { 'metadata.createdBy': filters.userId },
            { 'permissions.canUse': filters.userId }
          ];
        }
      } else {
        // No user ID provided, only show public templates
        query.isPublic = true;
      }
      
      // Get templates
      let templatesQuery = ContractTemplate.find(query);
      
      // Add sorting
      const sortField = options.sortField || 'title';
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      templatesQuery = templatesQuery.sort({ [sortField]: sortOrder });
      
      // Add pagination
      if (options.page && options.limit) {
        const page = parseInt(options.page);
        const limit = parseInt(options.limit);
        const skip = (page - 1) * limit;
        
        templatesQuery = templatesQuery.skip(skip).limit(limit);
      }
      
      const templates = await templatesQuery.exec();
      
      return templates;
    } catch (error) {
      logger.error('Error fetching contract templates:', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   * @param {string} templateId - Template ID
   * @param {Object} options - Optional flags and user info
   * @returns {Object} Template data
   */
  static async getTemplateById(templateId, options = {}) {
    try {
      const template = await ContractTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Check if user has permission to view
      if (options.userId && !template.isPublic) {
        const canUse = template.canUserUse(options.userId);
        const canEdit = template.canUserEdit(options.userId);
        
        if (!canUse && !canEdit) {
          throw new Error('You do not have permission to view this template');
        }
      }
      
      return template;
    } catch (error) {
      logger.error(`Error fetching template ${templateId}:`, error);
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
      // Check if code already exists
      if (templateData.code) {
        const existingTemplate = await ContractTemplate.findOne({ code: templateData.code.toUpperCase() });
        if (existingTemplate) {
          throw new Error('A template with this code already exists');
        }
      }
      
      // Create new template
      const template = new ContractTemplate({
        ...templateData,
        metadata: {
          createdBy: userId,
          updatedBy: userId,
          usage: {
            contractsCreated: 0
          }
        }
      });
      
      await template.save();
      
      return template;
    } catch (error) {
      logger.error('Error creating contract template:', error);
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
      const template = await ContractTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Check if user has permission to edit
      if (!template.canUserEdit(userId)) {
        throw new Error('You do not have permission to edit this template');
      }
      
      // Check if creating a new version
      if (updateData.createNewVersion) {
        delete updateData.createNewVersion;
        return template.createNewVersion(
          updateData, 
          userId, 
          updateData.versionIncrement || 'patch'
        );
      }
      
      // Check if code is being changed and already exists
      if (updateData.code && updateData.code !== template.code) {
        const existingTemplate = await ContractTemplate.findOne({ 
          code: updateData.code.toUpperCase() 
        });
        
        if (existingTemplate && !existingTemplate._id.equals(templateId)) {
          throw new Error('A template with this code already exists');
        }
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'metadata' && key !== 'version' && key !== 'versionIncrement') {
          template[key] = updateData[key];
        }
      });
      
      // Update metadata
      template.metadata.updatedBy = userId;
      
      await template.save();
      
      return template;
    } catch (error) {
      logger.error(`Error updating template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Generate contract content from template
   * @param {string} templateId - Template ID
   * @param {Object} variables - Variable values
   * @returns {string} Generated contract content
   */
  static async generateContractContent(templateId, variables) {
    try {
      const template = await ContractTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      return template.generateContent(variables);
    } catch (error) {
      logger.error(`Error generating contract content from template ${templateId}:`, error);
      throw error;
    }
  }
}

module.exports = ContractService;