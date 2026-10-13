import { cercaInCampo, def } from './carte';
import { log, nomeG, NOMI_COLONNA } from './log';
import { ricalcolaTP } from './temperatura';
import { Carta, CartaCampo, Colonna, StatoPartita } from './types';

export function aCarta(fc: CartaCampo): Carta {
  return { uid: fc.uid, cardId: fc.cardId, owner: fc.owner };
}

/** +1 PEP se Calda, +1 RP se Fredda, al totale del giocatore per la Collisione del round. Max 2 per round. */
export function supportoIstantaneo(s: StatoPartita, fc: CartaCampo): void {
  const g = s.giocatori[fc.owner];
  if (g.supportoUsati >= 2) return;
  const t = def(s, fc.cardId).termica;
  if (t === 'Caldo') {
    g.supportoPep += 1;
    g.supportoUsati += 1;
    log(s, `Supporto Istantaneo: ${nomeG(fc.owner)} +1 PEP`);
  } else if (t === 'Freddo') {
    g.supportoRp += 1;
    g.supportoUsati += 1;
    log(s, `Supporto Istantaneo: ${nomeG(fc.owner)} +1 RP`);
  }
}

export function metti(
  s: StatoPartita, carta: Carta, colonna: Colonna, opz: { coperta?: boolean; supporto?: boolean } = {},
): CartaCampo {
  const fc: CartaCampo = {
    uid: carta.uid, cardId: carta.cardId, owner: carta.owner,
    coperta: opz.coperta ?? false, segnalino: null, statoForzato: null, modifiche: [],
  };
  s.colonne[colonna].push(fc);
  if (colonna === 'passato' && opz.supporto !== false) supportoIstantaneo(s, fc);
  if (colonna === 'presente') ricalcolaTP(s);
  return fc;
}

/**
 * Toglie una carta dal campo. Con `ricalcola: false` non ricalcola la TP: serve a chi toglie più carte
 * in blocco (Collasso del Presente) e ricalcola una volta sola alla fine, così la TP non passa per
 * valori intermedi che dipendono dall'ordine delle carte e non provoca Inversioni spurie.
 */
export function togli(s: StatoPartita, uid: string, opz: { ricalcola?: boolean } = {}): CartaCampo | null {
  const t = cercaInCampo(s, uid);
  if (!t) return null;
  s.colonne[t.colonna] = s.colonne[t.colonna].filter((c) => c.uid !== uid);
  if (t.colonna === 'presente' && opz.ricalcola !== false) ricalcolaTP(s);
  return t.carta;
}

export function distruggi(s: StatoPartita, uid: string, opz: { ricalcola?: boolean } = {}): boolean {
  const fc = togli(s, uid, opz);
  if (!fc) return false;
  s.giocatori[fc.owner].orizzonte.push(aCarta(fc));
  log(s, `${def(s, fc.cardId).nome} finisce nell'Orizzonte degli Eventi`);
  return true;
}

/** Sposta per effetto: conserva modifiche e stato forzato, non dà Supporto Istantaneo salvo richiesta. */
export function sposta(
  s: StatoPartita, uid: string, colonna: Colonna, opz: { supporto?: boolean; ricalcola?: boolean } = {},
): CartaCampo | null {
  const fc = togli(s, uid, { ricalcola: opz.ricalcola });
  if (!fc) return null;
  const coperta = fc.coperta && colonna === 'futuro';
  const n = metti(s, aCarta(fc), colonna, { supporto: opz.supporto ?? false, coperta });
  n.modifiche = fc.modifiche;
  n.statoForzato = fc.statoForzato;
  if (colonna === 'presente' && opz.ricalcola !== false) ricalcolaTP(s);
  log(s, `${coperta ? 'Un Frammento coperto' : def(s, fc.cardId).nome} si sposta nel ${NOMI_COLONNA[colonna]}`);
  return n;
}
