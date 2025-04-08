// app.js
/**
 * @file Application Setup
 * @description Express application configuration and setup
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const ejsMate = require('ejs-mate');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const passport = require('passport');
const path = require('path');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('./config');
const logger = require('./utils/logger');
const SessionManager = require('./security/session-manager');
const Database = require('./database');

// Import authentication strategies
const configureLocalStrategy = require('./auth/strategies/local-strategy');
const configureGithubStrategy = require('./auth/strategies/github-strategy');
const configurePasskeyStrategy = require('./auth/strategies/passkey-strategy');
const configureOrganizationStrategy = require('./auth/strategies/organization-strategy');

// Import routes
const authRoutes = require('./auth/auth-routes');
const userRoutes = require('./users/user-routes');
const organizationRoutes = require('./organizations/organization-routes');
const clientRoutes = require('./clients/client-routes');
const consultantRoutes = require('./consultants/consultant-routes');
const dashboardRoutes = require('./dashboard/dashboard-routes');

// Import new module routes
const serviceRoutes = require('./services/service-routes');
const caseStudyRoutes = require('./case-studies/case-study-routes');
const blogRoutes = require('./blog/blog-routes');
const adminRoutes = require('./admin/admin-routes');
const analyticsRoutes = require('./analytics/analytics-routes');
const contractRoutes = require('./contracts/contract-routes');
const eventRoutes = require('./events/event-routes');
const industryRoutes = require('./industries/industry-routes');
const knowledgeBaseRoutes = require('./knowledge-base/article-routes');
const marketingRoutes = require('./marketing/marketing-routes');
const onboardingRoutes = require('./onboarding/onboarding-routes');
const paymentRoutes = require('./payments/payment-routes');
const reportRoutes = require('./reports/report-routes');
const reviewRoutes = require('./reviews/review-routes');
const teamRoutes = require('./teams/team-routes');

/**
 * Application class
 * Handles Express app setup and configuration
 */
