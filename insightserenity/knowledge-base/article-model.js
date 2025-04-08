/**
 * @file Knowledge Base Article Model
 * @description Model for knowledge base articles and resources
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Knowledge Base Article Schema
 * Represents an educational resource or knowledge article
 */
const articleSchema = new Schema({
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
  content: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true,
    maxlength: 500
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'KnowledgeCategory',
    required: true
  },
  tags: [String],
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'intermediate'
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
  author: {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: { type: String, required: true },
    avatarUrl: { type: String }
  },
  contributors: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    name: { type: String },
    avatarUrl: { type: String }
  }],
  reviewedBy: {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    name: { type: String },
    date: { type: Date }
  },
  publishedAt: {
    type: Date
  },
  lastUpdatedAt: {
    type: Date
  },
  version: {
    type: Number,
    default: 1
  },
  media: {
    featuredImage: { type: String },
    attachments: [{
      title: { type: String, required: true },
      file: { type: String, required: true },
      type: { type: String },
      size: { type: String }
    }]
  },
  related: {
    articles: [{
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeArticle'
    }],
    services: [{
      type: Schema.Types.ObjectId,
      ref: 'Service'
    }],
    caseStudies: [{
      type: Schema.Types.ObjectId,
      ref: 'CaseStudy'
    }]
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String],
    focusKeyword: { type: String }
  },
  metadata: {
    estimatedReadingTime: { type: Number }, // in minutes
    tableOfContents: [{
      title: { type: String },
      anchor: { type: String },
      level: { type: Number }
    }]
  },
  analytics: {
    views: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    helpfulVotes: { type: Number, default: 0 },
    notHelpfulVotes: { type: Number, default: 0 }
  },
  feedback: [{
    helpful: { type: Boolean },
    comment: { type: String },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
// articleSchema.index({ slug: 1 });
articleSchema.index({ status: 1 });
articleSchema.index({ category: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ featured: 1 });
articleSchema.index({ publishedAt: -1 });
articleSchema.index({ 'author.user': 1 });
articleSchema.index({ visibility: 1 });
articleSchema.index({ difficulty: 1 });

/**
 * Virtual for article URL
 */
articleSchema.virtual('url').get(function() {
  return `/knowledge-base/${this.slug}`;
});

/**
 * Virtual for helpfulness percentage
 */
articleSchema.virtual('helpfulnessRating').get(function() {
  const totalVotes = this.analytics.helpfulVotes + this.analytics.notHelpfulVotes;
  if (totalVotes === 0) return null;
  
  return Math.round((this.analytics.helpfulVotes / totalVotes) * 100);
});

/**
 * Pre-save middleware to generate slug from title if not provided
 */
articleSchema.pre('save', function(next) {
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
 * Pre-save middleware to extract and generate metadata
 */
articleSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Calculate reading time based on content length
    // Average reading speed: 200 words per minute
    const wordCount = this.content.split(/\s+/).length;
    this.metadata.estimatedReadingTime = Math.ceil(wordCount / 200) || 1; // Minimum 1 minute
    
    // Extract headings for table of contents
    const headingRegex = /<h([2-6])[^>]*>(.*?)<\/h\1>/g;
    const headings = [];
    let match;
    
    while ((match = headingRegex.exec(this.content)) !== null) {
      const level = parseInt(match[1]);
      const title = match[2].replace(/<[^>]*>/g, ''); // Remove any HTML tags inside heading
      const anchor = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      headings.push({
        title,
        anchor,
        level
      });
    }
    
    this.metadata.tableOfContents = headings;
  }
  
  // Set published date if publishing for the first time
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Update lastUpdatedAt whenever content is modified
  if (this.isModified('content')) {
    this.lastUpdatedAt = new Date();
  }
  
  next();
});

/**
 * Statics
 */
articleSchema.statics.findPublished = function(query = {}) {
  return this.find({
    ...query,
    status: 'published',
    publishedAt: { $lte: new Date() }
  }).sort({ publishedAt: -1 });
};

articleSchema.statics.findFeatured = function(limit = 5) {
  return this.find({
    status: 'published',
    featured: true,
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

articleSchema.statics.findByCategory = function(categoryId, options = {}) {
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

articleSchema.statics.findByDifficulty = function(difficulty, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    difficulty,
    status: 'published',
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

articleSchema.statics.search = function(query, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { summary: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
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
articleSchema.methods.incrementViews = async function() {
  this.analytics.views += 1;
  return this.save();
};

articleSchema.methods.recordDownload = async function() {
  this.analytics.downloads += 1;
  return this.save();
};

articleSchema.methods.addFeedback = async function(feedbackData) {
  // Add feedback to array
  this.feedback.push(feedbackData);
  
  // Update analytics
  if (feedbackData.helpful) {
    this.analytics.helpfulVotes += 1;
  } else {
    this.analytics.notHelpfulVotes += 1;
  }
  
  return this.save();
};

const KnowledgeArticle = mongoose.model('KnowledgeArticle', articleSchema);

module.exports = KnowledgeArticle;