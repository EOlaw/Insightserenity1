/**
 * @file Event Routes
 * @description Defines API routes for event management
 */

const express = require('express');
const router = express.Router();
const EventController = require('./event-controller');
const { body, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate-request');
const rateLimiter = require('../security/rate-limiter');

/**
 * Event creation validation
 */
const eventCreationValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('type')
    .notEmpty()
    .withMessage('Event type is required')
    .isIn(['webinar', 'workshop', 'conference', 'meetup', 'training', 'other'])
    .withMessage('Invalid event type'),
  body('format')
    .notEmpty()
    .withMessage('Event format is required')
    .isIn(['online', 'in-person', 'hybrid'])
    .withMessage('Invalid event format'),
  body('summary')
    .notEmpty()
    .withMessage('Summary is required')
    .isLength({ max: 500 })
    .withMessage('Summary must not exceed 500 characters'),
  body('description')
    .notEmpty()
    .withMessage('Description is required'),
  body('schedule.startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('schedule.endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.schedule.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('schedule.timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('presenters')
    .optional()
    .isArray()
    .withMessage('Presenters must be an array'),
  body('presenters.*.name')
    .optional()
    .isString()
    .withMessage('Presenter name must be a string'),
  body('location.online.platform')
    .optional()
    .isString()
    .withMessage('Platform must be a string'),
  body('location.physical.venue')
    .optional()
    .isString()
    .withMessage('Venue must be a string'),
  body('industries')
    .optional()
    .isArray()
    .withMessage('Industries must be an array'),
  body('topics')
    .optional()
    .isArray()
    .withMessage('Topics must be an array'),
  body('targetAudience')
    .optional()
    .isArray()
    .withMessage('Target audience must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'cancelled', 'completed', 'archived'])
    .withMessage('Invalid status value'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Invalid visibility value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean')
];

/**
 * Event update validation (same as creation but all fields optional)
 */
const eventUpdateValidation = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 100 })
    .withMessage('Slug must be between 3 and 100 characters'),
  body('type')
    .optional()
    .isIn(['webinar', 'workshop', 'conference', 'meetup', 'training', 'other'])
    .withMessage('Invalid event type'),
  body('format')
    .optional()
    .isIn(['online', 'in-person', 'hybrid'])
    .withMessage('Invalid event format'),
  body('summary')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Summary must not exceed 500 characters'),
  body('schedule.startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('schedule.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'cancelled', 'completed', 'archived'])
    .withMessage('Invalid status value'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Invalid visibility value'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured flag must be a boolean')
];

/**
 * Registration validation
 */
