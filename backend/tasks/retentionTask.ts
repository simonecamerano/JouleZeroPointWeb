import cron from 'node-cron';
import User from '../models/User';
import Message from '../models/Message';
import Deck from '../models/Deck';
import logger from '../config/logger';

/**
 * Retention Task: applies the conservation policy declared in the privacy
 * notice. Accounts with no access for 24 months are deleted, together with the
 * terminal conversation and the decks that belong to them.
 *
 * The clock is the `lastLogin` field, written on every successful login and
 * defaulted at registration, so an account that is created and never used again
 * still has a starting point.
 *
 * Nothing here logs an email address or a username of a deleted account: the
 * log keeps counts only, because a retention log that lists who was erased
 * defeats the erasure.
 */

const RETENTION_MONTHS = 24;

export interface RetentionOutcome {
  cutoff: string;
  candidates: number;
  deletedUsers: number;
  deletedMessages: number;
  deletedDecks: number;
  dryRun: boolean;
}

export async function purgeInactiveAccounts(dryRun = true): Promise<RetentionOutcome> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  // Accounts predating the introduction of lastLogin have it defaulted, so a
  // missing value is treated as "never seen" and falls back to createdAt.
  const stale = await User.find({
    $or: [
      { lastLogin: { $lt: cutoff } },
      { lastLogin: { $exists: false }, createdAt: { $lt: cutoff } }
    ]
  }).select('_id username isAdmin');

  const outcome: RetentionOutcome = {
    cutoff: cutoff.toISOString().slice(0, 10),
    candidates: stale.length,
    deletedUsers: 0,
    deletedMessages: 0,
    deletedDecks: 0,
    dryRun
  };

  for (const user of stale) {
    // An administrator account is infrastructure, not a player: deleting it on
    // inactivity would lock the owner out of their own installation.
    if (user.isAdmin) {
      outcome.candidates--;
      continue;
    }

    if (dryRun) continue;

    const usernameLower = user.username.toLowerCase();

    const messages = await Message.deleteMany({ userId: user._id });
    const decks = await Deck.deleteMany({ creator: usernameLower });
    await Deck.updateMany({}, { $pull: { votes: user.username } });
    await User.deleteOne({ _id: user._id });

    outcome.deletedMessages += messages.deletedCount ?? 0;
    outcome.deletedDecks += decks.deletedCount ?? 0;
    outcome.deletedUsers++;
  }

  logger.info(
    `RETENTION_${dryRun ? 'DRYRUN' : 'APPLIED'}: soglia ${outcome.cutoff}, ` +
    `${outcome.candidates} account inattivi, ${outcome.deletedUsers} rimossi, ` +
    `${outcome.deletedMessages} messaggi, ${outcome.deletedDecks} mazzi.`
  );

  return outcome;
}

/**
 * Registers the monthly run. Called at boot: keeping the schedule inside the
 * application avoids the trap of a host cron pinned to a container name, which
 * changes on every deploy.
 */
export const initRetentionTask = (): void => {
  // The first day of the month at 04:00, away from any traffic.
  cron.schedule('0 4 1 * *', async () => {
    try {
      await purgeInactiveAccounts(false);
    } catch (error) {
      logger.error(`RETENTION_FAILURE: ${(error as Error).message}`);
    }
  });

  logger.info(`SANITY_MONITOR: Retention protocol established (${RETENTION_MONTHS} mesi, mensile).`);
};

export default initRetentionTask;

/**
 * Manual entry point, for verifying the policy without waiting for the monthly
 * run: `node dist/tasks/retentionTask.js` reports what would be deleted, and
 * `--apply` actually deletes it.
 */
if (require.main === module) {
  const apply = process.argv.includes('--apply');

  (async () => {
    const mongoose = await import('mongoose');
    const connectDB = (await import('../config/db')).default;

    await connectDB();
    const outcome = await purgeInactiveAccounts(!apply);
    console.log(JSON.stringify(outcome, null, 2));
    await mongoose.default.disconnect();
    process.exit(0);
  })().catch((error: unknown) => {
    logger.error(`RETENTION_CLI_FAILURE: ${(error as Error).message}`);
    process.exit(1);
  });
}
