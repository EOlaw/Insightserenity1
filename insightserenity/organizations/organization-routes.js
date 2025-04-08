/**
 * @file Organization Routes
 * @description Defines API routes for organization management
 */

const express = require('express');
const router = express.Router();
const OrganizationController = require('./organization-controller');
const { body, param, query } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Organization creation validation
 */
const organizationCreateValidation = [
  body('name')
    .notEmpty()
    .withMessage('Organization name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Organization name must be between 2 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('domain')
    .optional()
    .isString()
    .withMessage('Domain must be a string')
    .trim(),
  body('type')
    .optional()
    .isIn(['company', 'nonprofit', 'educational', 'government', 'other'])
    .withMessage('Organization type must be valid'),
  body('size')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .withMessage('Organization size must be valid'),
  body('industry')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'other'
    ])
    .withMessage('Industry must be valid')
];

/**
 * Organization update validation
 */
const organizationUpdateValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Organization name must be between 2 and 100 characters')
    .trim(),
  body('slug')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Slug must be between 2 and 100 characters')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('domain')
    .optional()
    .isString()
    .withMessage('Domain must be a string')
    .trim(),
  body('type')
    .optional()
    .isIn(['company', 'nonprofit', 'educational', 'government', 'other'])
    .withMessage('Organization type must be valid'),
  body('size')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .withMessage('Organization size must be valid'),
  body('industry')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'other'
    ])
    .withMessage('Industry must be valid'),
  body('settings.visibility')
    .optional()
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Visibility setting must be valid'),
  body('settings.requiresEmailDomain')
    .optional()
    .isBoolean()
    .withMessage('Requires email domain setting must be a boolean'),
  body('settings.allowedEmailDomains')
    .optional()
    .isArray()
    .withMessage('Allowed email domains must be an array'),
  body('settings.memberApproval')
    .optional()
    .isIn(['automatic', 'admin_approval', 'manager_approval'])
    .withMessage('Member approval setting must be valid')
];

/**
 * Billing information update validation
 */
const billingUpdateValidation = [
  body('plan')
    .optional()
    .isIn(['free', 'starter', 'professional', 'enterprise', 'custom'])
    .withMessage('Plan must be valid'),
  body('paymentMethod.type')
    .optional()
    .isIn(['credit_card', 'bank_transfer', 'invoice'])
    .withMessage('Payment method type must be valid'),
  body('billingEmail')
    .optional()
    .isEmail()
    .withMessage('Billing email must be valid')
    .normalizeEmail(),
  body('billingAddress.street')
    .optional()
    .isString()
    .withMessage('Street must be a string'),
  body('billingAddress.city')
    .optional()
    .isString()
    .withMessage('City must be a string'),
  body('billingAddress.state')
    .optional()
    .isString()
    .withMessage('State must be a string'),
  body('billingAddress.zipCode')
    .optional()
    .isString()
    .withMessage('Zip code must be a string'),
  body('billingAddress.country')
    .optional()
    .isString()
    .withMessage('Country must be a string'),
  body('taxId')
    .optional()
    .isString()
    .withMessage('Tax ID must be a string')
];

/**
 * User invitation validation
 */
const inviteUserValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('role')
    .isIn(['admin', 'manager', 'member', 'guest'])
    .withMessage('Role must be valid')
];

/**
 * Member role update validation
 */
const updateMemberRoleValidation = [
  body('role')
    .isIn(['admin', 'manager', 'member', 'guest'])
    .withMessage('Role must be valid')
];

/**
 * Organization list query validation
 */
