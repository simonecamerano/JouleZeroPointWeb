import path from 'path';

/**
 * Filesystem paths shared by the pieces that write files and the pieces that
 * serve them.
 *
 * This exists because the two had drifted apart: multer wrote uploads to
 * 'public/news' relative to the working directory, which is /app in the image,
 * while express.static served them from __dirname + 'public/news', which is
 * /app/dist/public/news once compiled. Nothing uploaded was ever served, and it
 * went unnoticed because uploads went to Cloudinary and the local branch was
 * only a fallback.
 *
 * Resolving from the working directory keeps a single answer for both, in the
 * container and in a local checkout, and it is the directory the persistent
 * volume is mounted on.
 */
export const NEWS_IMAGES_DIR = path.resolve( process.cwd(), 'public/news' );