const registrationValidation = [
  body('contactInfo.firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('contactInfo.lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('contactInfo.email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email address'),
  body('contactInfo.phoneNumber')
    .optional()
    .isString()
    .withMessage('Phone number must be a string'),
  body('contactInfo.company')
    .optional()
    .isString()
    .withMessage('Company must be a string'),
  body('contactInfo.jobTitle')
    .optional()
    .isString()
    .withMessage('Job title must be a string'),
  body('demographics')
    .optional()
    .isObject()
    .withMessage('Demographics must be an object'),
  body('marketing.referralSource')
    .optional()
    .isString()
    .withMessage('Referral source must be a string'),
  body('marketing.marketingConsent')
    .optional()
    .isBoolean()
    .withMessage('Marketing consent must be a boolean'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  body('customFields')
    .optional()
    .isObject()
    .withMessage('Custom fields must be an object')
];

/**
 * Feedback validation
 */
const feedbackValidation = [
  body('overallRating')
    .notEmpty()
    .withMessage('Overall rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Overall rating must be between 1 and 5'),
  body('comments')
    .optional()
    .isString()
    .withMessage('Comments must be a string'),
  body('surveyResponses')
    .optional()
    .isObject()
    .withMessage('Survey responses must be an object')
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
 * Get all events route
 * @route GET /api/events
 * @description Get all published events with optional filtering
 * @access Public
 */
router.get(
  '/',
  rateLimiter('get-events', 60, 60), // 60 requests per minute
  EventController.getEvents
);

/**
 * Get event by ID or slug route
 * @route GET /api/events/:id
 * @description Get a specific event by ID or slug
 * @access Public
 */
router.get(
  '/:id',
  rateLimiter('get-event', 60, 60), // 60 requests per minute
  EventController.getEventById
);

/**
 * Get featured events route
 * @route GET /api/events/featured/list
 * @description Get list of featured events
 * @access Public
 */
router.get(
  '/featured/list',
  rateLimiter('get-featured-events', 60, 60), // 60 requests per minute
  EventController.getFeaturedEvents
);

/**
 * Get upcoming events route
 * @route GET /api/events/upcoming/list
 * @description Get list of upcoming events
 * @access Public
 */
router.get(
  '/upcoming/list',
  rateLimiter('get-upcoming-events', 60, 60), // 60 requests per minute
  EventController.getUpcomingEvents
);

/**
 * Download event calendar route
 * @route GET /api/events/:id/calendar
 * @description Download iCalendar file for an event
 * @access Public
 */
router.get(
  '/:id/calendar',
  rateLimiter('download-event-calendar', 20, 60), // 20 requests per minute
  EventController.downloadEventCalendar
);

/**
 * Get monthly calendar events route
 * @route GET /api/events/calendar/:year/:month
 * @description Get events for a specific month
 * @access Public
 */
router.get(
  '/calendar/:year/:month',
  rateLimiter('get-monthly-calendar', 60, 60), // 60 requests per minute
  EventController.getMonthlyCalendar
);

/**
 * Register for event route (guest)
 * @route POST /api/events/:id/register
 * @description Register for an event as a guest
 * @access Public
 */
router.post(
  '/:id/register',
  rateLimiter('register-event', 10, 60), // 10 requests per minute
  registrationValidation,
  validateRequest,
  EventController.registerForEvent
);

/**
 * Check schedule conflicts route
 * @route POST /api/events/check-conflicts
 * @description Check for schedule conflicts
 * @access Public
 */
router.post(
  '/check-conflicts',
  rateLimiter('check-conflicts', 20, 60), // 20 requests per minute
  EventController.checkScheduleConflicts
);

/**
 * Protected routes - require authentication
 */

/**
 * Create event route
 * @route POST /api/events
 * @description Create a new event
 * @access Private (admin)
 */
router.post(
  '/',
  authenticate({ roles: ['admin'] }),
  eventCreationValidation,
  validateRequest,
  EventController.createEvent
);

/**
 * Update event route
 * @route PUT /api/events/:id
 * @description Update an event
 * @access Private (admin)
 */
router.put(
  '/:id',
  authenticate({ roles: ['admin'] }),
  eventUpdateValidation,
  validateRequest,
  EventController.updateEvent
);

/**
 * Delete event route
 * @route DELETE /api/events/:id
 * @description Delete an event
 * @access Private (admin)
 */
router.delete(
  '/:id',
  authenticate({ roles: ['admin'] }),
  EventController.deleteEvent
);

/**
 * Change event status route
 * @route PATCH /api/events/:id/status
 * @description Change event status (draft, published, cancelled, completed, archived)
 * @access Private (admin)
 */
router.patch(
  '/:id/status',
  authenticate({ roles: ['admin'] }),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['draft', 'published', 'cancelled', 'completed', 'archived'])
    .withMessage('Invalid status value'),
  validateRequest,
  EventController.changeEventStatus
);

/**
 * Upload event image route
 * @route POST /api/events/:id/image
 * @description Upload an event image (featured or gallery)
 * @access Private (admin)
 */
router.post(
  '/:id/image',
  authenticate({ roles: ['admin'] }),
  EventController.uploadEventImage
);

/**
 * Get event registrations route
 * @route GET /api/events/:id/registrations
 * @description Get registrations for an event
 * @access Private (admin)
 */
router.get(
  '/:id/registrations',
  authenticate({ roles: ['admin'] }),
  EventController.getEventRegistrations
);

/**
 * Update registration status route
 * @route PATCH /api/events/registrations/:registrationId/status
 * @description Update registration status
 * @access Private (admin)
 */
router.patch(
  '/registrations/:registrationId/status',
  authenticate({ roles: ['admin'] }),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'confirmed', 'cancelled', 'attended', 'no-show'])
    .withMessage('Invalid status value'),
  validateRequest,
  EventController.updateRegistrationStatus
);

/**
 * Check in attendee route
 * @route POST /api/events/registrations/:registrationId/check-in
 * @description Check in an attendee
 * @access Private (admin)
 */
router.post(
  '/registrations/:registrationId/check-in',
  authenticate({ roles: ['admin'] }),
  EventController.checkInAttendee
);

/**
 * Process waitlist route
 * @route POST /api/events/:id/process-waitlist
 * @description Process event waitlist
 * @access Private (admin)
 */
router.post(
  '/:id/process-waitlist',
  authenticate({ roles: ['admin'] }),
  EventController.processEventWaitlist
);

/**
 * Get event statistics route
 * @route GET /api/events/:id/statistics
 * @description Get event statistics
 * @access Private (admin)
 */
router.get(
  '/:id/statistics',
  authenticate({ roles: ['admin'] }),
  EventController.getEventStatistics
);

/**
 * Register for event route (authenticated user)
 * @route POST /api/events/:id/register-user
 * @description Register for an event as an authenticated user
 * @access Private
 */
router.post(
  '/:id/register-user',
  authenticate(),
  registrationValidation,
  validateRequest,
  EventController.registerForEvent
);

/**
 * Get user registrations route
 * @route GET /api/events/my-registrations
 * @description Get registrations for the authenticated user
 * @access Private
 */
router.get(
  '/my-registrations',
  authenticate(),
  EventController.getUserRegistrations
);

/**
 * Cancel registration route
 * @route POST /api/events/registrations/:registrationId/cancel
 * @description Cancel a registration
 * @access Private
 */
router.post(
  '/registrations/:registrationId/cancel',
  authenticate(),
  EventController.cancelRegistration
);

/**
 * Get registration calendar links route
 * @route GET /api/events/registrations/:registrationId/calendar-links
 * @description Get calendar links for a registration
 * @access Private
 */
router.get(
  '/registrations/:registrationId/calendar-links',
  authenticate(),
  EventController.getRegistrationCalendarLinks
);

/**
 * Submit event feedback route
 * @route POST /api/events/:id/feedback
 * @description Submit feedback for an event
 * @access Private
 */
router.post(
  '/:id/feedback',
  authenticate(),
  feedbackValidation,
  validateRequest,
  EventController.submitEventFeedback
);

module.exports = router;