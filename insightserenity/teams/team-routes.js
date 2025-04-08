/**
 * @file Team Routes
 * @description Defines API routes for team management
 */

const express = require('express');
const router = express.Router();
const TeamController = require('./team-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Team creation validation
 */
const teamCreationValidation = [
  body('name')
    .notEmpty()
    .withMessage('Team name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Team name must be between 3 and 100 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('shortDescription')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Short description must not exceed 200 characters'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'organization'])
    .withMessage('Invalid visibility value'),
  body('organization')
    .optional()
    .isMongoId()
    .withMessage('Invalid organization ID'),
  body('specialty.primary')
    .optional()
    .isIn([
      'software_development', 'cloud_architecture', 'data_science', 'cybersecurity',
      'project_management', 'ux_design', 'digital_marketing', 'business_strategy',
      'financial_consulting', 'legal_consulting', 'healthcare_consulting', 'education',
      'human_resources', 'sustainability', 'other'
    ])
    .withMessage('Invalid primary specialty'),
  body('specialty.secondary')
    .optional()
    .isArray()
    .withMessage('Secondary specialties must be an array'),
  body('industries')
    .optional()
    .isArray()
    .withMessage('Industries must be an array'),
  body('industries.*')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ])
    .withMessage('Invalid industry value'),
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  body('capacity.maxMembers')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Maximum members must be between 1 and 100'),
  body('capacity.currentAvailability')
    .optional()
    .isIn(['available', 'limited', 'unavailable'])
    .withMessage('Invalid availability status'),
  body('capacity.availableHoursPerWeek')
    .optional()
    .isInt({ min: 0, max: 168 })
    .withMessage('Available hours per week must be between 0 and 168'),
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Contact email must be a valid email address'),
  body('contact.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Contact phone must be a valid phone number'),
  body('contact.website')
    .optional()
    .isURL()
    .withMessage('Contact website must be a valid URL'),
  body('socialMedia.linkedin')
    .optional()
    .isURL()
    .withMessage('LinkedIn URL must be a valid URL'),
  body('socialMedia.twitter')
    .optional()
    .isURL()
    .withMessage('Twitter URL must be a valid URL'),
  body('socialMedia.github')
    .optional()
    .isURL()
    .withMessage('GitHub URL must be a valid URL'),
  body('services')
    .optional()
    .isArray()
    .withMessage('Services must be an array'),
  body('services.*')
    .optional()
    .isMongoId()
    .withMessage('Service ID must be a valid MongoDB ID'),
  body('settings.autoAcceptMemberRequests')
    .optional()
    .isBoolean()
    .withMessage('Auto-accept member requests must be a boolean'),
  body('settings.requiresApprovalForLeaving')
    .optional()
    .isBoolean()
    .withMessage('Requires approval for leaving must be a boolean'),
  body('settings.defaultMemberRole')
    .optional()
    .isIn(['member', 'senior', 'lead'])
    .withMessage('Invalid default member role'),
  body('settings.defaultVisibilityForNewProjects')
    .optional()
    .isIn(['public', 'team', 'client'])
    .withMessage('Invalid default project visibility')
];

/**
 * Team update validation (same as creation but all fields optional)
 */
const teamUpdateValidation = [
  body('name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Team name must be between 3 and 100 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('shortDescription')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Short description must not exceed 200 characters'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'organization'])
    .withMessage('Invalid visibility value'),
  body('specialty.primary')
    .optional()
    .isIn([
      'software_development', 'cloud_architecture', 'data_science', 'cybersecurity',
      'project_management', 'ux_design', 'digital_marketing', 'business_strategy',
      'financial_consulting', 'legal_consulting', 'healthcare_consulting', 'education',
      'human_resources', 'sustainability', 'other'
    ])
    .withMessage('Invalid primary specialty'),
  body('industries')
    .optional()
    .isArray()
    .withMessage('Industries must be an array'),
  body('capacity.currentAvailability')
    .optional()
    .isIn(['available', 'limited', 'unavailable'])
    .withMessage('Invalid availability status')
];

/**
 * Team member invite validation
 */
const memberInviteValidation = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ID'),
  body('role')
    .optional()
    .isIn(['admin', 'lead', 'senior', 'member', 'guest'])
    .withMessage('Invalid role value'),
  body('title')
    .optional()
    .isString()
    .withMessage('Title must be a string')
    .isLength({ max: 100 })
    .withMessage('Title must not exceed 100 characters'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
];

/**
 * Team member update validation
 */
