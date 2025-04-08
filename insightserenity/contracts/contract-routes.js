/**
 * @file Contract Routes
 * @description Defines API routes for contract management
 */

const express = require('express');
const router = express.Router();
const ContractController = require('./contract-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Contract creation validation
 */
const contractCreationValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('parties')
    .isArray({ min: 1 })
    .withMessage('At least one party is required'),
  body('parties.*.role')
    .notEmpty()
    .withMessage('Party role is required')
    .isIn(['client', 'consultant', 'organization', 'third_party'])
    .withMessage('Invalid party role'),
  body('parties.*.entity')
    .optional()
    .isMongoId()
    .withMessage('Invalid entity ID format'),
  body('parties.*.entityType')
    .notEmpty()
    .withMessage('Entity type is required')
    .isIn(['User', 'Client', 'Consultant', 'Organization'])
    .withMessage('Invalid entity type'),
  body('parties.*.name')
    .notEmpty()
    .withMessage('Party name is required'),
  body('parties.*.email')
    .notEmpty()
    .withMessage('Party email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  body('project')
    .optional()
    .isMongoId()
    .withMessage('Invalid project ID format'),
  body('template')
    .optional()
    .isMongoId()
    .withMessage('Invalid template ID format'),
  body('details.payment.type')
    .notEmpty()
    .withMessage('Payment type is required')
    .isIn(['fixed', 'hourly', 'milestone', 'retainer', 'value_based'])
    .withMessage('Invalid payment type'),
  body('content')
    .notEmpty()
    .withMessage('Contract content is required')
];

/**
 * Contract update validation
 */
const contractUpdateValidation = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('parties')
    .optional()
    .isArray()
    .withMessage('Parties must be an array'),
  body('details.payment.type')
    .optional()
    .isIn(['fixed', 'hourly', 'milestone', 'retainer', 'value_based'])
    .withMessage('Invalid payment type'),
  body('createAmendment')
    .optional()
    .isBoolean()
    .withMessage('createAmendment must be a boolean')
];

/**
 * Template creation validation
 */
const templateCreationValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('code')
    .notEmpty()
    .withMessage('Code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Code must be between 2 and 20 characters')
    .matches(/^[A-Za-z0-9-_]+$/)
    .withMessage('Code can only contain letters, numbers, hyphens, and underscores'),
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn([
      'consulting_agreement', 
      'service_agreement', 
      'nda', 
      'project_contract', 
      'retainer_agreement',
      'statement_of_work',
      'master_services_agreement',
      'amendment',
      'custom'
    ])
    .withMessage('Invalid template type'),
  body('category')
    .optional()
    .isIn(['client', 'consultant', 'organization', 'general'])
    .withMessage('Invalid template category'),
  body('content')
    .notEmpty()
    .withMessage('Template content is required'),
  body('sections')
    .optional()
    .isArray()
    .withMessage('Sections must be an array'),
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Invalid status value'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

/**
 * Template update validation
 */
const templateUpdateValidation = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('code')
    .optional()
    .isLength({ min: 2, max: 20 })
    .withMessage('Code must be between 2 and 20 characters')
    .matches(/^[A-Za-z0-9-_]+$/)
    .withMessage('Code can only contain letters, numbers, hyphens, and underscores'),
  body('type')
    .optional()
    .isIn([
      'consulting_agreement', 
      'service_agreement', 
      'nda', 
      'project_contract', 
      'retainer_agreement',
      'statement_of_work',
      'master_services_agreement',
      'amendment',
      'custom'
    ])
    .withMessage('Invalid template type'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Invalid status value'),
  body('createNewVersion')
    .optional()
    .isBoolean()
    .withMessage('createNewVersion must be a boolean'),
  body('versionIncrement')
    .optional()
    .isIn(['major', 'minor', 'patch'])
    .withMessage('Invalid version increment')
];

/**
 * =====================
 * CONTRACT ROUTES
 * =====================
 */

/**
 * Get all contracts route
 * @route GET /api/contracts
 * @description Get all contracts with optional filtering
 * @access Private
 */
