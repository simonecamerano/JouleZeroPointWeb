import { intero } from './rng';
import { Carta, GIOCATORI, PlayerId, StatoPartita } from './types';

function uidInUso(s: StatoPartita): Set<string> {
  const usati = new Set<string>();
  for (const p of GIOCATORI) {
    const g = s.giocatori[p];
    for (const c of [...g.futuro, ...g.memoria, ...g.mano, ...g.orizzonte, g.costruttore]) usati.add(c.uid);
  }
  for (const col of Object.values(s.colonne)) for (const fc of col) usati.add(fc.uid);
  if (s.anomalia) usati.add(s.anomalia.uid);
  for (const v of s.stack) usati.add(v.carta.uid);
  return usati;
}

/**
 * Uid nuovo per una carta che entra in una zona nascosta (mano, mazzo Futuro). Viene dall'rng della
 * partita e non da un contatore: l'avversario conta le pescate nel log pubblico, e un uid che resta
 * uguale collegherebbe una carta vista (Memoria, campo scoperto) alla stessa carta giocata coperta.
 */
export function nuovoUid(s: StatoPartita, p: PlayerId): string {
  const usati = uidInUso(s);
  let uid: string;
  do uid = `${p}-${intero(s, 2 ** 31).toString(36)}`;
  while (usati.has(uid));
  return uid;
}

/** Copia della carta con un uid nuovo, per l'ingresso in una zona nascosta. */
export function rinomina(s: StatoPartita, c: Carta): Carta {
  return { uid: nuovoUid(s, c.owner), cardId: c.cardId, owner: c.owner };
}
