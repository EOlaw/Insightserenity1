/**
 * @file Marketing Routes
 * @description Defines API and view routes for marketing module
 */

const express = require('express');
const router = express.Router();
const MarketingController = require('./marketing-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Contact form validation
 */
const contactFormValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be valid'),
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Phone number must be valid'),
  body('company')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Company name must not exceed 100 characters'),
  body('subject')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Subject must not exceed 200 characters'),
  body('newsletter')
    .optional()
    .isBoolean()
    .withMessage('Newsletter subscription must be boolean')
];

/**
 * Newsletter subscription validation
 */
const newsletterValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be valid'),
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters')
];

/**
 * Testimonial validation
 */
const testimonialValidation = [
  body('client.name')
    .notEmpty()
    .withMessage('Client name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name must be between 2 and 100 characters'),
  body('client.title')
    .notEmpty()
    .withMessage('Client title is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Client title must be between 2 and 100 characters'),
  body('client.company')
    .notEmpty()
    .withMessage('Client company is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Client company must be between 2 and 100 characters'),
  body('client.industry')
    .optional()
    .isIn([
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ])
    .withMessage('Invalid industry'),
  body('quote.short')
    .notEmpty()
    .withMessage('Short quote is required')
    .isLength({ min: 10, max: 250 })
    .withMessage('Short quote must be between 10 and 250 characters'),
  body('quote.full')
    .notEmpty()
    .withMessage('Full quote is required')
    .isLength({ min: 50, max: 2000 })
    .withMessage('Full quote must be between 50 and 2000 characters'),
  body('rating.value')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('service')
    .optional()
    .isMongoId()
    .withMessage('Service must be a valid ID'),
  body('project')
    .optional()
    .isMongoId()
    .withMessage('Project must be a valid ID'),
  body('consultant')
    .optional()
    .isMongoId()
    .withMessage('Consultant must be a valid ID')
];

/**
 * View Routes - Render frontend pages
 */

/**
 * Home page route
 * @route GET /
 * @description Render the home page
 * @access Public
 */
router.get('/', MarketingController.renderHomePage);

/**
 * About page route
 * @route GET /about
 * @description Render the about page
 * @access Public
 */
router.get('/about', MarketingController.renderAboutPage);

/**
 * Services overview page route
 * @route GET /services
 * @description Render the services overview page
 * @access Public
 */
router.get('/services', MarketingController.renderServicesPage);

/**
 * Contact page route
 * @route GET /contact
 * @description Render the contact page
 * @access Public
 */
router.get('/contact', MarketingController.renderContactPage);

/**
 * Pricing page route
 * @route GET /pricing
 * @description Render the pricing page
 * @access Public
 */
router.get('/pricing', MarketingController.renderPricingPage);

/**
 * API Routes - For data fetching and form submissions
 */

/**
 * Get page content route
 * @route GET /api/marketing/pages/:page
 * @description Get content for a specific marketing page
 * @access Public
 */
router.get(
  '/api/marketing/pages/:page',
  rateLimiter('get-page-content', 60, 60), // 60 requests per minute
  MarketingController.getPageContent
);

/**
 * Contact form submission route
 * @route POST /api/marketing/contact
 * @description Submit the contact form
 * @access Public
 */
router.post(
  '/api/marketing/contact',
  rateLimiter('submit-contact-form', 5, 60 * 10), // 5 requests per 10 minutes
  contactFormValidation,
  validateRequest,
  MarketingController.submitContactForm
);

/**
 * Newsletter subscription route
 * @route POST /api/marketing/subscribe
 * @description Subscribe to the newsletter
 * @access Public
 */
router.post(
  '/api/marketing/subscribe',
  rateLimiter('subscribe-newsletter', 3, 60 * 10), // 3 requests per 10 minutes
  newsletterValidation,
  validateRequest,
  MarketingController.subscribeNewsletter
);

/**
 * Get testimonials route
 * @route GET /api/marketing/testimonials
 * @description Get testimonials with optional filtering
 * @access Public
 */
router.get(
  '/api/marketing/testimonials',
  rateLimiter('get-testimonials', 60, 60), // 60 requests per minute
  MarketingController.getTestimonials
);

/**
 * Submit testimonial route
 * @route POST /api/marketing/testimonials
 * @description Submit a new testimonial
 * @access Private
 */
router.post(
  '/api/marketing/testimonials',
  authenticate(),
  testimonialValidation,
  validateRequest,
  MarketingController.submitTestimonial
);

/**
 * Update testimonial status route
 * @route PUT /api/marketing/testimonials/:id/status
 * @description Approve or reject a testimonial
 * @access Private (admin only)
 */
router.put(
  '/api/marketing/testimonials/:id/status',
  authenticate({ roles: ['admin'] }),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['approved', 'rejected', 'archived'])
    .withMessage('Invalid status'),
  validateRequest,
  MarketingController.updateTestimonialStatus
);

/**
 * Upload testimonial image route
 * @route POST /api/marketing/testimonials/:id/image
 * @description Upload client avatar or company logo
 * @access Private (admin only)
 */
router.post(
  '/api/marketing/testimonials/:id/image',
  authenticate({ roles: ['admin'] }),
  MarketingController.uploadTestimonialImage
);

/**
 * Get marketing statistics route
 * @route GET /api/marketing/stats
 * @description Get marketing statistics
 * @access Private (admin only)
 */
router.get(
  '/api/marketing/stats',
  authenticate({ roles: ['admin'] }),
  MarketingController.getMarketingStats
);

/**
 * SEO Routes
 */

/**
 * Sitemap route
 * @route GET /sitemap.xml
 * @description Generate and serve sitemap
 * @access Public
 */
router.get(
  '/sitemap.xml',
  rateLimiter('sitemap', 10, 60), // 10 requests per minute
  MarketingController.generateSitemap
);

/**
 * Robots.txt route
 * @route GET /robots.txt
 * @description Generate and serve robots.txt
 * @access Public
 */
router.get(
  '/robots.txt',
  rateLimiter('robots-txt', 10, 60), // 10 requests per minute
  MarketingController.generateRobotsTxt
);

module.exports = router;