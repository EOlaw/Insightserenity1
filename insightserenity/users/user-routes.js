/**
 * @file User Routes
 * @description Defines API routes for user management
 */

const express = require('express');
const router = express.Router();
const UserController = require('./user-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Profile update validation
 */
const profileUpdateValidation = [
  body('firstName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('phoneNumber')
    .optional()
    .isString()
    .trim()
    .withMessage('Phone number must be a string'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must not exceed 1000 characters'),
  body('location.country')
    .optional()
    .isString()
    .trim()
    .withMessage('Country must be a string'),
  body('location.state')
    .optional()
    .isString()
    .trim()
    .withMessage('State must be a string'),
  body('location.city')
    .optional()
    .isString()
    .trim()
    .withMessage('City must be a string'),
  body('location.zipCode')
    .optional()
    .isString()
    .trim()
    .withMessage('Zip code must be a string'),
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
  body('socialMedia.website')
    .optional()
    .isURL()
    .withMessage('Website URL must be a valid URL'),
  body('preferences.language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de'])
    .withMessage('Language must be a valid option'),
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),
  body('preferences.notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notification preference must be a boolean'),
  body('preferences.notifications.browser')
    .optional()
    .isBoolean()
    .withMessage('Browser notification preference must be a boolean'),
  body('preferences.marketing')
    .optional()
    .isBoolean()
    .withMessage('Marketing preference must be a boolean')
];

/**
 * Client profile update validation
 */
const clientProfileUpdateValidation = [
  body('company.name')
    .optional()
    .isString()
    .trim()
    .withMessage('Company name must be a string'),
  body('company.position')
    .optional()
    .isString()
    .trim()
    .withMessage('Position must be a string'),
  body('company.industry')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'other'
    ])
    .withMessage('Industry must be a valid option'),
  body('company.size')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .withMessage('Company size must be a valid option'),
  body('company.website')
    .optional()
    .isURL()
    .withMessage('Website must be a valid URL'),
  body('billing.address.street')
    .optional()
    .isString()
    .trim()
    .withMessage('Street must be a string'),
  body('billing.address.city')
    .optional()
    .isString()
    .trim()
    .withMessage('City must be a string'),
  body('billing.address.state')
    .optional()
    .isString()
    .trim()
    .withMessage('State must be a string'),
  body('billing.address.zipCode')
    .optional()
    .isString()
    .trim()
    .withMessage('Zip code must be a string'),
  body('billing.address.country')
    .optional()
    .isString()
    .trim()
    .withMessage('Country must be a string'),
  body('billing.taxId')
    .optional()
    .isString()
    .trim()
    .withMessage('Tax ID must be a string'),
  body('clientProfile.needsAssessment.primaryNeeds')
    .optional()
    .isArray()
    .withMessage('Primary needs must be an array'),
  body('clientProfile.needsAssessment.budget.range')
    .optional()
    .isIn(['under_5k', '5k_15k', '15k_50k', '50k_plus'])
    .withMessage('Budget range must be a valid option'),
  body('clientProfile.needsAssessment.budget.flexibility')
    .optional()
    .isIn(['fixed', 'somewhat_flexible', 'very_flexible'])
    .withMessage('Budget flexibility must be a valid option'),
  body('clientProfile.needsAssessment.timeline.urgency')
    .optional()
    .isIn(['immediate', 'within_month', 'within_quarter', 'flexible'])
    .withMessage('Timeline urgency must be a valid option'),
  body('clientProfile.needsAssessment.timeline.expectedDuration')
    .optional()
    .isIn(['short_term', 'medium_term', 'long_term', 'ongoing'])
    .withMessage('Expected duration must be a valid option'),
  body('clientProfile.preferences.communicationFrequency')
    .optional()
    .isIn(['daily', 'weekly', 'biweekly', 'monthly', 'as_needed'])
    .withMessage('Communication frequency must be a valid option'),
  body('clientProfile.preferences.communicationChannels')
    .optional()
    .isArray()
    .withMessage('Communication channels must be an array'),
  body('clientProfile.preferences.reportingPreferences')
    .optional()
    .isArray()
    .withMessage('Reporting preferences must be an array'),
  body('settings.visibility.showCompany')
    .optional()
    .isBoolean()
    .withMessage('Company visibility setting must be a boolean'),
  body('settings.visibility.showProjects')
    .optional()
    .isBoolean()
    .withMessage('Projects visibility setting must be a boolean'),
  body('settings.notifications.proposalReceived')
    .optional()
    .isBoolean()
    .withMessage('Proposal notification setting must be a boolean'),
  body('settings.notifications.consultantMessage')
    .optional()
    .isBoolean()
    .withMessage('Consultant message notification setting must be a boolean'),
  body('settings.notifications.projectUpdate')
    .optional()
    .isBoolean()
    .withMessage('Project update notification setting must be a boolean'),
  body('settings.notifications.billingAlert')
    .optional()
    .isBoolean()
    .withMessage('Billing alert notification setting must be a boolean')
];

