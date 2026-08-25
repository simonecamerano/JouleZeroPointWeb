/**
 * Retention: delete accounts inactive for 24 months.
 *
 * The privacy notice (section 4) states that after 24 months without access the
 * account, its Terminal conversations and its decks are deleted automatically.
 * This script is what makes that true: without it the notice would promise
 * something the system never does.
 *
 * Inactivity is measured on lastLogin, which is set at registration and updated
 * at every login, falling back to updatedAt for accounts created before that
 * field existed.
 *
 * What happens to each kind of data:
 *   - user            deleted
 *   - messages        deleted (Terminal conversations, linked by userId)
 *   - decks           deleted, except public ones already imported by other
 *                     players: those lose the link to the username and stay as
 *                     anonymous content, exactly as the notice describes
 *   - votes           the username is pulled from every deck it upvoted, so no
 *                     trace of the person is left in other people's documents
 *
 * Dry run (default, changes nothing):  node scripts/purge-inactive-accounts.js
 * Actually delete:                     node scripts/purge-inactive-accounts.js --apply
 *
 * Intended to run monthly from cron on the host. Logs counts only, never email
 * addresses or usernames.
 */
const mongoose = require( 'mongoose' );
const path = require( 'path' );
require( 'dotenv' ).config( { path: path.join( __dirname, '../.env' ) } );

// Same environment detection as the other scripts: in the image the compiled
// models live in dist, in a local checkout they are TypeScript sources.
const isDocker = __dirname.includes( '/app/scripts' );
const basePath = isDocker ? '../dist' : '..';

const loadDefault = ( modulePath ) => {
  const loaded = require( modulePath );
  return loaded.default || loaded;
};

const User = loadDefault( `${basePath}/models/User` );
const Message = loadDefault( `${basePath}/models/Message` );
const Deck = loadDefault( `${basePath}/models/Deck` );

const MESI_DI_CONSERVAZIONE = 24;
const CREATORE_ANONIMO = 'costruttore-rimosso';

async function purgeInactiveAccounts() {
  const apply = process.argv.includes( '--apply' );

  if ( !process.env.MONGODB_URI ) {
    throw new Error( 'MONGODB_URI is not defined' );
  }

  await mongoose.connect( process.env.MONGODB_URI );
  console.log( `Connected. Mode: ${apply ? 'APPLY (deletes data)' : 'DRY RUN (no changes)'}` );

  const soglia = new Date();
  soglia.setMonth( soglia.getMonth() - MESI_DI_CONSERVAZIONE );
  console.log( `Cutoff: accounts with no access since ${soglia.toISOString().slice( 0, 10 )}` );

  // lastLogin is set at registration, so it is normally present. updatedAt is
  // the fallback for documents written before the field existed.
  const inattivi = await User.find( {
    $or: [
      { lastLogin: { $lt: soglia } },
      { lastLogin: { $exists: false }, updatedAt: { $lt: soglia } }
    ]
  } ).select( '_id username' );

  console.log( `Inactive accounts found: ${inattivi.length}` );

  if ( inattivi.length === 0 ) {
    console.log( 'Nothing to do.' );
    return;
  }

  let messaggi = 0;
  let mazziCancellati = 0;
  let mazziAnonimizzati = 0;
  let votiRimossi = 0;

  for ( const utente of inattivi ) {
    const messaggiUtente = await Message.countDocuments( { userId: utente._id } );
    messaggi += messaggiUtente;

    // Decks are linked by username, not by id: the field is lowercased and
    // trimmed by the schema, and so is the value stored on the user.
    const mazzi = await Deck.find( { creator: utente.username } ).select( '_id isPublic importsCount' );
    const daAnonimizzare = mazzi.filter( ( m ) => m.isPublic && m.importsCount > 0 );
    const daCancellare = mazzi.filter( ( m ) => !( m.isPublic && m.importsCount > 0 ) );
    mazziAnonimizzati += daAnonimizzare.length;
    mazziCancellati += daCancellare.length;

    const conVoto = await Deck.countDocuments( { votes: utente.username } );
    votiRimossi += conVoto;

    if ( apply ) {
      await Message.deleteMany( { userId: utente._id } );
      if ( daCancellare.length > 0 ) {
        await Deck.deleteMany( { _id: { $in: daCancellare.map( ( m ) => m._id ) } } );
      }
      if ( daAnonimizzare.length > 0 ) {
        await Deck.updateMany(
          { _id: { $in: daAnonimizzare.map( ( m ) => m._id ) } },
          { $set: { creator: CREATORE_ANONIMO } }
        );
      }
      await Deck.updateMany( { votes: utente.username }, { $pull: { votes: utente.username } } );
      await User.deleteOne( { _id: utente._id } );
    }
  }

  const verbo = apply ? 'Deleted' : 'Would delete';
  console.log( `${verbo}: ${inattivi.length} accounts, ${messaggi} messages, ${mazziCancellati} decks` );
  console.log( `${apply ? 'Anonymised' : 'Would anonymise'}: ${mazziAnonimizzati} public decks already imported by others` );
  console.log( `${apply ? 'Removed' : 'Would remove'}: upvotes from ${votiRimossi} decks` );

  if ( !apply ) {
    console.log( 'Dry run: nothing was changed. Pass --apply to delete.' );
  }
}

purgeInactiveAccounts()
  .catch( ( error ) => {
    console.error( 'Retention run failed:', error.message );
    process.exitCode = 1;
  } )
  .finally( async () => {
    await mongoose.disconnect();
  } );