router.get(
  '/',
  authenticate(),
  ContractController.getContracts
);

/**
 * Get contract by ID route
 * @route GET /api/contracts/:id
 * @description Get a specific contract by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate(),
  ContractController.getContractById
);

/**
 * Create contract route
 * @route POST /api/contracts
 * @description Create a new contract
 * @access Private
 */
router.post(
  '/',
  authenticate(),
  contractCreationValidation,
  validateRequest,
  ContractController.createContract
);

/**
 * Update contract route
 * @route PUT /api/contracts/:id
 * @description Update a contract
 * @access Private
 */
router.put(
  '/:id',
  authenticate(),
  contractUpdateValidation,
  validateRequest,
  ContractController.updateContract
);

/**
 * Change contract status route
 * @route PATCH /api/contracts/:id/status
 * @description Change contract status
 * @access Private
 */
router.patch(
  '/:id/status',
  authenticate(),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['draft', 'pending_signature', 'active', 'completed', 'terminated', 'expired', 'amended'])
    .withMessage('Invalid status value'),
  validateRequest,
  ContractController.changeContractStatus
);

/**
 * Sign contract route
 * @route POST /api/contracts/:id/sign
 * @description Sign a contract
 * @access Private
 */
router.post(
  '/:id/sign',
  authenticate(),
  rateLimiter('sign-contract', 10, 60 * 60), // 10 requests per hour
  ContractController.signContract
);

/**
 * Generate contract PDF route
 * @route GET /api/contracts/:id/pdf
 * @description Generate a PDF for a contract
 * @access Private
 */
router.get(
  '/:id/pdf',
  authenticate(),
  rateLimiter('contract-pdf', 20, 60 * 60), // 20 requests per hour
  ContractController.generateContractPdf
);

/**
 * Upload contract file route
 * @route POST /api/contracts/:id/files
 * @description Upload a file to a contract
 * @access Private
 */
router.post(
  '/:id/files',
  authenticate(),
  ContractController.uploadContractFile
);

/**
 * Remove contract file route
 * @route DELETE /api/contracts/:id/files/:fileId
 * @description Remove a file from a contract
 * @access Private
 */
router.delete(
  '/:id/files/:fileId',
  authenticate(),
  ContractController.removeContractFile
);

/**
 * Get user contract statistics route
 * @route GET /api/contracts/stats/user/:userId?
 * @description Get contract statistics for a user
 * @access Private
 */
router.get(
  '/stats/user/:userId?',
  authenticate(),
  ContractController.getUserContractStats
);

/**
 * =====================
 * TEMPLATE ROUTES
 * =====================
 */

/**
 * Get all templates route
 * @route GET /api/contracts/templates
 * @description Get all contract templates with optional filtering
 * @access Private
 */
router.get(
  '/templates',
  authenticate(),
  ContractController.getTemplates
);

/**
 * Get template by ID route
 * @route GET /api/contracts/templates/:id
 * @description Get a specific template by ID
 * @access Private
 */
router.get(
  '/templates/:id',
  authenticate(),
  ContractController.getTemplateById
);

/**
 * Create template route
 * @route POST /api/contracts/templates
 * @description Create a new contract template
 * @access Private (admin or authorized only)
 */
router.post(
  '/templates',
  authenticate({ roles: ['admin', 'consultant'] }),
  templateCreationValidation,
  validateRequest,
  ContractController.createTemplate
);

/**
 * Update template route
 * @route PUT /api/contracts/templates/:id
 * @description Update a contract template
 * @access Private (admin or creator only)
 */
router.put(
  '/templates/:id',
  authenticate(),
  templateUpdateValidation,
  validateRequest,
  ContractController.updateTemplate
);

/**
 * Generate contract content from template route
 * @route POST /api/contracts/templates/:id/generate
 * @description Generate contract content from a template with variables
 * @access Private
 */
router.post(
  '/templates/:id/generate',
  authenticate(),
  rateLimiter('generate-contract', 20, 60 * 60), // 20 requests per hour
  ContractController.generateContractContent
);

module.exports = router;