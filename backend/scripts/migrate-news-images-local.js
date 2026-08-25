/**
 * One-off migration: point news images at this domain instead of Cloudinary.
 *
 * News images used to be uploaded to Cloudinary, which meant a third party
 * received the IP address of every visitor who opened a news item. The files
 * now live on this server, under the persistent volume mounted at public/news,
 * and are served by nginx through /news.
 *
 * This script rewrites the stored URLs accordingly:
 *   https://res.cloudinary.com/<cloud>/image/upload/v<version>/joule_news/<file>
 *   becomes /news/<file>
 *
 * It does NOT copy the files: they must already be in place before this runs,
 * otherwise the news items are left pointing at images that do not exist. The
 * script checks for each file and refuses to rewrite the ones that are missing.
 *
 * Dry run (default, changes nothing):  node scripts/migrate-news-images-local.js
 * Actually rewrite:                    node scripts/migrate-news-images-local.js --apply
 */
const mongoose = require( 'mongoose' );
const path = require( 'path' );
const fs = require( 'fs' );
require( 'dotenv' ).config( { path: path.join( __dirname, '../.env' ) } );

const isDocker = __dirname.includes( '/app/scripts' );
const basePath = isDocker ? '../dist' : '..';

const loadDefault = ( modulePath ) => {
  const loaded = require( modulePath );
  return loaded.default || loaded;
};

const News = loadDefault( `${basePath}/models/News` );

// Same resolution as config/paths.ts, which multer and express.static share.
const IMAGES_DIR = path.resolve( process.cwd(), 'public/news' );

async function migrate() {
  const apply = process.argv.includes( '--apply' );

  if ( !process.env.MONGODB_URI ) {
    throw new Error( 'MONGODB_URI is not defined' );
  }

  await mongoose.connect( process.env.MONGODB_URI );
  console.log( `Connected. Mode: ${apply ? 'APPLY (rewrites URLs)' : 'DRY RUN (no changes)'}` );
  console.log( `Looking for image files in: ${IMAGES_DIR}` );

  const items = await News.find( { imageUrl: /res\.cloudinary\.com/ } ).select( '_id slug imageUrl' );
  console.log( `News items still pointing at Cloudinary: ${items.length}` );

  let migrati = 0;
  let mancanti = 0;

  for ( const item of items ) {
    const fileName = item.imageUrl.split( '/' ).pop();
    const localPath = path.join( IMAGES_DIR, fileName );

    if ( !fs.existsSync( localPath ) ) {
      console.log( `MISSING  ${item.slug}: ${fileName} is not on this server, left untouched` );
      mancanti++;
      continue;
    }

    if ( apply ) {
      item.imageUrl = `/news/${fileName}`;
      await item.save();
    }
    console.log( `${apply ? 'MIGRATED' : 'WOULD MIGRATE'} ${item.slug}: ${fileName}` );
    migrati++;
  }

  console.log( `\n${apply ? 'Rewritten' : 'Would rewrite'}: ${migrati}. Left untouched for missing files: ${mancanti}.` );

  if ( mancanti > 0 ) {
    console.log( 'Copy the missing files into the volume and run again: a news item pointing at a file that is not there shows a broken image.' );
  }
  if ( !apply ) {
    console.log( 'Dry run: nothing was changed. Pass --apply to rewrite.' );
  }
}

migrate()
  .catch( ( error ) => {
    console.error( 'Migration failed:', error.message );
    process.exitCode = 1;
  } )
  .finally( async () => {
    await mongoose.disconnect();
  } );
