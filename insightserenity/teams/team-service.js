/**
 * @file Team Service
 * @description Service layer for team-related operations
 */

const Team = require('./team-model');
const TeamMember = require('./member-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const emailService = require('../services/email-service');
const fileService = require('../services/file-service');

/**
 * Team Service
 * Handles all team-related business logic
 */
class TeamService {
  /**
   * Get teams with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Teams with pagination info
   */
  static async getTeams(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'name';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Add filters
      if (filters.status) {
        query.status = filters.status;
      } else {
        // Default to active teams
        query.status = 'active';
      }
      
      if (filters.visibility) {
        query.visibility = filters.visibility;
      } else if (!filters.showAll) {
        // Default to public teams only for non-admins
        query.visibility = 'public';
      }
      
      if (filters.owner) {
        query.owner = filters.owner;
      }
      
      if (filters.organization) {
        query.organization = filters.organization;
      }
      
      if (filters.specialty) {
        query['specialty.primary'] = filters.specialty;
      }
      
      if (filters.industry) {
        query.industries = filters.industry;
      }
      
      if (filters.availability) {
        query['capacity.currentAvailability'] = filters.availability;
      }
      
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { shortDescription: { $regex: filters.search, $options: 'i' } },
          { skills: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const totalCount = await Team.countDocuments(query);
      
      // Execute query with pagination
      const teams = await Team.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('owner', 'profile.firstName profile.lastName profile.avatarUrl')
        .populate('organization', 'name')
        .lean();
      
      // Get member counts for each team
      const teamIds = teams.map(team => team._id);
      const memberCounts = await TeamMember.aggregate([
        { $match: { team: { $in: teamIds }, status: 'active' } },
        { $group: { _id: '$team', count: { $sum: 1 } } }
      ]);
      
      // Add member counts to team objects
      const teamsWithCounts = teams.map(team => {
        const countObj = memberCounts.find(mc => mc._id.equals(team._id));
        return {
          ...team,
          memberCount: countObj ? countObj.count : 0
        };
      });
      
      return {
        teams: teamsWithCounts,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching teams:', error);
      throw error;
    }
  }

  /**
   * Get team by ID or slug
   * @param {string} identifier - Team ID or slug
   * @param {Object} options - Optional flags for including related data
   * @returns {Object} Team data
   */
  static async getTeamById(identifier, options = {}) {
    try {
      let query;
      
      // Check if identifier is a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        query = { _id: identifier };
      } else {
        // Otherwise, treat as slug
        query = { slug: identifier };
      }
      
      // Include status filter if not showing all
      if (!options.showAll) {
        query.status = 'active';
      }
      
      // If checking visibility permissions
      if (options.userId && !options.isAdmin) {
        // User can see their own teams regardless of visibility
        const userTeamIds = await TeamMember.find({
          user: options.userId,
          status: 'active'
        }).distinct('team');
        
        query.$or = [
          { visibility: 'public' },
          { owner: options.userId },
          { _id: { $in: userTeamIds } }
        ];
      } else if (!options.isAdmin && !options.userId) {
        // Public visibility only for non-authenticated users
        query.visibility = 'public';
      }
      
      // Create base query
      let teamQuery = Team.findOne(query);
      
      // Include related data if requested
      if (options.includeOwner) {
        teamQuery = teamQuery.populate('owner', 'profile.firstName profile.lastName profile.avatarUrl email');
      }
      
      if (options.includeOrganization) {
        teamQuery = teamQuery.populate('organization', 'name logo');
      }
      
      if (options.includeServices) {
        teamQuery = teamQuery.populate('services', 'name slug description.short');
      }
      
      if (options.includeProjects) {
        teamQuery = teamQuery.populate('projects', 'name status startDate endDate');
      }
      
      if (options.includeCaseStudies) {
        teamQuery = teamQuery.populate('caseStudies', 'title slug summary');
      }
      
      const team = await teamQuery.exec();
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Get team members if requested
      if (options.includeMembers) {
        const members = await TeamMember.find({ team: team._id, status: 'active' })
          .populate('user', 'profile.firstName profile.lastName profile.avatarUrl')
          .populate('consultantProfile')
          .sort({ role: 1 });
        
        team.members = members;
      }
      
      // Check if the user is a team member if userId provided
      if (options.userId) {
        const membership = await TeamMember.findOne({
          team: team._id,
          user: options.userId,
          status: 'active'
        });
        
        team.userMembership = membership;
      }
      
      // Increment view count if tracking views
      if (options.trackView) {
        team.analytics.profileViews += 1;
        await team.save();
      }
      
      return team;
    } catch (error) {
      logger.error(`Error fetching team by identifier ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Create new team
   * @param {Object} teamData - Team data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created team
   */
  static async createTeam(teamData, userId) {
    try {
      // Check if slug already exists
      if (teamData.slug) {
        const existingTeam = await Team.findOne({ slug: teamData.slug });
        if (existingTeam) {
          throw new Error('A team with this slug already exists');
        }
      }
      
      // Create new team
      const team = new Team({
        ...teamData,
        owner: userId,
        createdBy: userId,
        updatedBy: userId
      });
      
      await team.save();
      
      // Create team membership for the owner with admin role
      const teamMember = new TeamMember({
        team: team._id,
        user: userId,
        role: 'admin',
        status: 'active',
        joinedAt: new Date(),
        permissions: {
          canInviteMembers: true,
          canRemoveMembers: true,
          canEditTeamProfile: true,
          canCreateProjects: true,
          canAssignTasks: true,
          canAccessFinancials: true
        }
      });
      
      await teamMember.save();
      
      return team;
    } catch (error) {
      logger.error('Error creating team:', error);
      throw error;
    }
  }

  /**
   * Update team
   * @param {string} teamId - Team ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated team
   */
  static async updateTeam(teamId, updateData, userId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Check if user has permission to update
      const hasPermission = await TeamService.checkTeamPermission(team, userId, 'canEditTeamProfile');
      
      if (!hasPermission) {
        throw new Error('You do not have permission to update this team');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== team.slug) {
        const existingTeam = await Team.findOne({ slug: updateData.slug });
        if (existingTeam && !existingTeam._id.equals(teamId)) {
          throw new Error('A team with this slug already exists');
        }
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'owner' && key !== 'createdBy' && key !== 'createdAt') {
          team[key] = updateData[key];
        }
      });
      
      // Update metadata
      team.updatedBy = userId;
      
      await team.save();
      
      return team;
    } catch (error) {
      logger.error(`Error updating team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Archive team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID performing the action
   * @returns {Object} Updated team
   */
  static async archiveTeam(teamId, userId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Only team owner or admins can archive a team
      if (!team.owner.equals(userId)) {
        const isAdmin = await TeamService.checkTeamPermission(team, userId, 'isAdmin');
        if (!isAdmin) {
          throw new Error('You do not have permission to archive this team');
        }
      }
      
      team.status = 'archived';
      team.updatedBy = userId;
      
      await team.save();
      
      // Notify team members
      const members = await TeamMember.find({
        team: teamId,
        status: 'active'
      }).populate('user', 'email profile.firstName');
      
      // Send notifications
      for (const member of members) {
        if (member.user && member.user.email) {
          await emailService.sendTeamStatusChangeEmail(
            member.user.email,
            member.user.profile.firstName,
            team.name,
            'archived'
          );
        }
      }
      
      return team;
    } catch (error) {
      logger.error(`Error archiving team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Reactivate team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID performing the action
   * @returns {Object} Updated team
   */
  static async reactivateTeam(teamId, userId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Only team owner can reactivate a team
      if (!team.owner.equals(userId)) {
        throw new Error('Only the team owner can reactivate this team');
      }
      
      team.status = 'active';
      team.updatedBy = userId;
      
      await team.save();
      
      // Notify team members
      const members = await TeamMember.find({
        team: teamId,
        status: 'active'
      }).populate('user', 'email profile.firstName');
      
      // Send notifications
      for (const member of members) {
        if (member.user && member.user.email) {
          await emailService.sendTeamStatusChangeEmail(
            member.user.email,
            member.user.profile.firstName,
            team.name,
            'reactivated'
          );
        }
      }
      
      return team;
    } catch (error) {
      logger.error(`Error reactivating team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Upload team avatar
   * @param {string} teamId - Team ID
   * @param {Object} file - Image file
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated team
   */
  static async uploadTeamAvatar(teamId, file, userId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Check permission
      const hasPermission = await TeamService.checkTeamPermission(team, userId, 'canEditTeamProfile');
      
      if (!hasPermission) {
        throw new Error('You do not have permission to update this team');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'teams/avatars');
      
      // Update team
      team.avatar = uploadResult.url;
      team.updatedBy = userId;
      
      await team.save();
      
      return team;
    } catch (error) {
      logger.error(`Error uploading team avatar ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Upload team cover image
   * @param {string} teamId - Team ID
   * @param {Object} file - Image file
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated team
   */
  static async uploadTeamCoverImage(teamId, file, userId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Check permission
      const hasPermission = await TeamService.checkTeamPermission(team, userId, 'canEditTeamProfile');
      
      if (!hasPermission) {
        throw new Error('You do not have permission to update this team');
      }
      
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.');
      }
      
      // Upload file to storage service
      const uploadResult = await fileService.uploadFile(file, 'teams/covers');
      
      // Update team
      team.coverImage = uploadResult.url;
      team.updatedBy = userId;
      
      await team.save();
      
      return team;
    } catch (error) {
      logger.error(`Error uploading team cover image ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Get team members
   * @param {string} teamId - Team ID
   * @param {Object} options - Query options
   * @returns {Object} Team members with pagination info
   */
  static async getTeamMembers(teamId, options = {}) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Create query object
      const query = { team: teamId };
      
      // Add status filter
      if (options.status) {
        query.status = options.status;
      } else {
        query.status = 'active';
      }
      
      // Add role filter
      if (options.role) {
        query.role = options.role;
      }
      
      // Get total count
      const totalCount = await TeamMember.countDocuments(query);
      
      // Execute query with pagination
      const members = await TeamMember.find(query)
        .sort({ role: 1, joinedAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'profile.firstName profile.lastName profile.avatarUrl email')
        .populate('consultantProfile');
      
      return {
        members,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error(`Error fetching team members for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Invite user to team
   * @param {string} teamId - Team ID
   * @param {Object} inviteData - Invitation data
   * @param {string} inviterId - User ID of the inviter
   * @returns {Object} Created team membership
   */
  static async inviteTeamMember(teamId, inviteData, inviterId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Check if inviter has permission to invite
      const hasPermission = await TeamService.checkTeamPermission(team, inviterId, 'canInviteMembers');
      
      if (!hasPermission) {
        throw new Error('You do not have permission to invite members to this team');
      }
      
      // Check if team is active
      if (team.status !== 'active') {
        throw new Error('Cannot invite members to an inactive team');
      }
      
      // Check if user already in team
      const existingMember = await TeamMember.findOne({
        team: teamId,
        user: inviteData.userId
      });
      
      if (existingMember) {
        if (existingMember.status === 'active') {
          throw new Error('User is already a member of this team');
        } else if (existingMember.status === 'pending') {
          throw new Error('User has already been invited to this team');
        } else {
          // Reactivate previous membership with new role
          existingMember.status = 'pending';
          existingMember.role = inviteData.role || existingMember.role;
          existingMember.invitedBy = inviterId;
          existingMember.invitedAt = new Date();
          
          await existingMember.save();
          return existingMember;
        }
      }
      
      // Check member limit
      const activeMembers = await TeamMember.countDocuments({
        team: teamId,
        status: 'active'
      });
      
      if (team.capacity.maxMembers && activeMembers >= team.capacity.maxMembers) {
        throw new Error(`Team has reached its maximum capacity of ${team.capacity.maxMembers} members`);
      }
      
      // Create new member invitation
      const teamMember = new TeamMember({
        team: teamId,
        user: inviteData.userId,
        role: inviteData.role || team.settings.defaultMemberRole || 'member',
        title: inviteData.title || '',
        invitedBy: inviterId,
        invitedAt: new Date(),
        status: 'pending',
        notes: inviteData.notes || ''
      });
      
      await teamMember.save();
      
      // Send invitation email
      const invitee = await mongoose.model('User').findById(inviteData.userId);
      
      if (invitee && invitee.email) {
        const inviter = await mongoose.model('User').findById(inviterId);
        const inviterName = inviter ? `${inviter.profile.firstName} ${inviter.profile.lastName}` : 'A team manager';
        
        await emailService.sendTeamInvitationEmail(
          invitee.email,
          invitee.profile.firstName,
          inviterName,
          team.name,
          teamMember.role,
          team.description,
          `/teams/${team.slug}/invitations`
        );
      }
      
      return teamMember;
    } catch (error) {
      logger.error(`Error inviting team member to team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Process member invitation response
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID responding to invitation
   * @param {boolean} accept - Whether to accept invitation
   * @param {string} [reason] - Reason for rejection (optional)
   * @returns {Object} Updated team membership
   */
  static async processInvitation(teamId, userId, accept, reason = '') {
    try {
      const membership = await TeamMember.findOne({
        team: teamId,
        user: userId,
        status: 'pending'
      });
      
      if (!membership) {
        throw new Error('No pending invitation found');
      }
      
      if (accept) {
        // Accept invitation
        membership.status = 'active';
        membership.joinedAt = new Date();
      } else {
        // Reject invitation
        membership.status = 'rejected';
        membership.notes = reason;
      }
      
      await membership.save();
      
      // Update team analytics if accepted
      if (accept) {
        const team = await Team.findById(teamId);
        if (team) {
          // Perform any team updates needed
          // e.g., increment member count in analytics if tracked
        }
      }
      
      // Notify team owner and inviter
      const team = await Team.findById(teamId).populate('owner', 'email profile.firstName');
      
      if (team && team.owner && team.owner.email) {
        const user = await mongoose.model('User').findById(userId, 'profile.firstName profile.lastName');
        const userName = user ? `${user.profile.firstName} ${user.profile.lastName}` : 'A user';
        
        await emailService.sendInvitationResponseEmail(
          team.owner.email,
          team.owner.profile.firstName,
          userName,
          team.name,
          accept ? 'accepted' : 'declined',
          accept ? '' : reason
        );
      }
      
      return membership;
    } catch (error) {
      logger.error(`Error processing invitation for team ${teamId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update team member
   * @param {string} teamId - Team ID
   * @param {string} memberId - Team member ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User ID performing the update
   * @returns {Object} Updated team membership
   */
  static async updateTeamMember(teamId, memberId, updateData, userId) {
    try {
      const membership = await TeamMember.findOne({
        _id: memberId,
        team: teamId
      });
      
      if (!membership) {
        throw new Error('Team membership not found');
      }
      
      // Check permissions
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Only team owner and admins can update other members
      const isOwner = team.owner.equals(userId);
      const isAdmin = await TeamService.checkTeamPermission(team, userId, 'canEditTeamProfile');
      const isSelf = membership.user.equals(userId);
      
      if (!isOwner && !isAdmin && !isSelf) {
        throw new Error('You do not have permission to update this team member');
      }
      
      // If not owner or admin, users can only update their own availability and preferences
      if (!isOwner && !isAdmin && isSelf) {
        const allowedFields = ['availability', 'preferences'];
        const updateKeys = Object.keys(updateData);
        
        if (!updateKeys.every(key => allowedFields.includes(key))) {
          throw new Error('You can only update your own availability and preferences');
        }
      }
      
      // Don't allow role change to admin except by owner
      if (updateData.role === 'admin' && !isOwner) {
        throw new Error('Only the team owner can assign admin role');
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== 'user' && key !== 'team') {
          membership[key] = updateData[key];
        }
      });
      
      await membership.save();
      
      return membership;
    } catch (error) {
      logger.error(`Error updating team member in team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Remove team member
   * @param {string} teamId - Team ID
   * @param {string} memberId - Team member ID
   * @param {string} userId - User ID performing the removal
   * @param {string} [reason] - Reason for removal (optional)
   * @returns {boolean} Success status
   */
  static async removeTeamMember(teamId, memberId, userId, reason = '') {
    try {
      const membership = await TeamMember.findOne({
        _id: memberId,
        team: teamId
      });
      
      if (!membership) {
        throw new Error('Team membership not found');
      }
      
      // Check permissions
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Can't remove the team owner
      if (membership.user.equals(team.owner)) {
        throw new Error('Cannot remove the team owner');
      }
      
      // Members can remove themselves (leave team)
      const isSelf = membership.user.equals(userId);
      
      if (!isSelf) {
        // For removing others, check if user has permission
        const canRemove = await TeamService.checkTeamPermission(team, userId, 'canRemoveMembers');
        
        if (!canRemove) {
          throw new Error('You do not have permission to remove members from this team');
        }
      }
      
      // If it's the user leaving and team requires approval, set to pending removal
      if (isSelf && team.settings.requiresApprovalForLeaving) {
        membership.status = 'pending_removal';
        membership.notes = reason;
        await membership.save();
        
        // Notify team owner
        const owner = await mongoose.model('User').findById(team.owner, 'email profile.firstName');
        const member = await mongoose.model('User').findById(membership.user, 'profile.firstName profile.lastName');
        
        if (owner && owner.email && member) {
          await emailService.sendTeamLeaveRequestEmail(
            owner.email,
            owner.profile.firstName,
            `${member.profile.firstName} ${member.profile.lastName}`,
            team.name,
            reason,
            `/teams/${team.slug}/members`
          );
        }
        
        return true;
      }
      
      // Otherwise, mark as inactive
      membership.status = 'inactive';
      membership.notes = reason;
      await membership.save();
      
      // Notify the removed member if being removed by someone else
      if (!isSelf) {
        const member = await mongoose.model('User').findById(membership.user, 'email profile.firstName');
        const remover = await mongoose.model('User').findById(userId, 'profile.firstName profile.lastName');
        const removerName = remover ? `${remover.profile.firstName} ${remover.profile.lastName}` : 'A team administrator';
        
        if (member && member.email) {
          await emailService.sendTeamRemovalEmail(
            member.email,
            member.profile.firstName,
            removerName,
            team.name,
            reason
          );
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`Error removing team member from team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's teams
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} User's teams
   */
  static async getUserTeams(userId, options = {}) {
    try {
      // Get user's team memberships
      const memberships = await TeamMember.findUserTeams(userId, {
        status: options.status || 'active',
        role: options.role
      });
      
      // Filter out null teams (in case team was deleted)
      const filteredMemberships = memberships.filter(m => m.team);
      
      // Map to include both team and membership info
      const teams = filteredMemberships.map(membership => ({
        team: membership.team,
        membership: {
          id: membership._id,
          role: membership.role,
          title: membership.title,
          joinedAt: membership.joinedAt,
          permissions: membership.permissions
        }
      }));
      
      return teams;
    } catch (error) {
      logger.error(`Error fetching teams for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's pending team invitations
   * @param {string} userId - User ID
   * @returns {Array} Pending invitations
   */
  static async getUserInvitations(userId) {
    try {
      const invitations = await TeamMember.find({
        user: userId,
        status: 'pending'
      })
        .populate({
          path: 'team',
          select: 'name slug description avatar capacity',
          match: { status: 'active' }
        })
        .populate({
          path: 'invitedBy',
          select: 'profile.firstName profile.lastName profile.avatarUrl'
        })
        .sort({ invitedAt: -1 });
      
      // Filter out null teams (in case team was deleted or inactive)
      return invitations.filter(inv => inv.team);
    } catch (error) {
      logger.error(`Error fetching invitations for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a user has a specific team permission
   * @param {Object|string} team - Team object or ID
   * @param {string} userId - User ID
   * @param {string} permission - Permission to check
   * @returns {boolean} Whether user has permission
   */
  static async checkTeamPermission(team, userId, permission) {
    try {
      // If team is an ID, fetch the team
      if (typeof team === 'string') {
        team = await Team.findById(team);
        if (!team) {
          return false;
        }
      }
      
      // Team owner has all permissions
      if (team.owner.equals(userId)) {
        return true;
      }
      
      // For isAdmin check, we need to check if role is admin
      if (permission === 'isAdmin') {
        const membership = await TeamMember.findOne({
          team: team._id,
          user: userId,
          status: 'active',
          role: 'admin'
        });
        
        return !!membership;
      }
      
      // For other permissions, check the permission flag
      const membership = await TeamMember.findOne({
        team: team._id,
        user: userId,
        status: 'active'
      });
      
      if (!membership) {
        return false;
      }
      
      // Check if the permission exists and is true
      return membership.permissions && membership.permissions[permission] === true;
    } catch (error) {
      logger.error(`Error checking team permission for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Update team analytics
   * @param {string} teamId - Team ID
   * @returns {Object} Updated team
   */
  static async updateTeamAnalytics(teamId) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      await team.updateAnalytics();
      
      return team;
    } catch (error) {
      logger.error(`Error updating team analytics for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Get team's projects
   * @param {string} teamId - Team ID
   * @param {Object} options - Query options
   * @returns {Object} Team projects with pagination
   */
  static async getTeamProjects(teamId, options = {}) {
    try {
      const team = await Team.findById(teamId);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Create query
      const query = { team: teamId };
      
      // Add status filter
      if (options.status) {
        query.status = options.status;
      }
      
      // Get Project model
      const Project = mongoose.model('Project');
      
      // Get total count
      const totalCount = await Project.countDocuments(query);
      
      // Execute query with pagination
      const projects = await Project.find(query)
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('client', 'name logo')
        .lean();
      
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
      logger.error(`Error fetching projects for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Search for available teams
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Search options
   * @returns {Object} Matching teams with pagination
   */
  static async searchAvailableTeams(criteria, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Base query for available teams
      const query = {
        status: 'active',
        visibility: 'public',
        'capacity.currentAvailability': { $ne: 'unavailable' }
      };
      
      // Add criteria
      if (criteria.search) {
        query.$or = [
          { name: { $regex: criteria.search, $options: 'i' } },
          { description: { $regex: criteria.search, $options: 'i' } },
          { skills: { $regex: criteria.search, $options: 'i' } }
        ];
      }
      
      if (criteria.specialty) {
        query['specialty.primary'] = criteria.specialty;
      }
      
      if (criteria.industry) {
        query.industries = criteria.industry;
      }
      
      if (criteria.availability) {
        query['capacity.currentAvailability'] = criteria.availability;
      }
      
      if (criteria.minAvailableHours) {
        query['capacity.availableHoursPerWeek'] = { $gte: parseInt(criteria.minAvailableHours) };
      }
      
      // Get total count
      const totalCount = await Team.countDocuments(query);
      
      // Execute query with pagination
      const teams = await Team.find(query)
        .sort({ [options.sortField || 'name']: options.sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'profile.firstName profile.lastName profile.avatarUrl')
        .lean();
      
      // Get member counts for each team
      const teamIds = teams.map(team => team._id);
      const memberCounts = await TeamMember.aggregate([
        { $match: { team: { $in: teamIds }, status: 'active' } },
        { $group: { _id: '$team', count: { $sum: 1 } } }
      ]);
      
      // Add member counts to team objects
      const teamsWithCounts = teams.map(team => {
        const countObj = memberCounts.find(mc => mc._id.equals(team._id));
        return {
          ...team,
          memberCount: countObj ? countObj.count : 0
        };
      });
      
      return {
        teams: teamsWithCounts,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error searching for available teams:', error);
      throw error;
    }
  }
}

module.exports = TeamService;