const organizationListValidation = [
  query('name')
    .optional()
    .isString()
    .withMessage('Name query must be a string'),
  query('domain')
    .optional()
    .isString()
    .withMessage('Domain query must be a string'),
  query('industry')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'other'
    ])
    .withMessage('Industry must be valid'),
  query('type')
    .optional()
    .isIn(['company', 'nonprofit', 'educational', 'government', 'other'])
    .withMessage('Organization type must be valid'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be valid'),
  query('visibility')
    .optional()
    .isIn(['public', 'private', 'unlisted', 'all'])
    .withMessage('Visibility must be valid'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortField')
    .optional()
    .isIn(['name', 'type', 'industry', 'metrics.memberCount', 'createdAt'])
    .withMessage('Sort field must be valid'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

/**
 * Organization routes
 */

/**
 * Create organization route
 * @route POST /api/organizations
 * @description Create a new organization
 * @access Private
 */
router.post(
  '/',
  authenticate(),
  rateLimiter('create-organization', 5, 24 * 60 * 60), // 5 per day
  organizationCreateValidation,
  validateRequest,
  OrganizationController.createOrganization
);

/**
 * Get organization routes
 * @route GET /api/organizations/:id
 * @description Get organization by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate(),
  OrganizationController.getOrganization
);

/**
 * Get organization by slug route
 * @route GET /api/organizations/slug/:slug
 * @description Get organization by slug
 * @access Private
 */
router.get(
  '/slug/:slug',
  authenticate(),
  OrganizationController.getOrganizationBySlug
);

/**
 * Update organization route
 * @route PUT /api/organizations/:id
 * @description Update organization details
 * @access Private
 */
router.put(
  '/:id',
  authenticate(),
  organizationUpdateValidation,
  validateRequest,
  OrganizationController.updateOrganization
);

/**
 * Upload organization logo route
 * @route POST /api/organizations/:id/logo
 * @description Upload or update organization logo
 * @access Private
 */
router.post(
  '/:id/logo',
  authenticate(),
  OrganizationController.uploadLogo
);

/**
 * Update billing information route
 * @route PUT /api/organizations/:id/billing
 * @description Update organization billing information
 * @access Private
 */
router.put(
  '/:id/billing',
  authenticate(),
  billingUpdateValidation,
  validateRequest,
  OrganizationController.updateBillingInfo
);

/**
 * Member management routes
 */

/**
 * Invite user route
 * @route POST /api/organizations/:id/invitations
 * @description Invite a user to join the organization
 * @access Private
 */
router.post(
  '/:id/invitations',
  authenticate(),
  rateLimiter('invite-user', 20, 24 * 60 * 60), // 20 per day
  inviteUserValidation,
  validateRequest,
  OrganizationController.inviteUser
);

/**
 * Accept invitation route
 * @route GET /api/organizations/invitations/:token/accept
 * @description Accept an organization invitation
 * @access Private
 */
router.get(
  '/invitations/:token/accept',
  authenticate(),
  OrganizationController.acceptInvitation
);

/**
 * Cancel invitation route
 * @route DELETE /api/organizations/:id/invitations/:email
 * @description Cancel an organization invitation
 * @access Private
 */
router.delete(
  '/:id/invitations/:email',
  authenticate(),
  OrganizationController.cancelInvitation
);

/**
 * Update member role route
 * @route PUT /api/organizations/:id/members/:userId/role
 * @description Update a member's role in the organization
 * @access Private
 */
router.put(
  '/:id/members/:userId/role',
  authenticate(),
  updateMemberRoleValidation,
  validateRequest,
  OrganizationController.updateMemberRole
);

/**
 * Remove member route
 * @route DELETE /api/organizations/:id/members/:userId
 * @description Remove a member from the organization
 * @access Private
 */
router.delete(
  '/:id/members/:userId',
  authenticate(),
  OrganizationController.removeMember
);

/**
 * Leave organization route
 * @route POST /api/organizations/:id/leave
 * @description Leave an organization
 * @access Private
 */
router.post(
  '/:id/leave',
  authenticate(),
  OrganizationController.leaveOrganization
);

/**
 * User-specific organization routes
 */

/**
 * Get user organizations route
 * @route GET /api/organizations/user/me
 * @description Get organizations for the authenticated user
 * @access Private
 */
router.get(
  '/user/me',
  authenticate(),
  OrganizationController.getUserOrganizations
);

/**
 * Set default organization route
 * @route PUT /api/organizations/:id/default
 * @description Set an organization as the default for the user
 * @access Private
 */
router.put(
  '/:id/default',
  authenticate(),
  OrganizationController.setDefaultOrganization
);

/**
 * Organization discovery routes
 */

/**
 * Search organizations route
 * @route GET /api/organizations
 * @description Search or list organizations
 * @access Private
 */
router.get(
  '/',
  authenticate(),
  organizationListValidation,
  validateRequest,
  OrganizationController.searchOrganizations
);

module.exports = router;