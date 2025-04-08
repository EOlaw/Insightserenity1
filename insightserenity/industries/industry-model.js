/**
 * @file Industry Model
 * @description Model for industry specializations offered by the consulting platform
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Industry Schema
 * Represents an industry specialization
 */
const industrySchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  slug: { 
    type: String,
    required: true,
    unique: true, 
    trim: true,
    lowercase: true
  },
  description: {
    short: { type: String, required: true, maxlength: 300 },
    detailed: { type: String, required: true, maxlength: 5000 }
  },
  icon: {
    type: String, // Icon class or code
    default: 'industry-default'
  },
  featuredImage: {
    type: String // URL to image
  },
  banner: {
    type: String // URL to banner image
  },
  keyFacts: [{
    label: { type: String },
    value: { type: String },
    icon: { type: String }
  }],
  challenges: [{
    title: { type: String },
    description: { type: String },
    icon: { type: String }
  }],
  solutions: [{
    title: { type: String },
    description: { type: String },
    icon: { type: String }
  }],
  benefits: [{
    title: { type: String },
    description: { type: String },
    icon: { type: String }
  }],
  marketTrends: [{
    title: { type: String },
    description: { type: String },
    source: { type: String },
    year: { type: Number }
  }],
  clientTypes: [String],
  expertiseLevel: {
    type: String,
    enum: ['emerging', 'established', 'expert', 'leader'],
    default: 'established'
  },
  serviceOfferings: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  caseStudies: [{
    type: Schema.Types.ObjectId,
    ref: 'CaseStudy'
  }],
  consultants: [{
    type: Schema.Types.ObjectId,
    ref: 'Consultant'
  }],
  resources: [{
    title: { type: String },
    type: { type: String, enum: ['whitepaper', 'ebook', 'guide', 'report', 'webinar', 'video', 'article'] },
    url: { type: String },
    thumbnailUrl: { type: String }
  }],
  testimonials: [{
    quote: { type: String },
    author: { type: String },
    company: { type: String },
    position: { type: String },
    imageUrl: { type: String }
  }],
  relatedIndustries: [{
    type: Schema.Types.ObjectId,
    ref: 'Industry'
  }],
  statistics: {
    clientCount: { type: Number, default: 0 },
    yearsExperience: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 }, // Percentage
    projectsCompleted: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String],
    canonical: { type: String }
  },
  analytics: {
    views: { type: Number, default: 0 },
    contactRequests: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 }
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
// industrySchema.index({ slug: 1 });
industrySchema.index({ status: 1 });
industrySchema.index({ featured: 1 });
industrySchema.index({ 'expertiseLevel': 1 });

/**
 * Pre-save middleware to generate slug from name if not provided
 */
industrySchema.pre('save', function(next) {
  if (!this.isModified('name') || this.slug) {
    return next();
  }
  
  this.slug = this.name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  next();
});

/**
 * Virtual for URL
 */
industrySchema.virtual('url').get(function() {
  return `/industries/${this.slug}`;
});

/**
 * Virtual for case studies count
 */
industrySchema.virtual('caseStudiesCount').get(function() {
  return this.caseStudies ? this.caseStudies.length : 0;
});

/**
 * Virtual for consultants count
 */
industrySchema.virtual('consultantsCount').get(function() {
  return this.consultants ? this.consultants.length : 0;
});

/**
 * Virtual for service offerings count
 */
industrySchema.virtual('serviceOfferingsCount').get(function() {
  return this.serviceOfferings ? this.serviceOfferings.length : 0;
});

/**
 * Statics
 */
industrySchema.statics.findPublished = function() {
  return this.find({ status: 'published' })
    .sort({ name: 1 });
};

industrySchema.statics.findFeatured = function(limit = 4) {
  return this.find({ 
    status: 'published',
    featured: true
  })
    .sort({ name: 1 })
    .limit(limit);
};

const Industry = mongoose.model('Industry', industrySchema);

module.exports = Industry;