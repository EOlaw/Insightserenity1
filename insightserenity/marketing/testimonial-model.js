/**
 * @file Testimonial Model
 * @description Model for client testimonials and success stories
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Testimonial Schema
 * Represents a client testimonial or success story
 */
const testimonialSchema = new Schema({
  client: {
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    company: { 
      type: String, 
      required: true,
      trim: true
    },
    industry: { 
      type: String,
      enum: [
        'technology', 'healthcare', 'finance', 'education', 'retail', 
        'manufacturing', 'media', 'legal', 'real_estate', 'energy',
        'hospitality', 'nonprofit', 'government', 'transportation', 'other'
      ]
    },
    avatar: { type: String }, // URL to client's photo
    logo: { type: String }, // URL to company logo
    isAnonymous: { 
      type: Boolean, 
      default: false // For confidential testimonials
    }
  },
  quote: {
    short: { 
      type: String, 
      required: true,
      maxlength: 250
    },
    full: { 
      type: String, 
      required: true,
      maxlength: 2000
    }
  },
  rating: {
    value: { 
      type: Number,
      min: 1,
      max: 5,
      default: 5
    },
    display: { 
      type: Boolean, 
      default: true
    }
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service'
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  caseStudy: {
    type: Schema.Types.ObjectId,
    ref: 'CaseStudy'
  },
  consultant: {
    type: Schema.Types.ObjectId,
    ref: 'Consultant'
  },
  media: {
    image: { type: String }, // URL to related image
    video: { type: String } // URL to testimonial video
  },
  featured: {
    type: Boolean,
    default: false
  },
  displayLocation: [{ 
    type: String,
    enum: ['home', 'about', 'services', 'consultants', 'case-studies', 'all']
  }],
  displayOrder: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'archived'],
    default: 'pending'
  },
  verification: {
    isVerified: { 
      type: Boolean, 
      default: false
    },
    method: { 
      type: String,
      enum: ['email', 'linkedin', 'phone', 'other', null],
      default: null
    },
    verifiedAt: { type: Date },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  metadata: {
    projectDate: { type: Date }, // When the project was completed
    relationshipLength: { type: String } // How long the client relationship has been
  },
  permissions: {
    isPublic: { 
      type: Boolean, 
      default: true
    },
    allowedInMarketing: { 
      type: Boolean, 
      default: true
    }
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
testimonialSchema.index({ 'client.industry': 1 });
testimonialSchema.index({ featured: 1 });
testimonialSchema.index({ status: 1 });
testimonialSchema.index({ displayOrder: 1 });
testimonialSchema.index({ service: 1 });
testimonialSchema.index({ consultant: 1 });
testimonialSchema.index({ displayLocation: 1 });

/**
 * Pre-save middleware to manage display locations
 */
testimonialSchema.pre('save', function(next) {
  // If marked to display on all pages, set the displayLocation array accordingly
  if (this.displayLocation.includes('all')) {
    this.displayLocation = ['home', 'about', 'services', 'consultants', 'case-studies'];
  }
  next();
});

/**
 * Virtual for display name (handles anonymous clients)
 */
testimonialSchema.virtual('displayName').get(function() {
  if (this.client.isAnonymous) {
    return `Anonymous ${this.client.industry ? 'Client in ' + this.client.industry.charAt(0).toUpperCase() + this.client.industry.slice(1) : 'Client'}`;
  }
  return this.client.name;
});

/**
 * Statics
 */
testimonialSchema.statics.findApproved = function(query = {}) {
  return this.find({
    ...query,
    status: 'approved'
  });
};

testimonialSchema.statics.findFeatured = function(limit = 3) {
  return this.find({
    status: 'approved',
    featured: true
  })
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(limit);
};

testimonialSchema.statics.findByLocation = function(location, limit = 5) {
  return this.find({
    status: 'approved',
    displayLocation: location
  })
    .sort({ displayOrder: 1, featured: -1, createdAt: -1 })
    .limit(limit);
};

testimonialSchema.statics.findByService = function(serviceId, limit = 3) {
  return this.find({
    status: 'approved',
    service: serviceId
  })
    .sort({ featured: -1, createdAt: -1 })
    .limit(limit);
};

testimonialSchema.statics.findByConsultant = function(consultantId, limit = 3) {
  return this.find({
    status: 'approved',
    consultant: consultantId
  })
    .sort({ featured: -1, createdAt: -1 })
    .limit(limit);
};

const Testimonial = mongoose.model('Testimonial', testimonialSchema);

module.exports = Testimonial;