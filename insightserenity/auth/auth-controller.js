/**
 * @file Authentication Controller
 * @description Controller for handling authentication-related HTTP requests and view rendering
 */

const AuthService = require('./auth-service');
const UserService = require('../users/user-service');
const { validationResult } = require('express-validator');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles HTTP requests and view rendering for authentication flows
 */
class AuthController {
  /**
   * Render the client registration page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static renderClientRegister(req, res) {
    // If user is already logged in, redirect to dashboard
    if (req.isAuthenticated()) {
      return res.redirect('/dashboard');
    }
    
    res.render('auth/register-client', {
      title: 'Register as Client',
      user: null,
      pageContext: 'register-client',
      error: req.flash('error'),
      formData: req.flash('formData')[0] || {}
    });
  }

  /**
   * Render the consultant registration page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static renderConsultantRegister(req, res) {
    // If user is already logged in, redirect to dashboard
    if (req.isAuthenticated()) {
      return res.redirect('/dashboard');
    }
    
    res.render('auth/register-consultant', {
      title: 'Register as Consultant',
      user: null,
      pageContext: 'register-consultant',
      error: req.flash('error'),
      formData: req.flash('formData')[0] || {}
    });
  }

  /**
   * Render the login page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static renderLogin(req, res) {
    // If user is already logged in, redirect to dashboard
    if (req.isAuthenticated()) {
        const roleRedirects = {
            client: '/api/clients/dashboard',
            consultant: '/api/consultants/dashboard',
        };

        return res.redirect(roleRedirects[req.user.role] || '/dashboard');
    }

    
    res.render('auth/login', {
      title: 'Login',
      user: null,
      pageContext: 'login',
      error: req.flash('error'),
      success: req.flash('success')
    });
  }

  /**
   * Render the forgot password page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static renderForgotPassword(req, res) {
    res.render('auth/forgot-password', {
      title: 'Forgot Password',
      user: null,
      pageContext: 'forget-password',
      error: req.flash('error'),
      success: req.flash('success')
    });
  }

  /**
   * Render the reset password page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static renderResetPassword(req, res) {
    const { token } = req.params;
    
    if (!token) {
      req.flash('error', 'Password reset token is required');
      return res.redirect('/auth/forgot-password');
    }
    
    res.render('auth/reset-password', {
      title: 'Reset Password',
      user: null,
      pageContext: 'reset-password',
      token,
      error: req.flash('error')
    });
  }

  /**
   * Render email verification result page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static renderVerifyEmail(req, res) {
    const { token } = req.params;
    
    res.render('auth/verify-email', {
      title: 'Email Verification',
      user: null,
      token,
      pageContext: 'verification',
      verified: req.query.status === 'success',
      message: req.flash('message')[0] || null,
      error: req.flash('error')
    });
  }

  /**
   * Register a new client user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async registerClient(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        req.flash('formData', req.body);
        return res.redirect('/api/auth/register-client');
      }

      // Extract client registration data
      const userData = {
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phoneNumber: req.body.phoneNumber,
        dateOfBirth: req.body.dateOfBirth,
        bio: req.body.bio,
        location: req.body.location,
        avatarUrl: req.body.avatarUrl,
        socialMedia: req.body.socialMedia,
        company: req.body.company,
        billing: req.body.billing,
        clientProfile: req.body.clientProfile,
        settings: req.body.settings,
        preferences: req.body.preferences
      };

      // Register client
      const { user, client, verificationToken } = await AuthService.registerClient(userData);

      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        // Don't return the verification token in production
        const responseData = {
          success: true,
          message: 'Registration successful. Please check your email to verify your account.',
          userId: user._id,
          clientId: client._id
        };

        // Only include verification token in development for testing
        if (process.env.NODE_ENV === 'development') {
          responseData.verificationToken = verificationToken;
        }

        return res.status(201).json(responseData);
      }
      
      // Handle web request
      req.flash('success', 'Registration successful. Please check your email to verify your account.');
      return res.redirect('/api/auth/registration-success');
    } catch (error) {
      logger.error('Client registration error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Registration failed'
        });
      }
      
      // Handle web request
      req.flash('error', error.message || 'Registration failed');
      req.flash('formData', req.body);
      return res.redirect('/api/auth/register-client');
    }
  }

  /**
   * Register a new consultant
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async registerConsultant(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        req.flash('formData', req.body);
        return res.redirect('/api/auth/register-consultant');
      }

      // Determine if using API or direct registration
      const useApi = req.body.useApi === true;
      
      // Structure data appropriately
      const userData = useApi ? {
        apiKey: req.body.apiKey,
        consultantId: req.body.consultantId
      } : {
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phoneNumber: req.body.phoneNumber,
        professional: req.body.professional,
        expertise: req.body.expertise,
        workExperience: req.body.workExperience,
        portfolio: req.body.portfolio,
        services: req.body.services,
        settings: req.body.settings
      };

      // Register or fetch consultant
      const result = await AuthService.registerOrFetchConsultant(userData, useApi);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        // Build appropriate response based on registration method
        const responseData = {
          success: true,
          message: useApi 
            ? (result.isNew 
                ? 'Consultant imported successfully. A password setup email has been sent.' 
                : 'Consultant data updated successfully.')
            : 'Registration successful. Please check your email to verify your account.',
          userId: result.user._id,
          consultantId: result.consultant._id
        };

        // Only include verification token in development for direct registration
        if (process.env.NODE_ENV === 'development' && !useApi && result.verificationToken) {
          responseData.verificationToken = result.verificationToken;
        }

        return res.status(201).json(responseData);
      }
      
      // Handle web request
      const successMessage = useApi 
        ? (result.isNew 
            ? 'Consultant imported successfully. A password setup email has been sent.' 
            : 'Consultant data updated successfully.')
        : 'Registration successful. Please check your email to verify your account.';
      
      req.flash('success', successMessage);
      return res.redirect('/api/auth/registration-success');
    } catch (error) {
      logger.error('Consultant registration error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Registration failed'
        });
      }
      
      // Handle web request
      req.flash('error', error.message || 'Registration failed');
      req.flash('formData', req.body);
      return res.redirect('/api/auth/register-consultant');
    }
  }

  /**
   * Render registration success page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static renderRegistrationSuccess(req, res) {
    res.render('auth/registration-success', {
      title: 'Registration Successful',
      user: null,
      pageContext: 'success',
      success: req.flash('success')
    });
  }

  /**
   * Login user and return authentication tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  /*
  static async login(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.redirect('/api/auth/login');
      }

      const { email, password } = req.body;
      
      // Login and get authentication tokens
      const authData = await AuthService.login(email, password);
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', authData.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.USE_HTTPS === 'true',
        sameSite: 'strict',
        maxAge: config.auth.refreshTokenExpiryMs
      });
      
      // Track user device
      if (req.useragent) {
        await UserService.trackUserDevice(authData.user.id, {
          deviceId: req.body.deviceId || 'unknown',
          userAgent: req.useragent.source,
          ipAddress: req.ip
        });
      }
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          accessToken: authData.accessToken,
          user: authData.user,
          expiresIn: authData.expiresIn
        });
      }
      
      // Handle web request
      req.flash('success', `Welcome back, ${authData.user.firstName}!`);
      
      // Redirect based on user role
      if (authData.user.role === 'client') {
        return res.redirect('/api/clients/dashboard');
      } else if (authData.user.role === 'consultant') {
        return res.redirect('/api/consultants/dashboard');
      } else {
        return res.redirect('/api/dashboard');
      }
    } catch (error) {
      logger.error('Login error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: error.message || 'Authentication failed'
        });
      }
      
      // Handle web request
      req.flash('error', error.message || 'Invalid email or password');
      return res.redirect('/api/auth/login');
    }
  }
  */
  static async login(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.redirect('/api/auth/login');
      }
  
