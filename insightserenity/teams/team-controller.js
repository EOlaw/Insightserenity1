/**
 * @file Team Controller
 * @description Controller for handling team-related HTTP requests
 */

const TeamService = require('./team-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Team Controller
 * Handles HTTP requests related to team management
 */
class TeamController {
  /**
   * Get all teams with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTeams(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        status: req.query.status,
        visibility: req.query.visibility,
        owner: req.query.owner,
        organization: req.query.organization,
        specialty: req.query.specialty,
        industry: req.query.industry,
        availability: req.query.availability,
        search: req.query.search,
        showAll: req.user && req.user.role === 'admin' // Admins can see all teams
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'name',
        sortOrder: req.query.sortOrder || 'asc'
      };
      
      const result = await TeamService.getTeams(filters, options);
      
      res.status(200).json({
        success: true,
        teams: result.teams,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting teams:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve teams'
      });
    }
  }

  /**
   * Get team by ID or slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTeamById(req, res) {
    try {
      const identifier = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includeOwner: req.query.includeOwner === 'true',
        includeOrganization: req.query.includeOrganization === 'true',
        includeServices: req.query.includeServices === 'true',
        includeProjects: req.query.includeProjects === 'true',
        includeCaseStudies: req.query.includeCaseStudies === 'true',
        includeMembers: req.query.includeMembers === 'true',
        trackView: req.query.trackView === 'true',
        showAll: req.user && req.user.role === 'admin', // Admins can see all teams
        isAdmin: req.user && req.user.role === 'admin',
        userId: req.user ? req.user.id : null
      };
      
      const team = await TeamService.getTeamById(identifier, options);
      
      res.status(200).json({
        success: true,
        team
      });
    } catch (error) {
      logger.error(`Error getting team ${req.params.id}:`, error);
      res.status(error.message === 'Team not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve team'
      });
    }
  }

  /**
   * Create new team
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createTeam(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newTeam = await TeamService.createTeam(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Team created successfully',
        team: newTeam
      });
    } catch (error) {
      logger.error('Error creating team:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create team'
      });
    }
  }

  /**
   * Update team
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateTeam(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const teamId = req.params.id;
      const updatedTeam = await TeamService.updateTeam(teamId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Team updated successfully',
        team: updatedTeam
      });
    } catch (error) {
      logger.error(`Error updating team ${req.params.id}:`, error);
      
      if (error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      } else if (error.message === 'You do not have permission to update this team') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this team'
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update team'
      });
    }
  }

  /**
   * Archive team
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async archiveTeam(req, res) {
    try {
      const teamId = req.params.id;
      await TeamService.archiveTeam(teamId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Team archived successfully'
      });
    } catch (error) {
      logger.error(`Error archiving team ${req.params.id}:`, error);
      
      if (error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      } else if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to archive team'
      });
    }
  }

  /**
   * Reactivate team
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async reactivateTeam(req, res) {
    try {
      const teamId = req.params.id;
      await TeamService.reactivateTeam(teamId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Team reactivated successfully'
      });
    } catch (error) {
      logger.error(`Error reactivating team ${req.params.id}:`, error);
      
      if (error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      } else if (error.message.includes('permission') || error.message.includes('owner')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reactivate team'
      });
    }
  }

  /**
   * Upload team avatar
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadTeamAvatar(req, res) {
    const uploadMiddleware = upload.single('avatar');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Team avatar upload error:', err);
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
        
        const teamId = req.params.id;
        
        const updatedTeam = await TeamService.uploadTeamAvatar(
          teamId,
          req.file,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'Team avatar uploaded successfully',
          avatar: updatedTeam.avatar
        });
      } catch (error) {
        logger.error(`Error processing team avatar ${req.params.id}:`, error);
        
        if (error.message === 'Team not found') {
          return res.status(404).json({
            success: false,
            message: 'Team not found'
          });
        } else if (error.message.includes('permission')) {
          return res.status(403).json({
            success: false,
            message: error.message
          });
        }
        
        res.status(400).json({
          success: false,
          message: error.message || 'Failed to process avatar'
        });
      }
    });
  }

  /**
   * Upload team cover image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadTeamCoverImage(req, res) {
    const uploadMiddleware = upload.single('coverImage');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Team cover image upload error:', err);
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
        
        const teamId = req.params.id;
        
        const updatedTeam = await TeamService.uploadTeamCoverImage(
          teamId,
          req.file,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: 'Team cover image uploaded successfully',
          coverImage: updatedTeam.coverImage
        });
      } catch (error) {
        logger.error(`Error processing team cover image ${req.params.id}:`, error);
        
        if (error.message === 'Team not found') {
          return res.status(404).json({
            success: false,
            message: 'Team not found'
          });
        } else if (error.message.includes('permission')) {
          return res.status(403).json({
            success: false,
            message: error.message
          });
        }
        
        res.status(400).json({
          success: false,
          message: error.message || 'Failed to process cover image'
        });
      }
    });
  }

  /**
   * Get team members
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTeamMembers(req, res) {
    try {
      const teamId = req.params.id;
      
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        status: req.query.status,
        role: req.query.role
      };
      
      const result = await TeamService.getTeamMembers(teamId, options);
      
      res.status(200).json({
        success: true,
        members: result.members,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`Error getting team members for team ${req.params.id}:`, error);
      
      if (error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve team members'
      });
    }
  }

  /**
   * Invite user to team
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async inviteTeamMember(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const teamId = req.params.id;
      const inviteData = {
        userId: req.body.userId,
        role: req.body.role,
        title: req.body.title,
        notes: req.body.notes
      };
      
      const membership = await TeamService.inviteTeamMember(teamId, inviteData, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Invitation sent successfully',
        membership
      });
    } catch (error) {
      logger.error(`Error inviting member to team ${req.params.id}:`, error);
      
      if (error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      } else if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      } else if (error.message.includes('already')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send invitation'
      });
    }
  }

  /**
   * Process invitation response
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processInvitation(req, res) {
    try {
      const teamId = req.params.id;
      const { accept, reason } = req.body;
      
      if (typeof accept !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Accept parameter must be a boolean'
        });
      }
      
      const membership = await TeamService.processInvitation(
        teamId,
        req.user.id,
        accept,
        reason
      );
      
      res.status(200).json({
        success: true,
        message: accept ? 'Invitation accepted successfully' : 'Invitation declined successfully',
        membership
      });
    } catch (error) {
      logger.error(`Error processing invitation for team ${req.params.id}:`, error);
      
      if (error.message === 'No pending invitation found') {
        return res.status(404).json({
          success: false,
          message: 'No pending invitation found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process invitation'
      });
    }
  }

  /**
   * Update team member
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateTeamMember(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const teamId = req.params.id;
      const memberId = req.params.memberId;
      
      const membership = await TeamService.updateTeamMember(
        teamId,
        memberId,
        req.body,
        req.user.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Team member updated successfully',
        membership
      });
    } catch (error) {
      logger.error(`Error updating team member ${req.params.memberId} in team ${req.params.id}:`, error);
      
      if (error.message === 'Team membership not found' || error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update team member'
      });
    }
  }

  /**
   * Remove team member
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeTeamMember(req, res) {
    try {
      const teamId = req.params.id;
      const memberId = req.params.memberId;
      const { reason } = req.body;
      
      await TeamService.removeTeamMember(teamId, memberId, req.user.id, reason);
      
      res.status(200).json({
        success: true,
        message: 'Team member removed successfully'
      });
    } catch (error) {
      logger.error(`Error removing team member ${req.params.memberId} from team ${req.params.id}:`, error);
      
      if (error.message === 'Team membership not found' || error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error.message.includes('permission') || error.message.includes('Cannot remove')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove team member'
      });
    }
  }

  /**
   * Get user's teams
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserTeams(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Only allow users to view their own teams unless admin
      if (userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view other users\' teams'
        });
      }
      
      const options = {
        status: req.query.status,
        role: req.query.role
      };
      
      const teams = await TeamService.getUserTeams(userId, options);
      
      res.status(200).json({
        success: true,
        teams
      });
    } catch (error) {
      logger.error(`Error getting teams for user ${req.params.userId || req.user.id}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve user teams'
      });
    }
  }

  /**
   * Get user's pending invitations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserInvitations(req, res) {
    try {
      const invitations = await TeamService.getUserInvitations(req.user.id);
      
      res.status(200).json({
        success: true,
        invitations
      });
    } catch (error) {
      logger.error(`Error getting invitations for user ${req.user.id}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve invitations'
      });
    }
  }

  /**
   * Update team analytics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateTeamAnalytics(req, res) {
    try {
      const teamId = req.params.id;
      const team = await TeamService.updateTeamAnalytics(teamId);
      
      res.status(200).json({
        success: true,
        message: 'Team analytics updated successfully',
        analytics: team.analytics
      });
    } catch (error) {
      logger.error(`Error updating analytics for team ${req.params.id}:`, error);
      
      if (error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update team analytics'
      });
    }
  }

  /**
   * Get team's projects
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTeamProjects(req, res) {
    try {
      const teamId = req.params.id;
      
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        status: req.query.status
      };
      
      const result = await TeamService.getTeamProjects(teamId, options);
      
      res.status(200).json({
        success: true,
        projects: result.projects,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`Error getting projects for team ${req.params.id}:`, error);
      
      if (error.message === 'Team not found') {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve team projects'
      });
    }
  }

  /**
   * Search for available teams
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchAvailableTeams(req, res) {
    try {
      // Extract search criteria
      const criteria = {
        search: req.query.search,
        specialty: req.query.specialty,
        industry: req.query.industry,
        availability: req.query.availability,
        minAvailableHours: req.query.minAvailableHours
      };
      
      // Extract options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'name',
        sortOrder: req.query.sortOrder || 'asc'
      };
      
      const result = await TeamService.searchAvailableTeams(criteria, options);
      
      res.status(200).json({
        success: true,
        teams: result.teams,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error searching for available teams:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search for teams'
      });
    }
  }
}

module.exports = TeamController;