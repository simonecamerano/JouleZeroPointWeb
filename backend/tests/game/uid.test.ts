import { applica, creaPartita, vista } from '../../game/engine';
import { eseguiSlittamento } from '../../game/engine/slittamento';
import { Carta, PlayerId, StatoPartita } from '../../game/engine/types';
import { Vista } from '../../game/engine/vista';
import { catalogoProva, inCampo, mazzoProva, statoVuoto } from './helpers';

/** Ogni uid che il giocatore ha visto associato a un cardId in questa vista. */
function visti(v: Vista, mappa: Map<string, number>): void {
  const reg = (c: { uid: string; cardId: number | null } | null) => {
    if (c && c.cardId !== null) mappa.set(c.uid, c.cardId);
  };
  for (const col of Object.values(v.colonne)) col.forEach(reg);
  v.stack.forEach(reg);
  reg(v.anomalia);
  for (const p of ['A', 'B'] as PlayerId[]) {
    const g = v.giocatori[p];
    (g.mano ?? []).forEach(reg);
    g.memoria.forEach(reg);
    g.orizzonte.forEach(reg);
    reg(g.costruttore);
  }
}

describe('uid e zone nascoste', () => {
  test('una carta vista nella Memoria, pescata e giocata coperta non è riconoscibile dall\'uid', () => {
    let s: StatoPartita = statoVuoto();
    s.flusso = 'invertito';
    s.giocatori.A.et = 5;
    s.giocatori.A.memoria.push({ uid: 'U', cardId: 4, owner: 'A' });
    const mappaB = new Map<string, number>();
    const passo = (p: PlayerId, a: Parameters<typeof applica>[2]) => {
      visti(vista(s, 'B'), mappaB);
      const r = applica(s, p, a);
      if (!r.ok) throw new Error(r.errore);
      s = r.stato;
    };
    expect(vista(s, 'B').giocatori.A.memoria.map((c) => c.uid)).toContain('U');
    passo('A', { tipo: 'usaEffetto', uid: 'A-C' });
    passo('A', { tipo: 'base', base: { op: 'pesca' } });
    passo('A', { tipo: 'fatto' });
    const inMano = s.giocatori.A.mano.find((c) => c.cardId === 4)!;
    passo('A', { tipo: 'giocaCarta', uid: inMano.uid, colonna: 'futuro' });
    const coperte = vista(s, 'B').colonne.futuro.filter((c) => c.owner === 'A' && c.coperta);
    expect(coperte).toHaveLength(1);
    expect(coperte[0].uid).not.toBe('U');
    expect(coperte[0].cardId).toBeNull();
    expect(mappaB.has(coperte[0].uid)).toBe(false);
  });

  test('la mano iniziale non ha gli uid delle prime posizioni del mazzo', () => {
    const s = creaPartita({ seed: 4, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
    for (const p of ['A', 'B'] as PlayerId[]) {
      const primi = [0, 1, 2, 3, 4].map((i) => `${p}${i}`);
      for (const c of s.giocatori[p].mano) expect(primi).not.toContain(c.uid);
    }
  });

  test('il mulligan cambia gli uid delle carte rimesse nel Futuro e della nuova mano', () => {
    let s = creaPartita({ seed: 4, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
    const w = s.decisione!.giocatore;
    const r0 = applica(s, w, { tipo: 'sceltaIniziativa', tieni: true });
    if (!r0.ok) throw new Error(r0.errore);
    s = r0.stato;
    const prima = new Set(s.giocatori[w].mano.map((c) => c.uid));
    const r = applica(s, w, { tipo: 'mulligan', esegui: true });
    if (!r.ok) throw new Error(r.errore);
    const g = r.stato.giocatori[w];
    for (const c of [...g.mano, ...g.futuro]) expect(prima.has(c.uid)).toBe(false);
  });

  test('Slittamento invertito: la carta che torna nel mazzo Futuro cambia uid', () => {
    const s = statoVuoto();
    s.flusso = 'invertito';
    const fut = inCampo(s, 'B', 3, 'futuro');
    eseguiSlittamento(s);
    const tornata: Carta = s.giocatori.B.futuro[0];
    expect(tornata.cardId).toBe(3);
    expect(tornata.uid).not.toBe(fut.uid);
  });

  test('gli uid nuovi sono deterministici per seed', () => {
    const crea = () => creaPartita({ seed: 9, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
    expect(crea()).toEqual(crea());
  });
});
