import { applica, chiDeveAgire, creaPartita, mosseLegali, verificaInvarianti, vista } from '../../game/engine';
import { intero } from '../../game/engine/rng';
import { PlayerId, StatoPartita } from '../../game/engine/types';
import { Vista } from '../../game/engine/vista';
import { catalogoProva, mazzoProva } from './helpers';

/**
 * Registra in `visti` ogni uid che il giocatore ha visto con un cardId, poi controlla che nessuna carta
 * coperta avversaria mostri un cardId o un uid già visto: sarebbe una carta nascosta riconoscibile.
 */
function controllaVista(v: Vista, visti: Map<string, number>): string | null {
  const reg = (c: { uid: string; cardId: number | null } | null) => {
    if (c && c.cardId !== null) visti.set(c.uid, c.cardId);
  };
  if (v.decisione?.tipo === 'sceltaEffetto' && v.decisione.giocatore !== v.io && v.decisione.domanda !== null) {
    return `${v.io} vede la domanda di una scelta altrui`;
  }
  const coperte = Object.values(v.colonne).flat().filter((c) => c.coperta && c.owner !== v.io);
  for (const c of coperte) {
    if (c.cardId !== null) return `${v.io} vede il cardId della carta coperta ${c.uid}`;
    if (visti.has(c.uid)) return `${v.io} riconosce la carta coperta ${c.uid}: l'aveva vista come ${visti.get(c.uid)}`;
  }
  for (const col of Object.values(v.colonne)) col.forEach(reg);
  v.stack.forEach(reg);
  reg(v.anomalia);
  for (const g of Object.values(v.giocatori)) {
    (g.mano ?? []).forEach(reg);
    g.memoria.forEach(reg);
    g.orizzonte.forEach(reg);
    reg(g.costruttore);
  }
  return null;
}

function partitaCasuale(seed: number): StatoPartita {
  let s = creaPartita({ seed, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
  const r = { rng: seed * 7919 };
  const visti: Record<PlayerId, Map<string, number>> = { A: new Map(), B: new Map() };
  for (let passo = 0; passo < 3000 && !s.esito; passo++) {
    const p = chiDeveAgire(s);
    if (!p) throw new Error(`seed ${seed} passo ${passo}: nessuno deve agire ma la partita non è finita`);
    // Il pannello manuale non si simula: `usaEffetto` aprirebbe effetti a vuoto senza fine.
    const mosse = mosseLegali(s, p).filter((m) => m.tipo !== 'usaEffetto');
    if (!mosse.length) throw new Error(`seed ${seed} passo ${passo}: nessuna mossa legale per ${p}`);
    const m = mosse[intero(r, mosse.length)];
    const res = applica(s, p, m);
    if (!res.ok) throw new Error(`seed ${seed} passo ${passo}: ${JSON.stringify(m)} rifiutata: ${res.errore}`);
    s = res.stato;
    // Il log non entra nelle regole: svuotarlo evita che ogni structuredClone diventi più lento a ogni passo.
    s.log = [];
    const inv = verificaInvarianti(s);
    if (inv.length) throw new Error(`seed ${seed} passo ${passo}: ${inv.join('; ')}`);
    for (const io of ['A', 'B'] as PlayerId[]) {
      const fuga = controllaVista(vista(s, io), visti[io]);
      if (fuga) throw new Error(`seed ${seed} passo ${passo}: ${fuga}`);
    }
  }
  return s;
}

describe('partite simulate', () => {
  test('100 partite casuali: nessun blocco, nessuna mossa legale rifiutata, invarianti sempre veri', () => {
    let finite = 0;
    for (let seed = 1; seed <= 100; seed++) if (partitaCasuale(seed).esito) finite += 1;
    // Il gioco casuale non garantisce la fine entro 3000 passi, ma la maggior parte deve finire.
    expect(finite).toBeGreaterThanOrEqual(50);
  }, 120_000);

  test('la stessa sequenza di seed produce la stessa partita', () => {
    expect(partitaCasuale(42)).toEqual(partitaCasuale(42));
  });
});
