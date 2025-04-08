/**
 * @file Team Model
 * @description Model for consultant teams and collaboration groups
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Team Schema
 * Represents a team of consultants that work together on projects
 */
const teamSchema = new Schema({
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
    type: String,
    required: true,
    maxlength: 1000
  },
  shortDescription: {
    type: String,
    maxlength: 200
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'organization'],
    default: 'private'
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  avatar: {
    type: String // URL to team avatar
  },
  coverImage: {
    type: String // URL to team cover image
  },
  specialty: {
    primary: {
      type: String,
      enum: [
        'software_development', 'cloud_architecture', 'data_science', 'cybersecurity',
        'project_management', 'ux_design', 'digital_marketing', 'business_strategy',
        'financial_consulting', 'legal_consulting', 'healthcare_consulting', 'education',
        'human_resources', 'sustainability', 'other'
      ]
    },
    secondary: [String]
  },
  industries: [{
    type: String,
    enum: [
      'technology', 'healthcare', 'finance', 'education', 'retail', 
      'manufacturing', 'media', 'legal', 'real_estate', 'energy',
      'hospitality', 'nonprofit', 'government', 'transportation', 'other'
    ]
  }],
  skills: [String],
  formation: {
    type: Date,
    default: Date.now
  },
  capacity: {
    maxMembers: {
      type: Number,
      default: 10
    },
    currentAvailability: {
      type: String,
      enum: ['available', 'limited', 'unavailable'],
      default: 'available'
    },
    availableHoursPerWeek: {
      type: Number,
      default: 40
    }
  },
  contact: {
    email: { type: String },
    phone: { type: String },
    website: { type: String }
  },
  socialMedia: {
    linkedin: { type: String },
    twitter: { type: String },
    github: { type: String }
  },
  services: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  projects: [{
    type: Schema.Types.ObjectId,
    ref: 'Project'
  }],
  caseStudies: [{
    type: Schema.Types.ObjectId,
    ref: 'CaseStudy'
  }],
  analytics: {
    totalProjects: { type: Number, default: 0 },
    activeProjects: { type: Number, default: 0 },
    completedProjects: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 }
  },
  settings: {
    autoAcceptMemberRequests: { type: Boolean, default: false },
    requiresApprovalForLeaving: { type: Boolean, default: false },
    defaultMemberRole: {
      type: String,
      enum: ['member', 'senior', 'lead'],
      default: 'member'
    },
    defaultVisibilityForNewProjects: {
      type: String,
      enum: ['public', 'team', 'client'],
      default: 'team'
    },
    notificationPreferences: {
      newMemberRequests: { type: Boolean, default: true },
      newProjectAssignments: { type: Boolean, default: true },
      memberUpdates: { type: Boolean, default: true }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
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
// teamSchema.index({ slug: 1 });
teamSchema.index({ owner: 1 });
teamSchema.index({ status: 1 });
teamSchema.index({ visibility: 1 });
teamSchema.index({ organization: 1 });
teamSchema.index({ 'specialty.primary': 1 });
teamSchema.index({ industries: 1 });

/**
 * Pre-save middleware to generate slug from name if not provided
 */
teamSchema.pre('save', function(next) {
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
 * Virtual for members
 */
teamSchema.virtual('members', {
  ref: 'TeamMember',
  localField: '_id',
  foreignField: 'team'
});

/**
 * Virtual for member count
 */
teamSchema.virtual('memberCount', {
  ref: 'TeamMember',
  localField: '_id',
  foreignField: 'team',
  count: true
});

/**
 * Virtual for URL
 */
teamSchema.virtual('url').get(function() {
  return `/teams/${this.slug}`;
});

/**
 * Static method to find available teams
 */
teamSchema.statics.findAvailableTeams = function(options = {}) {
  const { page = 1, limit = 10, sortField = 'name', sortOrder = 'asc' } = options;
  const skip = (page - 1) * limit;
  const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

  return this.find({
    status: 'active',
    visibility: 'public',
    'capacity.currentAvailability': { $ne: 'unavailable' }
  })
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

/**
 * Method to check if a user is a member of the team
 */
teamSchema.methods.isMember = async function(userId) {
  const TeamMember = mongoose.model('TeamMember');
  const member = await TeamMember.findOne({
    team: this._id,
    user: userId,
    status: { $in: ['active', 'pending'] }
  });
  
  return !!member;
};

/**
 * Method to get a member's role in the team
 */
teamSchema.methods.getMemberRole = async function(userId) {
  const TeamMember = mongoose.model('TeamMember');
  const member = await TeamMember.findOne({
    team: this._id,
    user: userId,
    status: 'active'
  });
  
  return member ? member.role : null;
};

/**
 * Method to check if a user is a team admin
 */
teamSchema.methods.isTeamAdmin = async function(userId) {
  // Team owner is automatically an admin
  if (this.owner.equals(userId)) {
    return true;
  }
  
  const TeamMember = mongoose.model('TeamMember');
  const member = await TeamMember.findOne({
    team: this._id,
    user: userId,
    status: 'active',
    role: { $in: ['admin', 'lead'] }
  });
  
  return !!member;
};

/**
 * Method to update analytics
 */
teamSchema.methods.updateAnalytics = async function() {
  const Project = mongoose.model('Project');
  
  // Update project counts
  const projectCounts = await Project.aggregate([
    { $match: { team: this._id } },
    { $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$billingInfo.totalAmount' }
      }
    }
  ]);
  
  let totalProjects = 0;
  let activeProjects = 0;
  let completedProjects = 0;
  let totalRevenue = 0;
  
  projectCounts.forEach(result => {
    if (result._id === 'active' || result._id === 'in_progress') {
      activeProjects += result.count;
    } else if (result._id === 'completed') {
      completedProjects += result.count;
    }
    
    totalProjects += result.count;
    totalRevenue += result.revenue || 0;
  });
  
  this.analytics.totalProjects = totalProjects;
  this.analytics.activeProjects = activeProjects;
  this.analytics.completedProjects = completedProjects;
  this.analytics.totalRevenue = totalRevenue;
  
  // Update average rating if there's a Review model
  try {
    const Review = mongoose.model('Review');
    const ratings = await Review.aggregate([
      { $match: { teamId: this._id } },
      { $group: {
          _id: null,
          averageRating: { $avg: '$rating' }
        }
      }
    ]);
    
    if (ratings.length > 0) {
      this.analytics.averageRating = ratings[0].averageRating;
    }
  } catch (error) {
    // Ignore if Review model doesn't exist
  }
  
  return this.save();
};

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;