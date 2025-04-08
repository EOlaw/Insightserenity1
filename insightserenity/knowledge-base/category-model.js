/**
 * @file Knowledge Category Model
 * @description Model for knowledge base categories
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Knowledge Category Schema
 * Represents a category for knowledge base articles
 */
const categorySchema = new Schema({
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
    maxlength: 500
  },
  icon: {
    type: String // Icon class or code
  },
  color: {
    type: String, // Hex color code
    default: '#3B82F6' // Default to blue
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'KnowledgeCategory',
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  visibility: {
    type: String,
    enum: ['public', 'clients', 'consultants', 'internal'],
    default: 'public'
  },
  featuredArticles: [{
    type: Schema.Types.ObjectId,
    ref: 'KnowledgeArticle'
  }],
  showInNavigation: {
    type: Boolean,
    default: true
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String]
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
// categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ order: 1 });
categorySchema.index({ visibility: 1 });
categorySchema.index({ showInNavigation: 1 });

/**
 * Virtual for category URL
 */
categorySchema.virtual('url').get(function() {
  return `/knowledge-base/category/${this.slug}`;
});

/**
 * Virtual for subcategories
 */
categorySchema.virtual('subcategories', {
  ref: 'KnowledgeCategory',
  localField: '_id',
  foreignField: 'parent',
  options: { sort: { order: 1 } }
});

/**
 * Virtual for articles count
 */
categorySchema.virtual('articlesCount', {
  ref: 'KnowledgeArticle',
  localField: '_id',
  foreignField: 'category',
  count: true
});

/**
 * Pre-save middleware to generate slug from title if not provided
 */
categorySchema.pre('save', function(next) {
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
categorySchema.statics.findActiveCategories = function(visibility = 'public') {
  return this.find({ 
    status: 'active',
    visibility
  }).sort({ order: 1 });
};

categorySchema.statics.findRootCategories = function(visibility = 'public') {
  return this.find({ 
    parent: null, 
    status: 'active',
    visibility
  }).sort({ order: 1 });
};

categorySchema.statics.findWithSubcategories = function(visibility = 'public') {
  return this.find({ 
    parent: null, 
    status: 'active',
    visibility
  })
    .sort({ order: 1 })
    .populate({ 
      path: 'subcategories', 
      match: { status: 'active', visibility },
      options: { sort: { order: 1 } }
    });
};

categorySchema.statics.findWithArticleCounts = function(visibility = 'public') {
  return this.find({ 
    status: 'active',
    visibility
  })
    .sort({ order: 1 })
    .populate({
      path: 'articlesCount'
    });
};

categorySchema.statics.findNavigationCategories = function() {
  return this.find({
    status: 'active',
    showInNavigation: true
  }).sort({ order: 1 });
};

/**
 * Methods
 */
categorySchema.methods.getFullHierarchy = async function() {
  if (!this.parent) {
    return [this];
  }
  
  const parentCategory = await this.model('KnowledgeCategory').findById(this.parent);
  if (!parentCategory) {
    return [this];
  }
  
  const parentHierarchy = await parentCategory.getFullHierarchy();
  return [...parentHierarchy, this];
};

const KnowledgeCategory = mongoose.model('KnowledgeCategory', categorySchema);

module.exports = KnowledgeCategory;