/**
 * @file Server Entry Point
 * @description Main server entry point that starts the Express application
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const app = require('./app');
const logger = require('./utils/logger');

/**
 * Server initialization and startup
 */
async function startServer() {
  try {
    // Start the application (connects to database)
    const expressApp = await app.start();
    
    // Create HTTP or HTTPS server based on environment
    let server;
    
    if (config.app.env === 'development' && process.env.USE_HTTPS === 'true') {
      // In development, use HTTPS with self-signed certificates if configured
      try {
        const httpsOptions = {
          key: fs.readFileSync(path.join(process.cwd(), 'localhost-key.pem')),
          cert: fs.readFileSync(path.join(process.cwd(), 'localhost.pem'))
        };
        
        server = https.createServer(httpsOptions, expressApp);
        logger.info('Using HTTPS in development mode');
      } catch (error) {
        logger.warn('Failed to load HTTPS certificates, falling back to HTTP', { error });
        server = http.createServer(expressApp);
      }
    } else {
      // In production or other environments, use HTTP (handled by reverse proxy)
      server = http.createServer(expressApp);
    }
    
    // Start the server
    server.listen(config.app.port, () => {
      logger.info(`Server started successfully`, {
        port: config.app.port,
        environment: config.app.env,
        protocol: server instanceof https.Server ? 'HTTPS' : 'HTTP'
      });
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.app.port} is already in use`);
      } else {
        logger.error('Server error', { error });
      }
      process.exit(1);
    });
    
    // Set up graceful shutdown
    setupGracefulShutdown(server);
    
    return server;
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

/**
 * Set up graceful shutdown handlers
 * @param {Object} server - HTTP/HTTPS server instance
 */
function setupGracefulShutdown(server) {
  // Handle process termination signals
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    // Close server connections
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close the database connection
      const Database = require('./database');
      Database.close()
        .then(() => {
          logger.info('All connections closed, process exiting');
          process.exit(0);
        })
        .catch((error) => {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        });
    });
    
    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, 30000); // 30 seconds
  };
  
  // Register signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    shutdown('uncaughtException');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { reason });
    shutdown('unhandledRejection');
  });
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { startServer };