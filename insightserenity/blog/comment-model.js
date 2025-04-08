/**
 * @file Comment Model
 * @description Model for blog post comments
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Comment Schema
 * Represents a comment on a blog post
 */
const commentSchema = new Schema({
  post: {
    type: Schema.Types.ObjectId,
    ref: 'BlogPost',
    required: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  guestAuthor: {
    name: { type: String },
    email: { type: String },
    website: { type: String }
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'spam', 'rejected'],
    default: 'pending'
  },
  isAuthor: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  notifications: {
    subscribed: { type: Boolean, default: false }
  },
  likes: {
    count: { type: Number, default: 0 },
    users: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  reports: {
    count: { type: Number, default: 0 },
    users: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    reasons: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
commentSchema.index({ post: 1 });
commentSchema.index({ parent: 1 });
commentSchema.index({ status: 1 });
commentSchema.index({ createdAt: -1 });
commentSchema.index({ 'author': 1 });
commentSchema.index({ 'guestAuthor.email': 1 });

/**
 * Virtual for replies
 */
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parent',
  options: { sort: { createdAt: 1 } }
});

/**
 * Pre-save middleware to set author flags
 */
commentSchema.pre('save', async function(next) {
  if (this.isNew && this.author) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(this.author);
      
      if (user) {
        const BlogPost = mongoose.model('BlogPost');
        const post = await BlogPost.findById(this.post);
        
        // Check if commenter is the post author
        if (post && user._id.equals(post.author.user)) {
          this.isAuthor = true;
        }
        
        // Check if commenter is an admin
        if (user.role === 'admin') {
          this.isAdmin = true;
        }
      }
    } catch (error) {
      // Just continue if there's an error checking author status
      console.error('Error checking comment author status:', error);
    }
  }
  
  next();
});

/**
 * Statics
 */
commentSchema.statics.findByPost = function(postId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    post: postId,
    parent: null, // Only top-level comments
    status: 'approved'
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'profile.firstName profile.lastName profile.avatarUrl')
    .populate({
      path: 'replies',
      match: { status: 'approved' },
      options: { sort: { createdAt: 1 } },
      populate: {
        path: 'author',
        select: 'profile.firstName profile.lastName profile.avatarUrl'
      }
    });
};

commentSchema.statics.findPendingComments = function(options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('post', 'title slug')
    .populate('author', 'profile.firstName profile.lastName email');
};

commentSchema.statics.countPendingComments = function() {
  return this.countDocuments({ status: 'pending' });
};

commentSchema.statics.countCommentsByPost = function(postId) {
  return this.countDocuments({ post: postId, status: 'approved' });
};

/**
 * Methods
 */
commentSchema.methods.approve = async function() {
  this.status = 'approved';
  return this.save();
};

commentSchema.methods.reject = async function() {
  this.status = 'rejected';
  return this.save();
};

commentSchema.methods.markAsSpam = async function() {
  this.status = 'spam';
  return this.save();
};

commentSchema.methods.like = async function(userId) {
  if (!this.likes.users.includes(userId)) {
    this.likes.users.push(userId);
    this.likes.count = this.likes.users.length;
    return this.save();
  }
  return this;
};

commentSchema.methods.unlike = async function(userId) {
  const index = this.likes.users.indexOf(userId);
  if (index > -1) {
    this.likes.users.splice(index, 1);
    this.likes.count = this.likes.users.length;
    return this.save();
  }
  return this;
};

commentSchema.methods.report = async function(userId, reason) {
  if (!this.reports.users.includes(userId)) {
    this.reports.users.push(userId);
    if (reason) {
      this.reports.reasons.push(reason);
    }
    this.reports.count = this.reports.users.length;
    return this.save();
  }
  return this;
};

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;