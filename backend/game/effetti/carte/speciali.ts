// Effetti che il linguaggio non esprime: funzioni scritte a mano, registrate con `azione(...)`.
import { metti } from '../../engine/campo';
import { contaInColonna, def, isFrammento } from '../../engine/carte';
import { log, nomeG } from '../../engine/log';
import { Carta } from '../../engine/types';
import { Ctx, nomeFonte } from '../dsl';

/**
 * 203 Vuoto di Probabilità. "Il tuo mazzo" è il mazzo del Futuro anche a flusso invertito (regolamento v6,
 * note sul flusso invertito: "guardano sempre a destra").
 */
export function vuotoDiProbabilita(c: Ctx): void {
  const g = c.s.giocatori[c.controllore];
  const prime = g.futuro.slice(0, 2);
  if (!prime.length) return;
  log(c.s, `${nomeFonte(c)}: guardi ${prime.map((x) => def(c.s, x.cardId).nome).join(' e ')}`, c.controllore);
  const frammenti = prime.filter((x) => isFrammento(def(c.s, x.cardId).tipo));
  // Si chiede sempre, con 'Nessuno' come default (opzione 0): l'avversario non deve dedurre se c'era un Frammento.
  let scelta: Carta | null = null;
  const candidati = contaInColonna(c.s, 'futuro', c.controllore) < 4 ? frammenti : [];
  const r = c.chiedi({
    tipo: 'opzione', testo: `${nomeFonte(c)}: metti un Frammento nel tuo Futuro coperto?`,
    opzioni: ['Nessuno', ...candidati.map((x) => def(c.s, x.cardId).nome)],
  });
  if (typeof r === 'number' && r >= 1 && r <= candidati.length) scelta = candidati[r - 1];
  g.futuro.splice(0, prime.length);
  const resto = prime.filter((x) => x !== scelta);
  g.futuro.push(...resto);
  if (scelta) {
    metti(c.s, scelta, 'futuro', { coperta: true });
    log(c.s, `${nomeG(c.controllore)} mette un Frammento coperto nel Futuro`);
  }
  log(c.s, `${nomeG(c.controllore)} rimette ${resto.length} ${resto.length === 1 ? 'carta' : 'carte'} in fondo al mazzo`);
}
