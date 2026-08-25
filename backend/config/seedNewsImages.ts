import fs from 'fs';
import path from 'path';
import logger from './logger';
import { NEWS_IMAGES_DIR } from './paths';

/**
 * Restores news images that are in the repository but missing from the volume.
 *
 * News images live in a Docker volume, which is the only place they exist: no
 * backup runs on this server, and the copies that used to sit on Cloudinary are
 * gone since the images were moved here on 2026-08-25. A volume lost or
 * recreated empty would leave every published article with a broken image and
 * no way to get it back.
 *
 * The files shipped with the repository are therefore the backup. They are
 * copied into the volume at boot, and only when a file with that name is not
 * already there: an image edited or replaced from the editorial dashboard is
 * never overwritten by the one committed here.
 *
 * Consequence worth knowing: deleting one of these files from the volume by hand
 * does not stick, because the next boot puts it back. To remove one for good,
 * delete it from the repository too.
 */
const SEED_DIR = path.resolve( process.cwd(), 'public/news-seed' );

export const seedNewsImages = (): void => {
  try {
    if ( !fs.existsSync( SEED_DIR ) ) return;

    fs.mkdirSync( NEWS_IMAGES_DIR, { recursive: true } );

    const files = fs.readdirSync( SEED_DIR );
    let restored = 0;

    for ( const file of files ) {
      const destination = path.join( NEWS_IMAGES_DIR, file );
      if ( fs.existsSync( destination ) ) continue;

      fs.copyFileSync( path.join( SEED_DIR, file ), destination );
      restored++;
    }

    if ( restored > 0 ) {
      logger.info( `VIGIL_SYSTEM: ${restored} news image(s) restored into the volume from the repository.` );
    }
  } catch ( error ) {
    // A failure here must not stop the server: the site works without an image,
    // it does not work without the API.
    logger.error( `NEWS_SEED_FAILURE: ${( error as Error ).message}` );
  }
};

export default seedNewsImages;
