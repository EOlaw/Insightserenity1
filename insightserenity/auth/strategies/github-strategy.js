/**
 * @file GitHub Authentication Strategy
 * @description Passport strategy for GitHub OAuth authentication
 */

const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../../users/user-model');
const Client = require('../../users/client-model');
const Consultant = require('../../users/consultant-model');
const logger = require('../../utils/logger');
const config = require('../../config');
const crypto = require('crypto');

/**
 * Configure GitHub OAuth authentication strategy
 * @param {Object} passport - Passport instance
 * @returns {Object} Configured strategy
 */
module.exports = function configureGitHubStrategy(passport) {
  // Create GitHub OAuth strategy
  const githubStrategy = new GitHubStrategy(
    {
      clientID: config.oauth.github.clientId,
      clientSecret: config.oauth.github.clientSecret,
      callbackURL: config.oauth.github.callbackUrl,
      scope: ['user:email'], // Request email scope
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        logger.debug('GitHub OAuth authentication attempt', {
          githubId: profile.id,
          username: profile.username
        });
        
        // Extract primary email from GitHub profile
        const emails = profile.emails || [];
        const primaryEmail = emails.find(email => email.primary)?.value || 
                            (emails.length > 0 ? emails[0].value : null);
        
        if (!primaryEmail) {
          logger.warn('GitHub authentication failed: No email available in GitHub profile', {
            githubId: profile.id
          });
          return done(null, false, { message: 'Email access is required for GitHub login' });
        }
        
        // Check if user already exists with this GitHub ID
        let user = await User.findOne({ 'integration.githubId': profile.id });
        
        // If user exists, return it
        if (user) {
          logger.info('Found existing user with GitHub ID', {
            githubId: profile.id,
            userId: user._id
          });
          
          // Update last login
          user.analytics.lastLogin = new Date();
          user.analytics.loginCount += 1;
          await user.save();
          
          return done(null, user);
        }
        
        // Check if user exists with the provided email
        user = await User.findOne({ email: primaryEmail });
        
        if (user) {
          // Link GitHub to existing account
          logger.info('Linking GitHub to existing user account', {
            githubId: profile.id,
            userId: user._id
          });
          
          user.integration.githubId = profile.id;
          
          // Update profile with GitHub data if fields are empty
          if (!user.profile.avatarUrl && profile.photos && profile.photos.length > 0) {
            user.profile.avatarUrl = profile.photos[0].value;
          }
          
          if (!user.profile.socialMedia) {
            user.profile.socialMedia = {};
          }
          
          if (!user.profile.socialMedia.github && profile.profileUrl) {
            user.profile.socialMedia.github = profile.profileUrl;
          }
          
          // Update last login
          user.analytics.lastLogin = new Date();
          user.analytics.loginCount += 1;
          
          await user.save();
          return done(null, user);
        }
        
        // Create a new user with GitHub profile data
        logger.info('Creating new user from GitHub profile', {
          githubId: profile.id,
          email: primaryEmail
        });
        
        // Parse name from GitHub profile
        const displayName = profile.displayName || profile.username || 'GitHub User';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        // Create new user
        const newUser = new User({
          email: primaryEmail,
          role: 'client', // Default role for OAuth users
          profile: {
            firstName: firstName,
            lastName: lastName,
            avatarUrl: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
            bio: profile._json.bio,
            location: {
              country: profile._json.location
            },
            socialMedia: {
              github: profile.profileUrl
            }
          },
          integration: {
            githubId: profile.id
          },
          security: {
            accountStatus: 'active', // Auto-activate OAuth users
            emailVerified: true // Email is verified through GitHub
          },
          analytics: {
            lastLogin: new Date(),
            loginCount: 1
          }
        });
        
        // Generate a random secure password (user won't need to know this)
        const randomPassword = crypto.randomBytes(32).toString('hex');
        
        // Register the user with passport-local-mongoose
        await User.register(newUser, randomPassword);
        
        // Create a client profile for the new user
        const newClient = new Client({
          user: newUser._id,
          company: {
            name: profile._json.company || 'Personal',
            website: profile._json.blog
          },
          settings: {
            notifications: {
              proposalReceived: true,
              consultantMessage: true,
              projectUpdate: true,
              billingAlert: true
            }
          }
        });
        
        await newClient.save();
        
        // Attach profile ID to user object
        newUser.profileId = newClient._id;
        
        logger.info('Successfully created new user from GitHub profile', {
          userId: newUser._id,
          githubId: profile.id
        });
        
        return done(null, newUser);
      } catch (error) {
        logger.error('GitHub strategy error:', error);
        return done(error);
      }
    }
  );

  // Register the strategy with passport
  passport.use('github', githubStrategy);
  
  return { 
    name: 'github',
    strategy: githubStrategy
  };
};