const memberUpdateValidation = [
  body('role')
    .optional()
    .isIn(['admin', 'lead', 'senior', 'member', 'guest'])
    .withMessage('Invalid role value'),
  body('title')
    .optional()
    .isString()
    .withMessage('Title must be a string')
    .isLength({ max: 100 })
    .withMessage('Title must not exceed 100 characters'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  body('availability')
    .optional()
    .isObject()
    .withMessage('Availability must be an object'),
  body('availability.hoursPerWeek')
    .optional()
    .isInt({ min: 0, max: 168 })
    .withMessage('Hours per week must be between 0 and 168'),
  body('availability.status')
    .optional()
    .isIn(['available', 'limited', 'unavailable'])
    .withMessage('Invalid availability status'),
  body('availability.daysOfWeek')
    .optional()
    .isArray()
    .withMessage('Days of week must be an array'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object')
];

/**
 * Custom validator for slugs
 
const { check } = require('express-validator');
check.prototype.isSlug = function() {
  return this.matches(/^[a-z0-9-]+$/);
};
*/

/**
 * Public routes - accessible without authentication
 */

/**
 * Get all teams route (public/filtered)
 * @route GET /api/teams
 * @description Get all public teams with optional filtering
 * @access Public
 */
router.get(
  '/',
  rateLimiter('get-teams', 60, 60), // 60 requests per minute
  TeamController.getTeams
);

/**
 * Get team by ID or slug route
 * @route GET /api/teams/:id
 * @description Get a specific team by ID or slug
 * @access Public
 */
router.get(
  '/:id',
  param('id').notEmpty().withMessage('Team ID or slug is required'),
  validateRequest,
  rateLimiter('get-team', 60, 60), // 60 requests per minute
  TeamController.getTeamById
);

/**
 * Search available teams route
 * @route GET /api/teams/search/available
 * @description Search for available teams based on criteria
 * @access Public
 */
router.get(
  '/search/available',
  rateLimiter('search-teams', 30, 60), // 30 requests per minute
  TeamController.searchAvailableTeams
);

/**
 * Protected routes - require authentication
 */

/**
 * Create team route
 * @route POST /api/teams
 * @description Create a new team
 * @access Private
 */
router.post(
  '/',
  authenticate(),
  teamCreationValidation,
  validateRequest,
  TeamController.createTeam
);

/**
 * Update team route
 * @route PUT /api/teams/:id
 * @description Update a team
 * @access Private
 */
router.put(
  '/:id',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  teamUpdateValidation,
  validateRequest,
  TeamController.updateTeam
);

/**
 * Archive team route
 * @route PATCH /api/teams/:id/archive
 * @description Archive a team
 * @access Private
 */
router.patch(
  '/:id/archive',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  validateRequest,
  TeamController.archiveTeam
);

/**
 * Reactivate team route
 * @route PATCH /api/teams/:id/reactivate
 * @description Reactivate an archived team
 * @access Private
 */
router.patch(
  '/:id/reactivate',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  validateRequest,
  TeamController.reactivateTeam
);

/**
 * Upload team avatar route
 * @route POST /api/teams/:id/avatar
 * @description Upload team avatar
 * @access Private
 */
router.post(
  '/:id/avatar',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  validateRequest,
  TeamController.uploadTeamAvatar
);

/**
 * Upload team cover image route
 * @route POST /api/teams/:id/cover
 * @description Upload team cover image
 * @access Private
 */
router.post(
  '/:id/cover',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  validateRequest,
  TeamController.uploadTeamCoverImage
);

/**
 * Get team members route
 * @route GET /api/teams/:id/members
 * @description Get members of a team
 * @access Private
 */
router.get(
  '/:id/members',
  authenticate(),
  param('id').notEmpty().withMessage('Team ID or slug is required'),
  validateRequest,
  TeamController.getTeamMembers
);

/**
 * Invite team member route
 * @route POST /api/teams/:id/members/invite
 * @description Invite a user to the team
 * @access Private
 */
router.post(
  '/:id/members/invite',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  memberInviteValidation,
  validateRequest,
  TeamController.inviteTeamMember
);

/**
 * Process invitation response route
 * @route POST /api/teams/:id/invitation/respond
 * @description Accept or decline a team invitation
 * @access Private
 */
router.post(
  '/:id/invitation/respond',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  body('accept').isBoolean().withMessage('Accept parameter must be a boolean'),
  validateRequest,
  TeamController.processInvitation
);

/**
 * Update team member route
 * @route PUT /api/teams/:id/members/:memberId
 * @description Update a team member's role or permissions
 * @access Private
 */
router.put(
  '/:id/members/:memberId',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  param('memberId').isMongoId().withMessage('Invalid member ID'),
  memberUpdateValidation,
  validateRequest,
  TeamController.updateTeamMember
);

/**
 * Remove team member route
 * @route DELETE /api/teams/:id/members/:memberId
 * @description Remove a member from the team
 * @access Private
 */
router.delete(
  '/:id/members/:memberId',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  param('memberId').isMongoId().withMessage('Invalid member ID'),
  validateRequest,
  TeamController.removeTeamMember
);

/**
 * Get user's teams route
 * @route GET /api/teams/user/:userId?
 * @description Get teams that a user belongs to (defaults to current user)
 * @access Private
 */
router.get(
  '/user/:userId?',
  authenticate(),
  TeamController.getUserTeams
);

/**
 * Get user's invitations route
 * @route GET /api/teams/invitations/pending
 * @description Get user's pending team invitations
 * @access Private
 */
router.get(
  '/invitations/pending',
  authenticate(),
  TeamController.getUserInvitations
);

/**
 * Update team analytics route
 * @route POST /api/teams/:id/analytics/update
 * @description Update team analytics
 * @access Private
 */
router.post(
  '/:id/analytics/update',
  authenticate(),
  param('id').isMongoId().withMessage('Invalid team ID'),
  validateRequest,
  TeamController.updateTeamAnalytics
);

/**
 * Get team projects route
 * @route GET /api/teams/:id/projects
 * @description Get projects associated with a team
 * @access Private
 */
router.get(
  '/:id/projects',
  authenticate(),
  param('id').notEmpty().withMessage('Team ID or slug is required'),
  validateRequest,
  TeamController.getTeamProjects
);

module.exports = router;