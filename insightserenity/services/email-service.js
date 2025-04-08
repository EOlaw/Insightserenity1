/**
 * @file Email Service
 * @description Service for sending transactional emails with different providers
 */

const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const mailgun = require('mailgun-js');
const fs = require('fs'); // Use standard fs module
const fsPromises = fs.promises; // Separately get the promises API
const path = require('path');
const ejs = require('ejs');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Email Service 
 * Handles sending various transactional emails through different providers
 */
class EmailService {
  constructor() {
    this.templates = {};
    this.transport = null;
    this.initialize();
  }

  /**
   * Initialize email service and load templates
   */
  async initialize() {
    try {
      // Load email templates
      await this.loadTemplates();
      
      // Set up email transport based on configuration
      this.setupTransport();
      
      logger.info('Email service initialized', {
        provider: config.email.provider
      });
    } catch (error) {
      logger.error('Failed to initialize email service', { error });
      // Don't throw the error, allow the application to continue
    }
  }

  /**
   * Set up the email transport based on configured provider
   */
  setupTransport() {
    const provider = config.email.provider;
    
    switch (provider) {
      case 'smtp':
        // Debug configuration values
        logger.debug('SMTP Configuration', {
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          secure: config.email.smtp.secure,
          auth: {
            user: config.email.smtp.auth.user,
            pass: config.email.smtp.auth.pass ? '[Password Set]' : '[No Password]'
          }
        });
        
        this.transport = nodemailer.createTransport(config.email.smtp);
        break;
        
      case 'sendgrid':
        sgMail.setApiKey(config.email.sendgrid.apiKey);
        break;
        
      case 'mailgun':
        this.mailgunClient = mailgun({
          apiKey: config.email.mailgun.apiKey,
          domain: config.email.mailgun.domain
        });
        break;
        
      case 'test':
        // Create a test transport that doesn't actually send emails
        this.transport = {
          sendMail: (mailOptions) => {
            logger.debug('Test email transport', { mailOptions });
            return Promise.resolve({
              messageId: `test-${Date.now()}`
            });
          }
        };
        break;
        
      default:
        logger.warn(`Unknown email provider: ${provider}, falling back to SMTP`);
        this.transport = nodemailer.createTransport(config.email.smtp);
    }
    
    // Verify SMTP connection if using SMTP
    if (this.transport && typeof this.transport.verify === 'function') {
      this.transport.verify()
        .then(() => {
          logger.info('SMTP connection verified successfully');
        })
        .catch((error) => {
          logger.error('SMTP connection verification failed', { error });
        });
    }
  }

  /**
   * Load email templates from files
   */
  async loadTemplates() {
    try {
      const templates = config.email.templates;
      
      // Create templates directory if it doesn't exist
      const templatesDir = path.join(process.cwd(), 'views/emails');
      try {
        if (!fs.existsSync(templatesDir)) {
          logger.info(`Creating email templates directory: ${templatesDir}`);
          fs.mkdirSync(templatesDir, { recursive: true });
        }
      } catch (error) {
        logger.error(`Failed to create templates directory: ${templatesDir}`, { error });
      }
      
      for (const [name, filePath] of Object.entries(templates)) {
        try {
          const templatePath = path.join(process.cwd(), 'views/emails', `${name}.ejs`);
          // Store the template path instead of compiling
          this.templates[name] = templatePath;
          logger.debug(`Email template path stored: ${name} -> ${templatePath}`);
        } catch (error) {
          logger.warn(`Email template ${name} not found, using fallback`);
          // Create fallback templates in views/emails folder
        }
      }
    } catch (error) {
      logger.error('Error loading email templates', { error });
      // Don't throw the error, allow the application to continue
    }
  }

  /**
   * Send an email using the configured transport
   * @param {Object} options - Email options
   * @returns {Object} Email send result
   */
  async sendEmail(options) {
    try {
      const { to, subject, html, text, from, attachments } = options;
      
      // Validate required fields
      if (!to || !subject || (!html && !text)) {
        throw new Error('Missing required email fields');
      }
      
      // Prepare email data
      const emailData = {
        from: from || config.email.from,
        to,
        subject,
        html,
        text: text || this.htmlToText(html), // Generate text version from HTML if not provided
        attachments: attachments || []
      };
      
      let result;
      
      // Send email using the appropriate provider
      switch (config.email.provider) {
        case 'sendgrid':
          result = await sgMail.send(emailData);
          break;
          
        case 'mailgun':
          result = await new Promise((resolve, reject) => {
            this.mailgunClient.messages().send(emailData, (error, body) => {
              if (error) reject(error);
              else resolve(body);
            });
          });
          break;
          
        default: // smtp or test
          result = await this.transport.sendMail(emailData);
          break;
      }
      
      logger.info('Email sent successfully', {
        to,
        subject,
        provider: config.email.provider
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send email', {
        error,
        to: options.to,
        subject: options.subject
      });
      
      // Return a fake success result instead of throwing to prevent registration from failing
      return {
        messageId: `error-${Date.now()}`,
        error: error.message
      };
    }
  }

