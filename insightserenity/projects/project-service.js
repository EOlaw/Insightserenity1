/**
 * @file Project Service
 * @description Service layer for project-related operations
 */

const Project = require('./project-model');
const Proposal = require('./proposal-model');
const Notification = require('../notifications/notification-model');
const Conversation = require('../messaging/conversation-model');
const User = require('../users/user-model');
const Client = require('../users/client-model');
const Consultant = require('../users/consultant-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Project Service
 * Handles business logic for project operations
 */
class ProjectService {
  /**
   * Get project by ID
   * @param {string} projectId - Project ID
   * @param {Object} options - Additional options
   * @returns {Object} Project object
   */
  static async getProjectById(projectId, options = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error('Invalid project ID');
      }
      
      let query = Project.findById(projectId);
      
      // Include client information
      if (options.includeClient) {
        query = query.populate({
          path: 'client',
          populate: {
            path: 'user',
            select: 'email profile'
          }
        });
      }
      
      // Include consultant information
      if (options.includeConsultant && options.includeConsultant !== false) {
        query = query.populate({
          path: 'consultant',
          populate: {
            path: 'user',
            select: 'email profile'
          }
        });
      }
      
      // Include proposals (typically only for clients)
      if (options.includeProposals) {
        query = query.populate({
          path: 'proposals',
          populate: {
            path: 'consultant',
            populate: {
              path: 'user',
              select: 'email profile'
            }
          }
        });
      }
      
      const project = await query.exec();
      
      return project;
    } catch (error) {
      logger.error('Error getting project by ID:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to project
   * @param {string} userId - User ID
   * @param {Object} project - Project object
   * @returns {boolean} Whether user has access
   */
  static async checkProjectAccess(userId, project) {
    try {
      // Get user role
      const user = await User.findById(userId);
      
      if (!user) {
        return false;
      }
      
      // Admins have access to all projects
      if (user.role === 'admin') {
        return true;
      }
      
      // Check if user is the client who created the project
      if (user.role === 'client') {
        const client = await Client.findOne({ user: userId });
        
        if (!client) {
          return false;
        }
        
        return project.client.toString() === client._id.toString();
      }
      
      // Check if user is the consultant assigned to the project
      if (user.role === 'consultant') {
        const consultant = await Consultant.findOne({ user: userId });
        
        if (!consultant) {
          return false;
        }
        
        // Consultant has access if assigned to project
        if (project.consultant && project.consultant.toString() === consultant._id.toString()) {
          return true;
        }
        
        // Consultant has access if they have a submitted proposal for public projects
        if (project.visibility === 'public' && project.status === 'open') {
          const hasProposal = await Proposal.findOne({
            project: project._id,
            consultant: consultant._id
          });
          
          return !!hasProposal;
        }
        
        return false;
      }
      
      return false;
    } catch (error) {
      logger.error('Error checking project access:', error);
      return false;
    }
  }

  /**
   * Update project status
   * @param {string} projectId - Project ID
   * @param {string} status - New status
   * @param {string} userId - User ID making the update
   * @returns {Object} Updated project
   */
  static async updateProjectStatus(projectId, status, userId) {
    try {
      // Get project
      const project = await this.getProjectById(projectId);
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Check access
      const hasAccess = await this.checkProjectAccess(userId, project);
      
      if (!hasAccess) {
        throw new Error('You do not have permission to update this project');
      }
      
      // Get user for role check
      const user = await User.findById(userId);
      
      // Validate status transition
      if (!this.isValidStatusTransition(project.status, status, user.role)) {
        throw new Error(`Cannot change project status from ${project.status} to ${status}`);
      }
      
      // Update status
      project.status = status;
      await project.save();
      
      // Create notifications for relevant parties
      await this.createStatusChangeNotifications(project, status, userId);
      
      return project;
    } catch (error) {
      logger.error('Error updating project status:', error);
      throw error;
    }
  }

  /**
   * Check if status transition is valid
   * @param {string} currentStatus - Current project status
   * @param {string} newStatus - New project status
   * @param {string} userRole - Role of user making the change
   * @returns {boolean} Whether transition is valid
   */
  static isValidStatusTransition(currentStatus, newStatus, userRole) {
    // Define valid transitions per role
    const validTransitions = {
      client: {
        'draft': ['open', 'cancelled'],
        'open': ['cancelled'],
        'pending': ['active', 'cancelled'],
        'active': ['in_progress', 'review', 'cancelled'],
        'review': ['completed', 'in_progress'],
        'completed': []
      },
      consultant: {
        'draft': [],
        'open': [],
        'pending': [],
        'active': ['in_progress'],
        'in_progress': ['review'],
        'review': ['in_progress'],
        'completed': []
      },
      admin: {
        // Admins can make any transition
        'draft': ['open', 'pending', 'active', 'in_progress', 'review', 'completed', 'cancelled'],
        'open': ['pending', 'active', 'in_progress', 'review', 'completed', 'cancelled'],
        'pending': ['active', 'open', 'cancelled'],
        'active': ['in_progress', 'open', 'review', 'completed', 'cancelled'],
        'in_progress': ['active', 'review', 'completed', 'cancelled'],
        'review': ['in_progress', 'active', 'completed', 'cancelled'],
        'completed': ['active', 'in_progress', 'review', 'cancelled'],
        'cancelled': ['draft', 'open', 'pending', 'active', 'in_progress', 'review', 'completed']
      }
    };
    
    // If role doesn't have defined transitions, no transitions allowed
    if (!validTransitions[userRole]) {
      return false;
    }
    
    // If current status doesn't have defined transitions, no transitions allowed
    if (!validTransitions[userRole][currentStatus]) {
      return false;
    }
    
    // Check if new status is in the list of valid transitions
    return validTransitions[userRole][currentStatus].includes(newStatus);
  }

  /**
   * Create notifications for project status change
   * @param {Object} project - Project object
   * @param {string} newStatus - New project status
   * @param {string} userId - User ID making the change
   */
  static async createStatusChangeNotifications(project, newStatus, userId) {
    try {
      // Get user who made the change
      const user = await User.findById(userId);
      
      // Get client and consultant users
      const clientUser = await User.findOne({ 
        _id: { $in: await Client.findById(project.client).then(client => client.user) } 
      });
      
      let consultantUser = null;
      if (project.consultant) {
        consultantUser = await User.findOne({ 
          _id: { $in: await Consultant.findById(project.consultant).then(consultant => consultant.user) } 
        });
      }
      
      // Create notifications based on status change
      switch (newStatus) {
        case 'open':
          // Notify client that project is now open for proposals
          await this.createNotification({
            user: clientUser._id,
            type: 'project',
            title: 'Project Open for Proposals',
            message: `Your project "${project.title}" is now open for proposals from consultants.`,
            data: {
              projectId: project._id,
              link: `/projects/${project._id}`
            }
          });
          break;
          
        case 'active':
          // Notify client that project is active
          await this.createNotification({
            user: clientUser._id,
            type: 'project',
            title: 'Project Activated',
            message: `Your project "${project.title}" has been activated.`,
            data: {
              projectId: project._id,
              link: `/projects/${project._id}`
            }
          });
          
          // Notify consultant if assigned
          if (consultantUser) {
            await this.createNotification({
              user: consultantUser._id,
              type: 'project',
              title: 'Project Activated',
              message: `The project "${project.title}" has been activated.`,
              data: {
                projectId: project._id,
                link: `/projects/${project._id}`,
                actionRequired: true
              }
            });
          }
          break;
          
        case 'in_progress':
          // Notify client that work has begun
          await this.createNotification({
            user: clientUser._id,
            type: 'project',
            title: 'Project In Progress',
            message: `Work has begun on your project "${project.title}".`,
            data: {
              projectId: project._id,
              link: `/projects/${project._id}`
            }
          });
          break;
          
        case 'review':
          // Notify client that project is ready for review
          await this.createNotification({
            user: clientUser._id,
            type: 'project',
            title: 'Project Ready for Review',
            message: `Your project "${project.title}" is ready for your review.`,
            data: {
              projectId: project._id,
              link: `/projects/${project._id}`,
              actionRequired: true
            }
          });
          break;
          
        case 'completed':
          // Notify both parties that project is complete
          await this.createNotification({
            user: clientUser._id,
            type: 'project',
            title: 'Project Completed',
            message: `Your project "${project.title}" has been marked as completed.`,
            data: {
              projectId: project._id,
              link: `/projects/${project._id}`
            }
          });
          
          if (consultantUser) {
            await this.createNotification({
              user: consultantUser._id,
              type: 'project',
              title: 'Project Completed',
              message: `The project "${project.title}" has been marked as completed.`,
              data: {
                projectId: project._id,
                link: `/projects/${project._id}`
              }
            });
          }
          break;
          
        case 'cancelled':
          // Notify both parties that project is cancelled
          await this.createNotification({
            user: clientUser._id,
            type: 'project',
            title: 'Project Cancelled',
            message: `Your project "${project.title}" has been cancelled.`,
            data: {
              projectId: project._id,
              link: `/projects/${project._id}`
            }
          });
          
          if (consultantUser) {
            await this.createNotification({
              user: consultantUser._id,
              type: 'project',
              title: 'Project Cancelled',
              message: `The project "${project.title}" has been cancelled.`,
              data: {
                projectId: project._id,
                link: `/projects/${project._id}`
              }
            });
          }
          break;
      }
    } catch (error) {
      logger.error('Error creating status change notifications:', error);
      // Don't throw, as this is a non-critical operation
    }
  }

  /**
   * Create a notification
   * @param {Object} notificationData - Notification data
   * @returns {Object} Created notification
   */
  static async createNotification(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      // Don't throw, as this is a non-critical operation
    }
  }

  /**
   * Submit project milestone
   * @param {string} projectId - Project ID
   * @param {string} milestoneId - Milestone ID
   * @param {string} userId - User ID submitting milestone
   * @param {string} deliverableNotes - Notes for deliverable
   * @returns {Object} Updated project
   */
  static async submitMilestone(projectId, milestoneId, userId, deliverableNotes) {
    try {
      // Get project
      const project = await this.getProjectById(projectId);
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Check access
      const hasAccess = await this.checkProjectAccess(userId, project);
      
      if (!hasAccess) {
        throw new Error('You do not have permission to update this project');
      }
      
      // Get user for role check
      const user = await User.findById(userId);
      
      // Only consultants can submit milestones
      if (user.role !== 'consultant') {
        throw new Error('Only consultants can submit milestones');
      }
      
      // Find the milestone
      const milestoneIndex = project.milestones.findIndex(
        m => m._id.toString() === milestoneId
      );
      
      if (milestoneIndex === -1) {
        throw new Error('Milestone not found');
      }
      
      // Update milestone status
      project.milestones[milestoneIndex].status = 'submitted';
      project.milestones[milestoneIndex].deliverableNotes = deliverableNotes;
      
      await project.save();
      
      // Create notification for client
      const clientUser = await User.findOne({ 
        _id: { $in: await Client.findById(project.client).then(client => client.user) } 
      });
      
      await this.createNotification({
        user: clientUser._id,
        type: 'milestone',
        title: 'Milestone Submitted',
        message: `A milestone for project "${project.title}" has been submitted for your review.`,
        data: {
          projectId: project._id,
          link: `/projects/${project._id}`,
          actionRequired: true
        }
      });
      
      return project;
    } catch (error) {
      logger.error('Error submitting milestone:', error);
      throw error;
    }
  }

  /**
   * Approve milestone
   * @param {string} projectId - Project ID
   * @param {string} milestoneId - Milestone ID
   * @param {string} userId - User ID approving milestone
   * @param {string} feedback - Feedback for milestone
   * @returns {Object} Updated project
   */
  static async approveMilestone(projectId, milestoneId, userId, feedback) {
    try {
      // Get project
      const project = await this.getProjectById(projectId);
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Check access
      const hasAccess = await this.checkProjectAccess(userId, project);
      
      if (!hasAccess) {
        throw new Error('You do not have permission to update this project');
      }
      
      // Get user for role check
      const user = await User.findById(userId);
      
      // Only clients can approve milestones
      if (user.role !== 'client') {
        throw new Error('Only clients can approve milestones');
      }
      
      // Find the milestone
      const milestoneIndex = project.milestones.findIndex(
        m => m._id.toString() === milestoneId
      );
      
      if (milestoneIndex === -1) {
        throw new Error('Milestone not found');
      }
      
      // Milestone must be in submitted status
      if (project.milestones[milestoneIndex].status !== 'submitted') {
        throw new Error('Milestone is not in submitted status');
      }
      
      // Update milestone status
      project.milestones[milestoneIndex].status = 'approved';
      project.milestones[milestoneIndex].feedback = feedback;
      project.milestones[milestoneIndex].completedAt = new Date();
      
      await project.save();
      
      // Create notification for consultant
      const consultantUser = await User.findOne({ 
        _id: { $in: await Consultant.findById(project.consultant).then(consultant => consultant.user) } 
      });
      
      await this.createNotification({
        user: consultantUser._id,
        type: 'milestone',
        title: 'Milestone Approved',
        message: `A milestone for project "${project.title}" has been approved.`,
        data: {
          projectId: project._id,
          link: `/projects/${project._id}`
        }
      });
      
      return project;
    } catch (error) {
      logger.error('Error approving milestone:', error);
      throw error;
    }
  }

  /**
   * Get public projects
   * @param {number} page - Page number
   * @param {number} limit - Number of items per page
   * @param {Object} filters - Filter criteria
   * @returns {Object} Projects and pagination info
   */
  static async getPublicProjects(page = 1, limit = 10, filters = {}) {
    try {
      // Build query
      const query = {
        visibility: 'public',
        status: 'open'
      };
      
      // Apply additional filters
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.minBudget || filters.maxBudget) {
        query.budget = {};
        
        if (filters.minBudget) {
          query.budget.max = { $gte: filters.minBudget };
        }
        
        if (filters.maxBudget) {
          query.budget.min = { $lte: filters.maxBudget };
        }
      }
      
      if (filters.skills && filters.skills.length > 0) {
        query['requirements.skills'] = { $in: filters.skills };
      }
      
      // Add text search if query provided
      if (filters.query) {
        query.$or = [
          { title: { $regex: filters.query, $options: 'i' } },
          { description: { $regex: filters.query, $options: 'i' } }
        ];
      }
      
      // Execute query with pagination
      const skip = (page - 1) * limit;
      
      const projects = await Project.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'client',
          populate: {
            path: 'user',
            select: 'profile.firstName profile.lastName profile.avatarUrl'
          }
        });
      
      // Get total count for pagination
      const totalCount = await Project.countDocuments(query);
      
      return {
        projects,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting public projects:', error);
      throw error;
    }
  }

  /**
   * Submit project feedback
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID submitting feedback
   * @param {number} rating - Rating (1-5)
   * @param {string} comment - Feedback comment
   * @returns {Object} Updated project
   */
  static async submitFeedback(projectId, userId, rating, comment) {
    try {
      // Get project
      const project = await this.getProjectById(projectId);
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Check access
      const hasAccess = await this.checkProjectAccess(userId, project);
      
      if (!hasAccess) {
        throw new Error('You do not have permission to submit feedback for this project');
      }
      
      // Get user for role check
      const user = await User.findById(userId);
      
      // Project must be completed
      if (project.status !== 'completed') {
        throw new Error('Feedback can only be submitted for completed projects');
      }
      
      // Update feedback based on user role
      if (user.role === 'client') {
        // Client giving feedback to consultant
        if (!project.consultant) {
          throw new Error('Project does not have an assigned consultant');
        }
        
        project.feedback.consultant = {
          rating: parseInt(rating),
          comment,
          givenAt: new Date()
        };
        
        // Update consultant's ratings
        const consultant = await Consultant.findById(project.consultant);
        
        if (consultant) {
          // Calculate new average
          const totalReviews = consultant.reviews.count || 0;
          const currentAverage = consultant.reviews.average || 0;
          
          const newCount = totalReviews + 1;
          const newAverage = ((currentAverage * totalReviews) + parseInt(rating)) / newCount;
          
          // Update consultant review metrics
          consultant.reviews.average = newAverage;
          consultant.reviews.count = newCount;
          
          // Add to featured reviews if comment is provided
          if (comment) {
            consultant.reviews.featured.push({
              client: project.client,
              rating: parseInt(rating),
              comment,
              date: new Date(),
              project: project.title
            });
          }
          
          await consultant.save();
          
          // Create notification for consultant
          const consultantUser = await User.findById(consultant.user);
          
          await this.createNotification({
            user: consultantUser._id,
            type: 'review',
            title: 'New Review Received',
            message: `You received a ${rating}-star review for project "${project.title}".`,
            data: {
              projectId: project._id,
              link: `/consultants/reviews`
            }
          });
        }
      } else if (user.role === 'consultant') {
        // Consultant giving feedback to client
        project.feedback.client = {
          rating: parseInt(rating),
          comment,
          givenAt: new Date()
        };
        
        // Update client's ratings if needed
        // This is optional as many platforms don't show client ratings publicly
        
        // Create notification for client
        const clientUser = await User.findOne({ 
          _id: { $in: await Client.findById(project.client).then(client => client.user) } 
        });
        
        await this.createNotification({
          user: clientUser._id,
          type: 'review',
          title: 'Project Feedback Received',
          message: `You received feedback for project "${project.title}".`,
          data: {
            projectId: project._id,
            link: `/projects/${project._id}`
          }
        });
      }
      
      await project.save();
      
      return project;
    } catch (error) {
      logger.error('Error submitting project feedback:', error);
      throw error;
    }
  }
}

module.exports = ProjectService;