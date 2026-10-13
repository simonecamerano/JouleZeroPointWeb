import { applica, arrendi, chiDeveAgire, creaPartita, mosseLegali } from '../../game/engine';
import { Azione, PlayerId, StatoPartita } from '../../game/engine/types';
import { catalogoProva, mazzoProva } from './helpers';

const nuova = (seed = 1) =>
  creaPartita({ seed, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });

function ok(s: StatoPartita, p: PlayerId, a: Azione): StatoPartita {
  const r = applica(s, p, a);
  if (!r.ok) throw new Error(`${JSON.stringify(a)}: ${r.errore}`);
  return r.stato;
}

/** Porta la partita al round 1, fase Azioni, senza mulligan. */
function pronta(seed = 1): StatoPartita {
  let s = nuova(seed);
  const w = chiDeveAgire(s)!;
  s = ok(s, w, { tipo: 'sceltaIniziativa', tieni: true });
  s = ok(s, w, { tipo: 'mulligan', esegui: false });
  s = ok(s, w === 'A' ? 'B' : 'A', { tipo: 'mulligan', esegui: false });
  return s;
}

describe('setup', () => {
  test('scissione 30/10, mano di 5, decisione d\'iniziativa al vincitore del dado', () => {
    const s = nuova();
    for (const p of ['A', 'B'] as PlayerId[]) {
      const g = s.giocatori[p];
      expect(g.futuro).toHaveLength(25);
      expect(g.memoria).toHaveLength(10);
      expect(g.mano).toHaveLength(5);
      expect(g.it).toBe(20);
    }
    expect(s.decisione?.tipo).toBe('sceltaIniziativa');
    expect(s.tp).toBe(0);
    expect(s.flusso).toBe('normale');
  });

  test('stesso seed, stessa partita', () => {
    expect(nuova(9)).toEqual(nuova(9));
  });

  test('mazzo non valido: errore', () => {
    const m = mazzoProva(); m.carte.pop();
    expect(() => creaPartita({ seed: 1, mazzi: { A: m, B: mazzoProva() }, catalogo: catalogoProva() }))
      .toThrow(/Mazzo A/);
  });

  test('cedere l\'iniziativa e fare mulligan', () => {
    let s = nuova(3);
    const w = chiDeveAgire(s)!;
    const o: PlayerId = w === 'A' ? 'B' : 'A';
    s = ok(s, w, { tipo: 'sceltaIniziativa', tieni: false });
    expect(s.iniziativa).toBe(o);
    expect(s.decisione).toEqual({ tipo: 'mulligan', giocatore: o });
    s = ok(s, o, { tipo: 'mulligan', esegui: true });
    expect(s.giocatori[o].mano).toHaveLength(4);
    expect(s.giocatori[o].futuro).toHaveLength(26);
    s = ok(s, w, { tipo: 'mulligan', esegui: false });
    // round 1: niente Slittamento, Risorse pesca 1
    expect(s.fase).toBe('azioni');
    expect(s.round).toBe(1);
    expect(s.giocatori[o].mano).toHaveLength(5);
    expect(s.giocatori[w].mano).toHaveLength(6);
    expect(s.giocatori[o].et).toBe(3);
    expect(s.attivo).toBe(o);
  });
});

