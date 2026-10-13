import { contaInColonna, def } from './carte';
import { COLONNE, GIOCATORI, StatoPartita } from './types';

/** Controlli di coerenza usati dai test e dalle partite simulate. Lista vuota = tutto a posto. */
export function verificaInvarianti(s: StatoPartita): string[] {
  const err: string[] = [];
  const uids = new Set<string>();
  const registra = (uid: string) => {
    if (uids.has(uid)) err.push(`uid duplicato ${uid}`);
    uids.add(uid);
  };
  for (const p of GIOCATORI) {
    const g = s.giocatori[p];
    const zone = [g.futuro, g.memoria, g.mano, g.orizzonte];
    let n = zone.reduce((t, z) => t + z.length, 0);
    zone.flat().forEach((c) => registra(c.uid));
    for (const col of COLONNE) {
      for (const fc of s.colonne[col]) if (fc.owner === p) { n += 1; registra(fc.uid); }
    }
    if (s.anomalia?.owner === p) { n += 1; registra(s.anomalia.uid); }
    for (const v of s.stack) {
      if (v.carta.owner === p && def(s, v.carta.cardId).tipo === 'Evento') { n += 1; registra(v.carta.uid); }
    }
    if (n !== 40) err.push(`${p} ha ${n} carte invece di 40`);
    if (g.et < 0) err.push(`${p} ha ET negativa`);
    if (g.etMax > 10) err.push(`${p} ha ET massima oltre 10`);
    if (g.supportoUsati > 2) err.push(`${p} ha più di 2 Supporti nel round`);
    if (!s.esito && s.decisione?.tipo !== 'capienza') {
      for (const col of COLONNE) if (contaInColonna(s, col, p) > 4) err.push(`${p} ha più di 4 Frammenti nel ${col}`);
    }
  }
  if (s.tp < -4 || s.tp > 4) err.push(`TP fuori limite: ${s.tp}`);
  if (s.esito && s.fase !== 'terminata') err.push('esito presente ma fase non terminata');
  return err;
}
