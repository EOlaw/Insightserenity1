/**
 * @file Review Model
 * @description Model for consultant and service reviews
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Review Schema
 * Represents a review for a consultant or service
 */
const reviewSchema = new Schema({
  reviewer: {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    name: { 
      type: String,
      required: true
    },
    company: { type: String },
    position: { type: String },
    avatarUrl: { type: String },
    verified: { 
      type: Boolean,
      default: false
    }
  },
  reviewType: {
    type: String,
    enum: ['consultant', 'service', 'project', 'organization'],
    required: true
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'targetModel'
  },
  targetModel: {
    type: String,
    required: true,
    enum: ['Consultant', 'Service', 'Project', 'Organization']
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  rating: {
    overall: { 
      type: Number, 
      required: true,
      min: 1,
      max: 5
    },
    communication: { 
      type: Number,
      min: 1,
      max: 5
    },
    expertise: { 
      type: Number,
      min: 1,
      max: 5
    },
    quality: { 
      type: Number,
      min: 1,
      max: 5
    },
    valueForMoney: { 
      type: Number,
      min: 1,
      max: 5
    },
    timeliness: { 
      type: Number,
      min: 1,
      max: 5
    },
    recommendation: { 
      type: Number,
      min: 1,
      max: 5
    }
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  summary: {
    type: String,
    trim: true,
    maxlength: 200
  },
  pros: [String],
  cons: [String],
  tags: [String],
  engagement: {
    startDate: { type: Date },
    endDate: { type: Date },
    duration: { type: String },
    engagementType: { 
      type: String,
      enum: ['one-time', 'short-term', 'long-term', 'ongoing']
    },
    budget: {
      range: { 
        type: String,
        enum: ['under_5k', '5k_15k', '15k_50k', '50k_plus']
      },
      exact: { type: Number }
    }
  },
  media: {
    images: [String],
    videos: [String],
    documents: [{
      title: { type: String },
      url: { type: String },
      type: { type: String }
    }]
  },
  response: {
    content: { type: String, maxlength: 2000 },
    respondent: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    respondentName: { type: String },
    timestamp: { type: Date }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'clients_only'],
    default: 'public'
  },
  featured: {
    type: Boolean,
    default: false
  },
  analytics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    helpfulVotes: { type: Number, default: 0 },
    unhelpfulVotes: { type: Number, default: 0 },
    reports: { type: Number, default: 0 }
  },
  verification: {
    isVerified: { 
      type: Boolean,
      default: false 
    },
    method: { 
      type: String,
      enum: ['project', 'invoice', 'contract', 'admin', null],
      default: null
    },
    verifiedAt: { type: Date },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  moderation: {
    moderatedAt: { type: Date },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: { type: String },
    changes: [{
      field: { type: String },
      originalValue: { type: String },
      newValue: { type: String },
      timestamp: { type: Date }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
reviewSchema.index({ 'reviewer.user': 1 });
reviewSchema.index({ reviewType: 1 });
reviewSchema.index({ targetId: 1, targetModel: 1 });
reviewSchema.index({ project: 1 });
reviewSchema.index({ 'rating.overall': -1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ visibility: 1 });
reviewSchema.index({ featured: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ 'verification.isVerified': 1 });

/**
 * Virtual for helpful rating percentage
 */
reviewSchema.virtual('helpfulPercent').get(function() {
  const total = this.analytics.helpfulVotes + this.analytics.unhelpfulVotes;
  if (total === 0) return 0;
  
  return Math.round((this.analytics.helpfulVotes / total) * 100);
});

/**
 * Middleware to auto-verify reviews when approved by admin
 */
reviewSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'approved' && !this.verification.isVerified) {
    if (this.moderation && this.moderation.moderatedBy) {
      this.verification.isVerified = true;
      this.verification.method = 'admin';
      this.verification.verifiedAt = new Date();
      this.verification.verifiedBy = this.moderation.moderatedBy;
    }
  }
  next();
});

/**
 * Average rating calculation
 */
reviewSchema.methods.calculateAverageRating = function() {
  let sum = 0;
  let count = 0;
  
  // Include all available rating dimensions
  Object.keys(this.rating).forEach(key => {
    if (this.rating[key] && key !== 'overall') {
      sum += this.rating[key];
      count++;
    }
  });
  
  // Calculate average if there are ratings other than overall
  if (count > 0) {
    this.rating.overall = Math.round((sum / count) * 10) / 10; // Round to 1 decimal place
  }
  
  return this.rating.overall;
};

/**
 * Mark as helpful
 */
reviewSchema.methods.markHelpful = function() {
  this.analytics.helpfulVotes += 1;
  return this.save();
};

/**
 * Mark as unhelpful
 */
reviewSchema.methods.markUnhelpful = function() {
  this.analytics.unhelpfulVotes += 1;
  return this.save();
};

/**
 * Report review
 */
reviewSchema.methods.report = function() {
  this.analytics.reports += 1;
  
  // Auto-flag if reports exceed threshold
  if (this.analytics.reports >= 5 && this.status !== 'flagged') {
    this.status = 'flagged';
  }
  
  return this.save();
};

/**
 * Static method to calculate aggregate ratings for a target
 */
reviewSchema.statics.getAggregateRatings = async function(targetId, targetModel) {
  const result = await this.aggregate([
    {
      $match: {
        targetId: mongoose.Types.ObjectId(targetId),
        targetModel: targetModel,
        status: 'approved',
        visibility: { $ne: 'private' }
      }
    },
    {
      $group: {
        _id: null,
        averageOverall: { $avg: '$rating.overall' },
        averageCommunication: { $avg: '$rating.communication' },
        averageExpertise: { $avg: '$rating.expertise' },
        averageQuality: { $avg: '$rating.quality' },
        averageValueForMoney: { $avg: '$rating.valueForMoney' },
        averageTimeliness: { $avg: '$rating.timeliness' },
        averageRecommendation: { $avg: '$rating.recommendation' },
        count: { $sum: 1 },
        verifiedCount: { 
          $sum: { 
            $cond: [
              { $eq: ['$verification.isVerified', true] },
              1,
              0
            ]
          }
        },
        rating5: {
          $sum: {
            $cond: [{ $eq: ['$rating.overall', 5] }, 1, 0]
          }
        },
        rating4: {
          $sum: {
            $cond: [{ $eq: ['$rating.overall', 4] }, 1, 0]
          }
        },
        rating3: {
          $sum: {
            $cond: [{ $eq: ['$rating.overall', 3] }, 1, 0]
          }
        },
        rating2: {
          $sum: {
            $cond: [{ $eq: ['$rating.overall', 2] }, 1, 0]
          }
        },
        rating1: {
          $sum: {
            $cond: [{ $eq: ['$rating.overall', 1] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        averageOverall: { $round: ['$averageOverall', 1] },
        averageCommunication: { $round: ['$averageCommunication', 1] },
        averageExpertise: { $round: ['$averageExpertise', 1] },
        averageQuality: { $round: ['$averageQuality', 1] },
        averageValueForMoney: { $round: ['$averageValueForMoney', 1] },
        averageTimeliness: { $round: ['$averageTimeliness', 1] },
        averageRecommendation: { $round: ['$averageRecommendation', 1] },
        count: 1,
        verifiedCount: 1,
        distribution: {
          '5': '$rating5',
          '4': '$rating4',
          '3': '$rating3',
          '2': '$rating2',
          '1': '$rating1'
        }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : {
    averageOverall: 0,
    averageCommunication: 0,
    averageExpertise: 0,
    averageQuality: 0,
    averageValueForMoney: 0,
    averageTimeliness: 0,
    averageRecommendation: 0,
    count: 0,
    verifiedCount: 0,
    distribution: {
      '5': 0,
      '4': 0,
      '3': 0,
      '2': 0,
      '1': 0
    }
  };
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;