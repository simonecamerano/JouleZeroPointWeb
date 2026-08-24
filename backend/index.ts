import app from './app';
import connectDB from './config/db';
import { initRetentionTask } from './tasks/retentionTask';
import logger from './config/logger';

/**
 * Nucleo Punto Zero - Entry Point (TypeScript).
 * 
 * Orchestrates the bootstrapping sequence:
 * 1. Establish persistent connection with MongoDB Atlas.
 * 2. Register the recurring retention job.
 * 3. Initialize the Express application server.
 * 4. Handle system signals for graceful shutdowns.
 */

const PORT = process.env.PORT || 5000;

// Bootstrap Sequence
const startServer = async () => {
  try {
    // 1. Initialize Neural Link (Database)
    await connectDB();

    // 2. Register the retention job declared in the privacy notice
    initRetentionTask();

    // 3. Activate Application Portal
    const server = app.listen(PORT, () => {
      logger.info(`VIGIL_SYSTEM: Node operational on frequency ${PORT} in ${process.env.NODE_ENV} mode.`);
    });

    // 4. Graceful Signal Interception
    process.on('unhandledRejection', (err: any) => {
      logger.error(`UNHANDLED_REJECTION: ${err.message}`);
      // Close server & exit process
      server.close(() => process.exit(1));
    });

  } catch (error) {
    logger.error(`BOOTSTRAP_FAILURE: ${(error as Error).message}`);
    process.exit(1);
  }
};

startServer();
