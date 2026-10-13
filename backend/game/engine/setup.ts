import { Mazzo, validaMazzo } from './carte';
import { log, nomeG } from './log';
import { intero, mescola } from './rng';
import { altro, DefCarta, Giocatore, GIOCATORI, PlayerId, StatoPartita } from './types';

export function creaPartita(o: {
  seed: number; mazzi: Record<PlayerId, Mazzo>; catalogo: Record<number, DefCarta>;
}): StatoPartita {
  for (const p of GIOCATORI) {
    const e = validaMazzo(o.mazzi[p], o.catalogo);
    if (e) throw new Error(`Mazzo ${p}: ${e}`);
  }
  const carte: Record<number, DefCarta> = {};
  for (const p of GIOCATORI) {
    for (const id of [...o.mazzi[p].carte, o.mazzi[p].costruttore]) carte[id] = o.catalogo[id];
  }
  const giocatore = (p: PlayerId): Giocatore => ({
    id: p,
    futuro: o.mazzi[p].carte.map((cardId, i) => ({ uid: `${p}${i}`, cardId, owner: p })),
    memoria: [], mano: [], orizzonte: [],
    costruttore: { uid: `${p}-C`, cardId: o.mazzi[p].costruttore, owner: p },
    it: 20, et: 3, etMax: 3, mulliganFatto: false, scambioUsato: false,
    supportoUsati: 0, supportoPep: 0, supportoRp: 0, haPassato: false,
  });
  const s: StatoPartita = {
    rng: o.seed >>> 0 || 1, round: 1, fase: 'setup', flusso: 'normale', tp: 0, tpSpostamento: 0,
    iniziativa: 'A', attivo: 'A',
    colonne: { passato: [], presente: [], futuro: [] },
    anomalia: null, giocatori: { A: giocatore('A'), B: giocatore('B') },
    stack: [], finestra: null, decisione: null, sconfitte: [], esito: null, carte, log: [],
  };
  for (const p of GIOCATORI) {
    const g = s.giocatori[p];
    mescola(s, g.futuro);
    g.memoria = g.futuro.splice(30);
    g.mano = g.futuro.splice(0, 5);
  }
  let a = 0;
  let b = 0;
  while (a === b) {
    a = intero(s, 6) + 1;
    b = intero(s, 6) + 1;
  }
  const w: PlayerId = a > b ? 'A' : 'B';
  log(s, `Dado per l'iniziativa: A ${a}, B ${b}. Sceglie ${nomeG(w)}`);
  s.iniziativa = w;
  s.attivo = w;
  s.decisione = { tipo: 'sceltaIniziativa', giocatore: w };
  return s;
}

export function sceltaIniziativa(s: StatoPartita, p: PlayerId, tieni: boolean): string | null {
  s.iniziativa = tieni ? p : altro(p);
  s.attivo = s.iniziativa;
  log(s, `Iniziativa a ${nomeG(s.iniziativa)}`);
  s.decisione = { tipo: 'mulligan', giocatore: s.iniziativa };
  return null;
}

export function mulligan(s: StatoPartita, p: PlayerId, esegui: boolean): string | null {
  const g = s.giocatori[p];
  if (esegui) {
    g.futuro.push(...g.mano);
    g.mano = [];
    mescola(s, g.futuro);
    g.mano = g.futuro.splice(0, 4);
    log(s, `${nomeG(p)} fa mulligan`);
  }
  g.mulliganFatto = true;
  const o = altro(p);
  if (!s.giocatori[o].mulliganFatto) {
    s.decisione = { tipo: 'mulligan', giocatore: o };
  } else {
    s.decisione = null;
    s.fase = 'slittamento';
  }
  return null;
}
