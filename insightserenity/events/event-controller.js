/**
 * @file Event Controller
 * @description Controller for handling event-related HTTP requests
 */

const EventService = require('./event-service');
const CalendarService = require('./calendar-service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Event Controller
 * Handles HTTP requests related to event management
 */
class EventController {
  /**
   * Get all events with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getEvents(req, res) {
    try {
      // Extract filter parameters
      const filters = {
        type: req.query.type,
        format: req.query.format,
        status: req.query.status,
        visibility: req.query.visibility,
        industry: req.query.industry,
        topic: req.query.topic,
        search: req.query.search,
        featured: req.query.featured,
        upcoming: req.query.upcoming === 'true',
        past: req.query.past === 'true',
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'schedule.startDate',
        sortOrder: req.query.sortOrder || 'asc'
      };
      
      const result = await EventService.getEvents(filters, options);
      
      res.status(200).json({
        success: true,
        events: result.events,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting events:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve events'
      });
    }
  }

  /**
   * Get event by ID or slug
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getEventById(req, res) {
    try {
      const identifier = req.params.id;
      
      // Set options for related data inclusion
      const options = {
        includePresenters: req.query.includePresenters === 'true',
        includeRelatedServices: req.query.includeRelatedServices === 'true',
        includeRegistrationCount: req.query.includeRegistrationCount === 'true',
        trackView: req.query.trackView === 'true',
        isAdmin: req.user && req.user.role === 'admin',
        isAuthenticated: !!req.user,
        userId: req.user ? req.user.id : null
      };
      
      const event = await EventService.getEventById(identifier, options);
      
      res.status(200).json({
        success: true,
        event
      });
    } catch (error) {
      logger.error(`Error getting event ${req.params.id}:`, error);
      res.status(error.message === 'Event not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve event'
      });
    }
  }

  /**
   * Create new event
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createEvent(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const newEvent = await EventService.createEvent(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Event created successfully',
        event: newEvent
      });
    } catch (error) {
      logger.error('Error creating event:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create event'
      });
    }
  }

  /**
   * Update event
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateEvent(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const eventId = req.params.id;
      const updatedEvent = await EventService.updateEvent(eventId, req.body, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Event updated successfully',
        event: updatedEvent
      });
    } catch (error) {
      logger.error(`Error updating event ${req.params.id}:`, error);
      res.status(error.message === 'Event not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update event'
      });
    }
  }

  /**
   * Delete event
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteEvent(req, res) {
    try {
      const eventId = req.params.id;
      await EventService.deleteEvent(eventId);
      
      res.status(200).json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting event ${req.params.id}:`, error);
      res.status(error.message === 'Event not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to delete event'
      });
    }
  }

  /**
   * Change event status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changeEventStatus(req, res) {
    try {
      const { status, reason } = req.body;
      const eventId = req.params.id;
      
      if (!status || !['draft', 'published', 'cancelled', 'completed', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be draft, published, cancelled, completed, or archived.'
        });
      }
      
      const statusData = {};
      if (status === 'cancelled' && reason) {
        statusData.reason = reason;
      }
      
      const updatedEvent = await EventService.changeEventStatus(eventId, status, statusData, req.user.id);
      
      res.status(200).json({
        success: true,
        message: `Event status changed to ${status} successfully`,
        event: updatedEvent
      });
    } catch (error) {
      logger.error(`Error changing event status ${req.params.id}:`, error);
      res.status(error.message === 'Event not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to change event status'
      });
    }
  }

  /**
   * Upload event image (featured or gallery)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadEventImage(req, res) {
    const uploadMiddleware = upload.single('image');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        logger.error('Event image upload error:', err);
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
        
        const eventId = req.params.id;
        const imageType = req.query.type || 'featured';
        
        if (!['featured', 'gallery'].includes(imageType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid image type. Must be "featured" or "gallery"'
          });
        }
        
        const updatedEvent = await EventService.uploadEventImage(
          eventId,
          req.file,
          imageType,
          req.user.id
        );
        
        res.status(200).json({
          success: true,
          message: `Event ${imageType} image uploaded successfully`,
          event: {
            id: updatedEvent._id,
            featuredImage: updatedEvent.featuredImage,
            media: updatedEvent.media
          }
        });
      } catch (error) {
        logger.error(`Error processing event image ${req.params.id}:`, error);
        res.status(error.message === 'Event not found' ? 404 : 400).json({
          success: false,
          message: error.message || 'Failed to process image'
        });
      }
    });
  }

  /**
   * Register for an event
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async registerForEvent(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const eventId = req.params.id;
      const userId = req.user ? req.user.id : null;
      
      // Add IP and user agent info if available
      const registrationData = {
        ...req.body,
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      };
      
      const registration = await EventService.registerForEvent(eventId, registrationData, userId);
      
      res.status(201).json({
        success: true,
        message: registration.registrationType === 'waitlist' ? 
          'You have been added to the waitlist' : 
          'Registration successful',
        registration: {
          id: registration._id,
          confirmationCode: registration.confirmationDetails.confirmationCode,
          status: registration.status,
          type: registration.registrationType
        }
      });
    } catch (error) {
      logger.error(`Error registering for event ${req.params.id}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to register for event'
      });
    }
  }

  /**
   * Get event registrations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getEventRegistrations(req, res) {
    try {
      const eventId = req.params.id;
      
      // Extract filter options
      const options = {
        status: req.query.status,
        registrationType: req.query.registrationType,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        sort: req.query.sort
      };
      
      const result = await EventService.getEventRegistrations(eventId, options);
      
      res.status(200).json({
        success: true,
        registrations: result.registrations,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`Error getting registrations for event ${req.params.id}:`, error);
      res.status(error.message === 'Event not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve registrations'
      });
    }
  }

  /**
   * Update registration status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateRegistrationStatus(req, res) {
    try {
      const { status } = req.body;
      const registrationId = req.params.registrationId;
      
      if (!status || !['pending', 'confirmed', 'cancelled', 'attended', 'no-show'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }
      
      const updatedRegistration = await EventService.updateRegistrationStatus(registrationId, status);
      
      res.status(200).json({
        success: true,
        message: `Registration status updated to ${status}`,
        registration: updatedRegistration
      });
    } catch (error) {
      logger.error(`Error updating registration status ${req.params.registrationId}:`, error);
      res.status(error.message === 'Registration not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to update registration status'
      });
    }
  }

  /**
   * Cancel registration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async cancelRegistration(req, res) {
    try {
      const registrationId = req.params.registrationId;
      const userId = req.user.id;
      
      const updatedRegistration = await EventService.cancelRegistration(registrationId, userId);
      
      res.status(200).json({
        success: true,
        message: 'Registration cancelled successfully',
        registration: updatedRegistration
      });
    } catch (error) {
      logger.error(`Error cancelling registration ${req.params.registrationId}:`, error);
      res.status(error.message === 'Registration not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to cancel registration'
      });
    }
  }

  /**
   * Check in attendee
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async checkInAttendee(req, res) {
    try {
      const registrationId = req.params.registrationId;
      
      const updatedRegistration = await EventService.checkInAttendee(registrationId);
      
      res.status(200).json({
        success: true,
        message: 'Attendee checked in successfully',
        registration: updatedRegistration
      });
    } catch (error) {
      logger.error(`Error checking in attendee ${req.params.registrationId}:`, error);
      res.status(error.message === 'Registration not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to check in attendee'
      });
    }
  }

  /**
   * Submit event feedback
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async submitEventFeedback(req, res) {
    try {
      const eventId = req.params.id;
      const userId = req.user.id;
      
      const registration = await EventService.submitEventFeedback(eventId, req.body, userId);
      
      res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully',
        feedback: registration.feedback
      });
    } catch (error) {
      logger.error(`Error submitting feedback for event ${req.params.id}:`, error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit feedback'
      });
    }
  }

  /**
   * Get user registrations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserRegistrations(req, res) {
    try {
      const userId = req.user.id;
      
      // Extract filter options
      const options = {
        status: req.query.status,
        upcoming: req.query.upcoming === 'true',
        past: req.query.past === 'true',
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };
      
      const result = await EventService.getUserRegistrations(userId, options);
      
      res.status(200).json({
        success: true,
        registrations: result.registrations,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`Error getting registrations for user ${req.user.id}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve registrations'
      });
    }
  }

  /**
   * Get registration calendar links
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRegistrationCalendarLinks(req, res) {
    try {
      const registrationId = req.params.registrationId;
      
      const calendarLinks = await EventService.getRegistrationCalendarLinks(registrationId);
      
      res.status(200).json({
        success: true,
        ...calendarLinks
      });
    } catch (error) {
      logger.error(`Error getting calendar links for registration ${req.params.registrationId}:`, error);
      res.status(error.message === 'Registration not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to get calendar links'
      });
    }
  }

  /**
   * Download event iCalendar file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async downloadEventCalendar(req, res) {
    try {
      const eventId = req.params.id;
      
      const event = await EventService.getEventById(eventId);
      
      // Generate iCalendar file
      const icalData = await CalendarService.generateEventICalendar(event, {
        baseUrl: `${req.protocol}://${req.get('host')}`
      });
      
      // Set headers
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="${event.slug}.ics"`);
      
      // Send file
      res.send(icalData);
    } catch (error) {
      logger.error(`Error generating calendar for event ${req.params.id}:`, error);
      res.status(error.message === 'Event not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to generate calendar'
      });
    }
  }

  /**
   * Get monthly calendar events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getMonthlyCalendar(req, res) {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: 'Invalid year or month'
        });
      }
      
      // Extract filter options
      const options = {
        type: req.query.type,
        includePrivate: req.user && req.user.role === 'admin',
        includeAllStatuses: req.user && req.user.role === 'admin'
      };
      
      const eventsByDay = await CalendarService.getMonthEvents(year, month, options);
      
      res.status(200).json({
        success: true,
        year,
        month,
        events: eventsByDay
      });
    } catch (error) {
      logger.error(`Error getting monthly calendar for ${req.params.month}/${req.params.year}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve monthly calendar'
      });
    }
  }

  /**
   * Get featured events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getFeaturedEvents(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 3;
      
      const featuredEvents = await EventService.getFeaturedEvents(limit);
      
      res.status(200).json({
        success: true,
        events: featuredEvents
      });
    } catch (error) {
      logger.error('Error getting featured events:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve featured events'
      });
    }
  }

  /**
   * Get upcoming events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUpcomingEvents(req, res) {
    try {
      // Extract filter options
      const options = {
        type: req.query.type,
        industry: req.query.industry,
        topic: req.query.topic,
        limit: parseInt(req.query.limit) || 10
      };
      
      const upcomingEvents = await EventService.getUpcomingEvents(options);
      
      res.status(200).json({
        success: true,
        events: upcomingEvents
      });
    } catch (error) {
      logger.error('Error getting upcoming events:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve upcoming events'
      });
    }
  }

  /**
   * Get event statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getEventStatistics(req, res) {
    try {
      const eventId = req.params.id;
      
      const stats = await EventService.getEventStatistics(eventId);
      
      res.status(200).json({
        success: true,
        statistics: stats
      });
    } catch (error) {
      logger.error(`Error getting statistics for event ${req.params.id}:`, error);
      res.status(error.message === 'Event not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve event statistics'
      });
    }
  }

  /**
   * Process event waitlist
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processEventWaitlist(req, res) {
    try {
      const eventId = req.params.id;
      
      const processed = await EventService.processWaitlist(eventId);
      
      res.status(200).json({
        success: true,
        message: processed ? 'Waitlist processed successfully' : 'No waitlist entries to process',
        processed
      });
    } catch (error) {
      logger.error(`Error processing waitlist for event ${req.params.id}:`, error);
      res.status(error.message === 'Event not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to process waitlist'
      });
    }
  }

  /**
   * Check for schedule conflicts
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async checkScheduleConflicts(req, res) {
    try {
      const { startDate, endDate, eventId } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const conflicts = await CalendarService.checkScheduleConflicts(
        new Date(startDate),
        new Date(endDate),
        eventId
      );
      
      res.status(200).json({
        success: true,
        hasConflicts: conflicts.length > 0,
        conflicts
      });
    } catch (error) {
      logger.error('Error checking schedule conflicts:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to check schedule conflicts'
      });
    }
  }
}

module.exports = EventController;