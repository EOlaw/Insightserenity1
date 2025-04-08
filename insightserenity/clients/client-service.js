/**
 * @file Client Service
 * @description Service layer for client-specific operations
 */

const Client = require('../users/client-model');
const Consultant = require('../users/consultant-model');
const User = require('../users/user-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Project = require('../projects/project-model'); // You'll need to create this model
const Conversation = require('../messaging/conversation-model'); // You'll need to create this model

/**
 * Client Service
 * Handles all client-specific business logic
 */
class ClientService {
  /**
   * Get client dashboard data
   * @param {string} userId - User ID
   * @returns {Object} Dashboard data
   */
  static async getDashboardData(userId) {
    try {
      // Get client profile
      const client = await Client.findOne({ user: userId });
      
      if (!client) {
        throw new Error('Client profile not found');
      }
      
      // Get projects count
      const projectCount = await Project.countDocuments({ client: client._id });
      
      // Get active projects
      const activeProjects = await Project.find({ 
        client: client._id,
        status: { $in: ['open', 'active', 'in_progress'] }
      })
      .limit(5)
      .sort({ updatedAt: -1 })
      .populate('consultant', 'user');
      
      // Get unread message count
      const unreadMessages = await Conversation.aggregate([
        { $match: { participants: client._id } },
        { $unwind: '$messages' },
        { $match: { 'messages.readBy': { $ne: client._id } } },
        { $count: 'total' }
      ]);
      
      // Get recent activity
      const recentActivity = await this.getClientActivity(client._id, 5);
      
      // Get recommended consultants
      const recommendedConsultants = await this.getRecommendedConsultants(userId, 3);
      
      return {
        profileCompletionPercentage: client.profileCompletionPercentage || 0,
        projectStats: {
          total: projectCount,
          active: activeProjects.length,
          completed: client.activity?.projectCount || 0,
          totalSpent: client.activity?.totalSpent || 0
        },
        activeProjects,
        unreadMessages: unreadMessages[0]?.total || 0,
        recentActivity,
        recommendedConsultants
      };
    } catch (error) {
      logger.error('Error getting client dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get client projects
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Client projects
   */
  static async getClientProjects(userId, options = {}) {
    try {
      const client = await Client.findOne({ user: userId });
      
      if (!client) {
        throw new Error('Client profile not found');
      }
      
      // Build query
      const query = { client: client._id };
      
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
        .populate('consultant', 'user professional')
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
      logger.error('Error getting client projects:', error);
      throw error;
    }
  }

  /**
   * Get specialties list for consultant search
   * @returns {Array} List of specialties
   */
  static async getSpecialtiesList() {
    try {
      // Get distinct specialties from consultant profiles
      const specialties = await Consultant.distinct('expertise.primarySpecialty');
      
      // Map to readable format
      const formattedSpecialties = specialties.map(specialty => ({
        value: specialty,
        label: this.formatSpecialtyName(specialty)
      }));
      
      return formattedSpecialties;
    } catch (error) {
      logger.error('Error getting specialties list:', error);
      throw error;
    }
  }

  /**
   * Format specialty name for display
   * @param {string} specialty - Specialty value
   * @returns {string} Formatted specialty name
   */
  static formatSpecialtyName(specialty) {
    return specialty
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get popular skills for consultant search
   * @param {number} limit - Number of skills to return
   * @returns {Array} List of popular skills
   */
  static async getPopularSkills(limit = 20) {
    try {
      // Aggregate pipeline to get most common skills
      const popularSkills = await Consultant.aggregate([
        { $unwind: '$expertise.skills' },
        { $group: {
            _id: '$expertise.skills.name',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: {
            _id: 0,
            name: '$_id',
            count: 1
          }
        }
      ]);
      
      return popularSkills;
    } catch (error) {
      logger.error('Error getting popular skills:', error);
      throw error;
    }
  }

  /**
   * Search consultants based on criteria
   * @param {Object} searchParams - Search parameters
   * @returns {Array} Matching consultants
   */
  static async searchConsultants(searchParams) {
    try {
      const { query, specialty, skills, maxRate, availability } = searchParams;
      
      // Build query
      const searchQuery = {};
      
      // Add status filters
      searchQuery['settings.availableForWork'] = true;
      searchQuery['settings.profileVisibility'] = { $ne: 'private' };
      
      // Add specialty filter if provided
      if (specialty) {
        searchQuery['expertise.primarySpecialty'] = specialty;
      }
      
      // Add skills filter if provided
      if (skills && skills.length > 0) {
        searchQuery['expertise.skills.name'] = { $in: skills };
      }
      
      // Add rate filter if provided
      if (maxRate) {
        searchQuery['services.rateInfo.hourlyRate'] = { $lte: maxRate };
      }
      
      // Add availability filter if provided
      if (availability) {
        searchQuery['services.availability.status'] = availability;
      }
      
      // Add text search if query provided
      if (query) {
        // Use MongoDB text search if text index exists, otherwise use regex
        try {
          searchQuery.$text = { $search: query };
        } catch (error) {
          // Fallback to regex search
          searchQuery.$or = [
            { 'professional.title': { $regex: query, $options: 'i' } },
            { 'professional.summary': { $regex: query, $options: 'i' } },
            { 'expertise.skills.name': { $regex: query, $options: 'i' } }
          ];
        }
      }
      
      // Execute query
      const consultants = await Consultant.find(searchQuery)
        .sort({ 'reviews.average': -1 })
        .limit(20)
        .populate({
          path: 'user',
          select: 'email profile.firstName profile.lastName profile.avatarUrl'
        });
      
      // Format results
      return consultants.map(consultant => ({
        id: consultant._id,
        userId: consultant.user._id,
        name: `${consultant.user.profile.firstName} ${consultant.user.profile.lastName}`,
        title: consultant.professional.title,
        avatarUrl: consultant.user.profile.avatarUrl,
        hourlyRate: consultant.services.rateInfo.hourlyRate,
        currency: consultant.services.rateInfo.currency,
        rating: consultant.reviews.average,
        reviewCount: consultant.reviews.count,
        skills: consultant.expertise.skills.slice(0, 5).map(skill => skill.name),
        availability: consultant.services.availability.status
      }));
    } catch (error) {
      logger.error('Error searching consultants:', error);
      throw error;
    }
  }

  /**
   * Track client search for analytics
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @returns {boolean} Success status
   */
  static async trackSearch(userId, query) {
    try {
      if (!query) return false;
      
      // Update client activity with search
      await Client.findOneAndUpdate(
        { user: userId },
        { 
          $push: {
            'activity.recentSearches': {
              $each: [{ query, timestamp: new Date() }],
              $position: 0,
              $slice: 10 // Keep only 10 most recent searches
            }
          },
          'activity.lastActive': new Date()
        }
      );
      
      return true;
    } catch (error) {
      logger.error('Error tracking client search:', error);
      // Don't throw, just return false
      return false;
    }
  }

  /**
   * Get recommended consultants based on client profile
   * @param {string} userId - User ID
   * @param {number} limit - Number of recommendations to return
   * @returns {Array} Recommended consultants
   */
  static async getRecommendedConsultants(userId, limit = 5) {
    try {
      const client = await Client.findOne({ user: userId });
      
      if (!client) {
        throw new Error('Client profile not found');
      }
      
      // Build recommendation query based on client profile
      const query = {
        'settings.availableForWork': true,
        'settings.profileVisibility': { $ne: 'private' }
      };
      
      // If client has industry preference, use it
      if (client.company && client.company.industry) {
        query['expertise.industries'] = client.company.industry;
      }
      
      // If client has primary needs, use them
      if (client.clientProfile && client.clientProfile.needsAssessment && 
          client.clientProfile.needsAssessment.primaryNeeds && 
          client.clientProfile.needsAssessment.primaryNeeds.length > 0) {
        query['expertise.skills.name'] = { $in: client.clientProfile.needsAssessment.primaryNeeds };
      }
      
      // Get consultants that match criteria
      let consultants = await Consultant.find(query)
        .sort({ 'reviews.average': -1 })
        .limit(limit)
        .populate({
          path: 'user',
          select: 'email profile.firstName profile.lastName profile.avatarUrl'
        });
      
      // If not enough matches, get top rated consultants
      if (consultants.length < limit) {
        const remainingCount = limit - consultants.length;
        const existingIds = consultants.map(c => c._id);
        
        const additionalConsultants = await Consultant.find({
          _id: { $nin: existingIds },
          'settings.availableForWork': true,
          'settings.profileVisibility': { $ne: 'private' }
        })
        .sort({ 'reviews.average': -1 })
        .limit(remainingCount)
        .populate({
          path: 'user',
          select: 'email profile.firstName profile.lastName profile.avatarUrl'
        });
        
        consultants = [...consultants, ...additionalConsultants];
      }
      
      // Format results
      return consultants.map(consultant => ({
        id: consultant._id,
        userId: consultant.user._id,
        name: `${consultant.user.profile.firstName} ${consultant.user.profile.lastName}`,
        title: consultant.professional.title,
        avatarUrl: consultant.user.profile.avatarUrl,
        hourlyRate: consultant.services.rateInfo.hourlyRate,
        currency: consultant.services.rateInfo.currency,
        rating: consultant.reviews.average,
        reviewCount: consultant.reviews.count,
        skills: consultant.expertise.skills.slice(0, 5).map(skill => skill.name),
        availability: consultant.services.availability.status
      }));
    } catch (error) {
      logger.error('Error getting recommended consultants:', error);
      throw error;
    }
  }

  /**
   * Save/favorite a consultant
   * @param {string} userId - User ID
   * @param {string} consultantId - Consultant ID
   * @returns {boolean} Success status
   */
  static async saveConsultant(userId, consultantId) {
    try {
      // Verify consultant exists
      const consultant = await Consultant.findById(consultantId);
      if (!consultant) {
        throw new Error('Consultant not found');
      }
      
      // Check if already saved
      const client = await Client.findOne({ user: userId });
      if (!client) {
        throw new Error('Client profile not found');
      }
      
      // Check if consultant is already saved
      const alreadySaved = client.activity && 
                          client.activity.savedConsultants &&
                          client.activity.savedConsultants.some(
                            saved => saved.consultant.toString() === consultantId
                          );
      
      if (alreadySaved) {
        return true; // Already saved, no action needed
      }
      
      // Add to saved consultants
      await Client.findOneAndUpdate(
        { user: userId },
        { 
          $push: { 
            'activity.savedConsultants': {
              consultant: consultant._id,
              addedAt: new Date()
            } 
          },
          'activity.lastActive': new Date()
        }
      );
      
      return true;
    } catch (error) {
      logger.error('Error saving consultant:', error);
      throw error;
    }
  }

  /**
   * Get saved consultants
   * @param {string} userId - User ID
   * @returns {Array} Saved consultants
   */
  static async getSavedConsultants(userId) {
    try {
      const client = await Client.findOne({ user: userId });
      
      if (!client) {
        throw new Error('Client profile not found');
      }
      
      if (!client.activity || !client.activity.savedConsultants || 
          client.activity.savedConsultants.length === 0) {
        return [];
      }
      
      // Get consultant details
      const consultants = await Promise.all(
        client.activity.savedConsultants.map(async (saved) => {
          const consultant = await Consultant.findById(saved.consultant)
            .populate({
              path: 'user',
              select: 'email profile.firstName profile.lastName profile.avatarUrl'
            });
          
          if (!consultant) return null;
          
          return {
            id: consultant._id,
            userId: consultant.user._id,
            name: `${consultant.user.profile.firstName} ${consultant.user.profile.lastName}`,
            title: consultant.professional.title,
            avatarUrl: consultant.user.profile.avatarUrl,
            hourlyRate: consultant.services.rateInfo.hourlyRate,
            currency: consultant.services.rateInfo.currency,
            rating: consultant.reviews.average,
            reviewCount: consultant.reviews.count,
            skills: consultant.expertise.skills.slice(0, 5).map(skill => skill.name),
            availability: consultant.services.availability.status,
            savedAt: saved.addedAt
          };
        })
      );
      
      // Filter out any null results (consultants that were deleted)
      return consultants.filter(c => c !== null);
    } catch (error) {
      logger.error('Error getting saved consultants:', error);
      throw error;
    }
  }

  /**
   * Get consultant by ID
   * @param {string} consultantId - Consultant ID
   * @returns {Object} Consultant details
   */
  static async getConsultantById(consultantId) {
    try {
      const consultant = await Consultant.findById(consultantId)
        .populate({
          path: 'user',
          select: 'email profile.firstName profile.lastName profile.avatarUrl'
        });
      
      if (!consultant) {
        throw new Error('Consultant not found');
      }
      
      return {
        id: consultant._id,
        userId: consultant.user._id,
        name: `${consultant.user.profile.firstName} ${consultant.user.profile.lastName}`,
        title: consultant.professional.title,
        avatarUrl: consultant.user.profile.avatarUrl,
        summary: consultant.professional.summary,
        hourlyRate: consultant.services.rateInfo.hourlyRate,
        currency: consultant.services.rateInfo.currency,
        rating: consultant.reviews.average,
        reviewCount: consultant.reviews.count,
        yearsOfExperience: consultant.professional.yearsOfExperience,
        skills: consultant.expertise.skills.map(skill => ({
          name: skill.name,
          level: skill.level,
          yearsOfExperience: skill.yearsOfExperience
        })),
        industries: consultant.expertise.industries,
        education: consultant.professional.education,
        certifications: consultant.professional.certifications,
        availability: consultant.services.availability,
        workExperience: consultant.workExperience,
        services: consultant.services.offerings
      };
    } catch (error) {
      logger.error('Error getting consultant by ID:', error);
      throw error;
    }
  }

  /**
   * Get project options for new project form
   * @returns {Object} Project options
   */
  static async getProjectOptions() {
    // These could come from a database in the future
    return {
      categories: [
        { value: 'software_development', label: 'Software Development' },
        { value: 'web_development', label: 'Web Development' },
        { value: 'mobile_development', label: 'Mobile App Development' },
        { value: 'ui_ux_design', label: 'UI/UX Design' },
        { value: 'data_science', label: 'Data Science & Analytics' },
        { value: 'cloud_architecture', label: 'Cloud Architecture' },
        { value: 'cybersecurity', label: 'Cybersecurity' },
        { value: 'project_management', label: 'Project Management' },
        { value: 'digital_marketing', label: 'Digital Marketing' },
        { value: 'content_creation', label: 'Content Creation' },
        { value: 'business_strategy', label: 'Business Strategy' },
        { value: 'other', label: 'Other' }
      ],
      budgetRanges: [
        { value: 'under_1000', label: 'Under $1,000' },
        { value: '1000_5000', label: '$1,000 - $5,000' },
        { value: '5000_10000', label: '$5,000 - $10,000' },
        { value: '10000_25000', label: '$10,000 - $25,000' },
        { value: '25000_50000', label: '$25,000 - $50,000' },
        { value: '50000_plus', label: 'Over $50,000' }
      ],
      durations: [
        { value: 'less_than_week', label: 'Less than a week' },
        { value: '1_2_weeks', label: '1-2 weeks' },
        { value: '2_4_weeks', label: '2-4 weeks' },
        { value: '1_3_months', label: '1-3 months' },
        { value: '3_6_months', label: '3-6 months' },
        { value: 'over_6_months', label: 'Over 6 months' }
      ],
      complexities: [
        { value: 'simple', label: 'Simple' },
        { value: 'moderate', label: 'Moderate' },
        { value: 'complex', label: 'Complex' }
      ]
    };
  }

  /**
   * Create a new project
   * @param {string} userId - User ID
   * @param {Object} projectData - Project data
   * @returns {Object} Created project
   */
  static async createProject(userId, projectData) {
    try {
      // Get client profile
      const client = await Client.findOne({ user: userId });
      
      if (!client) {
        throw new Error('Client profile not found');
      }
      
      // Check if consultant ID is provided and exists
      let consultant = null;
      if (projectData.consultantId) {
        consultant = await Consultant.findById(projectData.consultantId);
        if (!consultant) {
          throw new Error('Specified consultant not found');
        }
      }
      
      // Create new project
      const project = new Project({
        title: projectData.title,
        description: projectData.description,
        category: projectData.category,
        client: client._id,
        consultant: consultant ? consultant._id : null,
        status: consultant ? 'pending' : 'open',
        budget: {
          min: projectData.budget.min,
          max: projectData.budget.max,
          type: projectData.budget.type || 'fixed'
        },
        timeline: {
          startDate: projectData.timeline.startDate,
          endDate: projectData.timeline.endDate,
          duration: projectData.timeline.duration
        },
        requirements: projectData.requirements,
        attachments: projectData.attachments || [],
        visibility: projectData.visibility || 'public',
        createdBy: userId
      });
      
      await project.save();
      
      // Update client project count
      await Client.findByIdAndUpdate(
        client._id,
        { 
          $inc: { 'activity.projectCount': 1 },
          'activity.lastActive': new Date()
        }
      );
      
      // If consultant is specified, create a proposal
      if (consultant) {
        // Create proposal
        const proposal = {
          project: project._id,
          consultant: consultant._id,
          status: 'awaiting_consultant',
          // Additional proposal fields
        };
        
        // TODO: Add proposal creation code once model is created
      }
      
      return project;
    } catch (error) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  /**
   * Get client activity log
   * @param {string} clientId - Client ID
   * @param {number} limit - Number of activities to return
   * @returns {Array} Client activity log
   */
  static async getClientActivity(clientId, limit = 10) {
    try {
      // This is a stub - in a real implementation, you would fetch
      // activity from various collections (projects, messages, etc.)
      // and aggregate them into a timeline
      
      // For now, return some mock data
      return [
        {
          type: 'project_created',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
          details: {
            projectId: 'project123',
            projectTitle: 'Website Redesign'
          }
        },
        {
          type: 'consultant_saved',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4), // 4 days ago
          details: {
            consultantId: 'consultant456',
            consultantName: 'John Doe'
          }
        },
        {
          type: 'message_received',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
          details: {
            conversationId: 'conv789',
            sender: 'Jane Smith'
          }
        }
      ];
    } catch (error) {
      logger.error('Error getting client activity:', error);
      throw error;
    }
  }

  /**
   * Get client conversations
   * @param {string} clientId - Client ID
   * @returns {Array} Client conversations
   */
  static async getClientConversations(clientId) {
    try {
      // This would fetch conversations from the database
      // For now, return an empty array
      return [];
    } catch (error) {
      logger.error('Error getting client conversations:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @param {string} clientId - Client ID
   * @returns {Object} Conversation details
   */
  static async getConversationById(conversationId, clientId) {
    try {
      // This would fetch a specific conversation from the database
      // For now, return null
      return null;
    } catch (error) {
      logger.error('Error getting conversation by ID:', error);
      throw error;
    }
  }

  /**
   * Update client settings
   * @param {string} userId - User ID
   * @param {Object} settings - Settings to update
   * @returns {Object} Updated client
   */
  static async updateClientSettings(userId, settings) {
    try {
      const client = await Client.findOne({ user: userId });
      
      if (!client) {
        throw new Error('Client profile not found');
      }
      
      // Update settings
      if (settings.settings) {
        client.settings = {
          ...client.settings,
          ...settings.settings
        };
      }
      
      await client.save();
      
      return client;
    } catch (error) {
      logger.error('Error updating client settings:', error);
      throw error;
    }
  }

  /**
   * Get client billing information
   * @param {string} userId - User ID
   * @returns {Object} Billing information
   */
  static async getBillingInfo(userId) {
    try {
      const client = await Client.findOne({ user: userId });
      
      if (!client) {
        throw new Error('Client profile not found');
      }
      
      // For now, just return the payment methods from the client model
      // In a real implementation, you would fetch additional billing history
      return {
        paymentMethods: client.billing?.paymentMethods || [],
        billingHistory: [] // This would come from a separate collection in a real implementation
      };
    } catch (error) {
      logger.error('Error getting billing info:', error);
      throw error;
    }
  }
}

module.exports = ClientService;