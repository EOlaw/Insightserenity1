/**
 * @file Event Feedback Model
 * @description Model for feedback and ratings from event attendees
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Event Feedback Schema
 * Represents feedback provided by an attendee for an event
 */
const feedbackSchema = new Schema({
  event: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  registration: {
    type: Schema.Types.ObjectId,
    ref: 'EventRegistration'
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  attendeeInfo: {
    name: { type: String },
    email: { type: String, lowercase: true }
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  feedback: {
    type: String,
    required: true
  },
  responses: {
    contentQuality: { type: Number, min: 1, max: 5 },
    speakerQuality: { type: Number, min: 1, max: 5 },
    relevance: { type: Number, min: 1, max: 5 },
    organization: { type: Number, min: 1, max: 5 },
    facilities: { type: Number, min: 1, max: 5 },
    networking: { type: Number, min: 1, max: 5 },
    valueForMoney: { type: Number, min: 1, max: 5 }
  },
  highlights: {
    type: String
  },
  improvement: {
    type: String
  },
  nextTopics: {
    type: String
  },
  futureParticipation: {
    type: Boolean
  },
  recommendation: {
    type: Boolean
  },
  nps: {
    type: Number,
    min: 0,
    max: 10
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'archived'],
    default: 'pending'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'anonymous'],
    default: 'public'
  },
  isTestimonial: {
    type: Boolean,
    default: false
  },
  moderatorNotes: {
    type: String
  },
  ipAddress: {
    type: String
  },
  deviceInfo: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
feedbackSchema.index({ event: 1 });
feedbackSchema.index({ user: 1 });
feedbackSchema.index({ registration: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ visibility: 1 });
feedbackSchema.index({ isTestimonial: 1 });

/**
 * Virtual for average score of detailed responses
 */
feedbackSchema.virtual('detailedResponseAverage').get(function() {
  const responses = this.responses;
  const values = [];
  
  if (responses.contentQuality) values.push(responses.contentQuality);
  if (responses.speakerQuality) values.push(responses.speakerQuality);
  if (responses.relevance) values.push(responses.relevance);
  if (responses.organization) values.push(responses.organization);
  if (responses.facilities) values.push(responses.facilities);
  if (responses.networking) values.push(responses.networking);
  if (responses.valueForMoney) values.push(responses.valueForMoney);
  
  if (values.length === 0) return null;
  
  const sum = values.reduce((total, val) => total + val, 0);
  return parseFloat((sum / values.length).toFixed(1));
});

/**
 * Post-save middleware to update event average rating
 */
feedbackSchema.post('save', async function() {
  try {
    if (this.rating) {
      const Event = mongoose.model('Event');
      const event = await Event.findById(this.event);
      
      if (event) {
        await event.updateAverageRating();
      }
    }
  } catch (error) {
    console.error('Error updating event average rating:', error);
  }
});

/**
 * Post-remove middleware to update event average rating
 */
feedbackSchema.post('remove', async function() {
  try {
    const Event = mongoose.model('Event');
    const event = await Event.findById(this.event);
    
    if (event) {
      await event.updateAverageRating();
    }
  } catch (error) {
    console.error('Error updating event average rating after feedback removal:', error);
  }
});

/**
 * Methods
 */
feedbackSchema.methods.approveForPublic = async function() {
  this.status = 'approved';
  return this.save();
};

feedbackSchema.methods.markAsTestimonial = async function() {
  this.isTestimonial = true;
  this.status = 'approved';
  return this.save();
};

feedbackSchema.methods.reject = async function(reason) {
  this.status = 'rejected';
  this.moderatorNotes = reason || this.moderatorNotes;
  return this.save();
};

/**
 * Statics
 */
feedbackSchema.statics.findByEvent = function(eventId, options = {}) {
  const { page = 1, limit = 20, status = 'approved', includePrivate = false } = options;
  const skip = (page - 1) * limit;
  
  const query = { 
    event: eventId,
    status
  };
  
  if (!includePrivate) {
    query.visibility = { $ne: 'private' };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

feedbackSchema.statics.findTestimonials = function(eventId = null, limit = 5) {
  const query = { 
    isTestimonial: true,
    status: 'approved',
    visibility: { $ne: 'private' }
  };
  
  if (eventId) {
    query.event = eventId;
  }
  
  return this.find(query)
    .sort({ rating: -1 })
    .limit(limit);
};

feedbackSchema.statics.getEventStats = async function(eventId) {
  const stats = {};
  
  // Get total feedback count
  stats.totalFeedback = await this.countDocuments({ event: eventId });
  
  // Get average rating
  const ratingResult = await this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } }
  ]);
  
  stats.averageRating = ratingResult.length > 0 ? 
    parseFloat(ratingResult[0].avgRating.toFixed(1)) : 0;
  
  // Get rating distribution
  const ratingDistribution = await this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  
  stats.ratingDistribution = {};
  for (let i = 1; i <= 5; i++) {
    const found = ratingDistribution.find(item => item._id === i);
    stats.ratingDistribution[i] = found ? found.count : 0;
  }
  
  // Get NPS distribution
  if (await this.countDocuments({ event: eventId, nps: { $exists: true } })) {
    const npsResult = await this.aggregate([
      { $match: { event: mongoose.Types.ObjectId(eventId), nps: { $exists: true } } },
      { 
        $group: { 
          _id: null, 
          promoters: { 
            $sum: { $cond: [{ $gte: ['$nps', 9] }, 1, 0] } 
          },
          passives: { 
            $sum: { $cond: [{ $and: [{ $gte: ['$nps', 7] }, { $lte: ['$nps', 8] }] }, 1, 0] } 
          },
          detractors: { 
            $sum: { $cond: [{ $lte: ['$nps', 6] }, 1, 0] } 
          },
          total: { $sum: 1 }
        } 
      }
    ]);
    
    if (npsResult.length > 0) {
      const npsData = npsResult[0];
      stats.nps = {
        score: Math.round(((npsData.promoters - npsData.detractors) / npsData.total) * 100),
        promoters: npsData.promoters,
        passives: npsData.passives,
        detractors: npsData.detractors,
        total: npsData.total
      };
    }
  }
  
  // Get average detailed responses
  const detailedResponsesResult = await this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    { 
      $group: { 
        _id: null, 
        contentQuality: { $avg: '$responses.contentQuality' },
        speakerQuality: { $avg: '$responses.speakerQuality' },
        relevance: { $avg: '$responses.relevance' },
        organization: { $avg: '$responses.organization' },
        facilities: { $avg: '$responses.facilities' },
        networking: { $avg: '$responses.networking' },
        valueForMoney: { $avg: '$responses.valueForMoney' }
      } 
    }
  ]);
  
  if (detailedResponsesResult.length > 0) {
    const responses = detailedResponsesResult[0];
    delete responses._id;
    
    // Round all values to 1 decimal place
    Object.keys(responses).forEach(key => {
      if (responses[key]) {
        responses[key] = parseFloat(responses[key].toFixed(1));
      }
    });
    
    stats.detailedResponses = responses;
  }
  
  // Get future participation and recommendation rates
  const participationResult = await this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId), futureParticipation: { $exists: true } } },
    { 
      $group: { 
        _id: null, 
        yesCount: { $sum: { $cond: ['$futureParticipation', 1, 0] } },
        total: { $sum: 1 }
      } 
    }
  ]);
  
  if (participationResult.length > 0) {
    const data = participationResult[0];
    stats.futureParticipationRate = Math.round((data.yesCount / data.total) * 100);
  }
  
  const recommendationResult = await this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId), recommendation: { $exists: true } } },
    { 
      $group: { 
        _id: null, 
        yesCount: { $sum: { $cond: ['$recommendation', 1, 0] } },
        total: { $sum: 1 }
      } 
    }
  ]);
  
  if (recommendationResult.length > 0) {
    const data = recommendationResult[0];
    stats.recommendationRate = Math.round((data.yesCount / data.total) * 100);
  }
  
  return stats;
};

const EventFeedback = mongoose.model('EventFeedback', feedbackSchema);

module.exports = EventFeedback;