      const { email, password } = req.body;
      
      // Login and get authentication tokens
      const authData = await AuthService.login(email, password);
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', authData.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.USE_HTTPS === 'true',
        sameSite: 'strict',
        maxAge: config.auth.refreshTokenExpiryMs
      });
      
      // IMPORTANT: Establish session for authenticated user
      req.login(authData.user, (err) => {
        if (err) {
          logger.error('Error establishing session', err);
          req.flash('error', 'An error occurred during login');
          return res.redirect('/api/auth/login');
        }
        
        // Log session establishment
        logger.info('User session established', {
          userId: authData.user.id,
          role: authData.user.role,
          sessionID: req.sessionID
        });
        
        // Handle API request
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(200).json({
            success: true,
            accessToken: authData.accessToken,
            user: authData.user,
            expiresIn: authData.expiresIn
          });
        }
        
        // Handle web request
        req.flash('success', `Welcome back, ${authData.user.firstName}!`);
        
        // Redirect based on user role
        if (authData.user.role === 'client') {
          return res.redirect('/api/clients/dashboard');
        } else if (authData.user.role === 'consultant') {
          return res.redirect('/api/consultants/dashboard');
        } else {
          return res.redirect('/api/dashboard');
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: error.message || 'Authentication failed'
        });
      }
      
      // Handle web request
      req.flash('error', error.message || 'Invalid email or password');
      return res.redirect('/api/auth/login');
    }
  }

  /**
   * Refresh authentication tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async refreshToken(req, res) {
    try {
      // Get refresh token from cookie or request body
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is required'
        });
      }
      
      // Generate new tokens
      const tokens = await AuthService.refreshTokens(refreshToken);
      
      // Set new refresh token in HTTP-only cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: config.auth.refreshTokenExpiryMs
      });
      
      return res.status(200).json({
        success: true,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      
      // Clear the invalid refresh token cookie
      res.clearCookie('refreshToken');
      
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
  }

  /**
   * Log out user by clearing tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async logout(req, res) {
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    // Handle API request
    if (req.xhr || req.headers.accept.includes('application/json')) {
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    }
    
    // Handle web request - use Express.js logout method if available
    if (req.logout) {
      req.logout((err) => {
        if (err) {
          logger.error('Error during logout:', err);
        }
        req.flash('success', 'You have been logged out successfully');
        return res.redirect('/api/auth/login');
      });
    } else {
      req.flash('success', 'You have been logged out successfully');
      return res.redirect('/api/auth/login');
    }
  }

  /**
   * Verify user email with token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async verifyEmail(req, res) {
    try {
      const { token } = req.params;
      
      if (!token) {
        req.flash('error', 'Verification token is required');
        return res.redirect('/api/auth/login');
      }
      
      // Verify email
      const user = await AuthService.verifyEmail(token);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Email verified successfully',
          userId: user._id
        });
      }
      
      // Handle web request - Show verification success page
      // Set success message in flash for login page (it will be used after redirect)
      req.flash('success', 'Your email has been verified successfully. You can now log in.');
      
      return res.render('auth/verification-success', {
        title: 'Email Verified Successfully',
        user: null,
        pageContext: 'verification',
        firstName: user.profile.firstName,
        additionalJS: '' // Optional: You can add additional JavaScript if needed
      });
    } catch (error) {
      logger.error('Email verification error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Email verification failed'
        });
      }
      
      // Handle web request
      req.flash('error', error.message || 'Email verification failed');
      return res.redirect('/api/auth/login');
    }
  }

  /**
   * Initiate password reset process
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        req.flash('error', 'Email is required');
        return res.redirect('/api/auth/forgot-password');
      }
      
      // Initiate password reset
      await AuthService.forgotPassword(email);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }
      
      // Handle web request
      req.flash('success', 'If an account with that email exists, a password reset link has been sent.');
      return res.redirect('/auth/forgot-password');
    } catch (error) {
      logger.error('Forgot password error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }
      
      // Handle web request
      req.flash('success', 'If an account with that email exists, a password reset link has been sent.');
      return res.redirect('/auth/forgot-password');
    }
  }

  /**
   * Reset password with token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        req.flash('error', 'Token and password are required');
        return res.redirect(`/auth/reset-password/${token}`);
      }
      
      // Reset password
      const user = await AuthService.resetPassword(token, password);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Password reset successfully',
          userId: user._id
        });
      }
      
      // Handle web request
      req.flash('success', 'Your password has been reset successfully. You can now log in with your new password.');
      return res.redirect('/api/auth/login');
    } catch (error) {
      logger.error('Password reset error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Password reset failed'
        });
      }
      
      // Handle web request
      req.flash('error', error.message || 'Password reset failed');
      return res.redirect(`/auth/reset-password/${req.body.token}`);
    }
  }

  /**
   * Change password for authenticated user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        // Handle API request
        if (req.xhr || req.headers.accept.includes('application/json')) {
          return res.status(400).json({
            success: false,
            message: 'Current password and new password are required'
          });
        }
        
        // Handle web request
        req.flash('error', 'Current password and new password are required');
        return res.redirect('/user/settings');
      }
      
      // Change password
      const user = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Password changed successfully'
        });
      }
      
      // Handle web request
      req.flash('success', 'Your password has been changed successfully');
      return res.redirect('/user/settings');
    } catch (error) {
      logger.error('Password change error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Password change failed'
        });
      }
      
      // Handle web request
      req.flash('error', error.message || 'Password change failed');
      return res.redirect('/user/settings');
    }
  }

  /**
   * Handle GitHub OAuth callback
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async githubCallback(req, res) {
    try {
      const { code } = req.query;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is required'
        });
      }
      
      // Authenticate with GitHub
      const authData = await AuthService.githubAuth(code);
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', authData.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: config.auth.refreshTokenExpiryMs
      });
      
      // For API requests, return the tokens
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          accessToken: authData.accessToken,
          user: authData.user,
          expiresIn: authData.expiresIn
        });
      }
      
      // For browser requests, redirect based on user role
      if (authData.user.role === 'client') {
        return res.redirect('/client/dashboard');
      } else if (authData.user.role === 'consultant') {
        return res.redirect('/consultant/dashboard');
      } else {
        return res.redirect('/dashboard');
      }
    } catch (error) {
      logger.error('GitHub authentication error:', error);
      
      // For browser requests, redirect to login page with error
      if (!req.xhr && !req.headers.accept.includes('application/json')) {
        req.flash('error', 'GitHub authentication failed: ' + error.message);
        return res.redirect('/api/auth/login');
      }
      
      return res.status(401).json({
        success: false,
        message: error.message || 'GitHub authentication failed'
      });
    }
  }

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCurrentUser(req, res) {
    try {
      const { user, profile } = await AuthService.getUserWithProfile(req.user.id);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          user: {
            id: user._id,
            email: user.email,
            role: user.role,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            profile: user.profile,
            preferences: user.preferences,
            integration: user.integration,
            profileId: profile ? profile._id : null
          },
          profile
        });
      }
      
      // Handle web request - redirect to appropriate profile page
      if (user.role === 'client') {
        return res.redirect('/client/profile');
      } else if (user.role === 'consultant') {
        return res.redirect('/consultant/profile');
      } else {
        return res.redirect('/user/profile');
      }
    } catch (error) {
      logger.error('Get current user error:', error);
      
      // Handle API request
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Failed to retrieve user profile'
        });
      }
      
      // Handle web request
      req.flash('error', error.message || 'Failed to retrieve user profile');
      return res.redirect('/');
    }
  }
}

module.exports = AuthController;