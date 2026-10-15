import { emetti } from './eventi';
import { log, nomeG } from './log';
import { PlayerId, StatoPartita } from './types';

/** Danno IT: lo riducono gli effetti che riducono i danni e innesca "se subisci danni IT". */
export function infliggiDanno(s: StatoPartita, p: PlayerId, n: number): void {
  if (n <= 0) return;
  s.giocatori[p].it -= n;
  log(s, `${nomeG(p)} subisce ${n} danni IT (IT ${s.giocatori[p].it})`);
  emetti(s, { momento: 'dannoIT', giocatore: p, valore: n, inCollisione: s.fase === 'collisione' });
}

/** Perdita di IT come costo o penalità: non è un danno (interpretazione I6). */
export function perdiVita(s: StatoPartita, p: PlayerId, n: number): void {
  if (n <= 0) return;
  s.giocatori[p].it -= n;
  log(s, `${nomeG(p)} perde ${n} IT (IT ${s.giocatori[p].it})`);
}