/**
 * Consultant profile update validation
 */
const consultantProfileUpdateValidation = [
  body('professional.title')
    .optional()
    .isString()
    .trim()
    .withMessage('Professional title must be a string'),
  body('professional.summary')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Summary must not exceed 2000 characters'),
  body('professional.yearsOfExperience')
    .optional()
    .isInt({ min: 0, max: 70 })
    .withMessage('Years of experience must be a valid number'),
  body('professional.education')
    .optional()
    .isArray()
    .withMessage('Education must be an array'),
  body('professional.certifications')
    .optional()
    .isArray()
    .withMessage('Certifications must be an array'),
  body('professional.languages')
    .optional()
    .isArray()
    .withMessage('Languages must be an array'),
  body('expertise.primarySpecialty')
    .optional()
    .isIn([
      'software_development', 'cloud_architecture', 'data_science', 'cybersecurity',
      'project_management', 'ux_design', 'digital_marketing', 'business_strategy',
      'financial_consulting', 'legal_consulting', 'healthcare_consulting', 'education',
      'human_resources', 'sustainability', 'other'
    ])
    .withMessage('Primary specialty must be a valid option'),
  body('expertise.skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  body('expertise.industries')
    .optional()
    .isArray()
    .withMessage('Industries must be an array'),
  body('expertise.methodologies')
    .optional()
    .isArray()
    .withMessage('Methodologies must be an array'),
  body('workExperience')
    .optional()
    .isArray()
    .withMessage('Work experience must be an array'),
  body('portfolio.projects')
    .optional()
    .isArray()
    .withMessage('Portfolio projects must be an array'),
  body('portfolio.publications')
    .optional()
    .isArray()
    .withMessage('Publications must be an array'),
  body('portfolio.speakingEngagements')
    .optional()
    .isArray()
    .withMessage('Speaking engagements must be an array'),
  body('services.offerings')
    .optional()
    .isArray()
    .withMessage('Service offerings must be an array'),
  body('services.availability.status')
    .optional()
    .isIn(['available', 'limited', 'unavailable'])
    .withMessage('Availability status must be a valid option'),
  body('services.availability.hoursPerWeek')
    .optional()
    .isInt({ min: 0, max: 168 })
    .withMessage('Hours per week must be a valid number'),
  body('services.rateInfo.hourlyRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a valid number'),
  body('services.rateInfo.currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'])
    .withMessage('Currency must be a valid option'),
  body('services.rateInfo.negotiable')
    .optional()
    .isBoolean()
    .withMessage('Negotiable setting must be a boolean'),
  body('settings.profileVisibility')
    .optional()
    .isIn(['public', 'private', 'members_only'])
    .withMessage('Profile visibility must be a valid option'),
  body('settings.availableForWork')
    .optional()
    .isBoolean()
    .withMessage('Available for work setting must be a boolean'),
  body('settings.autoAcceptRequests')
    .optional()
    .isBoolean()
    .withMessage('Auto-accept requests setting must be a boolean')
];

/**
 * Email change validation
 */
const emailChangeValidation = [
  body('newEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Current password is required for verification')
];

/**
 * User profile routes
 */

