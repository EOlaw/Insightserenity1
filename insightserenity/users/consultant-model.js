/**
 * @file Consultant Model
 * @description Consultant-specific model extending User functionality
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Consultant Schema
 * Extends the base User model with consultant-specific information
 */
const consultantSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  professional: {
    title: { type: String, trim: true, required: true },
    summary: { 
      type: String, 
      trim: true, 
      required: true,
      maxlength: 2000
    },
    yearsOfExperience: { 
      type: Number, 
      min: 0, 
      max: 70,
      required: true
    },
    education: [{
      institution: { type: String, trim: true },
      degree: { type: String, trim: true },
      field: { type: String, trim: true },
      startYear: Number,
      endYear: Number,
      current: { type: Boolean, default: false }
    }],
    certifications: [{
      name: { type: String, trim: true },
      issuer: { type: String, trim: true },
      year: Number,
      expires: Date,
      credentialId: String,
      credentialUrl: String
    }],
    languages: [{
      language: { type: String, trim: true },
      proficiency: { 
        type: String, 
        enum: ['basic', 'conversational', 'proficient', 'fluent', 'native']
      }
    }]
  },
  expertise: {
    primarySpecialty: {
      type: String,
      enum: [
        'software_development', 'cloud_architecture', 'data_science', 'cybersecurity',
        'project_management', 'ux_design', 'digital_marketing', 'business_strategy',
        'financial_consulting', 'legal_consulting', 'healthcare_consulting', 'education',
        'human_resources', 'sustainability', 'other'
      ],
      required: true
    },
    skills: [{
      name: { type: String, trim: true },
      level: { 
        type: String, 
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'intermediate'
      },
      yearsOfExperience: Number,
      featured: { type: Boolean, default: false }
    }],
    industries: [{
      type: String,
      enum: [
        'technology', 'healthcare', 'finance', 'education', 'retail', 
        'manufacturing', 'media', 'legal', 'real_estate', 'energy',
        'hospitality', 'nonprofit', 'government', 'other'
      ]
    }],
    methodologies: [{
      type: String,
      enum: [
        'agile', 'scrum', 'kanban', 'waterfall', 'lean', 'six_sigma',
        'prince2', 'pmi', 'design_thinking', 'devops', 'other'
      ]
    }]
  },
  workExperience: [{
    company: { type: String, trim: true },
    position: { type: String, trim: true },
    location: { type: String, trim: true },
    startDate: Date,
    endDate: Date,
    current: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 1000 },
    achievements: [String]
  }],
  portfolio: {
    projects: [{
      title: { type: String, trim: true },
      description: { type: String, trim: true, maxlength: 1000 },
      client: { type: String, trim: true },
      year: Number,
      duration: { type: String, trim: true },
      role: { type: String, trim: true },
      technologies: [String],
      outcomes: [String],
      imageUrls: [String],
      demoUrl: { type: String, trim: true },
      caseStudyUrl: { type: String, trim: true },
      featured: { type: Boolean, default: false },
      confidential: { type: Boolean, default: false }
    }],
    publications: [{
      title: { type: String, trim: true },
      publisher: { type: String, trim: true },
      date: Date,
      url: { type: String, trim: true },
      description: { type: String, trim: true, maxlength: 500 }
    }],
    speakingEngagements: [{
      title: { type: String, trim: true },
      event: { type: String, trim: true },
      date: Date,
      location: { type: String, trim: true },
      description: { type: String, trim: true, maxlength: 500 },
      url: { type: String, trim: true }
    }]
  },
  services: {
    offerings: [{
      title: { type: String, trim: true },
      description: { type: String, trim: true, maxlength: 1000 },
      category: { 
        type: String, 
        enum: [
          'development', 'design', 'strategy', 'analysis', 'training',
          'management', 'support', 'implementation', 'audit', 'other'
        ]
      },
      deliverables: [String],
      pricing: {
        model: { 
          type: String, 
          enum: ['hourly', 'fixed', 'retainer', 'value_based']
        },
        startingAt: { type: Number, min: 0 }
      }
    }],
    availability: {
      status: { 
        type: String, 
        enum: ['available', 'limited', 'unavailable'],
        default: 'available'
      },
      hoursPerWeek: { type: Number, min: 0, max: 168, default: 40 },
      nextAvailableDate: Date,
      timezone: { type: String, default: 'UTC' },
      workSchedule: {
        monday: { available: { type: Boolean, default: true }, hours: { type: String, default: '9:00-17:00' } },
        tuesday: { available: { type: Boolean, default: true }, hours: { type: String, default: '9:00-17:00' } },
        wednesday: { available: { type: Boolean, default: true }, hours: { type: String, default: '9:00-17:00' } },
        thursday: { available: { type: Boolean, default: true }, hours: { type: String, default: '9:00-17:00' } },
        friday: { available: { type: Boolean, default: true }, hours: { type: String, default: '9:00-17:00' } },
        saturday: { available: { type: Boolean, default: false }, hours: { type: String, default: '' } },
        sunday: { available: { type: Boolean, default: false }, hours: { type: String, default: '' } }
      }
    },
    rateInfo: {
      hourlyRate: { 
        type: Number, 
        min: 0,
        required: true 
      },
      currency: { 
        type: String, 
        enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'],
        default: 'USD'
      },
      negotiable: { type: Boolean, default: true },
      minimumProjectSize: Number,
      discountOptions: {
        longTerm: { type: Boolean, default: false },
        nonprofit: { type: Boolean, default: false },
        startups: { type: Boolean, default: false }
      }
    }
  },
  reviews: {
    average: { type: Number, min: 0, max: 5, default: 0 },
    count: { type: Number, default: 0 },
    breakdown: {
      communication: { type: Number, min: 0, max: 5, default: 0 },
      expertise: { type: Number, min: 0, max: 5, default: 0 },
      quality: { type: Number, min: 0, max: 5, default: 0 },
      timeliness: { type: Number, min: 0, max: 5, default: 0 },
      value: { type: Number, min: 0, max: 5, default: 0 }
    },
    featured: [{
      client: {
        type: Schema.Types.ObjectId,
        ref: 'Client'
      },
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, trim: true, maxlength: 1000 },
      date: { type: Date, default: Date.now },
      project: { type: String, trim: true },
      response: {
        comment: { type: String, trim: true, maxlength: 500 },
        date: Date
      }
    }]
  },
  metrics: {
    completionRate: { type: Number, min: 0, max: 100, default: 100 },
    responseTime: { type: Number, default: 24 }, // hours
    projectsCompleted: { type: Number, default: 0 },
    onTimeDelivery: { type: Number, min: 0, max: 100, default: 100 },
    onBudgetCompletion: { type: Number, min: 0, max: 100, default: 100 },
    repeatHireRate: { type: Number, min: 0, max: 100, default: 0 },
    averageProjectDuration: { type: Number, default: 0 }, // days
    totalEarned: { type: Number, default: 0 },
    lastActive: Date,
    proposalAcceptanceRate: { type: Number, min: 0, max: 100, default: 0 }
  },
  verifications: {
    identityVerified: { type: Boolean, default: false },
    expertiseVerified: { type: Boolean, default: false },
    backgroundChecked: { type: Boolean, default: false },
    credentialsVerified: { type: Boolean, default: false },
    documents: [{
      type: { 
        type: String, 
        enum: ['id', 'address', 'certification', 'degree', 'other']
      },
      name: { type: String, trim: true },
      fileUrl: { type: String, trim: true },
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      expiresAt: Date
    }]
  },
  settings: {
    profileVisibility: { 
      type: String, 
      enum: ['public', 'private', 'members_only'],
      default: 'public'
    },
    availableForWork: { type: Boolean, default: true },
    autoAcceptRequests: { type: Boolean, default: false },
    notificationPreferences: {
      projectOpportunities: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
      platformUpdates: { type: Boolean, default: true }
    },
    featured: { type: Boolean, default: false }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for performance optimization
 */
// consultantSchema.index({ user: 1 });
consultantSchema.index({ 'expertise.primarySpecialty': 1 });
consultantSchema.index({ 'services.rateInfo.hourlyRate': 1 });
consultantSchema.index({ 'reviews.average': -1 });
consultantSchema.index({ 'expertise.skills.name': 1 });
consultantSchema.index({ 'expertise.industries': 1 });
consultantSchema.index({ 'settings.availableForWork': 1, 'services.availability.status': 1 });

/**
 * Virtuals for computing profile completion percentage
 */
consultantSchema.virtual('profileCompletionPercentage').get(function() {
  let totalFields = 0;
  let completedFields = 0;
  
  // Professional section
  if (this.professional) {
    const professionalFields = ['title', 'summary', 'yearsOfExperience'];
    totalFields += professionalFields.length;
    
    professionalFields.forEach(field => {
      if (this.professional[field]) completedFields++;
    });
    
    if (this.professional.education && this.professional.education.length > 0) completedFields++;
    if (this.professional.certifications && this.professional.certifications.length > 0) completedFields++;
    if (this.professional.languages && this.professional.languages.length > 0) completedFields++;
    
    totalFields += 3; // education, certifications, languages
  }
  
  // Expertise section
  if (this.expertise) {
    totalFields += 4; // primarySpecialty, skills, industries, methodologies
    
    if (this.expertise.primarySpecialty) completedFields++;
    if (this.expertise.skills && this.expertise.skills.length > 0) completedFields++;
    if (this.expertise.industries && this.expertise.industries.length > 0) completedFields++;
    if (this.expertise.methodologies && this.expertise.methodologies.length > 0) completedFields++;
  }
  
  // Work experience section
  if (this.workExperience && this.workExperience.length > 0) {
    totalFields += 1;
    completedFields += 1;
  }
  
  // Portfolio section
  if (this.portfolio) {
    totalFields += 3; // projects, publications, speaking engagements
    
    if (this.portfolio.projects && this.portfolio.projects.length > 0) completedFields++;
    if (this.portfolio.publications && this.portfolio.publications.length > 0) completedFields++;
    if (this.portfolio.speakingEngagements && this.portfolio.speakingEngagements.length > 0) completedFields++;
  }
  
  // Services section
  if (this.services) {
    totalFields += 2; // offerings, rateInfo
    
    if (this.services.offerings && this.services.offerings.length > 0) completedFields++;
    if (this.services.rateInfo && this.services.rateInfo.hourlyRate) completedFields++;
  }
  
  return Math.round((completedFields / totalFields) * 100);
});

/**
 * Method to calculate availability
 */
consultantSchema.methods.getAvailableHours = function() {
  if (!this.services.availability.workSchedule) return 0;
  
  const schedule = this.services.availability.workSchedule;
  let totalHours = 0;
  
  Object.keys(schedule).forEach(day => {
    if (schedule[day].available) {
      const hours = schedule[day].hours;
      if (hours) {
        const [start, end] = hours.split('-');
        if (start && end) {
          const startTime = new Date(`1970-01-01T${start}:00Z`);
          const endTime = new Date(`1970-01-01T${end}:00Z`);
          const diff = (endTime - startTime) / 1000 / 60 / 60;
          if (diff > 0) totalHours += diff;
        }
      }
    }
  });
  
  return totalHours;
};

/**
 * Method to search consultants by skills
 */
consultantSchema.statics.findBySkills = async function(skills, options = {}) {
  const query = {
    'expertise.skills.name': { $in: skills },
    'settings.availableForWork': true,
    'services.availability.status': { $ne: 'unavailable' }
  };
  
  return this.find(query)
    .sort(options.sort || { 'reviews.average': -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 20)
    .populate('user', 'email profile.firstName profile.lastName profile.avatarUrl');
};

/**
 * Method to update consultant metrics
 */
consultantSchema.methods.updateMetrics = async function(metrics) {
  Object.keys(metrics).forEach(key => {
    if (this.metrics.hasOwnProperty(key)) {
      this.metrics[key] = metrics[key];
    }
  });
  
  this.metrics.lastActive = new Date();
  return await this.save();
};

/**
 * Sample consultant data generator for development
 */
consultantSchema.statics.generateSampleData = function() {
  return {
    professional: {
      title: 'Senior Software Architect',
      summary: 'Experienced software architect with 15+ years in designing and implementing scalable cloud solutions. Specialized in distributed systems and microservices architecture. Passionate about solving complex technical challenges and mentoring development teams.',
      yearsOfExperience: 15,
      education: [
        {
          institution: 'Massachusetts Institute of Technology',
          degree: 'Master of Science',
          field: 'Computer Science',
          startYear: 2005,
          endYear: 2007,
          current: false
        },
        {
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science',
          field: 'Computer Engineering',
          startYear: 2001,
          endYear: 2005,
          current: false
        }
      ],
      certifications: [
        {
          name: 'AWS Certified Solutions Architect - Professional',
          issuer: 'Amazon Web Services',
          year: 2020,
          credentialId: 'AWS-PSA-123456',
          credentialUrl: 'https://aws.amazon.com/verification'
        },
        {
          name: 'Google Cloud Professional Architect',
          issuer: 'Google',
          year: 2019,
          credentialId: 'GCP-PA-789012',
          credentialUrl: 'https://cloud.google.com/certification/cloud-architect'
        }
      ],
      languages: [
        {
          language: 'English',
          proficiency: 'native'
        },
        {
          language: 'Spanish',
          proficiency: 'proficient'
        }
      ]
    },
    expertise: {
      primarySpecialty: 'cloud_architecture',
      skills: [
        {
          name: 'AWS',
          level: 'expert',
          yearsOfExperience: 10,
          featured: true
        },
        {
          name: 'Microservices',
          level: 'expert',
          yearsOfExperience: 8,
          featured: true
        },
        {
          name: 'Node.js',
          level: 'advanced',
          yearsOfExperience: 7,
          featured: false
        },
        {
          name: 'React',
          level: 'advanced',
          yearsOfExperience: 6,
          featured: false
        },
        {
          name: 'Kubernetes',
          level: 'expert',
          yearsOfExperience: 5,
          featured: true
        }
      ],
      industries: ['technology', 'finance', 'healthcare'],
      methodologies: ['agile', 'scrum', 'devops']
    },
    workExperience: [
      {
        company: 'TechInnovate Solutions',
        position: 'Lead Cloud Architect',
        location: 'San Francisco, CA',
        startDate: new Date('2018-06-01'),
        endDate: null,
        current: true,
        description: 'Leading cloud architecture initiatives for enterprise clients across multiple industries. Designing and implementing scalable, secure, and cost-effective cloud solutions.',
        achievements: [
          'Reduced infrastructure costs by 35% through cloud optimization',
          'Implemented CI/CD pipeline reducing deployment time by 70%',
          'Designed microservices architecture supporting 10M+ daily users'
        ]
      },
      {
        company: 'Global Financial Tech',
        position: 'Senior Software Engineer',
        location: 'New York, NY',
        startDate: new Date('2014-03-01'),
        endDate: new Date('2018-05-30'),
        current: false,
        description: 'Developed high-frequency trading platforms and real-time financial data processing systems.',
        achievements: [
          'Built real-time data processing system handling 50,000 transactions per second',
          'Led team of 8 engineers in modernizing legacy systems',
          'Implemented fault-tolerant architecture with 99.99% uptime'
        ]
      }
    ],
    portfolio: {
      projects: [
        {
          title: 'Enterprise Cloud Migration',
          description: 'Led the migration of a Fortune 500 company"s infrastructure to AWS, including 200+ applications and services.',
          client: 'Major Retail Corporation',
          year: 2021,
          duration: '18 months',
          role: 'Lead Architect',
          technologies: ['AWS', 'Terraform', 'Docker', 'Kubernetes', 'CI/CD'],
          outcomes: [
            '40% reduction in operational costs',
            '99.99% system availability',
            'Enhanced security posture',
            'Improved developer productivity'
          ],
          featured: true,
          confidential: false
        },
        {
          title: 'Microservices Transformation',
          description: 'Redesigned monolithic application into microservices architecture for a healthcare provider.',
          client: 'Healthcare Solutions Inc.',
          year: 2020,
          duration: '12 months',
          role: 'Solution Architect',
          technologies: ['Kubernetes', 'Node.js', 'MongoDB', 'RabbitMQ', 'Docker'],
          outcomes: [
            'Increased deployment frequency from monthly to daily',
            'Reduced system downtime by 90%',
            'Enabled independent scaling of components'
          ],
          featured: true,
          confidential: false
        }
      ],
      publications: [
        {
          title: 'Designing Resilient Microservices',
          publisher: 'Cloud Architecture Journal',
          date: new Date('2022-03-15'),
          url: 'https://example.com/publications/resilient-microservices',
          description: 'In-depth exploration of patterns for creating fault-tolerant distributed systems.'
        }
      ],
      speakingEngagements: [
        {
          title: 'Cloud-Native Architecture: Lessons from the Field',
          event: 'Cloud Computing Conference 2022',
          date: new Date('2022-09-25'),
          location: 'Seattle, WA',
          description: 'Keynote presentation on real-world experiences implementing cloud-native solutions',
          url: 'https://example.com/conferences/cloud-2022'
        }
      ]
    },
    services: {
      offerings: [
        {
          title: 'Cloud Architecture Design & Implementation',
          description: 'Comprehensive cloud architecture services including assessment, design, implementation, and optimization.',
          category: 'strategy',
          deliverables: [
            'Cloud readiness assessment',
            'Architecture design documentation',
            'Implementation roadmap',
            'Cost optimization analysis'
          ],
          pricing: {
            model: 'fixed',
            startingAt: 10000
          }
        },
        {
          title: 'Microservices Transformation',
          description: 'Convert legacy monolithic applications to modern microservices architecture.',
          category: 'implementation',
          deliverables: [
            'Current state analysis',
            'Domain-driven design workshop',
            'Microservices architecture blueprint',
            'Implementation plan',
            'Knowledge transfer'
          ],
          pricing: {
            model: 'fixed',
            startingAt: 25000
          }
        }
      ],
      availability: {
        status: 'limited',
        hoursPerWeek: 30,
        nextAvailableDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        timezone: 'America/Los_Angeles',
        workSchedule: {
          monday: { available: true, hours: '9:00-17:00' },
          tuesday: { available: true, hours: '9:00-17:00' },
          wednesday: { available: true, hours: '9:00-17:00' },
          thursday: { available: true, hours: '9:00-17:00' },
          friday: { available: true, hours: '9:00-13:00' },
          saturday: { available: false, hours: '' },
          sunday: { available: false, hours: '' }
        }
      },
      rateInfo: {
        hourlyRate: 180,
        currency: 'USD',
        negotiable: true,
        minimumProjectSize: 5000,
        discountOptions: {
          longTerm: true,
          nonprofit: true,
          startups: false
        }
      }
    },
    reviews: {
      average: 4.8,
      count: 23,
      breakdown: {
        communication: 4.7,
        expertise: 4.9,
        quality: 4.8,
        timeliness: 4.6,
        value: 4.5
      },
      featured: [
        {
          rating: 5,
          comment: 'An exceptional consultant who delivered beyond our expectations. The cloud migration was smooth and we"ve seen significant improvements in performance and reliability.',
          date: new Date('2022-04-15'),
          project: 'Enterprise Cloud Migration',
          response: {
            comment: 'Thank you for the kind words! It was a pleasure working with your team.',
            date: new Date('2022-04-17')
          }
        }
      ]
    },
    metrics: {
      completionRate: 100,
      responseTime: 4, // hours
      projectsCompleted: 37,
      onTimeDelivery: 95,
      onBudgetCompletion: 97,
      repeatHireRate: 65,
      averageProjectDuration: 120, // days
      totalEarned: 875000,
      lastActive: new Date(),
      proposalAcceptanceRate: 72
    },
    verifications: {
      identityVerified: true,
      expertiseVerified: true,
      backgroundChecked: true,
      credentialsVerified: true
    },
    settings: {
      profileVisibility: 'public',
      availableForWork: true,
      autoAcceptRequests: false,
      notificationPreferences: {
        projectOpportunities: true,
        messages: true,
        reviews: true,
        platformUpdates: true
      },
      featured: true
    }
  };
};

const Consultant = mongoose.model('Consultant', consultantSchema);

module.exports = Consultant;