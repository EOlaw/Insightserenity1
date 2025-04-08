/**
 * @file Authentication Service
 * @description Core authentication service providing authentication, verification and password management
 */

const User = require('../users/user-model');
const Client = require('../users/client-model');
const Consultant = require('../users/consultant-model');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const emailService = require('../infrastructure/email/email-service');
const config = require('../config');
const logger = require('../utils/logger')

/**
 * Authentication Service
 * Handles all authentication-related operations
 */
class AuthService {
  /**
   * Generate a secure verification token
   * @returns {string} A hex-encoded random token
   */
  static generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a JWT token for user authentication
   * @param {Object} user - User object
   * @param {string} tokenType - Type of token (access, refresh)
   * @param {Object} options - Additional options
   * @returns {string} JWT token
   */
  static generateToken(user, tokenType = 'access', options = {}) {
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      type: tokenType
    };

    // Add additional claims based on token type
    if (tokenType === 'access') {
      payload.permissions = options.permissions || [];
      payload.scope = options.scope || 'read:profile';
    }

    const secret = tokenType === 'refresh' 
      ? config.auth.refreshTokenSecret 
      : config.auth.accessTokenSecret;
      
    const expiresIn = tokenType === 'refresh'
      ? config.auth.refreshTokenExpiry
      : config.auth.accessTokenExpiry;

    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * Verify a JWT token
   * @param {string} token - JWT token to verify
   * @param {string} tokenType - Type of token (access, refresh)
   * @returns {Object} Decoded token payload
   * @throws {Error} If token is invalid
   */
  static verifyToken(token, tokenType = 'access') {
    const secret = tokenType === 'refresh' 
      ? config.auth.refreshTokenSecret 
      : config.auth.accessTokenSecret;
    
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new Error(`Invalid ${tokenType} token: ${error.message}`);
    }
  }

  /**
   * Register a new client user
   * @param {Object} userData - User registration data
   * @returns {Object} Created user and client
   */
  static async registerClient(userData) {
    // Validate user data
    if (!userData.email || !userData.password) {
      throw new Error('Email and password are required');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('Email is already registered');
    }

    try {
      // Create new user
      const newUser = new User({
        email: userData.email,
        role: 'client',
        profile: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber,
          dateOfBirth: userData.dateOfBirth,
          bio: userData.bio,
          location: userData.location,
          avatarUrl: userData.avatarUrl,
          socialMedia: userData.socialMedia
        },
        preferences: userData.preferences || {
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: true,
            sms: false,
            browser: true
          }
        },
        security: {
          accountStatus: 'pending',
          emailVerified: false
        }
      });

      // Generate verification token
      const verificationToken = newUser.generateVerificationToken();

      // Register the user with password
      await User.register(newUser, userData.password);

      // Create associated client profile
      const newClient = new Client({
        user: newUser._id,
        company: userData.company,
        billing: userData.billing,
        clientProfile: userData.clientProfile,
        settings: userData.settings
      });

      await newClient.save();

      /*
      // Send verification email
      await emailService.sendVerificationEmail(
        newUser.email,
        newUser.profile.firstName,
        verificationToken
      );
      */

      // Try to send verification email but don't fail if it errors
        try {
            await emailService.sendVerificationEmail(
                newUser.email,
                newUser.profile.firstName,
                verificationToken
            );
            } catch (emailError) {
            // Log the error but don't fail the registration
            logger.error('Failed to send verification email', {
                service: "AuthSystem",
                environment: process.env.NODE_ENV,
                userEmail: newUser.email,
                errorDetails: emailError
            });
        }

      return {
        user: newUser,
        client: newClient,
        verificationToken
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Register or fetch consultant from API
   * @param {Object} userData - Consultant registration data or API credentials
   * @param {boolean} useApi - Whether to use API for consultant data
   * @returns {Object} Consultant user and profile
   */
  static async registerOrFetchConsultant(userData, useApi = false) {
    if (useApi) {
      // Fetch consultant from external API
      return await this.fetchConsultantFromApi(userData.apiKey, userData.consultantId);
    } else {
      // Register new consultant directly
      return await this.registerConsultant(userData);
    }
  }

  /**
   * Register a new consultant user
   * @param {Object} userData - Consultant registration data
   * @returns {Object} Created user and consultant
   */
  static async registerConsultant(userData) {
    // Validate user data
    if (!userData.email || !userData.password) {
      throw new Error('Email and password are required');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('Email is already registered');
    }

    try {
      // Create new user
      const newUser = new User({
        email: userData.email,
        role: 'consultant',
        profile: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber,
          dateOfBirth: userData.dateOfBirth,
          bio: userData.bio,
          location: userData.location,
          avatarUrl: userData.avatarUrl,
          socialMedia: userData.socialMedia
        },
        preferences: userData.preferences || {
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: true,
            sms: false,
            browser: true
          }
        },
        security: {
          accountStatus: 'pending',
          emailVerified: false
        }
      });

      // Generate verification token
      const verificationToken = newUser.generateVerificationToken();

      // Register the user with password
      await User.register(newUser, userData.password);

      // Create consultant profile from sample data first, then override with provided data
      const sampleData = Consultant.generateSampleData();
      
      const newConsultant = new Consultant({
        user: newUser._id,
        professional: userData.professional || sampleData.professional,
        expertise: userData.expertise || sampleData.expertise,
        workExperience: userData.workExperience || sampleData.workExperience,
        portfolio: userData.portfolio || sampleData.portfolio,
        services: userData.services || sampleData.services,
        reviews: {
          average: 0,
          count: 0,
          breakdown: {
            communication: 0,
            expertise: 0,
            quality: 0,
            timeliness: 0,
            value: 0
          },
          featured: []
        },
        metrics: {
          completionRate: 100,
          responseTime: 24,
          projectsCompleted: 0,
          onTimeDelivery: 100,
          onBudgetCompletion: 100,
          repeatHireRate: 0,
          averageProjectDuration: 0,
          totalEarned: 0,
          lastActive: new Date(),
          proposalAcceptanceRate: 0
        },
        verifications: {
          identityVerified: false,
          expertiseVerified: false,
          backgroundChecked: false,
          credentialsVerified: false
        },
        settings: userData.settings || sampleData.settings
      });

      await newConsultant.save();

      /*
      // Send verification email
      await emailService.sendVerificationEmail(
        newUser.email,
        newUser.profile.firstName,
        verificationToken
      );
      */

        // Try to send verification email but don't fail if it errors
        try {
            await emailService.sendVerificationEmail(
                newUser.email,
                newUser.profile.firstName,
                verificationToken
            );
            } catch (emailError) {
            // Log the error but don't fail the registration
            logger.error('Failed to send verification email', {
                service: "AuthSystem",
                environment: process.env.NODE_ENV,
                userEmail: newUser.email,
                errorDetails: emailError
            });
        }

      return {
        user: newUser,
        consultant: newConsultant,
        verificationToken
      };
    } catch (error) {
      throw new Error(`Consultant registration failed: ${error.message}`);
    }
  }

  /**
   * Fetch consultant data from external API
   * @param {string} apiKey - API authentication key
   * @param {string} consultantId - Consultant ID to fetch
   * @returns {Object} Fetched consultant data and created user
   */
  static async fetchConsultantFromApi(apiKey, consultantId) {
    try {
      // API request to fetch consultant data
      const response = await axios.get(
        `${config.consultantApi.baseUrl}/consultants/${consultantId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data || response.status !== 200) {
        throw new Error('Failed to fetch consultant data from API');
      }

      const consultantData = response.data;

      // Check if user already exists
      let existingUser = await User.findOne({ email: consultantData.email });
      let existingConsultant;
      
      if (existingUser) {
        // Check if there's already a consultant profile
        existingConsultant = await Consultant.findOne({ user: existingUser._id });
        
        if (existingConsultant) {
          // Update existing consultant data
          Object.assign(existingConsultant, this.mapApiDataToConsultantModel(consultantData));
          await existingConsultant.save();
          
          return {
            user: existingUser,
            consultant: existingConsultant,
            isNew: false
          };
        }
      } else {
        // Create new user for consultant
        existingUser = new User({
          email: consultantData.email,
          role: 'consultant',
          profile: {
            firstName: consultantData.firstName,
            lastName: consultantData.lastName,
            phoneNumber: consultantData.phone,
            bio: consultantData.bio,
            avatarUrl: consultantData.profileImage
          },
          security: {
            accountStatus: 'active', // Auto-activate API-imported consultants
            emailVerified: true
          }
        });

        // Generate random password - they'll need to reset it
        const randomPassword = crypto.randomBytes(16).toString('hex');
        await User.register(existingUser, randomPassword);
        
        // Generate reset token so they can set their own password
        const resetToken = existingUser.generatePasswordResetToken();
        await existingUser.save();
        
        // Send password setup email
        await emailService.sendPasswordSetupEmail(
          existingUser.email,
          existingUser.profile.firstName,
          resetToken
        );
      }

      // Create new consultant profile using mapped data
      const newConsultant = new Consultant({
        user: existingUser._id,
        ...this.mapApiDataToConsultantModel(consultantData)
      });

      await newConsultant.save();

      return {
        user: existingUser,
        consultant: newConsultant,
        isNew: true
      };
    } catch (error) {
      throw new Error(`Error fetching consultant from API: ${error.message}`);
    }
  }

  /**
   * Map API consultant data to our data model
   * @param {Object} apiData - Raw API data
   * @returns {Object} Mapped data matching our consultant model
   */
  static mapApiDataToConsultantModel(apiData) {
    // This method maps external API data to our internal model structure
    return {
      professional: {
        title: apiData.title,
        summary: apiData.summary || apiData.bio,
        yearsOfExperience: apiData.yearsOfExperience || 0,
        education: Array.isArray(apiData.education) ? apiData.education.map(edu => ({
          institution: edu.school,
          degree: edu.degree,
          field: edu.fieldOfStudy,
          startYear: edu.startYear,
          endYear: edu.endYear,
          current: edu.current || false
        })) : [],
        certifications: Array.isArray(apiData.certifications) ? apiData.certifications.map(cert => ({
          name: cert.name,
          issuer: cert.issuer,
          year: cert.year,
          credentialId: cert.id
        })) : [],
        languages: Array.isArray(apiData.languages) ? apiData.languages.map(lang => ({
          language: lang.name,
          proficiency: lang.level || 'proficient'
        })) : []
      },
      expertise: {
        primarySpecialty: apiData.specialty || 'other',
        skills: Array.isArray(apiData.skills) ? apiData.skills.map(skill => ({
          name: skill.name,
          level: skill.level || 'intermediate',
          yearsOfExperience: skill.years || 1,
          featured: skill.featured || false
        })) : [],
        industries: apiData.industries || [],
        methodologies: apiData.methodologies || []
      },
      workExperience: Array.isArray(apiData.experience) ? apiData.experience.map(exp => ({
        company: exp.company,
        position: exp.title,
        location: exp.location,
        startDate: exp.startDate ? new Date(exp.startDate) : null,
        endDate: exp.endDate ? new Date(exp.endDate) : null,
        current: exp.current || false,
        description: exp.description,
        achievements: exp.achievements || []
      })) : [],
      services: {
        rateInfo: {
          hourlyRate: apiData.hourlyRate || 100,
          currency: apiData.currency || 'USD',
          negotiable: true
        },
        availability: {
          status: apiData.availabilityStatus || 'available',
          hoursPerWeek: apiData.availableHours || 40
        }
      },
      settings: {
        profileVisibility: 'public',
        availableForWork: true
      }
    };
  }

  /**
   * Verify a user's email with token
   * @param {string} token - Verification token
   * @returns {Object} Verified user
   */
  static async verifyEmail(token) {
    const user = await User.findOne({
      'security.verificationToken': token,
      'security.verificationExpires': { $gt: Date.now() }
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    user.security.emailVerified = true;
    user.security.accountStatus = 'active';
    user.security.verificationToken = undefined;
    user.security.verificationExpires = undefined;

    await user.save();

    // Send welcome email after verification is complete
    try {
        await emailService.sendWelcomeEmail(
        user.email,
        user.profile.firstName
        );
        logger.info('Welcome email sent successfully', {
        service: "AuthSystem",
        action: "EmailVerification",
        userId: user._id,
        email: user.email
        });
    } catch (emailError) {
        // Log the error but don't fail the verification process
        logger.error('Failed to send welcome email after verification', {
        service: "AuthSystem",
        environment: process.env.NODE_ENV,
        userId: user._id,
        userEmail: user.email,
        errorDetails: emailError
        });
    }

    return user;
  }

  /**
   * Login user and generate authentication tokens
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} Authentication data with tokens and user info
   */
  static async login(email, password) {
    // Find user by email (configured as username field)
    const user = await User.findOne({ email });
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Check account status
    if (user.security.accountStatus !== 'active') {
      throw new Error(`Account is ${user.security.accountStatus}. Please verify your email or contact support.`);
    }
    
    // Check if account is locked
    if (user.isLocked) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }
    
    // Authenticate with passport-local-mongoose
    const { user: authenticatedUser, error } = await new Promise((resolve) => {
      user.authenticate(password, (err, user, error) => {
        resolve({ user, error });
      });
    });
    
    if (!authenticatedUser) {
      // Track failed login attempt
      await user.trackLoginAttempt(false);
      throw new Error('Invalid email or password');
    }
    
    // Track successful login attempt
    await user.trackLoginAttempt(true);
    
    // Generate tokens
    const accessToken = this.generateToken(user);
    const refreshToken = this.generateToken(user, 'refresh');
    
    // Get profile data based on user role
    let profileData;
    if (user.role === 'client') {
      profileData = await Client.findOne({ user: user._id });
    } else if (user.role === 'consultant') {
      profileData = await Consultant.findOne({ user: user._id });
    }
    
    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        profileId: profileData ? profileData._id : null
      },
      expiresIn: config.auth.accessTokenExpiry
    };
  }

  /**
   * Refresh authentication tokens using a refresh token
   * @param {string} refreshToken - Current refresh token
   * @returns {Object} New authentication tokens
   */
  static async refreshTokens(refreshToken) {
    try {
      // Verify the refresh token
      const payload = this.verifyToken(refreshToken, 'refresh');
      
      // Find the user
      const user = await User.findById(payload.sub);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generate new tokens
      const newAccessToken = this.generateToken(user);
      const newRefreshToken = this.generateToken(user, 'refresh');
      
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: config.auth.accessTokenExpiry
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Initiate password reset process
   * @param {string} email - User email
   * @returns {boolean} Success status
   */
  static async forgotPassword(email) {
    const user = await User.findOne({ email });
    
    // Don't reveal if user exists or not
    if (!user) {
      // Simulate delay to prevent email enumeration
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    }
    
    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    
    // Send password reset email
    await emailService.sendPasswordResetEmail(
      user.email,
      user.profile.firstName,
      resetToken
    );
    
    return true;
  }

  /**
   * Complete password reset with token
   * @param {string} token - Reset token from email
   * @param {string} newPassword - New password
   * @returns {Object} Updated user
   */
  static async resetPassword(token, newPassword) {
    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid token
    const user = await User.findOne({
      'security.resetPasswordToken': hashedToken,
      'security.resetPasswordExpires': { $gt: Date.now() }
    });
    
    if (!user) {
      throw new Error('Invalid or expired password reset token');
    }
    
    // Check against password history
    const isInHistory = await this.checkPasswordHistory(user, newPassword);
    if (isInHistory) {
      throw new Error('New password cannot be the same as any of your recent passwords');
    }
    
    // Set the new password
    await user.setPassword(newPassword);
    
    // Clear reset token fields
    user.security.resetPasswordToken = undefined;
    user.security.resetPasswordExpires = undefined;
    
    await user.save();
    
    return user;
  }

  /**
   * Change password for authenticated user
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password for verification
   * @param {string} newPassword - New password
   * @returns {Object} Updated user
   */
  static async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify current password
    const isValid = await new Promise((resolve) => {
      user.authenticate(currentPassword, (err, user, error) => {
        resolve(!!user);
      });
    });
    
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }
    
    // Check against password history
    const isInHistory = await this.checkPasswordHistory(user, newPassword);
    if (isInHistory) {
      throw new Error('New password cannot be the same as any of your recent passwords');
    }
    
    // Set the new password
    await user.setPassword(newPassword);
    await user.save();
    
    // Send notification about password change
    await emailService.sendPasswordChangeNotification(
      user.email,
      user.profile.firstName
    );
    
    return user;
  }

  /**
   * Check if password was used in the past
   * @param {Object} user - User object
   * @param {string} newPassword - Password to check
   * @returns {boolean} Whether the password is in history
   */
  static async checkPasswordHistory(user, newPassword) {
    if (!user.security.passwordHistory || user.security.passwordHistory.length === 0) {
      return false;
    }
    
    // Check against previous password hashes
    for (const oldHash of user.security.passwordHistory) {
      const isMatch = await bcrypt.compare(newPassword, oldHash);
      if (isMatch) return true;
    }
    
    return false;
  }

  /**
   * Authenticate with GitHub OAuth
   * @param {string} code - GitHub authorization code
   * @returns {Object} Authentication result
   */
  static async githubAuth(code) {
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: config.oauth.github.clientId,
          client_secret: config.oauth.github.clientSecret,
          code
        },
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );
      
      const { access_token } = tokenResponse.data;
      
      if (!access_token) {
        throw new Error('Failed to obtain access token from GitHub');
      }
      
      // Get user profile
      const userDataResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${access_token}`
        }
      });
      
      // Get user emails (may be private)
      const userEmailsResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `token ${access_token}`
        }
      });
      
      const userData = userDataResponse.data;
      const userEmails = userEmailsResponse.data || [];
      
      // Find primary email
      const primaryEmail = userEmails.find(email => email.primary)?.email || userEmails[0]?.email;
      
      if (!primaryEmail) {
        throw new Error('No email found in GitHub profile');
      }
      
      // Check if user exists
      let user = await User.findOne({
        $or: [
          { 'integration.githubId': userData.id.toString() },
          { email: primaryEmail }
        ]
      });
      
      // If user doesn't exist, create one
      if (!user) {
        user = new User({
          email: primaryEmail,
          role: 'client', // Default role for GitHub users
          profile: {
            firstName: userData.name ? userData.name.split(' ')[0] : 'GitHub',
            lastName: userData.name ? userData.name.split(' ').slice(1).join(' ') : 'User',
            avatarUrl: userData.avatar_url,
            bio: userData.bio,
            location: {
              country: userData.location
            },
            socialMedia: {
              github: userData.html_url
            }
          },
          integration: {
            githubId: userData.id.toString()
          },
          security: {
            accountStatus: 'active',
            emailVerified: true
          }
        });
        
        // Generate a random secure password
        const randomPassword = crypto.randomBytes(20).toString('hex');
        await User.register(user, randomPassword);
        
        // Create client profile
        const newClient = new Client({
          user: user._id,
          company: {
            name: userData.company || 'Personal',
            website: userData.blog
          }
        });
        
        await newClient.save();
      } else if (!user.integration.githubId) {
        // Link GitHub to existing account
        user.integration.githubId = userData.id.toString();
        
        // Update profile with GitHub data
        if (userData.avatar_url && !user.profile.avatarUrl) {
          user.profile.avatarUrl = userData.avatar_url;
        }
        
        if (userData.html_url && !user.profile.socialMedia?.github) {
          user.profile.socialMedia = {
            ...user.profile.socialMedia,
            github: userData.html_url
          };
        }
        
        await user.save();
      }
      
      // Generate tokens
      const accessToken = this.generateToken(user);
      const refreshToken = this.generateToken(user, 'refresh');
      
      // Get profile data
      let profileData;
      if (user.role === 'client') {
        profileData = await Client.findOne({ user: user._id });
      } else if (user.role === 'consultant') {
        profileData = await Consultant.findOne({ user: user._id });
      }
      
      return {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          profileId: profileData ? profileData._id : null
        },
        expiresIn: config.auth.accessTokenExpiry
      };
    } catch (error) {
      throw new Error(`GitHub authentication failed: ${error.message}`);
    }
  }

  /**
   * Get a user by ID with role-specific profile
   * @param {string} userId - User ID
   * @returns {Object} User with profile data
   */
  static async getUserWithProfile(userId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    let profileData;
    if (user.role === 'client') {
      profileData = await Client.findOne({ user: user._id });
    } else if (user.role === 'consultant') {
      profileData = await Consultant.findOne({ user: user._id });
    }
    
    return {
      user,
      profile: profileData
    };
  }
}

module.exports = AuthService;