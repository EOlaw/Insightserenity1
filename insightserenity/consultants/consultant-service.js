/**
 * @file Consultant Service
 * @description Service layer for consultant-specific operations
 */

const Consultant = require('../users/consultant-model');
const User = require('../users/user-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');
const Project = require('../projects/project-model'); // You'll need to create this model
const Conversation = require('../messaging/conversation-model'); // You'll need to create this model
const Proposal = require('../projects/proposal-model'); // Model for project proposals

/**
 * Consultant Service
 * Handles all consultant-specific business logic
 */
class ConsultantService {
  /**
   * Get consultant dashboard data
   * @param {string} userId - User ID
   * @returns {Object} Dashboard data
   */
  static async getDashboardData(userId) {
    try {
      // Get consultant profile
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Get projects count
      const projectCount = await Project.countDocuments({ consultant: consultant._id });
      
      // Get active projects
      const activeProjects = await Project.find({ 
        consultant: consultant._id,
        status: { $in: ['active', 'in_progress'] }
      })
      .limit(5)
      .sort({ updatedAt: -1 })
      .populate('client', 'user');
      
      // Get proposals count
      const proposalCount = await Proposal.countDocuments({ 
        consultant: consultant._id,
        status: { $in: ['pending', 'under_review'] }
      });
      
      // Get unread message count
      const unreadMessages = await Conversation.aggregate([
        { $match: { participants: consultant._id } },
        { $unwind: '$messages' },
        { $match: { 'messages.readBy': { $ne: consultant._id } } },
        { $count: 'total' }
      ]);
      
      // Get project matches based on skills
      const projectMatches = await this.getMatchingProjects(userId, 3);
      
      // Get recent reviews
      const recentReviews = await this.getConsultantReviews(userId, 3);
      
      return {
        profileCompletionPercentage: consultant.profileCompletionPercentage || 0,
        metrics: consultant.metrics || {},
        projectStats: {
          total: projectCount,
          active: activeProjects.length,
          completed: consultant.metrics?.projectsCompleted || 0,
          totalEarned: consultant.metrics?.totalEarned || 0
        },
        activeProjects,
        proposalCount,
        unreadMessages: unreadMessages[0]?.total || 0,
        projectMatches,
        recentReviews,
        availability: consultant.services?.availability || {}
      };
    } catch (error) {
      logger.error('Error getting consultant dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get consultant projects
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Consultant projects
   */
  static async getConsultantProjects(userId, options = {}) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Build query
      const query = { consultant: consultant._id };
      
      // Add status filter if provided
      if (options.status) {
        query.status = options.status;
      }
      
      // Add date filters if provided
      if (options.startDate || options.endDate) {
        query.createdAt = {};
        if (options.startDate) {
          query.createdAt.$gte = new Date(options.startDate);
        }
        if (options.endDate) {
          query.createdAt.$lte = new Date(options.endDate);
        }
      }
      
      // Build sort options
      const sort = {};
      if (options.sortBy) {
        sort[options.sortBy] = options.sortOrder === 'asc' ? 1 : -1;
      } else {
        sort.createdAt = -1; // Default sort by creation date, newest first
      }
      
      // Get projects with pagination
      const limit = options.limit || 10;
      const skip = options.page ? (options.page - 1) * limit : 0;
      
      const projects = await Project.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('client', 'user company');
      
      // Get total count for pagination
      const totalCount = await Project.countDocuments(query);
      
      return {
        projects,
        pagination: {
          total: totalCount,
          page: options.page || 1,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting consultant projects:', error);
      throw error;
    }
  }

  /**
   * Get consultant proposals
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Consultant proposals
   */
  static async getConsultantProposals(userId, options = {}) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Build query
      const query = { consultant: consultant._id };
      
      // Add status filter if provided
      if (options.status) {
        query.status = options.status;
      }
      
      // Build sort options
      const sort = {};
      if (options.sortBy) {
        sort[options.sortBy] = options.sortOrder === 'asc' ? 1 : -1;
      } else {
        sort.createdAt = -1; // Default sort by creation date, newest first
      }
      
      // Get proposals with pagination
      const limit = options.limit || 10;
      const skip = options.page ? (options.page - 1) * limit : 0;
      
      const proposals = await Proposal.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('project')
        .populate('client', 'user company');
      
      // Get total count for pagination
      const totalCount = await Proposal.countDocuments(query);
      
      return {
        proposals,
        pagination: {
          total: totalCount,
          page: options.page || 1,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting consultant proposals:', error);
      throw error;
    }
  }

  /**
   * Get projects matching consultant skills
   * @param {string} userId - User ID
   * @param {number} limit - Number of projects to return
   * @returns {Array} Matching projects
   */
  static async getMatchingProjects(userId, limit = 5) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Get consultant skills
      const skills = consultant.expertise?.skills?.map(skill => skill.name) || [];
      
      if (skills.length === 0) {
        return [];
      }
      
      // Find projects matching consultant skills
      const projects = await Project.find({
        // Only show open projects
        status: 'open',
        // Ensure consultant hasn't already applied
        $or: [
          { proposals: { $not: { $elemMatch: { consultant: consultant._id } } } },
          { proposals: { $exists: false } }
        ],
        // Match project requirements to consultant skills
        $or: [
          { 'requirements.skills': { $in: skills } },
          { category: consultant.expertise.primarySpecialty }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('client', 'user company');
      
      return projects;
    } catch (error) {
      logger.error('Error getting matching projects:', error);
      throw error;
    }
  }

  /**
   * Get consultant reviews
   * @param {string} userId - User ID
   * @param {number} limit - Number of reviews to return
   * @returns {Array} Consultant reviews
   */
  static async getConsultantReviews(userId, limit = 10) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Get reviews from consultant model
      // In a real implementation, reviews might be in a separate collection
      const reviews = consultant.reviews?.featured || [];
      
      // Sort by date (newest first) and limit
      return reviews
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);
    } catch (error) {
      logger.error('Error getting consultant reviews:', error);
      throw error;
    }
  }

  /**
   * Get consultant conversations
   * @param {string} userId - User ID
   * @returns {Array} Consultant conversations
   */
  static async getConsultantConversations(userId) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // This would fetch conversations from the database
      // For now, return an empty array
      return [];
    } catch (error) {
      logger.error('Error getting consultant conversations:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Object} Conversation details
   */
  static async getConversationById(conversationId, userId) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // This would fetch a specific conversation from the database
      // For now, return null
      return null;
    } catch (error) {
      logger.error('Error getting conversation by ID:', error);
      throw error;
    }
  }

