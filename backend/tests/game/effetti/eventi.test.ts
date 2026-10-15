import { creaPartita } from '../../../game/engine';
import { fineRound } from '../../../game/engine/vittoria';
import { distruggi, sposta } from '../../../game/engine/campo';
import { eseguiSlittamento } from '../../../game/engine/slittamento';
import { inverti, ricalcolaTP } from '../../../game/engine/temperatura';
import { infliggiDanno, perdiVita } from '../../../game/engine/vita';
import { catalogoProva, catalogoReale, inCampo, mazzoProva, statoVuoto } from '../helpers';

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

describe('eventi emessi dal motore', () => {
  test('sposta nel Presente emette entraPresente e frammentoEntraPresente', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'futuro');
    sposta(s, fc.uid, 'presente');
    expect(s.eventi.map((e) => e.momento)).toEqual(['entraPresente', 'frammentoEntraPresente']);
    expect(s.eventi[0]).toMatchObject({ uid: fc.uid, cardId: 3, owner: 'A', da: 'futuro' });
    expect(s.eventi[1]).toMatchObject({ giocatore: 'A' });
  });

  test('una carta coperta che entra non emette il proprio ingresso', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente');
    sposta(s, fc.uid, 'futuro');
    s.eventi = [];
    const coperta = inCampo(s, 'B', 3, 'passato', { coperta: true });
    sposta(s, coperta.uid, 'futuro');
    expect(s.eventi).toEqual([]);
  });

  test('distruggi emette distrutta con colonna e contesto di Collisione', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'B', 1, 'presente');
    s.fase = 'collisione';
    distruggi(s, fc.uid);
    expect(s.eventi).toEqual([
      { momento: 'distrutta', uid: fc.uid, cardId: 1, owner: 'B', da: 'presente', inCollisione: true },
    ]);
  });

  test('lo Slittamento emette gli ingressi e fissa la TP di riferimento', () => {
    const s = statoVuoto();
    const f = inCampo(s, 'A', 3, 'futuro', { coperta: true });
    const p = inCampo(s, 'B', 1, 'presente');
    eseguiSlittamento(s);
    expect(s.eventi.map((e) => [e.momento, (e as { uid?: string }).uid])).toEqual([
      ['entraPassato', p.uid],
      ['entraPresente', f.uid],
      ['frammentoEntraPresente', f.uid],
    ]);
    expect(s.tpRiferimento).toBe(s.tp);
  });

  test('cambio di segno della TP: da +1 a -1 sì, da +1 a 0 no', () => {
    const s = statoVuoto();
    s.tpSpostamento = 1;
    ricalcolaTP(s);
    expect(s.segnoTP).toBe(1);
    s.tpSpostamento = 0;
    ricalcolaTP(s);
    expect(s.eventi).toEqual([]);
    s.tpSpostamento = -1;
    ricalcolaTP(s);
    expect(s.eventi).toEqual([{ momento: 'cambioSegnoTP', valore: -1 }]);
    expect(s.segnoTP).toBe(-1);
  });

  test("l'Inversione emette inversione con chi la provoca", () => {
    const s = statoVuoto();
    inverti(s, 'A');
    inverti(s, null);
    expect(s.eventi).toEqual([{ momento: 'inversione', giocatore: 'A' }, { momento: 'inversione' }]);
  });

  test('danno IT emette dannoIT, perdita di IT no (I6)', () => {
    const s = statoVuoto();
    infliggiDanno(s, 'B', 2);
    perdiVita(s, 'A', 1);
    expect(s.giocatori.B.it).toBe(18);
    expect(s.giocatori.A.it).toBe(19);
    expect(s.eventi).toEqual([{ momento: 'dannoIT', giocatore: 'B', valore: 2, inCollisione: false }]);
  });
});