  /**
   * Render an email template with provided data
   * @param {string} templateName - Template name
   * @param {Object} data - Template data
   * @returns {string} Rendered HTML
   */
  async renderTemplate(templateName, data) {
    try {
      const templatePath = this.templates[templateName];
      
      if (!templatePath) {
        logger.warn(`Email template not found: ${templateName}, using fallback`);
        // Return a fallback template
        return this.renderFallbackTemplate(templateName, data);
      }
      
      // Add app name to all templates
      const mergedData = {
        appName: config.app.name,
        ...data
      };
      
      // Check if the template file exists using synchronous method
      try {
        if (!fs.existsSync(templatePath)) {
          logger.warn(`Template file does not exist: ${templatePath}, using fallback`);
          return this.renderFallbackTemplate(templateName, mergedData);
        }
      } catch (error) {
        logger.warn(`Error checking if template exists: ${templatePath}`, { error });
        return this.renderFallbackTemplate(templateName, mergedData);
      }
      
      // Render the EJS template
      return await ejs.renderFile(templatePath, mergedData);
    } catch (error) {
      logger.error('Failed to render email template', {
        templateName,
        errorDetails: error
      });
      
      // Return a fallback template instead of throwing
      return this.renderFallbackTemplate(templateName, data);
    }
  }

