/**
 * @file Blog Category Model
 * @description Model for blog post categories
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Blog Category Schema
 * Represents a category for blog posts
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
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'BlogCategory',
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  featuredImage: {
    type: String // URL to image
  },
  icon: {
    type: String // Icon class or code
  },
  seo: {
    title: { type: String },
    description: { type: String },
    keywords: [String]
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  metaData: {
    type: Map,
    of: String
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
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

/**
 * Virtual for category URL
 */
categorySchema.virtual('url').get(function() {
  return `/blog/category/${this.slug}`;
});

/**
 * Virtual for subcategories
 */
categorySchema.virtual('subcategories', {
  ref: 'BlogCategory',
  localField: '_id',
  foreignField: 'parent',
  options: { sort: { order: 1 } }
});

/**
 * Virtual for posts count
 */
categorySchema.virtual('postsCount', {
  ref: 'BlogPost',
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
categorySchema.statics.findActiveCategories = function() {
  return this.find({ status: 'active' }).sort({ order: 1 });
};

categorySchema.statics.findRootCategories = function() {
  return this.find({ parent: null, status: 'active' }).sort({ order: 1 });
};

categorySchema.statics.findWithSubcategories = function() {
  return this.find({ parent: null, status: 'active' })
    .sort({ order: 1 })
    .populate({ 
      path: 'subcategories', 
      match: { status: 'active' },
      options: { sort: { order: 1 } }
    });
};

categorySchema.statics.findWithPostCounts = function() {
  return this.find({ status: 'active' })
    .sort({ order: 1 })
    .populate({
      path: 'postsCount'
    });
};

/**
 * Methods
 */
categorySchema.methods.getFullHierarchy = async function() {
  if (!this.parent) {
    return [this];
  }
  
  const parentCategory = await this.model('BlogCategory').findById(this.parent);
  if (!parentCategory) {
    return [this];
  }
  
  const parentHierarchy = await parentCategory.getFullHierarchy();
  return [...parentHierarchy, this];
};

const BlogCategory = mongoose.model('BlogCategory', categorySchema);

module.exports = BlogCategory;