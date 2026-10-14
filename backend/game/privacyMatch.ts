import Match from '../models/Match';
import type { Mazzo, PlayerId } from './engine';

/**
 * Partite di un utente per l'export GDPR (art. 20).
 * Si esportano solo dati dell'utente: il proprio mazzo e le proprie mosse
 * (le voci del log fatte dal suo ruolo). Niente username dell'avversario,
 * niente mosse dell'avversario o del server: sono dati di un terzo.
 */
export async function partiteDaEsportare(userId: string) {
  const partite = await Match.find({ 'giocatori.userId': userId }).sort({ createdAt: -1 }).lean();
  return partite.map((m) => {
    const io = m.giocatori.find((g) => g.userId === userId)!;
    const ruolo = io.ruolo as PlayerId;
    return {
      data: m.iniziata,
      ruolo,
      esito: m.esito,
      round: m.round,
      durata: m.durata,
      mazzo: m.mazzi[ruolo] as Mazzo,
      mosse: (m.log ?? [])
        .filter((v) => v.giocatore === ruolo)
        .map((v) => ({ t: v.t, azione: v.azione })),
    };
  });
}

/** Le partite restano all'avversario: si toglie solo il legame con l'account cancellato. */
export async function anonimizzaPartite(userId: string): Promise<number> {
  const r = await Match.updateMany(
    { 'giocatori.userId': userId },
    { $set: { 'giocatori.$[g].userId': null, 'giocatori.$[g].username': null } },
    { arrayFilters: [{ 'g.userId': userId }] },
  );
  return r.modifiedCount;
}
