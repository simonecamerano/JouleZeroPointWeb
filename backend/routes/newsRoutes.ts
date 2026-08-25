import express, { Request, Response } from 'express';
import logger from '../config/logger';
import { 
  getNews, 
  getNewsBySlug, 
  createNews, 
  updateNews, 
  deleteNews,
  getAdminNews
} from '../controllers/newsController';
import { adminProtect } from '../middleware/adminMiddleware';
import { uploadNewsImage } from '../config/multer';

/**
 * News Routes (TypeScript).
 * 
 * Orchestrates the public-facing news feed and the administrative 
 * editorial dashboard, including lore management and asset uploads.
 */

const router = express.Router();

/**
 * @route   GET /api/v1/news
 * @desc    Retrieve all published news artifacts
 * @access  Public
 */
router.get('/', getNews);

/**
 * @route   GET /api/v1/news/:slug
 * @desc    Retrieve news details by unique slug designation
 * @access  Public
 */
router.get('/:slug', getNewsBySlug);

/**
 * @route   GET /api/v1/news/admin/all
 * @desc    Administrative overview of all news (including drafts)
 * @access  Private/Admin
 */
router.get('/admin/all', adminProtect, getAdminNews);

/**
 * @route   POST /api/v1/news
 * @desc    Initialize a new news artifact
 * @access  Private/Admin
 */
router.post('/', adminProtect, createNews);

/**
 * @route   PUT /api/v1/news/:slug
 * @desc    Modify an existing news artifact
 * @access  Private/Admin
 */
router.put('/:slug', adminProtect, updateNews);

/**
 * @route   DELETE /api/v1/news/:slug
 * @desc    Eradicate a news artifact from the registry
 * @access  Private/Admin
 */
router.delete('/:slug', adminProtect, deleteNews);

/**
 * @route   POST /api/v1/news/admin/upload-image
 * @desc    Upload news imagery to the central asset repository
 * @access  Private/Admin
 * @protocol Manages file size constraints via Multer. The file is stored on this
 *           server, under public/news, which is a persistent volume: images used to
 *           be uploaded to Cloudinary, a third party that received the IP address of
 *           every visitor who opened a news item. Serving them from our own domain
 *           removes that recipient entirely, which is simpler than governing it.
 */
router.post('/admin/upload-image', adminProtect, (req: Request, res: Response) => {
    uploadNewsImage.single('image')(req, res, async (error: any) => {
        if (error) {
            logger.error(`UPLOAD_ERROR: multer error — ${error.message}`);
            const message = error.message === 'File too large'
                ? 'Image asset exceeds maximum scale threshold (4MB limit).'
                : error.message || 'Error occurred during image asset transmission.';
            return res.status(400).json({ error: message });
        }

        if (!req.file) {
            logger.warn('UPLOAD_ERROR: req.file is undefined after multer processing');
            return res.status(400).json({ error: 'Null payload detected: No asset file received.' });
        }

        // The path is relative on purpose: pages and API answer on the same origin,
        // so an absolute URL would only hardcode the domain and break the day it
        // changes. nginx routes /news to this service.
        return res.status(201).json({
            imageUrl: `/news/${req.file.filename}`
        });
    });
});

export default router;
