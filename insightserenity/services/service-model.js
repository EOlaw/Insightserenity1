/**
 * @file Service Model
 * @description Model for consulting services offered on the platform
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Service Schema
 * Represents a consulting service offering
 */
const serviceSchema = new Schema({
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
  category: {
    type: String,
    required: true,
    enum: [
      'strategy', 'operations', 'technology', 'digital', 'finance', 
      'hr', 'marketing', 'legal', 'compliance', 'research',
      'education', 'sustainability', 'other'
    ]
  },
  description: {
    short: { type: String, required: true, maxlength: 300 },
    detailed: { type: String, required: true, maxlength: 5000 }
  },
  benefits: [String],
  features: [String],
  process: [{
    stage: { type: String, required: true },
    description: { type: String, required: true },
    order: { type: Number, required: true }
  }],
  pricing: {
    model: { 
      type: String, 
      required: true,
      enum: ['hourly', 'fixed', 'retainer', 'milestone', 'value_based', 'mixed'] 
    },
    startingFrom: { type: Number },
    currency: { type: String, default: 'USD' },
    customQuote: { type: Boolean, default: false },
    priceRange: {
      min: { type: Number },
      max: { type: Number }
    },
    paymentSchedule: { type: String }
  },
  deliverables: [String],
  timeframes: {
    typical: { type: String },
    express: { type: String },
    factors: { type: String }
  },
  expertise: {
    requiredSkills: [String],
    certifications: [String],
    experience: { type: String }
  },
  industries: [{
    type: String,
    enum: [
      'technology', 'healthcare', 'finance', 'education', 'retail', 'consumer goods', 'industrial equipment',
      'manufacturing', 'media', 'legal', 'real_estate', 'energy', 'automotive', 'aerospace',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ]
  }],
  media: {
    featuredImage: { type: String },
    gallery: [String],
    video: { type: String }
  },
  faqs: [{
    question: { type: String },
    answer: { type: String }
  }],
  caseStudies: [{
    type: Schema.Types.ObjectId,
    ref: 'CaseStudy'
  }],
  testimonials: [{
    type: Schema.Types.ObjectId,
    ref: 'Testimonial'
  }],
  relatedServices: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  consultants: [{
    type: Schema.Types.ObjectId,
    ref: 'Consultant'
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String],
    canonical: { type: String }
  },
  analytics: {
    views: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 }
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
// serviceSchema.index({ slug: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ status: 1 });
serviceSchema.index({ 'pricing.model': 1 });
serviceSchema.index({ industries: 1 });

/**
 * Pre-save middleware to generate slug from name if not provided
 */
serviceSchema.pre('save', function(next) {
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
serviceSchema.virtual('url').get(function() {
  return `/services/${this.slug}`;
});

/**
 * Virtual for estimating price range
 */
serviceSchema.virtual('estimatedPriceRange').get(function() {
  if (this.pricing.customQuote) {
    return 'Custom quote required';
  }
  
  if (this.pricing.priceRange.min && this.pricing.priceRange.max) {
    return `${this.pricing.priceRange.min}-${this.pricing.priceRange.max} ${this.pricing.currency}`;
  }
  
  if (this.pricing.startingFrom) {
    return `Starting from ${this.pricing.startingFrom} ${this.pricing.currency}`;
  }
  
  return 'Contact for pricing';
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;