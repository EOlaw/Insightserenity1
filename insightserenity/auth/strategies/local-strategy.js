/**
 * @file Local Authentication Strategy
 * @description Passport strategy for username/password authentication
 */

const LocalStrategy = require('passport-local').Strategy;
const User = require('../../users/user-model');
const Client = require('../../users/client-model');
const Consultant = require('../../users/consultant-model');
const logger = require('../../utils/logger');

/**
 * Configure local authentication strategy (username/password)
 * @param {Object} passport - Passport instance
 * @returns {Object} Configured strategy
 */
module.exports = function configureLocalStrategy(passport) {
  // Create the local strategy with custom field names
  const localStrategy = new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true
    },
    async (req, email, password, done) => {
      try {
        logger.debug('Authenticating user with email:', email);
        
        // Find user by email
        const user = await User.findOne({ email });
        
        if (!user) {
          logger.info('Authentication failed: No user found with email:', email);
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Check account status
        if (user.security.accountStatus !== 'active') {
          logger.info(`Authentication failed: Account status is ${user.security.accountStatus}`, { userId: user._id });
          return done(null, false, {
            message: `Your account is ${user.security.accountStatus}. Please verify your email or contact support.`,
            status: user.security.accountStatus
          });
        }
        
        // Check if account is locked due to too many failed attempts
        if (user.isLocked) {
          const lockRemaining = Math.ceil((user.security.loginAttempts.lockUntil - Date.now()) / 1000 / 60);
          logger.info(`Authentication failed: Account is locked`, { userId: user._id, lockRemaining });
          
          return done(null, false, {
            message: `Account is temporarily locked. Please try again in ${lockRemaining} minutes.`,
            locked: true,
            lockRemaining
          });
        }
        
        // Authenticate using passport-local-mongoose's method
        user.authenticate(password, async (err, authenticatedUser, error) => {
          if (err) {
            logger.error('Authentication error:', err);
            return done(err);
          }
          
          if (!authenticatedUser) {
            // Track failed login attempt
            await user.trackLoginAttempt(false);
            
            logger.info('Authentication failed: Invalid password', { userId: user._id });
            return done(null, false, { 
              message: 'Invalid email or password',
              attempts: user.security.loginAttempts.count,
              remaining: 5 - user.security.loginAttempts.count
            });
          }
          
          // Track successful login
          await user.trackLoginAttempt(true);
          
          // Log user information
          logger.info('User authenticated successfully', { 
            userId: user._id, 
            role: user.role 
          });
          
          // Track device if available
          if (req.body.deviceId) {
            try {
              await user.trackDevice({
                deviceId: req.body.deviceId,
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip
              });
            } catch (trackError) {
              // Non-critical error, just log it
              logger.warn('Error tracking device:', trackError);
            }
          }
          
          // Get profile data based on user role
          try {
            let profileData;
            if (user.role === 'client') {
              profileData = await Client.findOne({ user: user._id });
            } else if (user.role === 'consultant') {
              profileData = await Consultant.findOne({ user: user._id });
            }
            
            // Attach profile ID to user object
            if (profileData) {
              user.profileId = profileData._id;
            }
          } catch (profileError) {
            logger.warn('Error fetching profile data:', profileError);
          }
          
          return done(null, user);
        });
      } catch (error) {
        logger.error('Local strategy error:', error);
        return done(error);
      }
    }
  );

  // Register the strategy with passport
  passport.use('local', localStrategy);
  
  return { 
    name: 'local',
    strategy: localStrategy
  };
};