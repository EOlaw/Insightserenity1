/**
 * @file Organization Authentication Strategy
 * @description Passport strategy for organization-specific authentication
 */

const LocalStrategy = require('passport-local').Strategy;
const User = require('../../users/user-model');
const Organization = require('../../organizations/organization-model');
const logger = require('../../utils/logger');

/**
 * Configure organization authentication strategy
 * @param {Object} passport - Passport instance
 * @returns {Object} Configured strategy
 */
module.exports = function configureOrganizationStrategy(passport) {
  // Create organization authentication strategy
  const organizationStrategy = new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true
    },
    async (req, email, password, done) => {
      try {
        logger.debug('Organization authentication attempt', {
          email,
          organizationId: req.params.organizationId || req.body.organizationId
        });
        
        // Get organization ID from parameters or request body
        const organizationId = req.params.organizationId || req.body.organizationId;
        
        if (!organizationId) {
          logger.warn('Organization authentication failed: Missing organization ID');
          return done(null, false, {
            message: 'Organization ID is required',
            code: 'MISSING_ORG_ID'
          });
        }
        
        // Find organization
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
          logger.warn('Organization authentication failed: Organization not found', { organizationId });
          return done(null, false, {
            message: 'Organization not found',
            code: 'INVALID_ORG'
          });
        }
        
        if (organization.status !== 'active') {
          logger.warn('Organization authentication failed: Organization not active', { 
            organizationId, 
            status: organization.status 
          });
          return done(null, false, {
            message: 'Organization is not active',
            code: 'INACTIVE_ORG'
          });
        }
        
        // Find user by email
        const user = await User.findOne({ email });
        
        if (!user) {
          logger.info('Organization authentication failed: No user found with email', { email });
          return done(null, false, {
            message: 'Invalid email or password',
            code: 'AUTH_FAILED'
          });
        }
        
        // Check account status
        if (user.security.accountStatus !== 'active') {
          logger.info(`Organization authentication failed: Account status is ${user.security.accountStatus}`, { userId: user._id });
          return done(null, false, {
            message: `Your account is ${user.security.accountStatus}. Please verify your email or contact support.`,
            status: user.security.accountStatus
          });
        }
        
        // Check if user is a member of the organization
        if (!user.organizations || user.organizations.length === 0) {
          logger.info('Organization authentication failed: User is not a member of any organization', { userId: user._id });
          return done(null, false, {
            message: 'You are not a member of this organization',
            code: 'NOT_ORG_MEMBER'
          });
        }
        
        const membership = user.organizations.find(org => 
          org.organization.toString() === organizationId &&
          org.status === 'active'
        );
        
        if (!membership) {
          logger.info('Organization authentication failed: User is not a member of the specified organization', {
            userId: user._id,
            organizationId
          });
          return done(null, false, {
            message: 'You are not a member of this organization',
            code: 'NOT_ORG_MEMBER'
          });
        }
        
        // Check if account is locked
        if (user.isLocked) {
          const lockRemaining = Math.ceil((user.security.loginAttempts.lockUntil - Date.now()) / 1000 / 60);
          logger.info(`Organization authentication failed: Account is locked`, { userId: user._id, lockRemaining });
          
          return done(null, false, {
            message: `Account is temporarily locked. Please try again in ${lockRemaining} minutes.`,
            locked: true,
            lockRemaining
          });
        }
        
        // Authenticate using passport-local-mongoose's method
        user.authenticate(password, async (err, authenticatedUser, error) => {
          if (err) {
            logger.error('Organization authentication error:', err);
            return done(err);
          }
          
          if (!authenticatedUser) {
            // Track failed login attempt
            await user.trackLoginAttempt(false);
            
            logger.info('Organization authentication failed: Invalid password', { userId: user._id });
            return done(null, false, { 
              message: 'Invalid email or password',
              attempts: user.security.loginAttempts.count,
              remaining: 5 - user.security.loginAttempts.count
            });
          }
          
          // Track successful login
          await user.trackLoginAttempt(true);
          
          // Set this organization as the default
          user.organizations.forEach(org => {
            org.isDefault = org.organization.toString() === organizationId;
          });
          
          await user.save();
          
          // Attach organization data to user
          user.currentOrganization = {
            id: organization._id,
            name: organization.name,
            role: membership.role
          };
          
          logger.info('Organization authentication successful', { 
            userId: user._id, 
            organizationId,
            role: membership.role
          });
          
          return done(null, user);
        });
      } catch (error) {
        logger.error('Organization strategy error:', error);
        return done(error);
      }
    }
  );

  // Register the strategy with passport
  passport.use('organization', organizationStrategy);
  
  return { 
    name: 'organization',
    strategy: organizationStrategy
  };
};