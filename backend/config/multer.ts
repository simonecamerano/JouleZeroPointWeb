import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { NEWS_IMAGES_DIR } from './paths';

/**
 * Asset Acquisition Infrastructure (TypeScript).
 * 
 * Orchestrates file uploads using Multer.
 * Files are written straight to their final home, the persistent volume under
 * public/news, and served from there: no third party involved.
 */

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    // The same directory express.static serves, resolved once in config/paths.
    // Created if absent: on a fresh volume the mount point starts out empty.
    fs.mkdirSync(NEWS_IMAGES_DIR, { recursive: true });
    cb(null, NEWS_IMAGES_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Cryptographic Naming: Prevents collisions and obscures original metadata
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  // Integrity Protocol: Only allows visual assets (images)
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

/**
 * Specialized Multer instance for News Imagery.
 * Constraints: 4MB limit per asset node.
 */
export const uploadNewsImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB threshold
});