/**
 * Get current user profile route
 * @route GET /api/users/me
 * @description Get the authenticated user's profile
 * @access Private
 */
router.get(
  '/me',
  authenticate(),
  UserController.getCurrentUser
);

/**
 * Update user profile route
 * @route PUT /api/users/profile
 * @description Update user profile information
 * @access Private
 */
router.put(
  '/profile',
  authenticate(),
  profileUpdateValidation,
  validateRequest,
  UserController.updateProfile
);

/**
 * Upload profile picture route
 * @route POST /api/users/profile/picture
 * @description Upload or update user profile picture
 * @access Private
 */
router.post(
  '/profile/picture',
  authenticate(),
  UserController.uploadProfilePicture
);

/**
 * Update client profile route
 * @route PUT /api/users/client
 * @description Update client-specific profile information
 * @access Private
 */
router.put(
  '/client',
  authenticate(),
  clientProfileUpdateValidation,
  validateRequest,
  UserController.updateClientProfile
);

/**
 * Update consultant profile route
 * @route PUT /api/users/consultant
 * @description Update consultant-specific profile information
 * @access Private
 */
router.put(
  '/consultant',
  authenticate(),
  consultantProfileUpdateValidation,
  validateRequest,
  UserController.updateConsultantProfile
);

/**
 * Upload portfolio file route
 * @route POST /api/users/consultant/portfolio/file
 * @description Upload file for consultant portfolio
 * @access Private
 */
router.post(
  '/consultant/portfolio/file',
  authenticate(),
  UserController.uploadPortfolioFile
);

/**
 * Account management routes
 */

/**
 * Deactivate account route
 * @route POST /api/users/deactivate
 * @description Deactivate user account
 * @access Private
 */
router.post(
  '/deactivate',
  authenticate(),
  body('reason')
    .notEmpty()
    .withMessage('Reason for deactivation is required'),
  validateRequest,
  UserController.deactivateAccount
);

/**
 * Get activity log route
 * @route GET /api/users/activity
 * @description Get user activity log
 * @access Private
 */
router.get(
  '/activity',
  authenticate(),
  UserController.getActivityLog
);

/**
 * Passkey management routes
 */

/**
 * Get passkey registration options route
 * @route GET /api/users/passkeys/options
 * @description Get WebAuthn/Passkey registration options
 * @access Private
 */
router.get(
  '/passkeys/options',
  authenticate(),
  rateLimiter('passkey-options', 10, 60 * 60), // 10 requests per hour
  UserController.getPasskeyRegistrationOptions
);

/**
 * Register passkey route
 * @route POST /api/users/passkeys
 * @description Register a new WebAuthn/Passkey
 * @access Private
 */
router.post(
  '/passkeys',
  authenticate(),
  rateLimiter('passkey-register', 5, 60 * 60), // 5 requests per hour
  UserController.registerPasskey
);

/**
 * Get passkeys route
 * @route GET /api/users/passkeys
 * @description Get user's registered WebAuthn/Passkeys
 * @access Private
 */
router.get(
  '/passkeys',
  authenticate(),
  UserController.getPasskeys
);

/**
 * Remove passkey route
 * @route DELETE /api/users/passkeys/:credentialId
 * @description Remove a registered WebAuthn/Passkey
 * @access Private
 */
router.delete(
  '/passkeys/:credentialId',
  authenticate(),
  UserController.removePasskey
);

/**
 * Email management routes
 */

/**
 * Request email change route
 * @route POST /api/users/email/change
 * @description Initiate email change process
 * @access Private
 */
router.post(
  '/email/change',
  authenticate(),
  rateLimiter('email-change', 3, 24 * 60 * 60), // 3 requests per day
  emailChangeValidation,
  validateRequest,
  UserController.requestEmailChange
);

/**
 * Confirm email change route
 * @route GET /api/users/email/confirm/:token
 * @description Confirm email change with token
 * @access Public
 */
router.get(
  '/email/confirm/:token',
  rateLimiter('email-confirm', 5, 60 * 60), // 5 requests per hour
  UserController.confirmEmailChange
);

module.exports = router;