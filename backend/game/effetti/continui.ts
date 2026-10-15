// Effetti continui: il motore li interroga quando calcola un valore o controlla una mossa (spec 1C, 4.2).
import { costoEffettivo, isFrammento } from '../engine/carte';
import { CartaCampo, Colonna, DefCarta, PlayerId, StatoPartita } from '../engine/types';
import { Continuo, CtxContinuo, Vieto } from './dsl';
import { attivaNellaZona, fontiAttive } from './dispatcher';
import { dichiarazioni } from './registro';

function continuiAttivi(s: StatoPartita): { c: CtxContinuo; k: Continuo }[] {
  const out: { c: CtxContinuo; k: Continuo }[] = [];
  for (const f of fontiAttive(s)) {
    for (const d of dichiarazioni(s, f.cardId) ?? []) {
      if (d.tipo !== 'continuo' || !d.continuo || !attivaNellaZona(f, d)) continue;
      out.push({ c: { s, sorgente: f.uid, cardId: f.cardId, controllore: f.controllore }, k: d.continuo });
    }
  }
  return out;
}

export function bonusPep(s: StatoPartita, fc: CartaCampo): number {
  return continuiAttivi(s).reduce((t, { c, k }) => t + (k.pep ? k.pep(c, fc) : 0), 0);
}

export function vietato(s: StatoPartita, v: Vieto): boolean {
  return continuiAttivi(s).some(({ c, k }) => !!k.vieta && k.vieta(c, v));
}

const scontoPer = (s: StatoPartita, p: PlayerId, d: DefCarta, colonna?: Colonna) =>
  isFrammento(d.tipo) && colonna ? s.sconti.find((x) => x.giocatore === p && x.colonna === colonna) : undefined;

export function costoPer(s: StatoPartita, p: PlayerId, d: DefCarta, colonna?: Colonna): number {
  let costo = costoEffettivo(d, colonna);
  for (const { c, k } of continuiAttivi(s)) if (k.costo) costo += k.costo(c, p, d, colonna);
  costo += scontoPer(s, p, d, colonna)?.delta ?? 0;
  return Math.max(0, costo);
}

/** Toglie lo sconto usato da una giocata. */
export function consumaSconto(s: StatoPartita, p: PlayerId, d: DefCarta, colonna?: Colonna): void {
  const sc = scontoPer(s, p, d, colonna);
  if (sc) s.sconti.splice(s.sconti.indexOf(sc), 1);
}

/** Blocco Termico: la TP resta entro 1 dal valore subito dopo l'ultimo Slittamento (I1). */
export function tpLimitata(s: StatoPartita, tp: number): number {
  if (!continuiAttivi(s).some(({ k }) => k.limitaTP)) return tp;
  return Math.max(s.tpRiferimento - 1, Math.min(s.tpRiferimento + 1, tp));
}

export function eventoGiocabile(s: StatoPartita, p: PlayerId, d: DefCarta): boolean {
  if (d.tipo !== 'Evento') return true;
  if (vietato(s, { tipo: 'evento', giocatore: p })) return false;
  const soloInCollisione = (dichiarazioni(s, d.cardId) ?? []).some((e) => e.continuo?.soloInCollisione);
  return !soloInCollisione || s.fase === 'collisione';
}
