/**
 * @file Onboarding Controller
 * @description Controller for handling onboarding-related HTTP requests
 */

const OnboardingService = require('./onboarding-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Onboarding Controller
 * Handles HTTP requests related to onboarding
 */
class OnboardingController {
  /**
   * Get client onboarding status and steps
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getClientOnboarding(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      
      // Set options for data inclusion
      const options = {
        includeClient: req.query.includeClient === 'true',
        includeAssignee: req.query.includeAssignee === 'true',
        includeRecommendedConsultants: req.query.includeRecommendedConsultants === 'true',
        includeRecommendedServices: req.query.includeRecommendedServices === 'true',
        initialize: req.query.initialize === 'true'
      };
      
      const onboarding = await OnboardingService.getClientOnboarding(clientId, options);
      
      res.status(200).json({
        success: true,
        onboarding
      });
    } catch (error) {
      logger.error(`Error getting client onboarding:`, error);
      res.status(error.message === 'Client onboarding not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve client onboarding'
      });
    }
  }

  /**
   * Get consultant onboarding status and steps
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getConsultantOnboarding(req, res) {
    try {
      const consultantId = req.params.consultantId || req.user.id;
      
      // Set options for data inclusion
      const options = {
        includeConsultant: req.query.includeConsultant === 'true',
        includeReviewer: req.query.includeReviewer === 'true',
        includeServiceOfferings: req.query.includeServiceOfferings === 'true',
        includeInterviews: req.query.includeInterviews === 'true',
        initialize: req.query.initialize === 'true'
      };
      
      const onboarding = await OnboardingService.getConsultantOnboarding(consultantId, options);
      
      res.status(200).json({
        success: true,
        onboarding
      });
    } catch (error) {
      logger.error(`Error getting consultant onboarding:`, error);
      res.status(error.message === 'Consultant onboarding not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve consultant onboarding'
      });
    }
  }

  /**
   * Initialize client onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async initializeClientOnboarding(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      
      const onboarding = await OnboardingService.initializeClientOnboarding(clientId);
      
      res.status(200).json({
        success: true,
        message: 'Client onboarding initialized successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error initializing client onboarding:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize client onboarding'
      });
    }
  }

  /**
   * Initialize consultant onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async initializeConsultantOnboarding(req, res) {
    try {
      const consultantId = req.params.consultantId || req.user.id;
      
      const onboarding = await OnboardingService.initializeConsultantOnboarding(consultantId);
      
      res.status(200).json({
        success: true,
        message: 'Consultant onboarding initialized successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error initializing consultant onboarding:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize consultant onboarding'
      });
    }
  }

  /**
   * Update client onboarding step
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateClientOnboardingStep(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      const stepNumber = parseInt(req.params.step);
      const { status, data } = req.body;
      
      // Validate inputs
      if (!stepNumber || isNaN(stepNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Valid step number is required'
        });
      }
      
      if (!status || !['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status is required (pending, in_progress, completed, skipped)'
        });
      }
      
      const onboarding = await OnboardingService.updateClientOnboardingStep(
        clientId,
        stepNumber,
        status,
        data
      );
      
      res.status(200).json({
        success: true,
        message: `Client onboarding step ${stepNumber} updated successfully`,
        onboarding
      });
    } catch (error) {
      logger.error(`Error updating client onboarding step:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update client onboarding step'
      });
    }
  }

  /**
   * Update consultant onboarding step
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateConsultantOnboardingStep(req, res) {
    try {
      const consultantId = req.params.consultantId || req.user.id;
      const stepNumber = parseInt(req.params.step);
      const { status, data } = req.body;
      
      // Validate inputs
      if (!stepNumber || isNaN(stepNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Valid step number is required'
        });
      }
      
      if (!status || !['pending', 'in_progress', 'completed', 'returned', 'skipped'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status is required (pending, in_progress, completed, returned, skipped)'
        });
      }
      
      const onboarding = await OnboardingService.updateConsultantOnboardingStep(
        consultantId,
        stepNumber,
        status,
        data
      );
      
      res.status(200).json({
        success: true,
        message: `Consultant onboarding step ${stepNumber} updated successfully`,
        onboarding
      });
    } catch (error) {
      logger.error(`Error updating consultant onboarding step:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update consultant onboarding step'
      });
    }
  }

  /**
   * Generate service recommendations for client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateServiceRecommendations(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      
      // Get onboarding ID
      const onboarding = await OnboardingService.getClientOnboarding(clientId);
      
      const recommendations = await OnboardingService.generateServiceRecommendations(onboarding._id);
      
      res.status(200).json({
        success: true,
        recommendations
      });
    } catch (error) {
      logger.error(`Error generating service recommendations:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate service recommendations'
      });
    }
  }

  /**
   * Generate consultant recommendations for client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateConsultantRecommendations(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      
      // Get onboarding ID
      const onboarding = await OnboardingService.getClientOnboarding(clientId);
      
      const recommendations = await OnboardingService.generateConsultantRecommendations(onboarding._id);
      
      res.status(200).json({
        success: true,
        recommendations
      });
    } catch (error) {
      logger.error(`Error generating consultant recommendations:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate consultant recommendations'
      });
    }
  }

  /**
   * Update consultant recommendation status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateConsultantRecommendationStatus(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      const consultantId = req.params.consultantId;
      const { status } = req.body;
      
      // Validate status
      if (!status || !['recommended', 'viewed', 'contacted', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status is required (recommended, viewed, contacted, rejected)'
        });
      }
      
      const onboarding = await OnboardingService.updateConsultantRecommendationStatus(
        clientId,
        consultantId,
        status
      );
      
      res.status(200).json({
        success: true,
        message: 'Consultant recommendation status updated successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error updating consultant recommendation status:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update consultant recommendation status'
      });
    }
  }

  /**
   * Schedule session for client onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async scheduleClientSession(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      const sessionData = req.body;
      
      // Validate required fields
      if (!sessionData.sessionType || !sessionData.scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'Session type and scheduled date are required'
        });
      }
      
      const onboarding = await OnboardingService.scheduleClientSession(clientId, sessionData);
      
      res.status(200).json({
        success: true,
        message: 'Session scheduled successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error scheduling client session:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to schedule session'
      });
    }
  }

  /**
   * Schedule interview for consultant onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async scheduleConsultantInterview(req, res) {
    try {
      const consultantId = req.params.consultantId || req.user.id;
      const interviewData = req.body;
      
      // Validate required fields
      if (!interviewData.interviewerId || !interviewData.scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'Interviewer and scheduled date are required'
        });
      }
      
      const onboarding = await OnboardingService.scheduleConsultantInterview(
        consultantId,
        interviewData
      );
      
      res.status(200).json({
        success: true,
        message: 'Interview scheduled successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error scheduling consultant interview:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to schedule interview'
      });
    }
  }

  /**
   * Submit consultant onboarding for review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitForReview(req, res) {
    try {
      const consultantId = req.params.consultantId || req.user.id;
      
      const onboarding = await OnboardingService.submitConsultantOnboardingForReview(consultantId);
      
      res.status(200).json({
        success: true,
        message: 'Onboarding submitted for review successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error submitting consultant onboarding for review:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to submit onboarding for review'
      });
    }
  }

  /**
   * Review consultant onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async reviewConsultantOnboarding(req, res) {
    try {
      const consultantId = req.params.consultantId;
      const { decision, notes } = req.body;
      
      // Validate decision
      if (!decision || !['approve', 'reject'].includes(decision)) {
        return res.status(400).json({
          success: false,
          message: 'Valid decision is required (approve, reject)'
        });
      }
      
      const onboarding = await OnboardingService.reviewConsultantOnboarding(
        consultantId,
        req.user.id,
        decision,
        notes
      );
      
      res.status(200).json({
        success: true,
        message: `Consultant onboarding ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
        onboarding
      });
    } catch (error) {
      logger.error(`Error reviewing consultant onboarding:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to review consultant onboarding'
      });
    }
  }

  /**
   * Complete client onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async completeClientOnboarding(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      
      const onboarding = await OnboardingService.completeClientOnboarding(clientId);
      
      res.status(200).json({
        success: true,
        message: 'Client onboarding completed successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error completing client onboarding:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to complete client onboarding'
      });
    }
  }

  /**
   * Complete consultant onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async completeConsultantOnboarding(req, res) {
    try {
      const consultantId = req.params.consultantId || req.user.id;
      
      const onboarding = await OnboardingService.completeConsultantOnboarding(consultantId);
      
      res.status(200).json({
        success: true,
        message: 'Consultant onboarding completed successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error completing consultant onboarding:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to complete consultant onboarding'
      });
    }
  }

  /**
   * Get stalled client onboardings
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getStalledClientOnboardings(req, res) {
    try {
      const daysThreshold = parseInt(req.query.days) || 7;
      
      const stalledOnboardings = await OnboardingService.getStalledClientOnboardings(daysThreshold);
      
      res.status(200).json({
        success: true,
        count: stalledOnboardings.length,
        onboardings: stalledOnboardings
      });
    } catch (error) {
      logger.error(`Error getting stalled client onboardings:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get stalled client onboardings'
      });
    }
  }

  /**
   * Get stalled consultant onboardings
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getStalledConsultantOnboardings(req, res) {
    try {
      const daysThreshold = parseInt(req.query.days) || 7;
      
      const stalledOnboardings = await OnboardingService.getStalledConsultantOnboardings(daysThreshold);
      
      res.status(200).json({
        success: true,
        count: stalledOnboardings.length,
        onboardings: stalledOnboardings
      });
    } catch (error) {
      logger.error(`Error getting stalled consultant onboardings:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get stalled consultant onboardings'
      });
    }
  }

  /**
   * Get consultants pending review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getConsultantsPendingReview(req, res) {
    try {
      const pendingReview = await OnboardingService.getConsultantsPendingReview();
      
      res.status(200).json({
        success: true,
        count: pendingReview.length,
        onboardings: pendingReview
      });
    } catch (error) {
      logger.error(`Error getting consultants pending review:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get consultants pending review'
      });
    }
  }

  /**
   * Assign client onboarding to team member
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async assignClientOnboarding(req, res) {
    try {
      const clientId = req.params.clientId;
      const { assigneeId } = req.body;
      
      if (!assigneeId) {
        return res.status(400).json({
          success: false,
          message: 'Assignee ID is required'
        });
      }
      
      const onboarding = await OnboardingService.assignClientOnboarding(clientId, assigneeId);
      
      res.status(200).json({
        success: true,
        message: 'Client onboarding assigned successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error assigning client onboarding:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to assign client onboarding'
      });
    }
  }

  /**
   * Add reminder for client or consultant
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addReminder(req, res) {
    try {
      const userId = req.params.userId;
      const { userType, reminderData } = req.body;
      
      // Validate inputs
      if (!userType || !['client', 'consultant'].includes(userType)) {
        return res.status(400).json({
          success: false,
          message: 'Valid user type is required (client, consultant)'
        });
      }
      
      if (!reminderData || !reminderData.type || !reminderData.message || !reminderData.scheduledFor) {
        return res.status(400).json({
          success: false,
          message: 'Reminder data must include type, message, and scheduledFor'
        });
      }
      
      const onboarding = await OnboardingService.addReminder(userId, userType, reminderData);
      
      res.status(200).json({
        success: true,
        message: 'Reminder added successfully',
        onboarding
      });
    } catch (error) {
      logger.error(`Error adding reminder:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add reminder'
      });
    }
  }

  /**
   * Get onboarding statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getOnboardingStats(req, res) {
    try {
      const stats = await OnboardingService.getOnboardingStats();
      
      res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error(`Error getting onboarding statistics:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get onboarding statistics'
      });
    }
  }

  /**
   * Upload document for client onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadClientDocument(req, res) {
    const uploadMiddleware = upload.single('document');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Document upload error:', err);
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
        
        const clientId = req.params.clientId || req.user.id;
        
        // Get onboarding
        const onboarding = await OnboardingService.getClientOnboarding(clientId);
        
        // Process file upload
        const fileService = require('../services/file-service');
        const uploadResult = await fileService.uploadFile(req.file, 'client-onboarding');
        
        // Add document to onboarding
        const documentData = {
          name: req.body.name || req.file.originalname,
          type: req.file.mimetype,
          url: uploadResult.url
        };
        
        await onboarding.addDocument(documentData);
        
        // If this is step 6, mark it as completed
        if (onboarding.currentStep === 6) {
          await onboarding.updateStepStatus(6, 'completed');
        }
        
        res.status(200).json({
          success: true,
          message: 'Document uploaded successfully',
          document: documentData
        });
      } catch (error) {
        logger.error(`Error processing document upload:`, error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to process document upload'
        });
      }
    });
  }

  /**
   * Upload document for consultant onboarding (certifications, education, etc.)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadConsultantDocument(req, res) {
    const uploadMiddleware = upload.single('document');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Document upload error:', err);
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
        
        const consultantId = req.params.consultantId || req.user.id;
        const documentType = req.query.documentType || 'other';
        
        // Get onboarding
        const onboarding = await OnboardingService.getConsultantOnboarding(consultantId);
        
        // Process file upload
        const fileService = require('../services/file-service');
        const uploadResult = await fileService.uploadFile(req.file, 'consultant-onboarding');
        
        // Handle different document types
        let result;
        
        if (documentType === 'certification') {
          // Add to certifications
          const certificationData = {
            name: req.body.name,
            issuer: req.body.issuer,
            dateObtained: req.body.dateObtained ? new Date(req.body.dateObtained) : new Date(),
            expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
            documentUrl: uploadResult.url,
            verified: false
          };
          
          await onboarding.addCertification(certificationData);
          result = certificationData;
        } else if (documentType === 'education') {
          // Add to education
          const educationData = {
            institution: req.body.institution,
            degree: req.body.degree,
            fieldOfStudy: req.body.fieldOfStudy,
            startDate: req.body.startDate ? new Date(req.body.startDate) : null,
            endDate: req.body.endDate ? new Date(req.body.endDate) : null,
            documentUrl: uploadResult.url,
            verified: false
          };
          
          await onboarding.addEducation(educationData);
          result = educationData;
        } else if (documentType === 'identity') {
          // Update identity verification
          await onboarding.verifyIdentity('in_progress', 'Document uploaded, pending verification', uploadResult.url);
          result = onboarding.verificationChecks.identityVerified;
        } else if (documentType === 'portfolio') {
          // Add to portfolio project
          const projectId = req.body.projectId;
          
          if (!projectId) {
            throw new Error('Project ID is required for portfolio documents');
          }
          
          // Find the project
          const projectIndex = onboarding.portfolio.findIndex(
            project => project._id.toString() === projectId
          );
          
          if (projectIndex === -1) {
            throw new Error('Portfolio project not found');
          }
          
          // Add document
          if (!onboarding.portfolio[projectIndex].documents) {
            onboarding.portfolio[projectIndex].documents = [];
          }
          
          onboarding.portfolio[projectIndex].documents.push({
            name: req.body.name || req.file.originalname,
            url: uploadResult.url,
            type: req.file.mimetype
          });
          
          await onboarding.save();
          result = onboarding.portfolio[projectIndex];
        } else if (documentType === 'contract') {
          // Handle contract signing
          const contractType = req.body.contractType;
          
          if (!contractType || !['nda', 'consultingAgreement', 'codeOfConduct'].includes(contractType)) {
            throw new Error('Valid contract type is required');
          }
          
          await onboarding.signContract(contractType, uploadResult.url);
          result = onboarding.contracts;
        } else {
          // Generic document
          result = {
            name: req.body.name || req.file.originalname,
            type: req.file.mimetype,
            url: uploadResult.url
          };
        }
        
        res.status(200).json({
          success: true,
          message: 'Document uploaded successfully',
          documentType,
          result
        });
      } catch (error) {
        logger.error(`Error processing document upload:`, error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to process document upload'
        });
      }
    });
  }

  /**
   * Submit feedback for client onboarding
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitClientFeedback(req, res) {
    try {
      const clientId = req.params.clientId || req.user.id;
      const { rating, comments } = req.body;
      
      // Validate inputs
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Valid rating is required (1-5)'
        });
      }
      
      // Get onboarding
      const onboarding = await OnboardingService.getClientOnboarding(clientId);
      
      // Submit feedback
      await onboarding.submitFeedback(rating, comments);
      
      res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully',
        feedback: onboarding.feedback
      });
    } catch (error) {
      logger.error(`Error submitting client feedback:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to submit feedback'
      });
    }
  }
}

module.exports = OnboardingController;