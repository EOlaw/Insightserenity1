/**
 * @file Blog Post Model
 * @description Model for blog posts that showcase thought leadership
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Blog Post Schema
 * Represents a blog post for thought leadership content
 */
const postSchema = new Schema({
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
  summary: {
    type: String,
    required: true,
    maxlength: 500
  },
  content: {
    type: String,
    required: true
  },
  author: {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: { type: String, required: true },
    bio: { type: String },
    avatarUrl: { type: String }
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'BlogCategory',
    required: true
  },
  tags: [String],
  featuredImage: {
    url: { type: String },
    alt: { type: String },
    caption: { type: String }
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String],
    focusKeyword: { type: String }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  featured: {
    type: Boolean,
    default: false
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  visibility: {
    type: String,
    enum: ['public', 'members', 'private'],
    default: 'public'
  },
  readingTime: {
    type: Number, // in minutes
    default: 0
  },
  relatedPosts: [{
    type: Schema.Types.ObjectId,
    ref: 'BlogPost'
  }],
  relatedServices: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  relatedCaseStudies: [{
    type: Schema.Types.ObjectId,
    ref: 'CaseStudy'
  }],
  social: {
    shareCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    platforms: {
      facebook: { type: Number, default: 0 },
      twitter: { type: Number, default: 0 },
      linkedin: { type: Number, default: 0 }
    }
  },
  analytics: {
    views: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    averageTimeOnPage: { type: Number, default: 0 }, // in seconds
    bounceRate: { type: Number, default: 0 }, // percentage
    conversionRate: { type: Number, default: 0 } // percentage
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
// postSchema.index({ slug: 1 });
postSchema.index({ status: 1 });
postSchema.index({ category: 1 });
postSchema.index({ tags: 1 });
postSchema.index({ featured: 1 });
postSchema.index({ publishedAt: -1 });
postSchema.index({ 'author.user': 1 });
postSchema.index({ visibility: 1 });

/**
 * Virtual for post URL
 */
postSchema.virtual('url').get(function() {
  return `/blog/${this.slug}`;
});

/**
 * Virtual for category title (to use in API responses)
 */
postSchema.virtual('categoryInfo', {
  ref: 'BlogCategory',
  localField: 'category',
  foreignField: '_id',
  justOne: true,
  options: { select: 'title slug' }
});

/**
 * Virtual for comments
 */
postSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'post',
  options: { 
    sort: { createdAt: -1 },
    populate: { path: 'author', select: 'profile.firstName profile.lastName profile.avatarUrl' }
  }
});

/**
 * Pre-save middleware to calculate reading time
 */
postSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Calculate reading time based on content length
    // Average reading speed: 200 words per minute
    const wordCount = this.content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);
    this.readingTime = readingTime || 1; // Minimum 1 minute
  }
  
  // Set published date if status is changed to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

/**
 * Pre-save middleware to generate slug from title if not provided
 */
postSchema.pre('save', function(next) {
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
 * Statics
 */
postSchema.statics.findPublished = function(query = {}) {
  return this.find({
    ...query,
    status: 'published',
    publishedAt: { $lte: new Date() }
  }).sort({ publishedAt: -1 });
};

postSchema.statics.findFeatured = function(limit = 5) {
  return this.find({
    status: 'published',
    featured: true,
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

postSchema.statics.findByCategory = function(categoryId, options = {}) {
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

postSchema.statics.findByTag = function(tag, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    tags: tag,
    status: 'published',
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

postSchema.statics.findByAuthor = function(authorId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    'author.user': authorId,
    status: 'published',
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit);
};

postSchema.statics.search = function(query, options = {}) {
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
postSchema.methods.incrementViews = async function() {
  this.analytics.views += 1;
  return this.save();
};

postSchema.methods.incrementSocialShareCount = async function(platform) {
  this.social.shareCount += 1;
  
  if (platform && this.social.platforms[platform] !== undefined) {
    this.social.platforms[platform] += 1;
  }
  
  return this.save();
};

postSchema.methods.like = async function() {
  this.social.likeCount += 1;
  return this.save();
};

postSchema.methods.unlike = async function() {
  if (this.social.likeCount > 0) {
    this.social.likeCount -= 1;
    return this.save();
  }
  return this;
};

const BlogPost = mongoose.model('BlogPost', postSchema);

module.exports = BlogPost;