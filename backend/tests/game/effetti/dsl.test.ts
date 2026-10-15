import {
  attivabile, azione, carta, Ctx, descrivi, inCollisione, opzione, puoi, quando, ritardato, scegliUno, se,
  spazioIn, tp, tpAlmeno,
} from '../../../game/effetti/dsl';
import {
  carteDichiarate, dichiarazioneRegistrata, dichiarazioni, haDichiarazione, registraPerTest,
} from '../../../game/effetti/registro';
import { Domanda, Risposta } from '../../../game/engine/types';
import { inCampo, statoVuoto } from '../helpers';

function ctx(over: Partial<Ctx> = {}): Ctx {
  const s = statoVuoto();
  return {
    s, sorgente: 'A-X', cardId: 3, indice: 0, controllore: 'A', evento: { momento: 'immediato' }, dati: {},
    chiedi: () => null, ...over,
  };
}

describe('linguaggio delle dichiarazioni', () => {
  test('ogni mattone si descrive in italiano', () => {
    const d = carta(12, 'Impulso Ionico',
      quando('entraPresente', se(tpAlmeno(1), tp(1))),
      ritardato('perdita', tp(-1)));
    expect(descrivi(d)).toBe('quando entra nel Presente: se la TP è almeno +1: TP +1. «perdita»: TP -1');
    expect(attivabile({ quando: 'azioni', limite: 'round', se: spazioIn('futuro') }, tp(1)).testo)
      .toBe("attivabile nel tuo turno di azioni, una volta per Round, se c'è posto nel tuo Futuro: TP +1");
  });

  test('tp sposta la TP e la ricalcola', () => {
    const c = ctx();
    tp(2).f(c);
    expect(c.s.tp).toBe(2);
    expect(c.s.tpSpostamento).toBe(2);
  });

  test('puoi chiede Sì/No e applica solo con Sì', () => {
    const domande: Domanda[] = [];
    let risposta: Risposta = false;
    const c = ctx({ chiedi: (d) => { domande.push(d); return risposta; } });
    const az = puoi(tp(1));
    az.f(c);
    expect(c.s.tp).toBe(0);
    risposta = true;
    az.f(c);
    expect(c.s.tp).toBe(1);
    expect(domande[0]).toEqual({ tipo: 'siNo', testo: 'Carta 3: vuoi TP +1?' });
  });

  test('scegliUno applica l opzione scelta', () => {
    const c = ctx({ chiedi: () => 1 });
    scegliUno(opzione('TP +1', tp(1)), opzione('TP -1', tp(-1))).f(c);
    expect(c.s.tp).toBe(-1);
  });

  test('inCollisione legge il contesto dell evento', () => {
    expect(inCollisione.f(ctx({ evento: { momento: 'distrutta', inCollisione: true } }))).toBe(true);
    expect(inCollisione.f(ctx())).toBe(false);
  });

  test('azione è la via di uscita in codice', () => {
    const c = ctx();
    azione('metti un segno', (x) => { x.dati.segno = 1; }).f(c);
    expect(c.dati.segno).toBe(1);
  });
});

describe('registro', () => {
  test('la dichiarazione vale solo se il nome coincide con il catalogo della partita', () => {
    const togli = registraPerTest(carta(3, 'Carta 3', quando('entraPresente', tp(1))));
    const s = statoVuoto();
    expect(haDichiarazione(s, 3)).toBe(true);
    expect(dichiarazioni(s, 3)).toHaveLength(1);
    s.carte[3] = { ...s.carte[3], nome: 'Altro nome' };
    expect(dichiarazioni(s, 3)).toBeNull();
    expect(dichiarazioneRegistrata(3)?.nome).toBe('Carta 3');
    togli();
    expect(dichiarazioneRegistrata(3)).toBeNull();
    expect(carteDichiarate()).not.toContain(3);
  });

  test('inCampo resta usabile con le dichiarazioni', () => {
    const s = statoVuoto();
    expect(inCampo(s, 'A', 3, 'presente').cardId).toBe(3);
  });
});
