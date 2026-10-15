import { creaPartita } from '../../../game/engine';
import { fineRound } from '../../../game/engine/vittoria';
import { catalogoProva, catalogoReale, mazzoProva, statoVuoto } from '../helpers';

describe('stato degli effetti', () => {
  test('una partita nuova ha tutti i campi degli effetti vuoti', () => {
    const s = creaPartita({ seed: 1, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
    expect(s.eventi).toEqual([]);
    expect(s.coda).toEqual([]);
    expect(s.ritardati).toEqual([]);
    expect(s.usi).toEqual({});
    expect(s.silenziate).toEqual([]);
    expect(s.manuali).toEqual([]);
    expect(s.sconti).toEqual([]);
    expect(s.collisione).toBeNull();
    expect(s.sottofase).toBeNull();
    expect(s.tpRiferimento).toBe(0);
    expect(s.segnoTP).toBe(0);
    expect(s.erroriEffetti).toEqual([]);
  });

  test('fineRound azzera usi del round, carte silenziate e sconti, non quelli di Collisione', () => {
    const s = statoVuoto();
    s.usi = { 'A-1:0:round': 1, 'A-2:0:collisione': 1 };
    s.silenziate = ['B-3'];
    s.sconti = [{ giocatore: 'A', colonna: 'futuro', delta: -1 }];
    fineRound(s);
    expect(s.usi).toEqual({ 'A-2:0:collisione': 1 });
    expect(s.silenziate).toEqual([]);
    expect(s.sconti).toEqual([]);
  });

  test('il catalogo reale di prova ha le 120 carte del set', () => {
    const c = catalogoReale();
    expect(Object.keys(c)).toHaveLength(120);
    expect(c[8].nome).toBe('Sciame Termico');
    expect(c[255].tipo).toBe('Costruttore');
  });
});
