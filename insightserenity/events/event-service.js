/**
 * @file Event Service
 * @description Service layer for event-related operations
 */

const Event = require('./event-model');
const EventRegistration = require('./registration-model');
const CalendarService = require('./calendar-service');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fileService = require('../services/file-service');
const emailService = require('../services/email-service');
const { v4: uuidv4 } = require('uuid');

/**
 * Event Service
 * Handles all event-related business logic
 */
class EventService {
  /**
   * Get events with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Object} Events with pagination info
   */
  static async getEvents(filters = {}, options = {}) {
    try {
      // Default options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      const sortField = options.sortField || 'schedule.startDate';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // Create query object
      const query = {};
      
      // Add event type filter
      if (filters.type) {
        query.type = filters.type;
      }
      
      // Add format filter
      if (filters.format) {
        query.format = filters.format;
      }
      
      // Add status filter
      if (filters.status) {
        query.status = filters.status;
      } else {
        // Default to published events only
        query.status = 'published';
      }
      
      // Add visibility filter
      if (filters.visibility) {
        query.visibility = filters.visibility;
      } else {
        // Default to public events only
        query.visibility = 'public';
      }
      
      // Add industry filter
      if (filters.industry) {
        query.industries = filters.industry;
      }
      
      // Add topic filter
      if (filters.topic) {
        query.topics = filters.topic;
      }
      
      // Add time-based filters
      if (filters.upcoming) {
        query['schedule.startDate'] = { $gte: new Date() };
      } else if (filters.past) {
        query['schedule.endDate'] = { $lt: new Date() };
      } else if (filters.startDate && filters.endDate) {
        query.$or = [
          // Events starting in this range
          {
            'schedule.startDate': {
              $gte: new Date(filters.startDate),
              $lte: new Date(filters.endDate)
            }
          },
          // Events ending in this range
          {
            'schedule.endDate': {
              $gte: new Date(filters.startDate),
              $lte: new Date(filters.endDate)
            }
          },
          // Events spanning this range
          {
            'schedule.startDate': { $lt: new Date(filters.startDate) },
            'schedule.endDate': { $gt: new Date(filters.endDate) }
          }
        ];
      }
      
      // Add search filter
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { summary: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { topics: { $regex: filters.search, $options: 'i' } },
          { 'presenters.name': { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Add featured filter
      if (filters.featured === true || filters.featured === 'true') {
        query.featured = true;
      }
      
      // Get total count
      const totalCount = await Event.countDocuments(query);
      
      // Execute query with pagination
      const events = await Event.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('presenters.user', 'profile.firstName profile.lastName profile.avatarUrl')
        .populate('relatedServices', 'name slug description.short')
        .lean();
      
      return {
        events,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching events:', error);
      throw error;
    }
  }

  /**
   * Get event by ID or slug
   * @param {string} identifier - Event ID or slug
   * @param {Object} options - Optional flags for including related data and tracking
   * @returns {Object} Event data
   */
  static async getEventById(identifier, options = {}) {
    try {
      let query;
      
      // Check if identifier is a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        query = { _id: identifier };
      } else {
        // Otherwise, treat as slug
        query = { slug: identifier };
      }
      
      // Add visibility filter (if not admin)
      if (!options.isAdmin) {
        if (options.isAuthenticated) {
          query.visibility = { $in: ['public', 'unlisted'] };
        } else {
          query.visibility = 'public';
        }
      }
      
      // Create base query
      let eventQuery = Event.findOne(query);
      
      // Include related data if requested
      if (options.includePresenters) {
        eventQuery = eventQuery.populate('presenters.user', 'profile.firstName profile.lastName profile.avatarUrl profile.bio');
      }
      
      if (options.includeRelatedServices) {
        eventQuery = eventQuery.populate('relatedServices', 'name slug description.short');
      }
      
      const event = await eventQuery.exec();
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Increment view count if tracking views
      if (options.trackView) {
        await event.incrementViews();
      }
      
      // Get registration count
      if (options.includeRegistrationCount) {
        const registrationCount = await EventRegistration.countByEvent(event._id);
        event.registration.registeredAttendees = registrationCount;
      }
      
      // Add registration status for user
      if (options.userId) {
        const isRegistered = await EventRegistration.isUserRegistered(event._id, options.userId);
        event.isUserRegistered = isRegistered;
      }
      
      return event;
    } catch (error) {
      logger.error(`Error fetching event by identifier ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Create new event
   * @param {Object} eventData - Event data
   * @param {string} userId - Creating user ID
   * @returns {Object} Created event
   */
  static async createEvent(eventData, userId) {
    try {
      // Check if slug already exists
      if (eventData.slug) {
        const existingEvent = await Event.findOne({ slug: eventData.slug });
        if (existingEvent) {
          throw new Error('An event with this slug already exists');
        }
      }
      
      // Check for schedule conflicts if needed
      if (eventData.checkConflicts) {
        const conflicts = await CalendarService.checkScheduleConflicts(
          new Date(eventData.schedule.startDate), 
          new Date(eventData.schedule.endDate)
        );
        
        if (conflicts && conflicts.length > 0) {
          throw new Error(`Schedule conflicts with ${conflicts.length} existing events`);
        }
      }
      
      // Create new event
      const event = new Event({
        ...eventData,
        createdBy: userId,
        updatedBy: userId
      });
      
      await event.save();
      
      return event;
    } catch (error) {
      logger.error('Error creating event:', error);
      throw error;
    }
  }

  /**
   * Update event
   * @param {string} eventId - Event ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated event
   */
  static async updateEvent(eventId, updateData, userId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if slug is being changed and already exists
      if (updateData.slug && updateData.slug !== event.slug) {
        const existingEvent = await Event.findOne({ slug: updateData.slug });
        if (existingEvent && !existingEvent._id.equals(eventId)) {
          throw new Error('An event with this slug already exists');
        }
      }
      
      // Check for schedule conflicts if date/time is changing and conflicts check is requested
      if (updateData.checkConflicts && 
          (updateData.schedule?.startDate || updateData.schedule?.endDate)) {
        
        const startDate = updateData.schedule?.startDate ? 
          new Date(updateData.schedule.startDate) : event.schedule.startDate;
        
        const endDate = updateData.schedule?.endDate ? 
          new Date(updateData.schedule.endDate) : event.schedule.endDate;
        
        const conflicts = await CalendarService.checkScheduleConflicts(startDate, endDate, eventId);
        
        if (conflicts && conflicts.length > 0) {
          throw new Error(`Schedule conflicts with ${conflicts.length} existing events`);
        }
      }
      
      // Handle nested updates properly
      if (updateData.schedule) {
        for (const key in updateData.schedule) {
          event.schedule[key] = updateData.schedule[key];
        }
        delete updateData.schedule;
      }
      
      if (updateData.location) {
        for (const key in updateData.location) {
          event.location[key] = updateData.location[key];
        }
        delete updateData.location;
      }
      
      if (updateData.registration) {
        for (const key in updateData.registration) {
          event.registration[key] = updateData.registration[key];
        }
        delete updateData.registration;
      }
      
      if (updateData.content) {
        for (const key in updateData.content) {
          event.content[key] = updateData.content[key];
        }
        delete updateData.content;
      }
      
      if (updateData.engagement) {
        for (const key in updateData.engagement) {
          event.engagement[key] = updateData.engagement[key];
        }
        delete updateData.engagement;
      }
      
      if (updateData.notifications) {
        for (const key in updateData.notifications) {
          event.notifications[key] = updateData.notifications[key];
        }
        delete updateData.notifications;
      }
      
      // Update top-level fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt' && key !== 'checkConflicts') {
          event[key] = updateData[key];
        }
      });
      
      // Update metadata
      event.updatedBy = userId;
      
      await event.save();
      
      // If event date/time was updated, notify registered attendees
      if (updateData.schedule?.startDate || updateData.schedule?.endDate) {
        this.notifyAttendeesOfScheduleChange(event);
      }
      
      return event;
    } catch (error) {
      logger.error(`Error updating event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Delete event
   * @param {string} eventId - Event ID
   * @returns {boolean} Success status
   */
  static async deleteEvent(eventId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if there are registrations for this event
      const registrationCount = await EventRegistration.countByEvent(eventId);
      
      if (registrationCount > 0) {
        throw new Error(`Cannot delete event with ${registrationCount} registrations. Cancel the event instead.`);
      }
      
      await event.remove();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Change event status
   * @param {string} eventId - Event ID
   * @param {string} status - New status ('draft', 'published', 'cancelled', 'completed', 'archived')
   * @param {Object} statusData - Additional data for status change (e.g., cancellation reason)
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated event
   */
  static async changeEventStatus(eventId, status, statusData = {}, userId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Validate status
      if (!['draft', 'published', 'cancelled', 'completed', 'archived'].includes(status)) {
        throw new Error('Invalid status value');
      }
      
      // Handle special case for cancellation
      if (status === 'cancelled') {
        if (!event.canBeCancelled()) {
          throw new Error('This event cannot be cancelled');
        }
        
        const reason = statusData.reason || 'No reason provided';
        await event.cancel(reason);
        
        // Notify registered attendees
        this.notifyAttendeesOfCancellation(event, reason);
        
        return event;
      }
      
      // Handle special case for completion
      if (status === 'completed' && event.status !== 'published') {
        throw new Error('Only published events can be marked as completed');
      }
      
      // Update status
      event.status = status;
      event.updatedBy = userId;
      
      await event.save();
      
      return event;
    } catch (error) {
      logger.error(`Error changing event status ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Upload event image (featured or gallery)
   * @param {string} eventId - Event ID
   * @param {Object} file - Image file
   * @param {string} type - Image type ('featured' or 'gallery')
   * @param {string} userId - Updating user ID
   * @returns {Object} Updated event
   */
  static async uploadEventImage(eventId, file, type, userId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
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
      const uploadResult = await fileService.uploadFile(file, 'events');
      
      // Update event based on image type
      if (type === 'featured') {
        event.featuredImage = {
          url: uploadResult.url,
          alt: event.title
        };
      } else if (type === 'gallery') {
        if (!event.media) {
          event.media = {};
        }
        
        if (!event.media.gallery) {
          event.media.gallery = [];
        }
        
        event.media.gallery.push(uploadResult.url);
      } else {
        throw new Error('Invalid image type specified');
      }
      
      // Update metadata
      event.updatedBy = userId;
      
      await event.save();
      
      return event;
    } catch (error) {
      logger.error(`Error uploading event image ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Register for an event
   * @param {string} eventId - Event ID
   * @param {Object} registrationData - Registration data
   * @param {string} userId - User ID (optional for guest registrations)
   * @returns {Object} Registration details
   */
  static async registerForEvent(eventId, registrationData, userId = null) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if event is published
      if (event.status !== 'published') {
        throw new Error('Registration is not available for this event');
      }
      
      // Check if registration is required
      if (!event.registration.isRequired) {
        throw new Error('Registration is not required for this event');
      }
      
      // Check if registration is open
      if (!event.isRegistrationOpen) {
        throw new Error('Registration is closed for this event');
      }
      
      // Check if event is at capacity
      if (event.isAtCapacity) {
        // If waitlist is enabled, register for waitlist
        if (event.registration.waitlist.enabled) {
          // Check if waitlist is full
          if (event.registration.waitlist.maxSize && 
              event.registration.waitlist.currentSize >= event.registration.waitlist.maxSize) {
            throw new Error('The waitlist for this event is full');
          }
          
          registrationData.registrationType = 'waitlist';
        } else {
          throw new Error('This event is at capacity');
        }
      }
      
      // Check if user is already registered (for logged-in users)
      if (userId) {
        const existingRegistration = await EventRegistration.isUserRegistered(eventId, userId);
        if (existingRegistration) {
          throw new Error('You are already registered for this event');
        }
      } else {
        // Check if email is already registered (for guest registrations)
        const existingRegistration = await EventRegistration.isEmailRegistered(eventId, registrationData.contactInfo.email);
        if (existingRegistration) {
          throw new Error('This email address is already registered for this event');
        }
      }
      
      // Create registration
      const registration = new EventRegistration({
        event: eventId,
        user: userId,
        contactInfo: registrationData.contactInfo,
        demographics: registrationData.demographics || {},
        marketing: registrationData.marketing || {},
        preferences: registrationData.preferences || {},
        customFields: registrationData.customFields ? new Map(Object.entries(registrationData.customFields)) : new Map(),
        registrationType: registrationData.registrationType || 'standard',
        status: userId ? 'confirmed' : 'pending', // Auto-confirm for logged-in users
        ipAddress: registrationData.ipAddress,
        deviceInfo: registrationData.deviceInfo,
        referralCode: registrationData.referralCode,
        createdBy: userId
      });
      
      // Handle payment details if applicable
      if (!event.registration.pricing.isFree) {
        registration.payment = {
          isPaid: false,
          amount: this._calculateRegistrationFee(event, registrationData.registrationType),
          currency: event.registration.pricing.currency
        };
      }
      
      await registration.save();
      
      // Update event registration count unless it's a waitlist registration
      if (registrationData.registrationType !== 'waitlist') {
        await event.addRegistration();
      } else {
        // Update waitlist size
        event.registration.waitlist.currentSize = event.registration.waitlist.currentSize || 0;
        event.registration.waitlist.currentSize += 1;
        await event.save();
      }
      
      // Send confirmation email
      this.sendRegistrationConfirmation(registration, event);
      
      return registration;
    } catch (error) {
      logger.error(`Error registering for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get registrations for an event
   * @param {string} eventId - Event ID
   * @param {Object} options - Filter and pagination options
   * @returns {Object} Registrations with pagination info
   */
  static async getEventRegistrations(eventId, options = {}) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 50;
      
      const registrations = await EventRegistration.findByEvent(eventId, {
        status: options.status,
        registrationType: options.registrationType,
        sort: options.sort,
        page,
        limit
      });
      
      const totalCount = await EventRegistration.countByEvent(eventId, {
        status: options.status,
        registrationType: options.registrationType
      });
      
      return {
        registrations,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error(`Error getting registrations for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Update registration status
   * @param {string} registrationId - Registration ID
   * @param {string} status - New status
   * @returns {Object} Updated registration
   */
  static async updateRegistrationStatus(registrationId, status) {
    try {
      const registration = await EventRegistration.findById(registrationId);
      
      if (!registration) {
        throw new Error('Registration not found');
      }
      
      if (!['pending', 'confirmed', 'cancelled', 'attended', 'no-show'].includes(status)) {
        throw new Error('Invalid status value');
      }
      
      // Handle special statuses
      if (status === 'confirmed') {
        await registration.confirm();
      } else if (status === 'cancelled') {
        await registration.cancel();
      } else if (status === 'attended') {
        await registration.checkIn();
      } else {
        registration.status = status;
        await registration.save();
      }
      
      return registration;
    } catch (error) {
      logger.error(`Error updating registration status ${registrationId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel registration
   * @param {string} registrationId - Registration ID
   * @param {string} userId - User ID performing the cancellation
   * @returns {Object} Updated registration
   */
  static async cancelRegistration(registrationId, userId) {
    try {
      const registration = await EventRegistration.findById(registrationId);
      
      if (!registration) {
        throw new Error('Registration not found');
      }
      
      // Check if user has permission to cancel this registration
      if (!registration.user || !registration.user.equals(userId)) {
        // Check if admin in a real application
        throw new Error('You do not have permission to cancel this registration');
      }
      
      // Get event details
      const event = await Event.findById(registration.event);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if cancellation is allowed
      if (event.isPast) {
        throw new Error('Cannot cancel registration for a past event');
      }
      
      await registration.cancel();
      
      // If this was a confirmed registration, update event registration count
      if (['confirmed', 'pending'].includes(registration.status)) {
        if (event.registration.registeredAttendees > 0) {
          event.registration.registeredAttendees -= 1;
          await event.save();
        }
      }
      
      // Process waitlist if applicable
      if (event.registration.waitlist && event.registration.waitlist.enabled && 
          event.registration.waitlist.currentSize > 0) {
        await this.processWaitlist(event._id);
      }
      
      return registration;
    } catch (error) {
      logger.error(`Error cancelling registration ${registrationId}:`, error);
      throw error;
    }
  }

  /**
   * Process waitlist for an event
   * @param {string} eventId - Event ID
   * @returns {boolean} Success status
   */
  static async processWaitlist(eventId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if waitlist is enabled and has people on it
      if (!event.registration.waitlist.enabled || 
          !event.registration.waitlist.currentSize || 
          event.registration.waitlist.currentSize <= 0) {
        return false;
      }
      
      // Check if there are available spots
      if (!event.availableSpots || event.availableSpots <= 0) {
        return false;
      }
      
      // Find the next waitlist registrations up to the number of available spots
      const waitlistRegistrations = await EventRegistration.find({
        event: eventId,
        registrationType: 'waitlist',
        status: { $nin: ['cancelled'] }
      })
        .sort({ createdAt: 1 })
        .limit(event.availableSpots);
      
      if (!waitlistRegistrations || waitlistRegistrations.length === 0) {
        return false;
      }
      
      // Process each waitlist registration
      for (const registration of waitlistRegistrations) {
        // Update registration
        registration.registrationType = 'standard';
        registration.status = 'confirmed';
        await registration.save();
        
        // Update event registration count
        event.registration.registeredAttendees += 1;
        
        // Update waitlist size
        if (event.registration.waitlist.currentSize > 0) {
          event.registration.waitlist.currentSize -= 1;
        }
        
        // Send notification
        this.sendWaitlistConfirmation(registration, event);
      }
      
      await event.save();
      
      return true;
    } catch (error) {
      logger.error(`Error processing waitlist for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Check in attendee
   * @param {string} registrationId - Registration ID or confirmation code
   * @returns {Object} Updated registration
   */
  static async checkInAttendee(registrationId) {
    try {
      let registration;
      
      // Check if this is a confirmation code or ID
      if (mongoose.Types.ObjectId.isValid(registrationId)) {
        registration = await EventRegistration.findById(registrationId);
      } else {
        registration = await EventRegistration.findByConfirmationCode(registrationId);
      }
      
      if (!registration) {
        throw new Error('Registration not found');
      }
      
      // Check if event is ongoing or past
      const event = await Event.findById(registration.event);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      if (!event.isOngoing && !event.isPast) {
        throw new Error('Check-in is only available when an event is ongoing');
      }
      
      // Check if already checked in
      if (registration.status === 'attended' && registration.attendance.checkInTime) {
        return registration;
      }
      
      await registration.checkIn();
      
      // Update event attendee count
      await event.addAttendee();
      
      return registration;
    } catch (error) {
      logger.error(`Error checking in attendee ${registrationId}:`, error);
      throw error;
    }
  }

  /**
   * Submit feedback for an event
   * @param {string} eventId - Event ID
   * @param {Object} feedbackData - Feedback data
   * @param {string} userId - User ID submitting feedback
   * @returns {Object} Updated registration with feedback
   */
  static async submitEventFeedback(eventId, feedbackData, userId) {
    try {
      // Find user's registration for this event
      const registration = await EventRegistration.findOne({
        event: eventId,
        user: userId,
        status: { $in: ['confirmed', 'attended'] }
      });
      
      if (!registration) {
        throw new Error('No active registration found for this event');
      }
      
      // Check if feedback already submitted
      if (registration.feedback.submitted) {
        throw new Error('Feedback has already been submitted for this registration');
      }
      
      // Submit feedback
      await registration.submitFeedback(feedbackData);
      
      // Update event rating
      const event = await Event.findById(eventId);
      
      if (event) {
        // Calculate new average rating
        const feedbacks = await EventRegistration.find({
          event: eventId,
          'feedback.submitted': true,
          'feedback.overallRating': { $gt: 0 }
        });
        
        if (feedbacks && feedbacks.length > 0) {
          const totalRating = feedbacks.reduce((sum, reg) => sum + reg.feedback.overallRating, 0);
          const averageRating = totalRating / feedbacks.length;
          
          event.analytics.averageRating = parseFloat(averageRating.toFixed(1));
          event.analytics.reviewsCount = feedbacks.length;
          
          await event.save();
        }
      }
      
      return registration;
    } catch (error) {
      logger.error(`Error submitting feedback for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get registrations for a user
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Object} User registrations with pagination info
   */
  static async getUserRegistrations(userId, options = {}) {
    try {
      // Handle upcoming/past filter by getting event IDs first
      let upcomingEventIds, pastEventIds;
      
      if (options.upcoming || options.past) {
        const allEvents = await Event.find({
          status: { $in: ['published', 'completed'] }
        }).select('_id schedule.startDate schedule.endDate');
        
        const now = new Date();
        
        upcomingEventIds = allEvents
          .filter(e => new Date(e.schedule.startDate) > now)
          .map(e => e._id);
        
        pastEventIds = allEvents
          .filter(e => new Date(e.schedule.endDate) < now)
          .map(e => e._id);
      }
      
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      
      const registrations = await EventRegistration.findByUser(userId, {
        status: options.status,
        upcoming: options.upcoming,
        past: options.past,
        upcomingEventIds,
        pastEventIds,
        sort: options.upcoming ? { 'event.schedule.startDate': 1 } : { 'event.schedule.startDate': -1 },
        page,
        limit
      });
      
      // Count total registrations matching filters
      const query = { user: userId };
      
      if (options.status) {
        query.status = options.status;
      }
      
      if (options.upcoming) {
        query.event = { $in: upcomingEventIds };
      } else if (options.past) {
        query.event = { $in: pastEventIds };
      }
      
      const totalCount = await EventRegistration.countDocuments(query);
      
      return {
        registrations,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error(`Error getting registrations for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get registration calendar links
   * @param {string} registrationId - Registration ID
   * @returns {Object} Calendar links and iCal file data
   */
  static async getRegistrationCalendarLinks(registrationId) {
    try {
      const registration = await EventRegistration.findById(registrationId)
        .populate('event');
      
      if (!registration) {
        throw new Error('Registration not found');
      }
      
      const event = registration.event;
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Generate calendar links
      const googleLink = CalendarService.generateGoogleCalendarLink(event);
      const outlookLink = CalendarService.generateOutlookLink(event);
      
      // Generate iCal file
      const icalData = await CalendarService.generateEventICalendar(event, {
        organizerEmail: 'events@insightserenity.com',
        baseUrl: 'https://insightserenity.com'
      });
      
      return {
        googleCalendarLink: googleLink,
        outlookLink: outlookLink,
        icalData: icalData.toString('base64'),
        event: {
          title: event.title,
          startDate: event.schedule.startDate,
          endDate: event.schedule.endDate
        }
      };
    } catch (error) {
      logger.error(`Error getting calendar links for registration ${registrationId}:`, error);
      throw error;
    }
  }

  /**
   * Get featured events
   * @param {number} limit - Maximum number of events to return
   * @returns {Array} Featured events
   */
  static async getFeaturedEvents(limit = 3) {
    try {
      const featuredEvents = await Event.findFeatured(limit);
      return featuredEvents;
    } catch (error) {
      logger.error('Error getting featured events:', error);
      throw error;
    }
  }

  /**
   * Get upcoming events
   * @param {Object} options - Filter options
   * @returns {Array} Upcoming events
   */
  static async getUpcomingEvents(options = {}) {
    try {
      const upcomingEvents = await Event.findUpcoming(options);
      return upcomingEvents;
    } catch (error) {
      logger.error('Error getting upcoming events:', error);
      throw error;
    }
  }

  /**
   * Get event statistics
   * @param {string} eventId - Event ID
   * @returns {Object} Event statistics
   */
  static async getEventStatistics(eventId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Get registration stats
      const registrations = await EventRegistration.find({ event: eventId });
      
      const stats = {
        totalRegistrations: registrations.length,
        confirmed: registrations.filter(r => r.status === 'confirmed').length,
        attended: registrations.filter(r => r.status === 'attended').length,
        cancelled: registrations.filter(r => r.status === 'cancelled').length,
        waitlist: registrations.filter(r => r.registrationType === 'waitlist').length,
        noShow: registrations.filter(r => r.status === 'no-show').length
      };
      
      // Calculate attendance rate
      if (stats.confirmed > 0) {
        stats.attendanceRate = Math.round((stats.attended / stats.confirmed) * 100);
      } else {
        stats.attendanceRate = 0;
      }
      
      // Get ratings
      stats.averageRating = event.analytics.averageRating || 0;
      stats.reviewsCount = event.analytics.reviewsCount || 0;
      
      // Get top sources if available
      const sources = registrations
        .filter(r => r.marketing && r.marketing.referralSource)
        .map(r => r.marketing.referralSource);
      
      if (sources.length > 0) {
        const sourceCounts = {};
        sources.forEach(source => {
          sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });
        
        stats.topSources = Object.entries(sourceCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([source, count]) => ({ source, count }));
      }
      
      return stats;
    } catch (error) {
      logger.error(`Error getting statistics for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Private: Send registration confirmation email
   * @param {Object} registration - Registration object
   * @param {Object} event - Event object
   * @private
   */
  static async sendRegistrationConfirmation(registration, event) {
    try {
      const isWaitlist = registration.registrationType === 'waitlist';
      const template = isWaitlist ? 'event-waitlist' : 'event-registration';
      const subject = isWaitlist ? 
        `You're on the waitlist: ${event.title}` : 
        `Registration Confirmed: ${event.title}`;
      
      // Prepare data for email
      const emailData = {
        recipientName: registration.contactInfo.firstName,
        recipientEmail: registration.contactInfo.email,
        eventTitle: event.title,
        eventDate: CalendarService.formatEventDate(event, 'full'),
        eventLocation: this._formatEventLocation(event),
        confirmationCode: registration.confirmationDetails.confirmationCode,
        isWaitlist,
        registrationId: registration._id.toString()
      };
      
      // Generate calendar links if not waitlist
      if (!isWaitlist) {
        emailData.googleCalendarLink = CalendarService.generateGoogleCalendarLink(event);
        emailData.outlookLink = CalendarService.generateOutlookLink(event);
        
        // Add iCal attachment
        const icalData = await CalendarService.generateEventICalendar(event, {
          organizerEmail: 'events@insightserenity.com',
          baseUrl: 'https://insightserenity.com'
        });
        
        emailData.attachments = [
          {
            filename: 'event.ics',
            content: icalData
          }
        ];
      }
      
      // Send email
      await emailService.sendTemplatedEmail(
        registration.contactInfo.email,
        subject,
        template,
        emailData
      );
      
      // Mark confirmation as sent
      registration.confirmationDetails.confirmationSent = true;
      registration.confirmationDetails.confirmationDate = new Date();
      
      await registration.save();
    } catch (error) {
      logger.error(`Error sending registration confirmation email: ${error.message}`, error);
      // Don't throw, just log the error to prevent transaction failure
    }
  }

  /**
   * Private: Send waitlist confirmation email
   * @param {Object} registration - Registration object
   * @param {Object} event - Event object
   * @private
   */
  static async sendWaitlistConfirmation(registration, event) {
    try {
      const subject = `Good news! You're registered for: ${event.title}`;
      
      // Prepare data for email
      const emailData = {
        recipientName: registration.contactInfo.firstName,
        recipientEmail: registration.contactInfo.email,
        eventTitle: event.title,
        eventDate: CalendarService.formatEventDate(event, 'full'),
        eventLocation: this._formatEventLocation(event),
        confirmationCode: registration.confirmationDetails.confirmationCode,
        registrationId: registration._id.toString()
      };
      
      // Generate calendar links
      emailData.googleCalendarLink = CalendarService.generateGoogleCalendarLink(event);
      emailData.outlookLink = CalendarService.generateOutlookLink(event);
      
      // Add iCal attachment
      const icalData = await CalendarService.generateEventICalendar(event, {
        organizerEmail: 'events@insightserenity.com',
        baseUrl: 'https://insightserenity.com'
      });
      
      emailData.attachments = [
        {
          filename: 'event.ics',
          content: icalData
        }
      ];
      
      // Send email
      await emailService.sendTemplatedEmail(
        registration.contactInfo.email,
        subject,
        'event-waitlist-confirmed',
        emailData
      );
    } catch (error) {
      logger.error(`Error sending waitlist confirmation email: ${error.message}`, error);
      // Don't throw, just log the error to prevent transaction failure
    }
  }

  /**
   * Private: Notify attendees of event cancellation
   * @param {Object} event - Event object
   * @param {string} reason - Cancellation reason
   * @private
   */
  static async notifyAttendeesOfCancellation(event, reason) {
    try {
      // Get all confirmed registrations for this event
      const registrations = await EventRegistration.find({
        event: event._id,
        status: { $in: ['confirmed', 'pending'] }
      });
      
      if (!registrations || registrations.length === 0) {
        return;
      }
      
      // Update all registrations to cancelled
      await EventRegistration.updateMany(
        { event: event._id, status: { $in: ['confirmed', 'pending'] } },
        { status: 'cancelled' }
      );
      
      const subject = `Event Cancelled: ${event.title}`;
      
      // Send cancellation email to each registrant
      for (const registration of registrations) {
        const emailData = {
          recipientName: registration.contactInfo.firstName,
          recipientEmail: registration.contactInfo.email,
          eventTitle: event.title,
          eventDate: CalendarService.formatEventDate(event, 'full'),
          cancellationReason: reason
        };
        
        // Send email
        await emailService.sendTemplatedEmail(
          registration.contactInfo.email,
          subject,
          'event-cancellation',
          emailData
        );
      }
    } catch (error) {
      logger.error(`Error notifying attendees of cancellation: ${error.message}`, error);
      // Don't throw, just log the error to prevent transaction failure
    }
  }

  /**
   * Private: Notify attendees of schedule change
   * @param {Object} event - Updated event object
   * @private
   */
  static async notifyAttendeesOfScheduleChange(event) {
    try {
      // Get all confirmed registrations for this event
      const registrations = await EventRegistration.find({
        event: event._id,
        status: { $in: ['confirmed', 'pending'] }
      });
      
      if (!registrations || registrations.length === 0) {
        return;
      }
      
      const subject = `Event Update: ${event.title} - Schedule Changed`;
      
      // Send update email to each registrant
      for (const registration of registrations) {
        const emailData = {
          recipientName: registration.contactInfo.firstName,
          recipientEmail: registration.contactInfo.email,
          eventTitle: event.title,
          eventDate: CalendarService.formatEventDate(event, 'full'),
          eventLocation: this._formatEventLocation(event),
          registrationId: registration._id.toString()
        };
        
        // Generate updated calendar links
        emailData.googleCalendarLink = CalendarService.generateGoogleCalendarLink(event);
        emailData.outlookLink = CalendarService.generateOutlookLink(event);
        
        // Add updated iCal attachment
        const icalData = await CalendarService.generateEventICalendar(event, {
          organizerEmail: 'events@insightserenity.com',
          baseUrl: 'https://insightserenity.com'
        });
        
        emailData.attachments = [
          {
            filename: 'event_updated.ics',
            content: icalData
          }
        ];
        
        // Send email
        await emailService.sendTemplatedEmail(
          registration.contactInfo.email,
          subject,
          'event-schedule-change',
          emailData
        );
      }
    } catch (error) {
      logger.error(`Error notifying attendees of schedule change: ${error.message}`, error);
      // Don't throw, just log the error to prevent transaction failure
    }
  }

  /**
   * Private: Format event location for display
   * @param {Object} event - Event object
   * @returns {string} Formatted location
   * @private
   */
  static _formatEventLocation(event) {
    if (!event.location) {
      return 'Location not specified';
    }
    
    if (event.format === 'online') {
      if (event.location.online && event.location.online.platform) {
        return `Online via ${event.location.online.platform}`;
      }
      return 'Online event';
    }
    
    if (event.format === 'in-person' || event.format === 'hybrid') {
      if (event.location.physical && event.location.physical.venue) {
        const venue = event.location.physical.venue;
        const address = event.location.physical.address;
        
        if (address) {
          let addressString = venue;
          
          if (address.street) {
            addressString += `, ${address.street}`;
          }
          
          if (address.city) {
            addressString += `, ${address.city}`;
          }
          
          if (address.state) {
            addressString += `, ${address.state}`;
          }
          
          return addressString;
        }
        
        return venue;
      }
    }
    
    if (event.format === 'hybrid') {
      return 'Hybrid event (both online and in-person)';
    }
    
    return 'Location details will be provided soon';
  }

  /**
   * Private: Calculate registration fee
   * @param {Object} event - Event object
   * @param {string} registrationType - Registration type
   * @returns {number} Registration fee
   * @private
   */
  static _calculateRegistrationFee(event, registrationType) {
    if (event.registration.pricing.isFree) {
      return 0;
    }
    
    // If early bird price is available and current date is before deadline
    if (registrationType !== 'waitlist' && 
        event.registration.pricing.earlyBirdAvailable && 
        event.registration.pricing.earlyBirdDeadline && 
        new Date() < new Date(event.registration.pricing.earlyBirdDeadline)) {
      return event.registration.pricing.earlyBirdPrice;
    }
    
    // Standard price
    return event.registration.pricing.price;
  }
}

module.exports = EventService;