describe('applica', () => {
  test('rifiuta chi non deve agire e non modifica lo stato', () => {
    const s = pronta();
    const copia = structuredClone(s);
    const altro: PlayerId = s.attivo === 'A' ? 'B' : 'A';
    const r = applica(s, altro, { tipo: 'passaTurno' });
    expect(r.ok).toBe(false);
    expect(s).toEqual(copia);
  });

  test('azione malformata: errore leggibile, stato invariato', () => {
    const s = pronta();
    const copia = structuredClone(s);
    const r1 = applica(s, s.attivo, { tipo: 'boh' } as unknown as Azione);
    expect(r1).toEqual({ ok: false, errore: 'Azione sconosciuta' });
    expect(applica(s, s.attivo, null as unknown as Azione)).toEqual({ ok: false, errore: 'Azione sconosciuta' });
    const r2 = applica(s, s.attivo, { tipo: 'giocaCarta', uid: 'inesistente', colonna: 'presente' });
    expect(r2.ok).toBe(false);
    const r3 = applica(s, s.attivo, { tipo: 'base', base: { op: 'tp', delta: 0.5 } });
    expect(r3.ok).toBe(false);
    expect(s).toEqual(copia);
  });

  test('un round completo: giocata, finestra, effetto manuale, Collisione, round 2', () => {
    let s = pronta(5);
    const a = s.attivo;
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    // dà ad A una carta con effetto, giocabile con 3 ET
    s.giocatori[a].mano.push({ uid: 'X1', cardId: 9, owner: a });
    s = ok(s, a, { tipo: 'giocaCarta', uid: 'X1', colonna: 'presente' });
    expect(chiDeveAgire(s)).toBe(b);
    s = ok(s, b, { tipo: 'passa' });
    expect(s.decisione).toEqual({ tipo: 'effettoManuale', giocatore: a, uid: 'X1', origine: 'stack' });
    s = ok(s, a, { tipo: 'base', base: { op: 'tp', delta: -1 } });
    s = ok(s, a, { tipo: 'fatto' });
    expect(s.stack).toHaveLength(0);
    expect(chiDeveAgire(s)).toBe(a);
    s = ok(s, a, { tipo: 'passaTurno' });
    s = ok(s, b, { tipo: 'passaTurno' });
    expect(s.fase).toBe('collisione');
    expect(s.finestra?.contesto).toBe('collisione');
    s = ok(s, s.iniziativa, { tipo: 'passa' });
    s = ok(s, b === s.iniziativa ? a : b, { tipo: 'passa' });
    expect(s.round).toBe(2);
    expect(s.fase).toBe('azioni');
    expect(s.iniziativa).toBe(b);
    expect(s.attivo).toBe(b);
    // la carta di A è slittata nel Passato
    expect(s.colonne.passato.map((c) => c.uid)).toContain('X1');
  });

  test('Evento in risposta durante la Collisione: la Collisione si risolve comunque', () => {
    let s = pronta(6);
    const a = s.attivo; // pronta() tiene l'iniziativa: a ha l'iniziativa
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    s.giocatori[b].mano.push({ uid: 'EV', cardId: 6, owner: b });
    s = ok(s, a, { tipo: 'passaTurno' });
    s = ok(s, b, { tipo: 'passaTurno' });
    expect(s.finestra).toEqual({ contesto: 'collisione', priorita: a, passi: 0, passiNecessari: 2 });
    s = ok(s, a, { tipo: 'passa' });
    s = ok(s, b, { tipo: 'giocaCarta', uid: 'EV' });
    expect(s.finestra).toEqual({ contesto: 'collisione', priorita: a, passi: 0, passiNecessari: 1 });
    s = ok(s, a, { tipo: 'passa' });
    expect(s.decisione).toEqual({ tipo: 'effettoManuale', giocatore: b, uid: 'EV', origine: 'stack' });
    s = ok(s, b, { tipo: 'fatto' });
    expect(s.giocatori[b].orizzonte.map((c) => c.uid)).toContain('EV');
    expect(s.round).toBe(2);
    expect(s.fase).toBe('azioni');
    expect(s.finestra).toBeNull();
  });

  test('pesca da effetto manuale con mazzo attivo vuoto: la partita finisce subito', () => {
    let s = pronta(7);
    const a = s.attivo;
    s.giocatori[a].futuro = [];
    s = ok(s, a, { tipo: 'usaEffetto', uid: s.giocatori[a].costruttore.uid });
    s = ok(s, a, { tipo: 'base', base: { op: 'pesca' } });
    expect(s.esito).toEqual({ vincitore: a === 'A' ? 'B' : 'A', motivo: 'collassoEntropico' });
    expect(s.fase).toBe('terminata');
    expect(s.decisione).toBeNull();
    expect(chiDeveAgire(s)).toBeNull();
  });

  test('Inversione spontanea allo Slittamento: le Risorse pescano dalla Memoria', () => {
    let s = pronta(8);
    const a = s.attivo;
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    // 4 Caldi nel Futuro di A: allo Slittamento entrano nel Presente, TP +4
    for (let i = 0; i < 4; i++) {
      s.colonne.futuro.push({ uid: `H${i}`, cardId: 3, owner: a, coperta: true, segnalino: null, statoForzato: null, modifiche: [] });
    }
    const memoriaPrima = { A: s.giocatori.A.memoria.length, B: s.giocatori.B.memoria.length };
    s = ok(s, a, { tipo: 'passaTurno' });
    s = ok(s, b, { tipo: 'passaTurno' });
    s = ok(s, s.iniziativa, { tipo: 'passa' });
    s = ok(s, s.iniziativa === a ? b : a, { tipo: 'passa' });
    expect(s.flusso).toBe('invertito');
    expect(s.giocatori.A.memoria.length).toBe(memoriaPrima.A - 1);
    expect(s.giocatori.B.memoria.length).toBe(memoriaPrima.B - 1);
  });

  test('arrendersi fa vincere l\'altro', () => {
    const s = arrendi(pronta(), 'A');
    expect(s.esito).toEqual({ vincitore: 'B', motivo: 'abbandono' });
    expect(chiDeveAgire(s)).toBeNull();
  });
});

describe('mosseLegali', () => {
  test('solo per chi deve agire, e ogni mossa proposta è accettata', () => {
    const s = pronta(11);
    const altro: PlayerId = s.attivo === 'A' ? 'B' : 'A';
    expect(mosseLegali(s, altro)).toEqual([]);
    const mosse = mosseLegali(s, s.attivo);
    expect(mosse).toContainEqual({ tipo: 'passaTurno' });
    for (const m of mosse) expect(applica(s, s.attivo, m).ok).toBe(true);
  });

  test('in una finestra: passa e gli Eventi pagabili', () => {
    let s = pronta(12);
    const a = s.attivo;
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    s.giocatori[b].mano = [{ uid: 'E1', cardId: 8, owner: b }, { uid: 'F1', cardId: 1, owner: b }];
    s.giocatori[a].mano.push({ uid: 'Y', cardId: 2, owner: a });
    s = ok(s, a, { tipo: 'giocaCarta', uid: 'Y', colonna: 'presente' });
    expect(mosseLegali(s, b)).toEqual([{ tipo: 'passa' }, { tipo: 'giocaCarta', uid: 'E1' }]);
  });
});
