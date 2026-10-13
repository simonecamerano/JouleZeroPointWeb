import { contaInColonna, def } from './carte';
import { log, nomeG } from './log';
import { altro, Carta, PlayerId, StatoPartita } from './types';

/** Chi ha l'iniziativa per primo. */
export function ordine(s: StatoPartita): PlayerId[] {
  return [s.iniziativa, altro(s.iniziativa)];
}

export function mazzoAttivo(s: StatoPartita, p: PlayerId): Carta[] {
  return s.flusso === 'normale' ? s.giocatori[p].futuro : s.giocatori[p].memoria;
}

/** Pesca dalla cima del mazzo attivo. Se è vuoto registra il Collasso Entropico. */
export function pesca(s: StatoPartita, p: PlayerId): boolean {
  const c = mazzoAttivo(s, p).shift();
  if (!c) {
    s.sconfitte.push({ giocatore: p, motivo: 'collassoEntropico' });
    log(s, `${nomeG(p)} deve pescare ma il mazzo attivo è vuoto: Collasso Entropico`);
    return false;
  }
  s.giocatori[p].mano.push(c);
  if (s.flusso === 'normale') {
    log(s, `${nomeG(p)} pesca una carta dal Futuro`);
    log(s, `Hai pescato ${def(s, c.cardId).nome}`, p);
  } else {
    log(s, `${nomeG(p)} pesca ${def(s, c.cardId).nome} dalla Memoria`);
  }
  return true;
}

export function eseguiRisorse(s: StatoPartita): void {
  for (const p of ordine(s)) {
    const g = s.giocatori[p];
    g.etMax = Math.min(10, 2 + s.round);
    g.et = g.etMax;
    g.scambioUsato = false;
    pesca(s, p);
  }
  const a = contaInColonna(s, 'presente', 'A');
  const b = contaInColonna(s, 'presente', 'B');
  if (a !== b) s.decisione = { tipo: 'bonusControllo', giocatore: a > b ? 'A' : 'B' };
}
