/**
 * @file Passkey Authentication Strategy
 * @description Passport strategy for WebAuthn/Passkey authentication
 */

const LocalStrategy = require('passport-local').Strategy;
const User = require('../../users/user-model');
const Client = require('../../users/client-model');
const Consultant = require('../../users/consultant-model');
const logger = require('../../utils/logger');
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
const config = require('../../config');

/**
 * Configure passkey (WebAuthn) authentication strategy
 * @param {Object} passport - Passport instance
 * @returns {Object} Configured strategy
 */
module.exports = function configurePasskeyStrategy(passport) {
  // Create the passkey strategy with custom field names
  const passkeyStrategy = new LocalStrategy(
    {
      usernameField: 'credentialId', // WebAuthn credential ID
      passwordField: 'authenticatorData', // WebAuthn response data
      passReqToCallback: true
    },
    async (req, credentialId, authenticatorData, done) => {
      try {
        logger.debug('Passkey authentication attempt', { credentialId });
        
        // Ensure the challenge exists in the session
        if (!req.session.passkeyChallenge) {
          logger.warn('Passkey authentication failed: No challenge in session');
          return done(null, false, { 
            message: 'Invalid authentication request (no challenge)',
            code: 'INVALID_CHALLENGE'
          });
        }
        
        // Parse authentication data
        let authData;
        try {
          authData = JSON.parse(authenticatorData);
        } catch (error) {
          logger.error('Failed to parse authenticator data:', error);
          return done(null, false, { 
            message: 'Invalid authenticator data format',
            code: 'INVALID_FORMAT'
          });
        }
        
        // Find user by credential ID
        const user = await User.findOne({
          'authenticators.credentialID': Buffer.from(credentialId, 'base64').toString('hex')
        });
        
        if (!user) {
          logger.warn('Passkey authentication failed: No user found with credential ID');
          return done(null, false, { 
            message: 'Invalid credentials',
            code: 'INVALID_CREDENTIAL'
          });
        }
        
        // Check account status
        if (user.security.accountStatus !== 'active') {
          logger.info(`Passkey authentication failed: Account status is ${user.security.accountStatus}`, { userId: user._id });
          return done(null, false, {
            message: `Your account is ${user.security.accountStatus}. Please verify your email or contact support.`,
            status: user.security.accountStatus
          });
        }
        
        // Find the specific credential used for this authentication
        const credential = user.authenticators.find(
          cred => cred.credentialID === Buffer.from(credentialId, 'base64').toString('hex')
        );
        
        if (!credential) {
          logger.warn('Passkey authentication failed: Credential not found in user authenticators', { userId: user._id });
          return done(null, false, { 
            message: 'Invalid credential',
            code: 'INVALID_CREDENTIAL'
          });
        }
        
        // Prepare verification data
        const expectedChallenge = req.session.passkeyChallenge.challenge;
        const expectedOrigin = config.app.url;
        const expectedRPID = new URL(expectedOrigin).hostname;
        
        // Verify the authentication response using SimpleWebAuthn
        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            credential: authData,
            expectedChallenge,
            expectedOrigin,
            expectedRPID,
            authenticator: {
              credentialID: Buffer.from(credential.credentialID, 'hex'),
              credentialPublicKey: Buffer.from(credential.credentialPublicKey, 'base64'),
              counter: credential.counter,
            }
          });
        } catch (error) {
          logger.error('Passkey verification error:', error);
          return done(null, false, { 
            message: 'Authentication verification failed',
            code: 'VERIFICATION_FAILED'
          });
        }
        
        // Check if verification succeeded
        if (!verification.verified) {
          logger.warn('Passkey verification failed', { userId: user._id });
          return done(null, false, { 
            message: 'Authentication verification failed',
            code: 'VERIFICATION_FAILED'
          });
        }
        
        // Update authenticator counter
        credential.counter = verification.authenticationInfo.newCounter;
        credential.lastUsed = new Date();
        
        // Track successful login
        await user.trackLoginAttempt(true);
        
        // Save the updated user with new authenticator counter
        await user.save();
        
        logger.info('Passkey authentication successful', { userId: user._id });
        
        // Clear challenge from session
        delete req.session.passkeyChallenge;
        
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
      } catch (error) {
        logger.error('Passkey strategy error:', error);
        return done(error);
      }
    }
  );

  // Register the strategy with passport
  passport.use('passkey', passkeyStrategy);
  
  return { 
    name: 'passkey',
    strategy: passkeyStrategy
  };
};