class Application {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupPassport();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  /**
   * Set up application middleware
   */
  setupMiddleware() {
    // Secure HTTP headers with Helmet
    if (config.security.helmet.enabled) {
      this.app.use(helmet(config.security.helmet));
    }
    
    // Parse JSON and URL-encoded bodies
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Sanitize data
    if (config.security.sanitize.enabled) {
      this.app.use(xss());
      this.app.use(mongoSanitize());
    }
    
    // Enable CORS
    if (config.security.cors.enabled) {
      this.app.use(cors({
        origin: config.security.cors.origins,
        methods: config.security.cors.methods,
        credentials: config.security.cors.allowCredentials,
        maxAge: 86400 // 24 hours
      }));
    }
    
    // Parse cookies
    this.app.use(cookieParser());
    
    // Compress responses
    this.app.use(compression());
    // Method override for PUT/DELETE requests
    this.app.use(methodOverride('_method'));

    // Set up the view engine
    this.app.engine('ejs', ejsMate);
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));
    
    // Serve static files
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    this.app.use('/public', express.static(path.join(process.cwd(), 'public')));
    // this.app.use('/public', express.static(path.join(__dirname, 'public')));
    
    // Log HTTP requests
    this.app.use(logger.httpLoggerMiddleware());
    
    // Session management
    const sessionMiddleware = SessionManager.createSessionMiddleware({
        useDatabase: true // Enable MongoDB session store in development
      });
    // const sessionMiddleware = SessionManager.createSessionMiddleware();
    this.app.use(sessionMiddleware);

    // Flash messages middleware
    this.app.use(flash());

    // Add flash messages to res.locals for template access
    this.app.use((req, res, next) => {
      res.locals.success = req.flash('success');
      res.locals.error = req.flash('error');
      res.locals.info = req.flash('info');
      res.locals.warning = req.flash('warning');
      next();
    });
    
    // Secure session handling
    this.app.use(SessionManager.createSessionSecurityMiddleware());
    this.app.use(SessionManager.createSessionActivityMiddleware());
    this.app.use(SessionManager.createIdleSessionTimeoutMiddleware(30)); // 30 minutes
  }

  /**
   * Set up Passport authentication
   */
  setupPassport() {
    // Initialize passport
    this.app.use(passport.initialize());
    this.app.use(passport.session());
    
    // Configure passport strategies
    configureLocalStrategy(passport);
    configureGithubStrategy(passport);
    configurePasskeyStrategy(passport);
    configureOrganizationStrategy(passport);
    
    // Serialize user
    passport.serializeUser((user, done) => {
      done(null, {
        id: user.id,
        type: user.type || 'user'
      });
    });
    
    // Deserialize user
    passport.deserializeUser(async (data, done) => {
      try {
        // Handle different user types here
        const UserModel = require('./users/user-model');
        const user = await UserModel.findById(data.id);
        
        if (!user) {
          return done(null, false);
        }
        
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  /**
   * Set up application routes
   */
  setupRoutes() {
    // API routes
    const apiRouter = express.Router();
    apiRouter.use('/auth', authRoutes);
    apiRouter.use('/users', userRoutes);
    apiRouter.use('/organizations', organizationRoutes);
    apiRouter.use('/clients', clientRoutes);
    apiRouter.use('/consultants', consultantRoutes);
    apiRouter.use('/dashboard', dashboardRoutes);

    // Register new module routes
    apiRouter.use('/services', serviceRoutes);
    apiRouter.use('/case-studies', caseStudyRoutes);
    apiRouter.use('/blog', blogRoutes);
    apiRouter.use('/admin', adminRoutes);
    // apiRouter.use('/analytics', analyticsRoutes);
    apiRouter.use('/contracts', contractRoutes);
    apiRouter.use('/events', eventRoutes);
    apiRouter.use('/industries', industryRoutes);
    apiRouter.use('/knowledge-base', knowledgeBaseRoutes);
    apiRouter.use('/marketing', marketingRoutes);
    apiRouter.use('/onboarding', onboardingRoutes);
    apiRouter.use('/payments', paymentRoutes);
    apiRouter.use('/reports', reportRoutes);
    apiRouter.use('/reviews', reviewRoutes);
    apiRouter.use('/teams', teamRoutes);
    
    // Mount API router at the configured prefix
    this.app.use(config.app.apiPrefix, apiRouter);
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const dbStatus = Database.getStatus();
      
      res.status(dbStatus.ready ? 200 : 503).json({
        status: dbStatus.ready ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        service: config.app.name,
        environment: config.app.env,
        database: dbStatus
      });
    });

    this.app.get('/session-check', (req, res) => {
        res.json({
            isAuthenticated: req.isAuthenticated && req.isAuthenticated(),
            session: req.session,
            sessionID: req.sessionID,
            user: req.user ? {
            id: req.user.id,
            role: req.user.role
            } : null
        });
    });

    this.app.get('/session-debug', (req, res) => {
        res.json({
            authenticated: req.isAuthenticated(),
            session: req.session,
            sessionID: req.sessionID,
            cookies: req.cookies,
            user: req.user ? {
            id: req.user.id,
            role: req.user.role
            } : null
        });
    });
    
    // Welcome route
    this.app.get('/', (req, res) => {
      res.status(200).json({
        name: config.app.name,
        message: 'Welcome to the API',
        documentation: '/api/docs',
        version: process.env.NPM_PACKAGE_VERSION || '1.0.0'
      });
    });

    // Add mock API for consultant API integration testing in development environment
    if (config.app.env === 'development') {
        try {
        // Import the mock API
        const mockConsultantApi = require('./tests/mocks/consultant-api');
        
        // Mount the mock API at a test endpoint
        this.app.use('/test-api', mockConsultantApi.router);
        
        // Log info about the mock API
        logger.info('Mock Consultant API initialized', {
            endpoint: '/test-api/consultants/:id',
            validApiKey: mockConsultantApi.VALID_API_KEY,
            availableConsultantIds: mockConsultantApi.mockConsultantIds
        });
        
        console.log(`
            Mock Consultant API available at: /test-api/consultants/:id
            Valid API Key: ${mockConsultantApi.VALID_API_KEY}
            Available Consultant IDs: ${mockConsultantApi.mockConsultantIds.join(', ')}
        `);
        } catch (error) {
        logger.warn('Failed to initialize mock Consultant API', { error });
        }
    }
  }

  /**
   * Set up error handling middleware
   */
  setupErrorHandlers() {
    // 404 handler - for routes that don't exist
    this.app.use((req, res, next) => {
      res.status(404).json({
        success: false,
        message: 'Resource not found',
        path: req.originalUrl
      });
    });
    
    // Global error handler
    this.app.use((err, req, res, next) => {
      const statusCode = err.statusCode || 500;
      
      // Log error with appropriate level
      if (statusCode >= 500) {
        logger.error('Server error', { 
          error: err.message, 
          stack: err.stack,
          path: req.path
        });
      } else {
        logger.warn('Client error', { 
          error: err.message,
          path: req.path
        });
      }
      
      // Send error response
      res.status(statusCode).json({
        success: false,
        message: statusCode >= 500 ? 'Internal server error' : err.message,
        code: err.code,
        // Only include stack trace in development
        ...(config.app.env === 'development' && { stack: err.stack })
      });
    });
  }

  /**
   * Start the application
   * @returns {Promise} Express application
   */
  async start() {
    try {
      // Connect to the database first
      await Database.connect();
      
      // Return the configured Express app
      return this.app;
    } catch (error) {
      logger.error('Failed to start application', { error });
      throw error;
    }
  }
}

module.exports = new Application();