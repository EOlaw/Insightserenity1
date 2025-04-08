/**
 * @file Member Model
 * @description Model for team membership and roles
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Team Member Schema
 * Represents a consultant's membership in a team
 */
const memberSchema = new Schema({
  team: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'lead', 'senior', 'member', 'guest'],
    default: 'member'
  },
  title: {
    type: String,
    trim: true
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  invitedAt: {
    type: Date
  },
  joinedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'rejected', 'left'],
    default: 'pending'
  },
  permissions: {
    canInviteMembers: { type: Boolean, default: false },
    canRemoveMembers: { type: Boolean, default: false },
    canEditTeamProfile: { type: Boolean, default: false },
    canCreateProjects: { type: Boolean, default: false },
    canAssignTasks: { type: Boolean, default: false },
    canAccessFinancials: { type: Boolean, default: false }
  },
  expertise: {
    skills: [String],
    experienceLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'expert'],
      default: 'intermediate'
    }
  },
  availability: {
    hoursPerWeek: { type: Number, default: 20 },
    status: {
      type: String, 
      enum: ['available', 'limited', 'unavailable'],
      default: 'available'
    },
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    timezone: { type: String, default: 'UTC' }
  },
  projects: [{
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project'
    },
    role: { type: String },
    hoursAllocated: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date }
  }],
  compensation: {
    type: {
      type: String,
      enum: ['hourly', 'fixed', 'percentage', 'other'],
      default: 'hourly'
    },
    rate: { type: Number },
    currency: { type: String, default: 'USD' },
    percentageShare: { type: Number }, // For percentage-based compensation
    paymentTerms: { type: String }
  },
  preferences: {
    notifyOnProjectAssignments: { type: Boolean, default: true },
    notifyOnTeamUpdates: { type: Boolean, default: true },
    showProfilePublicly: { type: Boolean, default: true },
    autoAcceptProjectAssignments: { type: Boolean, default: false },
    preferredContactMethod: {
      type: String,
      enum: ['email', 'app', 'phone'],
      default: 'app'
    }
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  performance: {
    projectsCompleted: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    hoursLogged: { type: Number, default: 0 },
    revenueGenerated: { type: Number, default: 0 }
  },
  lastActive: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
memberSchema.index({ team: 1, user: 1 }, { unique: true });
memberSchema.index({ user: 1 });
memberSchema.index({ status: 1 });
memberSchema.index({ role: 1 });
memberSchema.index({ 'availability.status': 1 });

/**
 * Pre-save middleware to set joined date
 */
memberSchema.pre('save', function(next) {
  // Set joinedAt date when status changes to active
  if (this.isModified('status') && this.status === 'active' && !this.joinedAt) {
    this.joinedAt = new Date();
  }
  
  // Set default role-based permissions
  if (this.isModified('role')) {
    switch (this.role) {
      case 'admin':
        this.permissions = {
          canInviteMembers: true,
          canRemoveMembers: true,
          canEditTeamProfile: true,
          canCreateProjects: true,
          canAssignTasks: true,
          canAccessFinancials: true
        };
        break;
      case 'lead':
        this.permissions = {
          canInviteMembers: true,
          canRemoveMembers: false,
          canEditTeamProfile: true,
          canCreateProjects: true,
          canAssignTasks: true,
          canAccessFinancials: true
        };
        break;
      case 'senior':
        this.permissions = {
          canInviteMembers: true,
          canRemoveMembers: false,
          canEditTeamProfile: false,
          canCreateProjects: true,
          canAssignTasks: true,
          canAccessFinancials: false
        };
        break;
      case 'member':
        this.permissions = {
          canInviteMembers: false,
          canRemoveMembers: false,
          canEditTeamProfile: false,
          canCreateProjects: false,
          canAssignTasks: false,
          canAccessFinancials: false
        };
        break;
      case 'guest':
        this.permissions = {
          canInviteMembers: false,
          canRemoveMembers: false,
          canEditTeamProfile: false,
          canCreateProjects: false,
          canAssignTasks: false,
          canAccessFinancials: false
        };
        break;
    }
  }
  
  next();
});

/**
 * Virtual for user profile info
 */
memberSchema.virtual('userProfile', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true,
  options: { 
    select: 'profile.firstName profile.lastName profile.avatarUrl email'
  }
});

/**
 * Virtual for consultant profile info
 */
memberSchema.virtual('consultantProfile', {
  ref: 'Consultant',
  localField: 'user',
  foreignField: 'user',
  justOne: true,
  options: { 
    select: 'professional.title professional.summary expertise.skills'
  }
});

/**
 * Static method to find team members
 */
memberSchema.statics.findTeamMembers = function(teamId, options = {}) {
  const { status = 'active', role, sortField = 'role', sortOrder = 'asc' } = options;
  const query = { team: teamId };
  
  if (status) {
    query.status = status;
  }
  
  if (role) {
    query.role = role;
  }
  
  const sort = {};
  sort[sortField] = sortOrder === 'asc' ? 1 : -1;
  
  return this.find(query)
    .sort(sort)
    .populate('user', 'profile.firstName profile.lastName profile.avatarUrl email')
    .populate('consultantProfile');
};

/**
 * Static method to find user's teams
 */
memberSchema.statics.findUserTeams = function(userId, options = {}) {
  const { status = 'active', role } = options;
  const query = { user: userId };
  
  if (status) {
    query.status = status;
  }
  
  if (role) {
    query.role = role;
  }
  
  return this.find(query)
    .populate({
      path: 'team',
      match: { status: 'active' },
      select: 'name slug description avatar specialty industries'
    });
};

/**
 * Method to accept team invitation
 */
memberSchema.methods.acceptInvitation = async function() {
  this.status = 'active';
  this.joinedAt = new Date();
  return this.save();
};

/**
 * Method to reject team invitation
 */
memberSchema.methods.rejectInvitation = async function() {
  this.status = 'rejected';
  return this.save();
};

/**
 * Method to leave team
 */
memberSchema.methods.leaveTeam = async function(reason) {
  this.status = 'left';
  this.notes = reason || this.notes;
  return this.save();
};

/**
 * Method to update availability
 */
memberSchema.methods.updateAvailability = async function(availabilityData) {
  Object.assign(this.availability, availabilityData);
  this.lastActive = new Date();
  return this.save();
};

/**
 * Method to assign project
 */
memberSchema.methods.assignProject = async function(projectData) {
  // Check if project already assigned
  const existingIndex = this.projects.findIndex(p => 
    p.project.toString() === projectData.project.toString()
  );
  
  if (existingIndex >= 0) {
    // Update existing project assignment
    this.projects[existingIndex] = {
      ...this.projects[existingIndex],
      ...projectData
    };
  } else {
    // Add new project assignment
    this.projects.push(projectData);
  }
  
  return this.save();
};

/**
 * Method to remove project assignment
 */
memberSchema.methods.removeProject = async function(projectId) {
  this.projects = this.projects.filter(p => !p.project.equals(projectId));
  return this.save();
};

/**
 * Method to update performance metrics
 */
memberSchema.methods.updatePerformance = async function() {
  // Logic to calculate performance metrics based on projects
  // This would typically be called by a background job or when projects are completed
  
  return this.save();
};

const TeamMember = mongoose.model('TeamMember', memberSchema);

module.exports = TeamMember;