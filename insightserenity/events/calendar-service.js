/**
 * @file Calendar Service
 * @description Service for calendar-related operations and formatting
 */

const Event = require('./event-model');
const EventRegistration = require('./registration-model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const ical = require('ical-generator');
const moment = require('moment-timezone');

/**
 * Calendar Service
 * Handles calendar-related operations for events
 */
class CalendarService {
  /**
   * Get events for a specific month
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Events in the specified month
   */
  static async getMonthEvents(year, month, options = {}) {
    try {
      // Create start and end date for the month
      const startDate = new Date(year, month - 1, 1, 0, 0, 0);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      // Base query
      const query = {
        $or: [
          // Events starting in this month
          {
            'schedule.startDate': {
              $gte: startDate,
              $lte: endDate
            }
          },
          // Events ending in this month
          {
            'schedule.endDate': {
              $gte: startDate,
              $lte: endDate
            }
          },
          // Events spanning this month
          {
            'schedule.startDate': { $lt: startDate },
            'schedule.endDate': { $gt: endDate }
          }
        ]
      };
      
      // Apply visibility filter
      if (!options.includePrivate) {
        query.visibility = 'public';
      }
      
      // Apply status filter
      if (!options.includeAllStatuses) {
        query.status = { $in: ['published', 'completed'] };
      } else if (options.status) {
        query.status = options.status;
      }
      
      // Apply type filter
      if (options.type) {
        query.type = options.type;
      }
      
      // Get events
      const events = await Event.find(query)
        .sort({ 'schedule.startDate': 1 })
        .select('title slug type format schedule location status featuredImage')
        .lean();
      
      // Group events by day
      const eventsByDay = {};
      
      for (const event of events) {
        const startDate = new Date(event.schedule.startDate);
        const endDate = new Date(event.schedule.endDate);
        
        // Handle multi-day events
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          // Only include dates within the requested month
          if (date.getMonth() === month - 1 && date.getFullYear() === year) {
            const day = date.getDate();
            
            if (!eventsByDay[day]) {
              eventsByDay[day] = [];
            }
            
            // Add event to this day if not already added
            const eventAlreadyAdded = eventsByDay[day].some(e => e._id.toString() === event._id.toString());
            
            if (!eventAlreadyAdded) {
              eventsByDay[day].push({
                ...event,
                isFirstDay: date.getDate() === startDate.getDate() && date.getMonth() === startDate.getMonth(),
                isLastDay: date.getDate() === endDate.getDate() && date.getMonth() === endDate.getMonth(),
                isMultiDay: startDate.toDateString() !== endDate.toDateString()
              });
            }
          }
        }
      }
      
      return eventsByDay;
    } catch (error) {
      logger.error(`Error getting events for month ${month}/${year}:`, error);
      throw error;
    }
  }

  /**
   * Get events for a specific date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Events in the specified date range
   */
  static async getDateRangeEvents(startDate, endDate, options = {}) {
    try {
      // Base query
      const query = {
        $or: [
          // Events starting in this range
          {
            'schedule.startDate': {
              $gte: startDate,
              $lte: endDate
            }
          },
          // Events ending in this range
          {
            'schedule.endDate': {
              $gte: startDate,
              $lte: endDate
            }
          },
          // Events spanning this range
          {
            'schedule.startDate': { $lt: startDate },
            'schedule.endDate': { $gt: endDate }
          }
        ]
      };
      
      // Apply visibility filter
      if (!options.includePrivate) {
        query.visibility = 'public';
      }
      
      // Apply status filter
      if (!options.includeAllStatuses) {
        query.status = { $in: ['published', 'completed'] };
      } else if (options.status) {
        query.status = options.status;
      }
      
      // Apply type filter
      if (options.type) {
        query.type = options.type;
      }
      
      // Apply format filter
      if (options.format) {
        query.format = options.format;
      }
      
      // Apply industry filter
      if (options.industry) {
        query.industries = options.industry;
      }
      
      // Apply topic filter
      if (options.topic) {
        query.topics = options.topic;
      }
      
      // Get events
      const events = await Event.find(query)
        .sort({ 'schedule.startDate': 1 })
        .populate('presenters.user', 'profile.firstName profile.lastName profile.avatarUrl')
        .lean();
      
      return events;
    } catch (error) {
      logger.error('Error getting events for date range:', error);
      throw error;
    }
  }

  /**
   * Generate iCalendar file for an event
   * @param {Object} event - Event object
   * @param {Object} options - Options for the calendar
   * @returns {Promise<Buffer>} iCalendar file content
   */
  static async generateEventICalendar(event, options = {}) {
    try {
      // Create calendar
      const calendar = ical({
        name: options.calendarName || 'InsightSerenity Events',
        prodId: options.prodId || '//InsightSerenity//Events//EN'
      });
      
      // Create event
      const calEvent = calendar.createEvent({
        start: moment(event.schedule.startDate).toDate(),
        end: moment(event.schedule.endDate).toDate(),
        summary: event.title,
        description: this._sanitizeDescription(event.description),
        location: this._formatLocation(event.location),
        url: `${options.baseUrl || 'https://insightserenity.com'}/events/${event.slug}`,
        timezone: event.schedule.timezone
      });
      
      // Add organizer
      if (event.presenters && event.presenters.length > 0) {
        const presenter = event.presenters[0];
        calEvent.organizer({
          name: presenter.name,
          email: options.organizerEmail || 'events@insightserenity.com'
        });
      } else {
        calEvent.organizer({
          name: 'InsightSerenity Events',
          email: options.organizerEmail || 'events@insightserenity.com'
        });
      }
      
      // Generate iCalendar content
      return Buffer.from(calendar.toString());
    } catch (error) {
      logger.error(`Error generating iCalendar for event ${event._id}:`, error);
      throw error;
    }
  }

  /**
   * Generate iCalendar file for multiple events
   * @param {Array} events - Array of event objects
   * @param {Object} options - Options for the calendar
   * @returns {Promise<Buffer>} iCalendar file content
   */
  static async generateEventsICalendar(events, options = {}) {
    try {
      // Create calendar
      const calendar = ical({
        name: options.calendarName || 'InsightSerenity Events',
        prodId: options.prodId || '//InsightSerenity//Events//EN'
      });
      
      // Add each event to the calendar
      for (const event of events) {
        const calEvent = calendar.createEvent({
          start: moment(event.schedule.startDate).toDate(),
          end: moment(event.schedule.endDate).toDate(),
          summary: event.title,
          description: this._sanitizeDescription(event.description),
          location: this._formatLocation(event.location),
          url: `${options.baseUrl || 'https://insightserenity.com'}/events/${event.slug}`,
          timezone: event.schedule.timezone
        });
        
        // Add organizer
        if (event.presenters && event.presenters.length > 0) {
          const presenter = event.presenters[0];
          calEvent.organizer({
            name: presenter.name,
            email: options.organizerEmail || 'events@insightserenity.com'
          });
        }
      }
      
      // Generate iCalendar content
      return Buffer.from(calendar.toString());
    } catch (error) {
      logger.error('Error generating iCalendar for multiple events:', error);
      throw error;
    }
  }

  /**
   * Get user calendar (events user is registered for)
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Events the user is registered for
   */
  static async getUserCalendar(userId, options = {}) {
    try {
      // Find registrations for the user with confirmed or attended status
      const registrations = await EventRegistration.find({
        user: userId,
        status: { $in: ['confirmed', 'attended'] }
      }).select('event');
      
      if (!registrations || registrations.length === 0) {
        return [];
      }
      
      // Extract event IDs
      const eventIds = registrations.map(reg => reg.event);
      
      // Base query
      const query = {
        _id: { $in: eventIds }
      };
      
      // Apply date filters
      if (options.upcoming) {
        query['schedule.startDate'] = { $gte: new Date() };
      } else if (options.past) {
        query['schedule.endDate'] = { $lt: new Date() };
      } else if (options.startDate && options.endDate) {
        query.$or = [
          // Events starting in this range
          {
            'schedule.startDate': {
              $gte: options.startDate,
              $lte: options.endDate
            }
          },
          // Events ending in this range
          {
            'schedule.endDate': {
              $gte: options.startDate,
              $lte: options.endDate
            }
          },
          // Events spanning this range
          {
            'schedule.startDate': { $lt: options.startDate },
            'schedule.endDate': { $gt: options.endDate }
          }
        ];
      }
      
      // Get events
      const events = await Event.find(query)
        .sort({ 'schedule.startDate': options.upcoming ? 1 : -1 })
        .populate('presenters.user', 'profile.firstName profile.lastName profile.avatarUrl')
        .lean();
      
      return events;
    } catch (error) {
      logger.error(`Error getting calendar for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate Google Calendar link for an event
   * @param {Object} event - Event object
   * @returns {string} Google Calendar link
   */
  static generateGoogleCalendarLink(event) {
    try {
      const startTime = moment(event.schedule.startDate).format('YYYYMMDDTHHmmss');
      const endTime = moment(event.schedule.endDate).format('YYYYMMDDTHHmmss');
      
      // Format location
      const location = this._formatLocation(event.location);
      
      // Create URL with parameters
      const url = new URL('https://calendar.google.com/calendar/render');
      url.searchParams.append('action', 'TEMPLATE');
      url.searchParams.append('text', event.title);
      url.searchParams.append('dates', `${startTime}/${endTime}`);
      url.searchParams.append('details', this._sanitizeDescription(event.description));
      
      if (location) {
        url.searchParams.append('location', location);
      }
      
      return url.toString();
    } catch (error) {
      logger.error(`Error generating Google Calendar link for event ${event._id}:`, error);
      throw error;
    }
  }

  /**
   * Generate Microsoft Outlook link for an event
   * @param {Object} event - Event object
   * @returns {string} Outlook link
   */
  static generateOutlookLink(event) {
    try {
      const startTime = moment(event.schedule.startDate).format('YYYYMMDDTHHmmss');
      const endTime = moment(event.schedule.endDate).format('YYYYMMDDTHHmmss');
      
      // Format location
      const location = this._formatLocation(event.location);
      
      // Create URL with parameters
      const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
      url.searchParams.append('subject', event.title);
      url.searchParams.append('startdt', startTime);
      url.searchParams.append('enddt', endTime);
      url.searchParams.append('body', this._sanitizeDescription(event.description));
      
      if (location) {
        url.searchParams.append('location', location);
      }
      
      return url.toString();
    } catch (error) {
      logger.error(`Error generating Outlook link for event ${event._id}:`, error);
      throw error;
    }
  }

  /**
   * Format event date for display
   * @param {Object} event - Event object
   * @param {string} format - Date format
   * @returns {Object} Formatted dates
   */
  static formatEventDate(event, format = 'default') {
    try {
      const startDate = moment(event.schedule.startDate);
      const endDate = moment(event.schedule.endDate);
      const timezone = event.schedule.timezone || 'UTC';
      
      // Check if same day
      const isSameDay = startDate.isSame(endDate, 'day');
      
      if (format === 'calendar') {
        if (isSameDay) {
          return {
            date: startDate.format('MMMM D, YYYY'),
            time: `${startDate.format('h:mm A')} - ${endDate.format('h:mm A')} ${timezone}`
          };
        } else {
          return {
            startDate: startDate.format('MMMM D, YYYY'),
            endDate: endDate.format('MMMM D, YYYY'),
            time: `${startDate.format('h:mm A')} - ${endDate.format('h:mm A')} ${timezone}`
          };
        }
      } else if (format === 'compact') {
        if (isSameDay) {
          return {
            date: startDate.format('MMM D, YYYY'),
            time: `${startDate.format('h:mm A')} - ${endDate.format('h:mm A')}`
          };
        } else {
          return {
            date: `${startDate.format('MMM D')} - ${endDate.format('MMM D, YYYY')}`,
            time: `${startDate.format('h:mm A')} - ${endDate.format('h:mm A')}`
          };
        }
      } else if (format === 'full') {
        if (isSameDay) {
          return `${startDate.format('dddd, MMMM D, YYYY')} from ${startDate.format('h:mm A')} to ${endDate.format('h:mm A')} ${timezone}`;
        } else {
          return `${startDate.format('dddd, MMMM D, YYYY')} at ${startDate.format('h:mm A')} to ${endDate.format('dddd, MMMM D, YYYY')} at ${endDate.format('h:mm A')} ${timezone}`;
        }
      } else {
        // Default format
        if (isSameDay) {
          return `${startDate.format('MMM D, YYYY')} · ${startDate.format('h:mm A')} - ${endDate.format('h:mm A')}`;
        } else {
          return `${startDate.format('MMM D')} - ${endDate.format('MMM D, YYYY')}`;
        }
      }
    } catch (error) {
      logger.error(`Error formatting date for event ${event._id}:`, error);
      return 'Date information unavailable';
    }
  }

  /**
   * Generate reminder timing
   * @param {Object} event - Event object
   * @returns {Array} Reminder timings
   */
  static generateReminderTiming(event) {
    try {
      const defaultReminders = [
        { value: 1, unit: 'days' },
        { value: 1, unit: 'hours' }
      ];
      
      // Use event-specific reminders if available, otherwise use defaults
      const reminders = event.notifications && event.notifications.reminderTiming && 
                        event.notifications.reminderTiming.length > 0 ? 
                        event.notifications.reminderTiming : defaultReminders;
      
      const startTime = moment(event.schedule.startDate);
      
      // Calculate reminder times
      return reminders.map(reminder => {
        const reminderTime = moment(startTime).subtract(reminder.value, reminder.unit);
        return {
          label: `${reminder.value} ${reminder.unit} before`,
          time: reminderTime.toDate(),
          formattedTime: reminderTime.format('MMMM D, YYYY h:mm A')
        };
      });
    } catch (error) {
      logger.error(`Error generating reminder timing for event ${event._id}:`, error);
      throw error;
    }
  }

  /**
   * Check for schedule conflicts
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} eventId - Event ID to exclude (for updates)
   * @returns {Promise<Array>} Conflicting events
   */
  static async checkScheduleConflicts(startDate, endDate, eventId = null) {
    try {
      const query = {
        $or: [
          // Events starting during the new event
          {
            'schedule.startDate': {
              $gte: startDate,
              $lte: endDate
            }
          },
          // Events ending during the new event
          {
            'schedule.endDate': {
              $gte: startDate,
              $lte: endDate
            }
          },
          // Events encompassing the new event
          {
            'schedule.startDate': { $lte: startDate },
            'schedule.endDate': { $gte: endDate }
          }
        ]
      };
      
      // Exclude the current event (for updates)
      if (eventId) {
        query._id = { $ne: mongoose.Types.ObjectId(eventId) };
      }
      
      // Find potential conflicts
      const conflicts = await Event.find(query)
        .select('title slug schedule.startDate schedule.endDate')
        .lean();
      
      return conflicts;
    } catch (error) {
      logger.error('Error checking schedule conflicts:', error);
      throw error;
    }
  }

  /**
   * Private: Sanitize description for calendar
   * @param {string} description - Event description
   * @returns {string} Sanitized description
   * @private
   */
  static _sanitizeDescription(description) {
    if (!description) return '';
    
    // Remove HTML tags
    const withoutHtml = description.replace(/<[^>]*>/g, '');
    
    // Limit length and add event URL placeholder
    const truncated = withoutHtml.length > 1000 ? 
      withoutHtml.substring(0, 997) + '...' : 
      withoutHtml;
    
    return truncated;
  }

  /**
   * Private: Format location for calendar
   * @param {Object} location - Event location
   * @returns {string} Formatted location
   * @private
   */
  static _formatLocation(location) {
    if (!location) return '';
    
    if (location.online && location.online.platform) {
      return `Online (${location.online.platform})`;
    }
    
    if (location.physical && location.physical.venue) {
      const address = location.physical.address;
      const addressParts = [];
      
      if (location.physical.venue) {
        addressParts.push(location.physical.venue);
      }
      
      if (address) {
        if (address.street) addressParts.push(address.street);
        
        const cityParts = [];
        if (address.city) cityParts.push(address.city);
        if (address.state) cityParts.push(address.state);
        if (address.zipCode) cityParts.push(address.zipCode);
        
        if (cityParts.length > 0) {
          addressParts.push(cityParts.join(', '));
        }
        
        if (address.country) addressParts.push(address.country);
      }
      
      return addressParts.join(', ');
    }
    
    return '';
  }
}

module.exports = CalendarService;