import { Request, Response } from 'express';
import User from '../models/User';
import Deck from '../models/Deck';
import logger from '../config/logger';
import { partiteDaEsportare } from '../game/privacyMatch';

/**
 * Export Controller (TypeScript).
 * 
 * Implements the GDPR Right to Data Portability (Article 20).
 * Allows users to extract their entire digital identity and creations
 * from the Joule Matrix in a machine-readable format (JSON).
 */

/**
 * @desc    Generate a complete data dump for the authenticated user
 * @route   GET /api/v1/auth/export-data
 * @access  Private/Protected
 */
export const exportUserData = async (req: any, res: Response) => {
  try {
    const userId = req.user._id;
    logger.debug(`EXPORT_PROCESS: Starting data extraction for UID: ${userId}`);

    // 1. Fetch User Profile (excluding sensitive hashes)
    const user = await User.findById(userId).select('-password -verificationToken -resetPasswordToken');
    
    if (!user) {
      logger.warn(`EXPORT_PROCESS: User not found for ID: ${userId}`);
      return res.status(404).json({ error: 'Identità non trovata nella Matrice.' });
    }

    logger.debug(`EXPORT_PROCESS: User ${user.username} found. Fetching decks...`);

    // 2. Fetch User Decks
    const decks = await Deck.find({ creator: user.username.toLowerCase() });
    logger.debug(`EXPORT_PROCESS: Found ${decks.length} decks for ${user.username}`);

    // 3. Fetch saved online matches (own deck and own moves only, no opponent data)
    const partite = await partiteDaEsportare(String(user._id));

    // 4. Aggregate Data Structure
    const exportPackage = {
      metadata: {
        application: "Joule: Zero Point",
        version: "1.0.1",
        export_timestamp: new Date().toISOString(),
        legal_basis: "GDPR Article 20 - Data Portability"
      },
      profile: {
        alias: user.usernameDisplay,
        username_id: user.username,
        email: user.email,
        verification_status: user.isVerified,
        account_created: user.createdAt,
        privacy_agreement: {
          accepted: user.privacyAccepted ?? false,
          accepted_at: user.privacyAcceptedAt ?? user.createdAt,
          version: user.privacyVersion ?? 'v0.0-legacy'
        }
      },
      content: {
        decks_count: decks.length,
        decks: decks.map(d => ({
          name: d.name || "Mazzo Senza Nome",
          constructor_id: d.costruttoreId || 0,
          cards: d.cards || [],
          is_public: d.isPublic ?? false,
          created_at: (d as any).createdAt || new Date()
        })),
        matches_count: partite.length,
        matches: partite
      }
    };

    logger.info(`DSAR_SUCCESS: Data portability export completed for user ${user.username}`);
    
    // Express-native attachment handling
    res.attachment(`joule_export_${user.username}.json`);
    return res.json(exportPackage);

  } catch (error) {
    logger.error(`EXPORT_ERROR: ${(error as Error).message}\n${(error as Error).stack}`);
    res.status(500).json({ error: 'Errore durante la generazione del pacchetto dati.' });
  }
};
