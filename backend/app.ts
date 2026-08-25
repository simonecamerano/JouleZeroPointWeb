import path from 'path';
import dotenv from 'dotenv';
// Load environment variables before any other imports that might depend on them
dotenv.config({ quiet: true });

import { NEWS_IMAGES_DIR } from './config/paths';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import qs from 'qs';

import logger from './config/logger';
import authRoutes from './routes/authRoutes';
import newsRoutes from './routes/newsRoutes';
import deckRoutes from './routes/deckRoutes';
import cardRoutes from './routes/cardRoutes';
import terminalRoutes from './routes/terminalRoutes';
import seoRoutes from './routes/seoRoutes';
import contactRoutes from './routes/contactRoutes';
import rulebookRoutes from './routes/rulebookRoutes';

const app = express();

/**
 * --- INFRASTRUCTURE CONFIGURATION ---
 * Trust Proxy is required for cloud deployments (Render, Heroku, Railway, Coolify) 
 * to correctly identify client IP addresses for Rate Limiting.
 */
app.set('trust proxy', 1);

/**
 * --- NATIVE EXPRESS 5 SECURITY ---
 * We sanitize the query string during the parsing phase to respect Express 5's read-only req.query.
 */
app.set('query parser', (str: string) => {
  const parsed = qs.parse(str, { allowDots: false, allowPrototypes: false });
  
  // 1. NoSQL Sanitization for Query Parameters
  const sanitized = mongoSanitize.sanitize(parsed);
  
  // 2. HTTP Parameter Pollution (HPP) protection for Query Parameters
  // Simple implementation: always take the latest value for any duplicated keys
  Object.keys(sanitized).forEach(key => {
    if (Array.isArray(sanitized[key])) {
      sanitized[key] = (sanitized[key] as any[]).pop();
    }
  });

  return sanitized;
});

/**
 * --- CORE MIDDLEWARE CONFIGURATION ---
 */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://www.joulezeropoint.com',
  'https://joulezeropoint.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
].filter(Boolean) as string[];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[SECURITY] CORS_REJECTED: Origin=${origin} is not in the whitelist.`);
      callback(new Error('Non autorizzato dalla politica CORS di Joule.'));
    }
  },
  credentials: true
}));

app.use(express.json());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:*"],
      "script-src": process.env.NODE_ENV === 'production'
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "font-src": ["'self'"],
      "connect-src": ["'self'", "https://*.vercel-analytics.com"],
    },
  },
}));

// Body and Params Sanitization (Mutable properties)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

// Uptime liveness ping
app.get('/ping', (req: Request, res: Response) => {
  logger.info('[MATRIX] Pulse detected (Root).');
  res.status(200).send('pong');
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Troppe richieste dalle tue coordinate galattiche (IP). Prego riprovare tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

if (process.env.NODE_ENV !== 'test') {
  app.use('/api', limiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Troppi tentativi di autenticazione. Il tuo portale di accesso è stato temporaneamente bloccato.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  app.use('/api/v1/auth/forgot-password', authLimiter);
  app.use('/api/v1/auth/resend-verification', authLimiter);
}

const DB_READY_STATE_LABELS: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Readiness Healthcheck.
 */
app.get('/api/v1/health', (req: Request, res: Response) => {
  const dbReadyState = mongoose.connection.readyState;
  const dbStatus = DB_READY_STATE_LABELS[dbReadyState] || 'unknown';
  const isHealthy = dbReadyState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OPERATIONAL' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    service: 'nucleo-punto-zero',
    uptimeSeconds: Math.floor(process.uptime()),
    checks: {
      database: dbStatus,
    },
  });
});

/**
 * Request Logging (Development only)
 */
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });
}

/**
 * --- ROUTE ORCHESTRATION ---
 */
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/decks', deckRoutes);
app.use('/api/v1/cards', cardRoutes);
app.use('/api/v1/rules', rulebookRoutes);
app.use('/api/v1/terminal', terminalRoutes);
app.use('/api/v1/seo', seoRoutes);
app.use('/api/v1/contact', contactRoutes);

/**
 * --- STATIC ASSETS ---
 */
app.use('/news', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(NEWS_IMAGES_DIR));

/**
 * --- 404 HANDLER ---
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Il varco richiesto (${req.originalUrl}) non esiste nella matrice Joule.`
  });
});

/**
 * --- GLOBAL ERROR HANDLER ---
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  logger.error(`SYSTEM_ERROR: ${err.message}\n${err.stack}`);

  res.status(statusCode).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? 'Ø' : err.stack,
  });
});

export default app;
