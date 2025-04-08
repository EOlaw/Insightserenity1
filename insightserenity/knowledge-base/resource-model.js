/**
 * @file Knowledge Base Resource Model
 * @description Model for additional knowledge base resources (files, videos, templates, etc.)
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Knowledge Base Resource Schema
 * Represents supplementary resources for the knowledge base
 */
const resourceSchema = new Schema({
  title: { 
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
    type: String,
    required: true,
    maxlength: 1000
  },
  resourceType: {
    type: String,
    required: true,
    enum: [
      'pdf', 'video', 'presentation', 'template', 'worksheet', 
      'checklist', 'guide', 'whitepaper', 'ebook', 'infographic', 'other'
    ]
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'KnowledgeCategory',
    required: true
  },
  tags: [String],
  file: {
    url: { type: String },
    filename: { type: String },
    size: { type: Number }, // in bytes
    type: { type: String },
    uploadDate: { type: Date, default: Date.now }
  },
  externalLink: {
    url: { type: String },
    type: { type: String }, // 'youtube', 'vimeo', 'website', etc.
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'clients', 'consultants', 'internal'],
    default: 'public'
  },
  featured: {
    type: Boolean,
    default: false
  },
  premium: {
    type: Boolean,
    default: false
  },
  author: {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: { type: String, required: true },
    avatarUrl: { type: String }
  },
  publishedAt: {
    type: Date
  },
  lastUpdatedAt: {
    type: Date
  },
  version: {
    type: String,
    default: '1.0'
  },
  relatedContent: {
    articles: [{
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeArticle'
    }],
    resources: [{
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeResource'
    }],
    services: [{
      type: Schema.Types.ObjectId,
      ref: 'Service'
    }]
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String]
  },
  metadata: {
    thumbnailUrl: { type: String },
    duration: { type: Number }, // in seconds, for videos
    pages: { type: Number }, // for PDFs, presentations
    fileFormat: { type: String }, // "pdf", "pptx", "xlsx", etc.
    dimensions: { type: String }, // for images, infographics
    language: { type: String, default: 'en' },
    compatibleWith: [String], // software compatibility
    requirements: { type: String } // any special requirements to use
  },
  analytics: {
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    uniqueDownloads: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 }
  },
  ratings: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: { type: String },
    date: { type: Date, default: Date.now }
  }],
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
// resourceSchema.index({ slug: 1 });
resourceSchema.index({ resourceType: 1 });
resourceSchema.index({ status: 1 });
resourceSchema.index({ category: 1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index({ featured: 1 });
resourceSchema.index({ premium: 1 });
resourceSchema.index({ publishedAt: -1 });
resourceSchema.index({ 'author.user': 1 });
resourceSchema.index({ visibility: 1 });

/**
 * Virtual for resource URL
 */
resourceSchema.virtual('url').get(function() {
  return `/knowledge-base/resources/${this.slug}`;
});

/**
 * Virtual for resource thumbnail
 */
resourceSchema.virtual('thumbnail').get(function() {
  if (this.metadata.thumbnailUrl) {
    return this.metadata.thumbnailUrl;
  }
  
  // Default thumbnails based on resource type
  const defaultThumbnails = {
    pdf: '/public/img/thumbnails/pdf.png',
    video: '/public/img/thumbnails/video.png',
    presentation: '/public/img/thumbnails/presentation.png',
    template: '/public/img/thumbnails/template.png',
    worksheet: '/public/img/thumbnails/worksheet.png',
    checklist: '/public/img/thumbnails/checklist.png',
    guide: '/public/img/thumbnails/guide.png',
    whitepaper: '/public/img/thumbnails/whitepaper.png',
    ebook: '/public/img/thumbnails/ebook.png',
    infographic: '/public/img/thumbnails/infographic.png',
    other: '/public/img/thumbnails/other.png'
  };
  
  return defaultThumbnails[this.resourceType] || defaultThumbnails.other;
});

/**
 * Virtual for formatted file size
 */
resourceSchema.virtual('formattedFileSize').get(function() {
  if (!this.file || !this.file.size) return null;
  
  const bytes = this.file.size;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  if (bytes === 0) return '0 Byte';
  
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
});

/**
 * Virtual for average rating
 */
resourceSchema.virtual('averageRating').get(function() {
  if (!this.ratings || this.ratings.length === 0) return null;
  
  const sum = this.ratings.reduce((total, rating) => total + rating.rating, 0);
  return Math.round((sum / this.ratings.length) * 10) / 10; // Round to 1 decimal place
});

/**
 * Pre-save middleware to generate slug from title if not provided
 */
resourceSchema.pre('save', function(next) {
  if (!this.isModified('title') || this.slug) {
    return next();
  }
  
  this.slug = this.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  next();
});

/**
 * Pre-save middleware to update dates and version
 */
resourceSchema.pre('save', function(next) {
  // Set published date if publishing for the first time
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Update lastUpdatedAt whenever content is modified
  if (this.isModified('file') || 
      this.isModified('externalLink') || 
      this.isModified('description')) {
    this.lastUpdatedAt = new Date();
  }
  
  next();
});

/**
 * Statics
 */
resourceSchema.statics.findPublished = function(query = {}) {
  return this.find({
    ...query,
    status: 'published',
    publishedAt: { $lte: new Date() }
  }).sort({ publishedAt: -1 });
};

resourceSchema.statics.findByType = function(resourceType, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    resourceType,
    status: 'published',
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

resourceSchema.statics.findFeatured = function(limit = 5) {
  return this.find({
    status: 'published',
    featured: true,
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

resourceSchema.statics.findByCategory = function(categoryId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    category: categoryId,
    status: 'published',
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

resourceSchema.statics.search = function(query, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $regex: query, $options: 'i' } }
    ],
    status: 'published',
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Methods
 */
resourceSchema.methods.incrementViews = async function() {
  this.analytics.views += 1;
  return this.save();
};

resourceSchema.methods.incrementDownloads = async function() {
  this.analytics.downloads += 1;
  return this.save();
};

resourceSchema.methods.incrementShares = async function() {
  this.analytics.shareCount += 1;
  return this.save();
};

resourceSchema.methods.addRating = async function(userId, rating, comment = '') {
  // Check if user has already rated
  const existingRatingIndex = this.ratings.findIndex(
    r => r.user && r.user.toString() === userId.toString()
  );
  
  if (existingRatingIndex > -1) {
    // Update existing rating
    this.ratings[existingRatingIndex] = {
      user: userId,
      rating,
      comment,
      date: new Date()
    };
  } else {
    // Add new rating
    this.ratings.push({
      user: userId,
      rating,
      comment,
      date: new Date()
    });
  }
  
  // Update average rating
  const totalRatings = this.ratings.length;
  const sumRatings = this.ratings.reduce((sum, r) => sum + r.rating, 0);
  this.analytics.averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;
  
  return this.save();
};

const KnowledgeResource = mongoose.model('KnowledgeResource', resourceSchema);

module.exports = KnowledgeResource;