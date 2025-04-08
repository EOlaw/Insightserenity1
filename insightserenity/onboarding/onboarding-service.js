/**
 * @file Onboarding Service
 * @description Service layer for user onboarding-related operations
 */

const ClientOnboarding = require('./client-onboarding-model');
const ConsultantOnboarding = require('./consultant-onboarding-model');
const User = require('../users/user-model');
const Client = require('../users/client-model');
const Consultant = require('../users/consultant-model');
const Service = require('../services/service-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const emailService = require('../services/email-service');

/**
 * Onboarding Service
 * Handles all onboarding-related business logic
 */
class OnboardingService {
  /**
   * Initialize client onboarding
   * @param {string} clientId - User ID of client
   * @returns {Object} Initialized onboarding object
   */
  static async initializeClientOnboarding(clientId) {
    try {
      // Check if user exists and is a client
      const user = await User.findById(clientId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== 'client') {
        throw new Error('User is not a client');
      }
      
      // Check if onboarding already exists
      const existingOnboarding = await ClientOnboarding.findOne({ client: clientId });
      
      if (existingOnboarding) {
        return existingOnboarding;
      }
      
      // Define standard onboarding steps
      const onboardingSteps = [
        {
          step: 1,
          name: 'Welcome',
          description: 'Introduction to the platform',
          status: 'pending',
          isRequired: true
        },
        {
          step: 2,
          name: 'Company Information',
          description: 'Basic information about your company',
          status: 'pending',
          isRequired: true
        },
        {
          step: 3,
          name: 'Business Needs Assessment',
          description: 'Help us understand your consulting needs',
          status: 'pending',
          isRequired: true
        },
        {
          step: 4,
          name: 'Service Preferences',
          description: 'Select services you are interested in',
          status: 'pending',
          isRequired: true
        },
        {
          step: 5,
          name: 'Budget and Timeframe',
          description: 'Expected budget and project timeframe',
          status: 'pending',
          isRequired: true
        },
        {
          step: 6,
          name: 'Document Upload',
          description: 'Upload any relevant documents',
          status: 'pending',
          isRequired: false
        },
        {
          step: 7,
          name: 'Consultant Matching',
          description: 'Review recommended consultants',
          status: 'pending',
          isRequired: true
        },
        {
          step: 8,
          name: 'Welcome Call Scheduling',
          description: 'Schedule an introductory call',
          status: 'pending',
          isRequired: false
        }
      ];
      
      // Create new onboarding
      const onboarding = new ClientOnboarding({
        client: clientId,
        status: 'not_started',
        currentStep: 1,
        steps: onboardingSteps,
        startedAt: new Date()
      });
      
      await onboarding.save();
      
      // Send welcome email
      try {
        await emailService.sendClientOnboardingWelcome(user.email, user.profile.firstName);
      } catch (error) {
        logger.error('Error sending client onboarding welcome email:', error);
        // Continue even if email fails
      }
      
      return onboarding;
    } catch (error) {
      logger.error('Error initializing client onboarding:', error);
      throw error;
    }
  }

  /**
   * Initialize consultant onboarding
   * @param {string} consultantId - User ID of consultant
   * @returns {Object} Initialized onboarding object
   */
  static async initializeConsultantOnboarding(consultantId) {
    try {
      // Check if user exists and is a consultant
      const user = await User.findById(consultantId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== 'consultant') {
        throw new Error('User is not a consultant');
      }
      
      // Check if onboarding already exists
      const existingOnboarding = await ConsultantOnboarding.findOne({ consultant: consultantId });
      
      if (existingOnboarding) {
        return existingOnboarding;
      }
      
      // Define standard onboarding steps
      const onboardingSteps = [
        {
          step: 1,
          name: 'Welcome',
          description: 'Introduction to the platform',
          status: 'pending',
          isRequired: true
        },
        {
          step: 2,
          name: 'Professional Information',
          description: 'Your professional background and expertise',
          status: 'pending',
          isRequired: true
        },
        {
          step: 3,
          name: 'Education and Certifications',
          description: 'Your educational background and certifications',
          status: 'pending',
          isRequired: true
        },
        {
          step: 4,
          name: 'Work History',
          description: 'Your previous work experience',
          status: 'pending',
          isRequired: true
        },
        {
          step: 5,
          name: 'Portfolio',
          description: 'Showcase your previous projects',
          status: 'pending',
          isRequired: true
        },
        {
          step: 6,
          name: 'Service Offerings',
          description: 'Define the services you offer',
          status: 'pending',
          isRequired: true
        },
        {
          step: 7,
          name: 'Identity Verification',
          description: 'Verify your identity',
          status: 'pending',
          isRequired: true
        },
        {
          step: 8,
          name: 'Legal Agreements',
          description: 'Review and sign required agreements',
          status: 'pending',
          isRequired: true
        },
        {
          step: 9,
          name: 'Payment Information',
          description: 'Set up your payment details',
          status: 'pending',
          isRequired: true
        },
        {
          step: 10,
          name: 'Training',
          description: 'Complete required platform training',
          status: 'pending',
          isRequired: true
        },
        {
          step: 11,
          name: 'Availability',
          description: 'Set your availability schedule',
          status: 'pending',
          isRequired: true
        },
        {
          step: 12,
          name: 'Interview Scheduling',
          description: 'Schedule a verification interview',
          status: 'pending',
          isRequired: true
        }
      ];
      
      // Create new onboarding
      const onboarding = new ConsultantOnboarding({
        consultant: consultantId,
        status: 'not_started',
        currentStep: 1,
        steps: onboardingSteps,
        startedAt: new Date()
      });
      
      await onboarding.save();
      
      // Send welcome email
      try {
        await emailService.sendConsultantOnboardingWelcome(user.email, user.profile.firstName);
      } catch (error) {
        logger.error('Error sending consultant onboarding welcome email:', error);
        // Continue even if email fails
      }
      
      return onboarding;
    } catch (error) {
      logger.error('Error initializing consultant onboarding:', error);
      throw error;
    }
  }

  /**
   * Get client onboarding data
   * @param {string} clientId - User ID of client
   * @param {Object} options - Query options
   * @returns {Object} Onboarding data
   */
  static async getClientOnboarding(clientId, options = {}) {
    try {
      let query = ClientOnboarding.findOne({ client: clientId });
      
      // Add population options
      if (options.includeClient) {
        query = query.populate('client', 'email profile.firstName profile.lastName profile.avatarUrl');
      }
      
      if (options.includeAssignee) {
        query = query.populate('assignedTo', 'email profile.firstName profile.lastName profile.avatarUrl');
      }
      
      if (options.includeRecommendedConsultants) {
        query = query.populate('recommendedConsultants.consultant', 'profile.firstName profile.lastName professional.title profile.avatarUrl');
      }
      
      if (options.includeRecommendedServices) {
        query = query.populate('recommendedServices.service', 'name description.short category');
      }
      
      const onboarding = await query.exec();
      
      if (!onboarding) {
        if (options.initialize) {
          return this.initializeClientOnboarding(clientId);
        }
        throw new Error('Client onboarding not found');
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error getting client onboarding for ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Get consultant onboarding data
   * @param {string} consultantId - User ID of consultant
   * @param {Object} options - Query options
   * @returns {Object} Onboarding data
   */
  static async getConsultantOnboarding(consultantId, options = {}) {
    try {
      let query = ConsultantOnboarding.findOne({ consultant: consultantId });
      
      // Add population options
      if (options.includeConsultant) {
        query = query.populate('consultant', 'email profile.firstName profile.lastName profile.avatarUrl');
      }
      
      if (options.includeReviewer) {
        query = query.populate('reviewedBy', 'email profile.firstName profile.lastName profile.avatarUrl');
      }
      
      if (options.includeServiceOfferings) {
        query = query.populate('serviceOfferings.service', 'name description.short category');
      }
      
      if (options.includeInterviews) {
        query = query.populate('interviews.interviewerId', 'email profile.firstName profile.lastName');
      }
      
      const onboarding = await query.exec();
      
      if (!onboarding) {
        if (options.initialize) {
          return this.initializeConsultantOnboarding(consultantId);
        }
        throw new Error('Consultant onboarding not found');
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error getting consultant onboarding for ${consultantId}:`, error);
      throw error;
    }
  }

  /**
   * Update client onboarding step
   * @param {string} clientId - User ID of client
   * @param {number} stepNumber - Step number to update
   * @param {string} status - New status
   * @param {Object} data - Step data to save
   * @returns {Object} Updated onboarding
   */
  static async updateClientOnboardingStep(clientId, stepNumber, status, data = null) {
    try {
      const onboarding = await this.getClientOnboarding(clientId, { initialize: true });
      
      await onboarding.updateStepStatus(stepNumber, status, data);
      
      // Handle specific step data
      if (stepNumber === 2 && data && data.companyInfo) {
        // Update company info
        onboarding.companyInfo = {
          ...onboarding.companyInfo,
          ...data.companyInfo
        };
        await onboarding.save();
        
        // Update client profile if it exists
        try {
          const client = await Client.findOne({ user: clientId });
          if (client && client.company) {
            client.company = {
              ...client.company,
              name: data.companyInfo.name || client.company.name,
              industry: data.companyInfo.industry || client.company.industry,
              size: data.companyInfo.size || client.company.size,
              website: data.companyInfo.website || client.company.website
            };
            await client.save();
          }
        } catch (error) {
          logger.error('Error updating client profile company info:', error);
          // Continue even if profile update fails
        }
      } else if (stepNumber === 3 && data && data.needsAssessment) {
        // Update needs assessment
        onboarding.needsAssessment = {
          ...onboarding.needsAssessment,
          ...data.needsAssessment
        };
        await onboarding.save();
      } else if (stepNumber === 4 && data && data.servicesInterested) {
        // Update service preferences
        onboarding.preferences.servicesInterested = data.servicesInterested;
        await onboarding.save();
        
        // Generate service recommendations based on interests
        await this.generateServiceRecommendations(onboarding._id);
      } else if (stepNumber === 5 && data && (data.budgetRange || data.projectTimeframe)) {
        // Update budget and timeframe
        if (data.budgetRange) {
          onboarding.preferences.budgetRange = data.budgetRange;
        }
        
        if (data.projectTimeframe) {
          onboarding.preferences.projectTimeframe = data.projectTimeframe;
        }
        
        await onboarding.save();
      } else if (stepNumber === 7 && status === 'completed') {
        // If consultant matching is completed, check if we need to generate recs
        if (!onboarding.recommendedConsultants || onboarding.recommendedConsultants.length === 0) {
          await this.generateConsultantRecommendations(onboarding._id);
        }
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error updating client onboarding step ${stepNumber} for ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Update consultant onboarding step
   * @param {string} consultantId - User ID of consultant
   * @param {number} stepNumber - Step number to update
   * @param {string} status - New status
   * @param {Object} data - Step data to save
   * @returns {Object} Updated onboarding
   */
  static async updateConsultantOnboardingStep(consultantId, stepNumber, status, data = null) {
    try {
      const onboarding = await this.getConsultantOnboarding(consultantId, { initialize: true });
      
      await onboarding.updateStepStatus(stepNumber, status, data);
      
      // Handle specific step data
      if (stepNumber === 2 && data && data.professionalInfo) {
        // Update professional info
        onboarding.professionalInfo = {
          ...onboarding.professionalInfo,
          ...data.professionalInfo
        };
        await onboarding.save();
        
        // Update consultant profile if it exists
        try {
          const consultant = await Consultant.findOne({ user: consultantId });
          if (consultant && consultant.professional) {
            consultant.professional = {
              ...consultant.professional,
              title: data.professionalInfo.title || consultant.professional.title,
              yearsOfExperience: data.professionalInfo.yearsOfExperience || consultant.professional.yearsOfExperience,
              summary: data.professionalInfo.summary || consultant.professional.summary
            };
            
            // Update expertise
            if (data.professionalInfo.expertise) {
              consultant.expertise = {
                ...consultant.expertise,
                skills: data.professionalInfo.expertise,
                primarySpecialty: data.professionalInfo.specialty || consultant.expertise.primarySpecialty
              };
            }
            
            await consultant.save();
          }
        } catch (error) {
          logger.error('Error updating consultant profile professional info:', error);
          // Continue even if profile update fails
        }
      } else if (stepNumber === 3 && data) {
        // Handle education and certifications
        if (data.education) {
          // Add education entries
          if (Array.isArray(data.education)) {
            data.education.forEach(async (edu) => {
              const existing = onboarding.professionalInfo.education.find(e => 
                e.institution === edu.institution && 
                e.degree === edu.degree
              );
              
              if (!existing) {
                onboarding.professionalInfo.education.push(edu);
              }
            });
          } else {
            onboarding.professionalInfo.education.push(data.education);
          }
        }
        
        if (data.certifications) {
          // Add certification entries
          if (Array.isArray(data.certifications)) {
            data.certifications.forEach(async (cert) => {
              const existing = onboarding.professionalInfo.certifications.find(c => 
                c.name === cert.name && 
                c.issuer === cert.issuer
              );
              
              if (!existing) {
                onboarding.professionalInfo.certifications.push(cert);
              }
            });
          } else {
            onboarding.professionalInfo.certifications.push(data.certifications);
          }
        }
        
        await onboarding.save();
      } else if (stepNumber === 4 && data && data.workHistory) {
        // Add work history entries
        if (Array.isArray(data.workHistory)) {
          data.workHistory.forEach(async (work) => {
            const existing = onboarding.workHistory.find(w => 
              w.company === work.company && 
              w.position === work.position
            );
            
            if (!existing) {
              onboarding.workHistory.push(work);
            }
          });
        } else {
          onboarding.workHistory.push(data.workHistory);
        }
        
        await onboarding.save();
      } else if (stepNumber === 5 && data && data.portfolio) {
        // Add portfolio entries
        if (Array.isArray(data.portfolio)) {
          data.portfolio.forEach(async (project) => {
            const existing = onboarding.portfolio.find(p => 
              p.projectTitle === project.projectTitle && 
              p.client === project.client
            );
            
            if (!existing) {
              onboarding.portfolio.push(project);
            }
          });
        } else {
          onboarding.portfolio.push(data.portfolio);
        }
        
        await onboarding.save();
      } else if (stepNumber === 6 && data && data.serviceOfferings) {
        // Add service offerings
        if (Array.isArray(data.serviceOfferings)) {
          for (const service of data.serviceOfferings) {
            await onboarding.addServiceOffering(service);
          }
        } else {
          await onboarding.addServiceOffering(data.serviceOfferings);
        }
      } else if (stepNumber === 7 && data && data.identityVerification) {
        // Update identity verification
        await onboarding.verifyIdentity(
          data.identityVerification.status,
          data.identityVerification.notes,
          data.identityVerification.documentUrl
        );
      } else if (stepNumber === 8 && data && data.legalAgreements) {
        // Sign agreements
        if (data.legalAgreements.nda) {
          await onboarding.signContract('nda', data.legalAgreements.nda);
        }
        
        if (data.legalAgreements.consultingAgreement) {
          await onboarding.signContract('consultingAgreement', data.legalAgreements.consultingAgreement);
        }
        
        if (data.legalAgreements.codeOfConduct) {
          await onboarding.signContract('codeOfConduct', data.legalAgreements.codeOfConduct);
        }
      } else if (stepNumber === 9 && data && data.paymentInformation) {
        // Update payment information
        await onboarding.updatePaymentInformation(data.paymentInformation);
      } else if (stepNumber === 10 && data && data.training) {
        // Complete training
        if (data.training.platformTraining) {
          await onboarding.completeTraining('platformTraining', data.training.platformTraining.score);
        }
        
        if (data.training.clientInteractionTraining) {
          await onboarding.completeTraining('clientInteractionTraining', data.training.clientInteractionTraining.score);
        }
      } else if (stepNumber === 11 && data && data.availability) {
        // Update availability
        await onboarding.updateAvailability(data.availability);
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error updating consultant onboarding step ${stepNumber} for ${consultantId}:`, error);
      throw error;
    }
  }

  /**
   * Generate service recommendations for client
   * @param {string} onboardingId - Client onboarding ID
   * @returns {Array} Recommended services
   */
  static async generateServiceRecommendations(onboardingId) {
    try {
      const onboarding = await ClientOnboarding.findById(onboardingId);
      
      if (!onboarding) {
        throw new Error('Client onboarding not found');
      }
      
      // Clear existing recommendations
      onboarding.recommendedServices = [];
      
      // Get services that match client's interests and industry
      const interestedServices = onboarding.preferences.servicesInterested || [];
      const clientIndustry = onboarding.companyInfo.industry || 
                           (onboarding.preferences.industry ? [onboarding.preferences.industry] : []);
      
      // Find services that match criteria
      const services = await Service.find({
        status: 'published',
        $or: [
          { name: { $in: interestedServices } },
          { category: { $in: interestedServices } }
        ]
      }).limit(5);
      
      // Add recommendations
      for (const service of services) {
        // Calculate match score based on industry alignment
        let matchScore = 75; // Base score
        
        if (service.industries && service.industries.some(ind => clientIndustry.includes(ind))) {
          matchScore += 25; // Boost score for industry match
        }
        
        // Add recommendation
        onboarding.recommendedServices.push({
          service: service._id,
          matchScore,
          reason: `This service aligns with your ${service.category} needs`
        });
      }
      
      await onboarding.save();
      
      return onboarding.recommendedServices;
    } catch (error) {
      logger.error(`Error generating service recommendations for onboarding ${onboardingId}:`, error);
      throw error;
    }
  }

  /**
   * Generate consultant recommendations for client
   * @param {string} onboardingId - Client onboarding ID
   * @returns {Array} Recommended consultants
   */
  static async generateConsultantRecommendations(onboardingId) {
    try {
      const onboarding = await ClientOnboarding.findById(onboardingId);
      
      if (!onboarding) {
        throw new Error('Client onboarding not found');
      }
      
      // Clear existing recommendations
      onboarding.recommendedConsultants = [];
      
      // Get client preferences
      const interestedServices = onboarding.preferences.servicesInterested || [];
      const clientIndustry = onboarding.companyInfo.industry || 
                           (onboarding.preferences.industry ? onboarding.preferences.industry : null);
      
      // Find consultants that match criteria
      const consultants = await Consultant.find({
        'settings.availableForWork': true,
        $or: [
          { 'expertise.skills': { $in: interestedServices } },
          { 'expertise.industries': clientIndustry },
          { 'expertise.primarySpecialty': { $in: interestedServices } }
        ]
      })
        .populate('user', 'profile.firstName profile.lastName profile.avatarUrl')
        .limit(5);
      
      // Add recommendations
      for (const consultant of consultants) {
        // Calculate match score based on alignment
        let matchScore = 70; // Base score
        
        // Check for service match
        if (consultant.expertise.skills && consultant.expertise.skills.some(skill => interestedServices.includes(skill))) {
          matchScore += 15;
        }
        
        // Check for industry match
        if (clientIndustry && consultant.expertise.industries && 
            consultant.expertise.industries.includes(clientIndustry)) {
          matchScore += 15;
        }
        
        // Add recommendation if the user ID exists
        if (consultant.user) {
          onboarding.recommendedConsultants.push({
            consultant: consultant.user._id,
            matchScore,
            reason: `This consultant specializes in ${consultant.expertise.primarySpecialty || 'your areas of interest'} with ${consultant.professional.yearsOfExperience || 'relevant'} years of experience`,
            status: 'recommended'
          });
        }
      }
      
      await onboarding.save();
      
      return onboarding.recommendedConsultants;
    } catch (error) {
      logger.error(`Error generating consultant recommendations for onboarding ${onboardingId}:`, error);
      throw error;
    }
  }

  /**
   * Update consultant recommendation status
   * @param {string} clientId - User ID of client
   * @param {string} consultantId - User ID of consultant
   * @param {string} status - New status (recommended, viewed, contacted, rejected)
   * @returns {Object} Updated onboarding
   */
  static async updateConsultantRecommendationStatus(clientId, consultantId, status) {
    try {
      const onboarding = await this.getClientOnboarding(clientId);
      
      const recIndex = onboarding.recommendedConsultants.findIndex(
        rec => rec.consultant.toString() === consultantId
      );
      
      if (recIndex === -1) {
        throw new Error('Consultant recommendation not found');
      }
      
      onboarding.recommendedConsultants[recIndex].status = status;
      onboarding.lastActivity = new Date();
      
      await onboarding.save();
      
      return onboarding;
    } catch (error) {
      logger.error(`Error updating consultant recommendation status for client ${clientId} and consultant ${consultantId}:`, error);
      throw error;
    }
  }

  /**
   * Schedule a session for client onboarding
   * @param {string} clientId - User ID of client
   * @param {Object} sessionData - Session data
   * @returns {Object} Updated onboarding with new session
   */
  static async scheduleClientSession(clientId, sessionData) {
    try {
      const onboarding = await this.getClientOnboarding(clientId);
      
      // Validate session data
      if (!sessionData.sessionType || !sessionData.scheduledAt) {
        throw new Error('Session type and scheduled date are required');
      }
      
      // Add session
      await onboarding.addSession(sessionData);
      
      // If this is a welcome call, update step 8
      if (sessionData.sessionType === 'welcome_call') {
        await onboarding.updateStepStatus(8, 'completed');
      }
      
      // Send notification email to client
      try {
        const user = await User.findById(clientId);
        if (user) {
          await emailService.sendSessionScheduled(
            user.email,
            user.profile.firstName,
            sessionData.sessionType,
            new Date(sessionData.scheduledAt)
          );
        }
      } catch (error) {
        logger.error('Error sending session notification email:', error);
        // Continue even if email fails
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error scheduling session for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Schedule an interview for consultant onboarding
   * @param {string} consultantId - User ID of consultant
   * @param {Object} interviewData - Interview data
   * @returns {Object} Updated onboarding with new interview
   */
  static async scheduleConsultantInterview(consultantId, interviewData) {
    try {
      const onboarding = await this.getConsultantOnboarding(consultantId);
      
      // Validate interview data
      if (!interviewData.interviewerId || !interviewData.scheduledAt) {
        throw new Error('Interviewer and scheduled date are required');
      }
      
      // Schedule interview
      await onboarding.scheduleInterview(interviewData);
      
      // Update step 12
      await onboarding.updateStepStatus(12, 'completed');
      
      // Send notification email to consultant
      try {
        const user = await User.findById(consultantId);
        if (user) {
          await emailService.sendInterviewScheduled(
            user.email,
            user.profile.firstName,
            new Date(interviewData.scheduledAt)
          );
        }
      } catch (error) {
        logger.error('Error sending interview notification email:', error);
        // Continue even if email fails
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error scheduling interview for consultant ${consultantId}:`, error);
      throw error;
    }
  }

  /**
   * Submit consultant onboarding for review
   * @param {string} consultantId - User ID of consultant
   * @returns {Object} Updated onboarding
   */
  static async submitConsultantOnboardingForReview(consultantId) {
    try {
      const onboarding = await this.getConsultantOnboarding(consultantId);
      
      await onboarding.submitForReview();
      
      // Send notification to admins
      try {
        const admins = await User.find({ role: 'admin' });
        const consultant = await User.findById(consultantId);
        
        if (consultant && admins.length > 0) {
          // Send notification to first admin for now (could be improved)
          await emailService.sendConsultantReviewNotification(
            admins[0].email,
            `${consultant.profile.firstName} ${consultant.profile.lastName}`,
            consultant._id
          );
        }
      } catch (error) {
        logger.error('Error sending review notification:', error);
        // Continue even if notification fails
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error submitting consultant onboarding for review ${consultantId}:`, error);
      throw error;
    }
  }

  /**
   * Review consultant onboarding
   * @param {string} consultantId - User ID of consultant
   * @param {string} reviewerId - User ID of reviewer
   * @param {string} decision - Decision (approve/reject)
   * @param {string} notes - Review notes
   * @returns {Object} Updated onboarding
   */
  static async reviewConsultantOnboarding(consultantId, reviewerId, decision, notes = '') {
    try {
      const onboarding = await this.getConsultantOnboarding(consultantId);
      
      if (onboarding.status !== 'under_review') {
        throw new Error('Onboarding is not under review');
      }
      
      if (decision === 'approve') {
        await onboarding.approve(reviewerId, notes);
        
        // Update consultant profile status
        try {
          const consultant = await Consultant.findOne({ user: consultantId });
          if (consultant) {
            consultant.settings.profileVisibility = 'public';
            consultant.settings.availableForWork = true;
            await consultant.save();
          }
          
          // Update user account status
          const user = await User.findById(consultantId);
          if (user) {
            user.security.accountStatus = 'active';
            await user.save();
            
            // Send approval email
            await emailService.sendConsultantApproval(
              user.email,
              user.profile.firstName
            );
          }
        } catch (error) {
          logger.error('Error updating consultant profile after approval:', error);
          // Continue even if profile update fails
        }
      } else if (decision === 'reject') {
        await onboarding.reject(reviewerId, notes);
        
        // Send rejection email
        try {
          const user = await User.findById(consultantId);
          if (user) {
            await emailService.sendConsultantRejection(
              user.email,
              user.profile.firstName,
              notes
            );
          }
        } catch (error) {
          logger.error('Error sending rejection email:', error);
          // Continue even if email fails
        }
      } else {
        throw new Error('Invalid decision. Must be "approve" or "reject"');
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error reviewing consultant onboarding ${consultantId}:`, error);
      throw error;
    }
  }

  /**
   * Complete client onboarding
   * @param {string} clientId - User ID of client
   * @returns {Object} Updated onboarding
   */
  static async completeClientOnboarding(clientId) {
    try {
      const onboarding = await this.getClientOnboarding(clientId);
      
      // Check if all required steps are completed
      const incompleteRequiredSteps = onboarding.steps.filter(
        step => step.isRequired && step.status !== 'completed' && step.status !== 'skipped'
      );
      
      if (incompleteRequiredSteps.length > 0) {
        throw new Error('Cannot complete onboarding. All required steps must be completed first.');
      }
      
      // Set all steps as completed if needed
      let updatedSteps = false;
      for (const step of onboarding.steps) {
        if (step.status !== 'completed' && step.status !== 'skipped') {
          await onboarding.updateStepStatus(step.step, 'skipped');
          updatedSteps = true;
        }
      }
      
      if (!updatedSteps) {
        // Force status update if steps are already completed
        onboarding.status = 'completed';
        onboarding.completedAt = new Date();
        onboarding.progress = 100;
        await onboarding.save();
      }
      
      // Update client profile status
      try {
        const client = await Client.findOne({ user: clientId });
        if (client) {
          client.settings.onboardingCompleted = true;
          await client.save();
        }
        
        // Update user account status
        const user = await User.findById(clientId);
        if (user) {
          user.security.accountStatus = 'active';
          await user.save();
        }
      } catch (error) {
        logger.error('Error updating client profile after onboarding completion:', error);
        // Continue even if profile update fails
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error completing client onboarding ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Complete consultant onboarding
   * @param {string} consultantId - User ID of consultant
   * @returns {Object} Updated onboarding
   */
  static async completeConsultantOnboarding(consultantId) {
    try {
      const onboarding = await this.getConsultantOnboarding(consultantId);
      
      // Can only complete if approved
      if (onboarding.status !== 'approved') {
        throw new Error('Onboarding must be approved before completion');
      }
      
      await onboarding.markCompleted();
      
      // Update consultant profile
      try {
        const consultant = await Consultant.findOne({ user: consultantId });
        if (consultant) {
          consultant.settings.onboardingCompleted = true;
          await consultant.save();
        }
      } catch (error) {
        logger.error('Error updating consultant profile after onboarding completion:', error);
        // Continue even if profile update fails
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error completing consultant onboarding ${consultantId}:`, error);
      throw error;
    }
  }

  /**
   * Get clients with stalled onboarding
   * @param {number} daysThreshold - Days threshold for staleness
   * @returns {Array} Stalled client onboardings
   */
  static async getStalledClientOnboardings(daysThreshold = 7) {
    try {
      return await ClientOnboarding.findStalledClients(daysThreshold);
    } catch (error) {
      logger.error('Error getting stalled client onboardings:', error);
      throw error;
    }
  }

  /**
   * Get consultants with stalled onboarding
   * @param {number} daysThreshold - Days threshold for staleness
   * @returns {Array} Stalled consultant onboardings
   */
  static async getStalledConsultantOnboardings(daysThreshold = 7) {
    try {
      return await ConsultantOnboarding.findStalledConsultants(daysThreshold);
    } catch (error) {
      logger.error('Error getting stalled consultant onboardings:', error);
      throw error;
    }
  }

  /**
   * Get consultants pending review
   * @returns {Array} Consultant onboardings under review
   */
  static async getConsultantsPendingReview() {
    try {
      return await ConsultantOnboarding.findPendingReview();
    } catch (error) {
      logger.error('Error getting consultants pending review:', error);
      throw error;
    }
  }

  /**
   * Assign client onboarding to team member
   * @param {string} clientId - User ID of client
   * @param {string} assigneeId - User ID of assignee
   * @returns {Object} Updated onboarding
   */
  static async assignClientOnboarding(clientId, assigneeId) {
    try {
      const onboarding = await this.getClientOnboarding(clientId);
      
      // Verify assignee exists and is admin or consultant
      const assignee = await User.findById(assigneeId);
      
      if (!assignee) {
        throw new Error('Assignee not found');
      }
      
      if (assignee.role !== 'admin' && assignee.role !== 'consultant') {
        throw new Error('Assignee must be an admin or consultant');
      }
      
      onboarding.assignedTo = assigneeId;
      onboarding.lastActivity = new Date();
      
      await onboarding.save();
      
      // Send assignment notification
      try {
        const client = await User.findById(clientId);
        
        await emailService.sendOnboardingAssignment(
          assignee.email,
          assignee.profile.firstName,
          client ? `${client.profile.firstName} ${client.profile.lastName}` : 'a client',
          clientId
        );
      } catch (error) {
        logger.error('Error sending assignment notification:', error);
        // Continue even if notification fails
      }
      
      return onboarding;
    } catch (error) {
      logger.error(`Error assigning client onboarding ${clientId} to ${assigneeId}:`, error);
      throw error;
    }
  }

  /**
   * Add a reminder for client or consultant
   * @param {string} userId - User ID of client or consultant
   * @param {string} userType - Type of user (client or consultant)
   * @param {Object} reminderData - Reminder data
   * @returns {Object} Updated onboarding
   */
  static async addReminder(userId, userType, reminderData) {
    try {
      let onboarding;
      
      if (userType === 'client') {
        onboarding = await this.getClientOnboarding(userId);
      } else if (userType === 'consultant') {
        onboarding = await this.getConsultantOnboarding(userId);
      } else {
        throw new Error('Invalid user type. Must be "client" or "consultant"');
      }
      
      await onboarding.addReminder(reminderData);
      
      return onboarding;
    } catch (error) {
      logger.error(`Error adding reminder for ${userType} ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get onboarding statistics
   * @returns {Object} Onboarding statistics
   */
  static async getOnboardingStats() {
    try {
      const stats = {
        clients: {},
        consultants: {}
      };
      
      // Client stats
      stats.clients.total = await ClientOnboarding.countDocuments();
      stats.clients.completed = await ClientOnboarding.countDocuments({ status: 'completed' });
      stats.clients.inProgress = await ClientOnboarding.countDocuments({ status: 'in_progress' });
      stats.clients.notStarted = await ClientOnboarding.countDocuments({ status: 'not_started' });
      stats.clients.stalled = await ClientOnboarding.countDocuments({
        status: 'in_progress',
        lastActivity: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
      
      // Consultant stats
      stats.consultants.total = await ConsultantOnboarding.countDocuments();
      stats.consultants.completed = await ConsultantOnboarding.countDocuments({ status: 'completed' });
      stats.consultants.inProgress = await ConsultantOnboarding.countDocuments({ status: 'in_progress' });
      stats.consultants.notStarted = await ConsultantOnboarding.countDocuments({ status: 'not_started' });
      stats.consultants.underReview = await ConsultantOnboarding.countDocuments({ status: 'under_review' });
      stats.consultants.approved = await ConsultantOnboarding.countDocuments({ status: 'approved' });
      stats.consultants.rejected = await ConsultantOnboarding.countDocuments({ status: 'rejected' });
      stats.consultants.stalled = await ConsultantOnboarding.countDocuments({
        status: 'in_progress',
        lastActivity: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
      
      // Time statistics
      const clientOnboardings = await ClientOnboarding.find({ 
        status: 'completed',
        startedAt: { $exists: true },
        completedAt: { $exists: true }
      });
      
      const consultantOnboardings = await ConsultantOnboarding.find({ 
        status: 'completed',
        startedAt: { $exists: true },
        completedAt: { $exists: true }
      });
      
      // Calculate average completion time
      let clientCompletionDays = 0;
      clientOnboardings.forEach(onboarding => {
        const startTime = new Date(onboarding.startedAt).getTime();
        const endTime = new Date(onboarding.completedAt).getTime();
        const daysDiff = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
        clientCompletionDays += daysDiff;
      });
      
      let consultantCompletionDays = 0;
      consultantOnboardings.forEach(onboarding => {
        const startTime = new Date(onboarding.startedAt).getTime();
        const endTime = new Date(onboarding.completedAt).getTime();
        const daysDiff = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
        consultantCompletionDays += daysDiff;
      });
      
      stats.clients.avgCompletionDays = clientOnboardings.length > 0 
        ? Math.round(clientCompletionDays / clientOnboardings.length) 
        : 0;
      
      stats.consultants.avgCompletionDays = consultantOnboardings.length > 0 
        ? Math.round(consultantCompletionDays / consultantOnboardings.length) 
        : 0;
      
      return stats;
    } catch (error) {
      logger.error('Error getting onboarding stats:', error);
      throw error;
    }
  }
}

module.exports = OnboardingService;