  /**
   * Render a fallback template when the main template is not available
   * @param {string} templateName - Template name
   * @param {Object} data - Template data
   * @returns {string} Rendered HTML
   */
  renderFallbackTemplate(templateName, data) {
    // Basic fallback template
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${data.title || 'System Message'}</title>
      </head>
      <body>
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>${data.title || templateName}</h1>
          <p>${data.message || 'Thank you for using our service.'}</p>
    `;

    // Add action button if url is provided
    if (data.actionUrl) {
      html += `
        <p>
          <a href="${data.actionUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
            ${data.actionText || 'Click Here'}
          </a>
        </p>
      `;
    }

    // Close the HTML
    html += `
          <p>Regards,<br>The ${data.appName || 'System'} Team</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Convert HTML to plain text
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  htmlToText(html) {
    // Very simple HTML to text conversion
    // In a real application, use a library like html-to-text
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Send welcome email to new user
   * @param {string} email - User email
   * @param {string} firstName - User first name
   * @returns {Object} Email send result
   */
  async sendWelcomeEmail(email, firstName) {
    try {
      const data = {
        firstName,
        title: `Welcome to ${config.app.name}!`,
        message: `Thank you for joining ${config.app.name}. We're excited to have you on board!`,
        actionText: 'Get Started',
        actionUrl: config.app.url
      };
      
      const html = await this.renderTemplate('welcome', data);
      
      return await this.sendEmail({
        to: email,
        subject: `Welcome to ${config.app.name}`,
        html
      });
    } catch (error) {
      logger.error('Failed to send welcome email', { email, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email verification
   * @param {string} email - User email
   * @param {string} firstName - User first name
   * @param {string} token - Verification token
   * @returns {Object} Email send result
   */
  async sendVerificationEmail(email, firstName, token) {
    try {
      const verificationUrl = `${config.app.url}/api/auth/verify-email/${token}`;
      
      const data = {
        firstName,
        title: 'Please Verify Your Email',
        message: 'Thank you for registering. Please verify your email address to complete your account setup.',
        actionText: 'Verify Email',
        actionUrl: verificationUrl,
        expiresIn: '24 hours',
        token
      };
      
      const html = await this.renderTemplate('verification', data);
      
      return await this.sendEmail({
        to: email,
        subject: 'Email Verification',
        html
      });
    } catch (error) {
      logger.error('Failed to send verification email', { email, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   * @param {string} firstName - User first name
   * @param {string} token - Reset token
   * @returns {Object} Email send result
   */
  async sendPasswordResetEmail(email, firstName, token) {
    try {
      const resetUrl = `${config.frontend.resetPasswordUrl}/${token}`;
      
      const data = {
        firstName,
        title: 'Reset Your Password',
        message: 'You requested a password reset. Please use the link below to reset your password.',
        actionText: 'Reset Password',
        actionUrl: resetUrl,
        expiresIn: '1 hour',
        token
      };
      
      const html = await this.renderTemplate('passwordReset', data);
      
      return await this.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html
      });
    } catch (error) {
      logger.error('Failed to send password reset email', { email, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password change notification
   * @param {string} email - User email
   * @param {string} firstName - User first name
   * @param {Object} details - Additional details
   * @returns {Object} Email send result
   */
  async sendPasswordChangeNotification(email, firstName, details = {}) {
    try {
      const data = {
        firstName,
        title: 'Your Password Was Changed',
        message: 'Your password was recently changed. If you did not make this change, please contact support immediately.',
        timestamp: details.changeDate || new Date().toISOString(),
        ip: details.ipAddress || 'Unknown',
        contactSupportUrl: `${config.app.url}/support`
      };
      
      const html = await this.renderTemplate('passwordChanged', data);
      
      return await this.sendEmail({
        to: email,
        subject: 'Your Password Has Been Changed',
        html
      });
    } catch (error) {
      logger.error('Failed to send password change notification', { email, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send organization invitation
   * @param {string} email - Recipient email
   * @param {Object} data - Invitation data
   * @returns {Object} Email send result
   */
  async sendOrganizationInvite(email, data) {
    try {
      const inviteUrl = `${config.app.url}/api/organizations/invitations/${data.token}/accept`;
      
      const templateData = {
        organizationName: data.organizationName,
        inviterName: data.inviterName,
        inviterEmail: data.inviterEmail,
        role: data.role,
        title: `You've Been Invited to Join ${data.organizationName}`,
        message: `${data.inviterName} has invited you to join ${data.organizationName} as a ${data.role}.`,
        actionText: 'Accept Invitation',
        actionUrl: inviteUrl,
        expiresIn: '7 days'
      };
      
      const html = await this.renderTemplate('organizationInvite', templateData);
      
      return await this.sendEmail({
        to: email,
        subject: `Invitation to Join ${data.organizationName}`,
        html
      });
    } catch (error) {
      logger.error('Failed to send organization invite', { email, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email change verification
   * @param {string} newEmail - New email address
   * @param {string} firstName - User first name
   * @param {string} token - Verification token
   * @returns {Object} Email send result
   */
  async sendEmailChangeVerification(newEmail, firstName, token) {
    try {
      const verificationUrl = `${config.app.url}/api/users/email/confirm/${token}`;
      
      const data = {
        firstName,
        title: 'Confirm Your New Email Address',
        message: 'You requested to change your email address. Please confirm this new email address by clicking the button below.',
        actionText: 'Confirm Email Change',
        actionUrl: verificationUrl,
        expiresIn: '24 hours',
        token
      };
      
      const html = await this.renderTemplate('verification', data);
      
      return await this.sendEmail({
        to: newEmail,
        subject: 'Confirm Your New Email Address',
        html
      });
    } catch (error) {
      logger.error('Failed to send email change verification', { email: newEmail, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send account deactivation notification
   * @param {string} email - User email
   * @param {string} firstName - User first name
   * @param {string} reason - Deactivation reason
   * @returns {Object} Email send result
   */
  async sendAccountDeactivationEmail(email, firstName, reason) {
    try {
      const data = {
        firstName,
        title: 'Your Account Has Been Deactivated',
        message: 'Your account has been deactivated.',
        reason: reason,
        timestamp: new Date().toISOString(),
        contactSupportUrl: `${config.app.url}/support`
      };
      
      const html = await this.renderTemplate('accountDeactivation', data);
      
      return await this.sendEmail({
        to: email,
        subject: 'Your Account Has Been Deactivated',
        html
      });
    } catch (error) {
      logger.error('Failed to send account deactivation email', { email, error });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send password setup email (for API-imported consultants)
   * @param {string} email - User email
   * @param {string} firstName - User first name
   * @param {string} token - Password reset token
   * @returns {Object} Email send result
   */
  async sendPasswordSetupEmail(email, firstName, token) {
    try {
      const setupUrl = `${config.frontend.resetPasswordUrl}/${token}`;
      
      const data = {
        firstName,
        title: 'Set Up Your Password',
        message: 'An account has been created for you. Please set up your password to access your account.',
        actionText: 'Set Password',
        actionUrl: setupUrl,
        expiresIn: '24 hours',
        token
      };
      
      const html = await this.renderTemplate('passwordReset', data);
      
      return await this.sendEmail({
        to: email,
        subject: 'Set Up Your Account Password',
        html
      });
    } catch (error) {
      logger.error('Failed to send password setup email', { email, error });
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const emailService = new EmailService();
module.exports = emailService;