  /**
   * Update consultant settings
   * @param {string} userId - User ID
   * @param {Object} settings - Settings to update
   * @returns {Object} Updated consultant
   */
  static async updateConsultantSettings(userId, settings) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Update settings
      if (settings.settings) {
        consultant.settings = {
          ...consultant.settings,
          ...settings.settings
        };
      }
      
      await consultant.save();
      
      return consultant;
    } catch (error) {
      logger.error('Error updating consultant settings:', error);
      throw error;
    }
  }

  /**
   * Update consultant availability
   * @param {string} userId - User ID
   * @param {Object} availabilityData - Availability data
   * @returns {Object} Updated consultant
   */
  static async updateAvailability(userId, availabilityData) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Ensure services.availability exists
      if (!consultant.services) {
        consultant.services = {};
      }
      
      if (!consultant.services.availability) {
        consultant.services.availability = {};
      }
      
      // Update availability fields
      if (availabilityData.status) {
        consultant.services.availability.status = availabilityData.status;
      }
      
      if (availabilityData.hoursPerWeek !== undefined) {
        consultant.services.availability.hoursPerWeek = availabilityData.hoursPerWeek;
      }
      
      if (availabilityData.nextAvailableDate) {
        consultant.services.availability.nextAvailableDate = new Date(availabilityData.nextAvailableDate);
      }
      
      if (availabilityData.timezone) {
        consultant.services.availability.timezone = availabilityData.timezone;
      }
      
      // Update work schedule if provided
      if (availabilityData.workSchedule) {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        // Initialize work schedule if it doesn't exist
        if (!consultant.services.availability.workSchedule) {
          consultant.services.availability.workSchedule = {};
        }
        
        // Update each day's schedule
        days.forEach(day => {
          if (availabilityData.workSchedule[day]) {
            // Initialize day if it doesn't exist
            if (!consultant.services.availability.workSchedule[day]) {
              consultant.services.availability.workSchedule[day] = {};
            }
            
            // Update availability
            if (availabilityData.workSchedule[day].available !== undefined) {
              consultant.services.availability.workSchedule[day].available = 
                availabilityData.workSchedule[day].available;
            }
            
            // Update hours if day is available
            if (availabilityData.workSchedule[day].available && 
                availabilityData.workSchedule[day].hours) {
              consultant.services.availability.workSchedule[day].hours = 
                availabilityData.workSchedule[day].hours;
            }
          }
        });
      }
      
      // Also update "available for work" setting if status changed
      if (availabilityData.status === 'unavailable') {
        if (!consultant.settings) {
          consultant.settings = {};
        }
        consultant.settings.availableForWork = false;
      } else if (availabilityData.status === 'available' || availabilityData.status === 'limited') {
        if (!consultant.settings) {
          consultant.settings = {};
        }
        consultant.settings.availableForWork = true;
      }
      
      await consultant.save();
      
      return consultant;
    } catch (error) {
      logger.error('Error updating consultant availability:', error);
      throw error;
    }
  }

  /**
   * Upload portfolio image
   * @param {string} userId - User ID
   * @param {Object} file - Image file
   * @returns {string} Uploaded file URL
   */
  static async uploadPortfolioImage(userId, file) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Upload file to storage
      const uploadResult = await fileService.uploadFile(file, 'portfolio', {
        resize: {
          width: 1200,
          height: null, // Maintain aspect ratio
          fit: 'inside',
          quality: 80
        }
      });
      
      return uploadResult.url;
    } catch (error) {
      logger.error('Error uploading portfolio image:', error);
      throw error;
    }
  }

  /**
   * Add portfolio project
   * @param {string} userId - User ID
   * @param {Object} projectData - Project data
   * @returns {Object} Updated consultant
   */
  static async addPortfolioProject(userId, projectData) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Initialize portfolio if it doesn't exist
      if (!consultant.portfolio) {
        consultant.portfolio = { projects: [] };
      }
      
      // Initialize projects array if it doesn't exist
      if (!consultant.portfolio.projects) {
        consultant.portfolio.projects = [];
      }
      
      // Create new portfolio project
      const newProject = {
        title: projectData.title,
        description: projectData.description,
        client: projectData.client,
        year: projectData.year,
        duration: projectData.duration,
        role: projectData.role,
        technologies: projectData.technologies || [],
        outcomes: projectData.outcomes || [],
        imageUrls: projectData.imageUrls || [],
        demoUrl: projectData.demoUrl,
        caseStudyUrl: projectData.caseStudyUrl,
        featured: projectData.featured || false,
        confidential: projectData.confidential || false
      };
      
      // Add project to portfolio
      consultant.portfolio.projects.push(newProject);
      
      await consultant.save();
      
      return consultant;
    } catch (error) {
      logger.error('Error adding portfolio project:', error);
      throw error;
    }
  }

  /**
   * Submit project proposal
   * @param {string} userId - User ID
   * @param {string} projectId - Project ID
   * @param {Object} proposalData - Proposal data
   * @returns {Object} Created proposal
   */
  static async submitProjectProposal(userId, projectId, proposalData) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Check if project exists and is open
      const project = await Project.findById(projectId);
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      if (project.status !== 'open') {
        throw new Error('Project is not open for proposals');
      }
      
      // Check if consultant has already submitted a proposal
      const existingProposal = await Proposal.findOne({
        consultant: consultant._id,
        project: project._id
      });
      
      if (existingProposal) {
        throw new Error('You have already submitted a proposal for this project');
      }
      
      // Create new proposal
      const proposal = new Proposal({
        project: project._id,
        client: project.client,
        consultant: consultant._id,
        coverLetter: proposalData.coverLetter,
        rate: proposalData.rate,
        estimatedHours: proposalData.estimatedHours,
        estimatedDuration: proposalData.estimatedDuration,
        milestones: proposalData.milestones || [],
        status: 'pending',
        submittedAt: new Date()
      });
      
      await proposal.save();
      
      // Update project with proposal reference
      await Project.findByIdAndUpdate(
        project._id,
        { $push: { proposals: proposal._id } }
      );
      
      // Update consultant metrics
      await Consultant.findByIdAndUpdate(
        consultant._id,
        { 
          $inc: { 'metrics.proposalsSubmitted': 1 },
          'metrics.lastActive': new Date()
        }
      );
      
      return proposal;
    } catch (error) {
      logger.error('Error submitting project proposal:', error);
      throw error;
    }
  }

  /**
   * Respond to client inquiry
   * @param {string} userId - User ID
   * @param {string} inquiryId - Inquiry ID
   * @param {string} response - Response message
   * @param {boolean} accept - Whether to accept the inquiry
   * @returns {Object} Updated inquiry
   */
  static async respondToInquiry(userId, inquiryId, response, accept) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Find the inquiry
      const inquiry = await Inquiry.findById(inquiryId);
      
      if (!inquiry) {
        throw new Error('Inquiry not found');
      }
      
      // Verify this inquiry is for this consultant
      if (inquiry.consultant.toString() !== consultant._id.toString()) {
        throw new Error('Unauthorized access to inquiry');
      }
      
      // Update inquiry with response
      inquiry.responses.push({
        message: response,
        sentBy: 'consultant',
        sentAt: new Date()
      });
      
      // Update status based on accept flag
      inquiry.status = accept ? 'accepted' : 'declined';
      inquiry.updatedAt = new Date();
      
      await inquiry.save();
      
      // Update consultant metrics
      await Consultant.findByIdAndUpdate(
        consultant._id,
        { 
          $inc: { 'metrics.inquiriesResponded': 1 },
          'metrics.lastActive': new Date(),
          'metrics.responseTime': await this.calculateAverageResponseTime(consultant._id)
        }
      );
      
      return inquiry;
    } catch (error) {
      logger.error('Error responding to inquiry:', error);
      throw error;
    }
  }

  /**
   * Calculate average response time for consultant
   * @param {string} consultantId - Consultant ID
   * @returns {number} Average response time in hours
   */
  static async calculateAverageResponseTime(consultantId) {
    try {
      // This is a stub - in a real implementation, you would calculate
      // the average time between inquiry creation and first response
      // across multiple inquiries
      
      // For now, return a default value
      return 24; // 24 hours
    } catch (error) {
      logger.error('Error calculating average response time:', error);
      return 24; // Default to 24 hours
    }
  }

  /**
   * Respond to review
   * @param {string} userId - User ID
   * @param {string} reviewId - Review ID
   * @param {string} response - Response message
   * @returns {Object} Updated consultant
   */
  static async respondToReview(userId, reviewId, response) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // Find the review in the featured reviews array
      const reviewIndex = consultant.reviews.featured.findIndex(
        review => review._id.toString() === reviewId
      );
      
      if (reviewIndex === -1) {
        throw new Error('Review not found');
      }
      
      // Add response to the review
      consultant.reviews.featured[reviewIndex].response = {
        comment: response,
        date: new Date()
      };
      
      await consultant.save();
      
      return consultant;
    } catch (error) {
      logger.error('Error responding to review:', error);
      throw error;
    }
  }

  /**
   * Get earnings data
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Earnings data
   */
  static async getEarningsData(userId, options = {}) {
    try {
      const consultant = await Consultant.findOne({ user: userId });
      
      if (!consultant) {
        throw new Error('Consultant profile not found');
      }
      
      // For now, return some basic data from the consultant metrics
      // In a real implementation, you would fetch and aggregate
      // payment data from various sources
      return {
        totalEarned: consultant.metrics?.totalEarned || 0,
        projectsCompleted: consultant.metrics?.projectsCompleted || 0,
        currentMonth: {
          earnings: 0, // This would be calculated in a real implementation
          projects: 0
        },
        previousMonth: {
          earnings: 0,
          projects: 0
        },
        recentPayments: [], // This would be populated in a real implementation
        pendingPayments: []
      };
    } catch (error) {
      logger.error('Error getting earnings data:', error);
      throw error;
    }
  }
}

module.exports = ConsultantService;