// Effetti attivabili ("puoi, una volta per Round...") e mosse del pannello manuale (spec 1C, 4.3).
import { def } from '../engine/carte';
import { log, nomeG } from '../engine/log';
import { Azione, PlayerId, StatoPartita } from '../engine/types';
import { attivaNellaZona, creaCtx, Fonte, fontiAttive, tutteLeFonti } from './dispatcher';
import { dichiarazioni, haDichiarazione } from './registro';

function momentoAperto(s: StatoPartita, p: PlayerId, m: 'azioni' | 'collisione'): boolean {
  if (s.decisione) return false;
  if (m === 'azioni') {
    return s.fase === 'azioni' && !s.finestra && s.attivo === p && !s.giocatori[p].haPassato;
  }
  return s.finestra?.contesto === 'collisione' && s.finestra.priorita === p;
}

const chiaveUso = (f: Fonte, i: number, per: string): string => `${f.uid}:${i}:${per}`;

export function mosseEffetti(s: StatoPartita, p: PlayerId, m: 'azioni' | 'collisione'): Azione[] {
  const out: Azione[] = [];
  if (!momentoAperto(s, p, m)) return out;
  for (const f of fontiAttive(s)) {
    if (f.controllore !== p) continue;
    (dichiarazioni(s, f.cardId) ?? []).forEach((d, i) => {
      if (d.tipo !== 'attivabile' || d.quando !== m || !attivaNellaZona(f, d)) return;
      if (d.limite && s.usi[chiaveUso(f, i, d.limite)]) return;
      const ctx = creaCtx(s, {
        cardId: f.cardId, indice: i, sorgente: f.uid, controllore: p,
        evento: { momento: 'immediato', uid: f.uid, cardId: f.cardId, owner: p }, scelte: [], dati: {},
      });
      if (d.condizione && !d.condizione.f(ctx)) return;
      out.push({ tipo: 'attivaEffetto', uid: f.uid, indice: i });
    });
  }
  if (m === 'azioni') {
    // Pannello manuale: Costruttore, Anomalia e Frammenti nel Presente senza dichiarazione o in ripiego.
    for (const f of tutteLeFonti(s)) {
      if (f.controllore !== p || !['costruttore', 'anomalia', 'presente'].includes(f.zona)) continue;
      const manuale = !haDichiarazione(s, f.cardId) || s.manuali.includes(f.cardId);
      if (manuale && def(s, f.cardId).effetto.trim()) out.push({ tipo: 'usaEffetto', uid: f.uid });
    }
  }
  return out;
}

export function attivaEffetto(s: StatoPartita, p: PlayerId, uid: string, indice: number): string | null {
  const m = s.finestra ? 'collisione' : 'azioni';
  const ok = mosseEffetti(s, p, m).some((x) => x.tipo === 'attivaEffetto' && x.uid === uid && x.indice === indice);
  if (!ok) return 'Effetto non attivabile adesso';
  const f = fontiAttive(s).find((x) => x.uid === uid)!;
  const d = dichiarazioni(s, f.cardId)![indice];
  if (d.limite) s.usi[chiaveUso(f, indice, d.limite)] = 1;
  log(s, `${nomeG(p)} attiva l'effetto di ${def(s, f.cardId).nome}`);
  s.coda.push({
    cardId: f.cardId, indice, sorgente: uid, controllore: p,
    evento: { momento: 'immediato', uid, cardId: f.cardId, owner: p }, scelte: [], dati: {},
  });
  return null;
}
