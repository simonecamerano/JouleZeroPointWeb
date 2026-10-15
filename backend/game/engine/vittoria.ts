import { statoDi } from './carte';
import { log, nomeG } from './log';
import { altro, COLONNE, GIOCATORI, MotivoFine, PlayerId, STATI, StatoPartita } from './types';

/** Collasso (IT ≤ 0) e Collasso Entropico. Due sconfitti nello stesso momento = pareggio. */
export function verificaFine(s: StatoPartita): void {
  if (s.esito) return;
  const perdenti = new Map<PlayerId, MotivoFine>();
  for (const p of GIOCATORI) if (s.giocatori[p].it <= 0) perdenti.set(p, 'collasso');
  for (const sc of s.sconfitte) if (!perdenti.has(sc.giocatore)) perdenti.set(sc.giocatore, sc.motivo);
  if (perdenti.size === 0) return;
  if (perdenti.size === 2) {
    s.esito = { vincitore: null, motivo: 'pareggio' };
    log(s, 'Partita terminata: pareggio');
    return;
  }
  const [[perdente, motivo]] = [...perdenti];
  s.esito = { vincitore: altro(perdente), motivo };
  log(s, `Partita terminata: vince ${nomeG(altro(perdente))} (${motivo})`);
}

export function haSincronia(s: StatoPartita, p: PlayerId): boolean {
  const mie = (col: (typeof COLONNE)[number]) => s.colonne[col].filter((c) => c.owner === p);
  if (COLONNE.some((col) => mie(col).length === 0)) return false;
  const tutte = COLONNE.flatMap(mie);
  const stati = new Set(tutte.map((fc) => statoDi(s, fc)));
  const mancanti = STATI.filter((st) => !stati.has(st));
  if (mancanti.length === 0) return true;
  const oscure = tutte.filter((fc) => statoDi(s, fc) === 'Materia Oscura').length;
  return mancanti.length === 1 && mancanti[0] !== 'Materia Oscura' && oscure >= 2;
}

export function verificaSincronia(s: StatoPartita): void {
  if (s.esito) return;
  const vincitori = GIOCATORI.filter((p) => haSincronia(s, p));
  if (vincitori.length === 2) {
    s.esito = { vincitore: null, motivo: 'pareggio' };
    log(s, 'Sincronia simultanea: pareggio');
  } else if (vincitori.length === 1) {
    s.esito = { vincitore: vincitori[0], motivo: 'sincronia' };
    log(s, `Sincronia: vince ${nomeG(vincitori[0])}`);
  }
}

export function fineRound(s: StatoPartita): void {
  for (const p of GIOCATORI) {
    const g = s.giocatori[p];
    g.supportoUsati = 0;
    g.supportoPep = 0;
    g.supportoRp = 0;
    g.haPassato = false;
  }
  for (const col of COLONNE) {
    for (const fc of s.colonne[col]) fc.modifiche = fc.modifiche.filter((m) => m.durata === 'permanente');
  }
  for (const k of Object.keys(s.usi)) if (k.endsWith(':round')) delete s.usi[k];
  s.silenziate = [];
  s.sconti = [];
  s.iniziativa = altro(s.iniziativa);
  s.round += 1;
  log(s, `Inizia il round ${s.round}. Iniziativa a ${nomeG(s.iniziativa)}`);
}
