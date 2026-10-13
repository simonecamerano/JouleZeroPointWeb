import { eseguiSlittamento } from '../../game/engine/slittamento';
import { eseguiRisorse, mazzoAttivo, pesca } from '../../game/engine/risorse';
import { carta, inCampo, statoVuoto } from './helpers';

describe('Slittamento', () => {
  test('flusso normale: Futuro → Presente → Passato → Memoria', () => {
    const s = statoVuoto();
    const vecchia = inCampo(s, 'A', 2, 'passato');
    const pres = inCampo(s, 'B', 3, 'presente');
    const fut = inCampo(s, 'A', 4, 'futuro', { coperta: true });
    eseguiSlittamento(s);
    expect(s.giocatori.A.memoria[0].uid).toBe(vecchia.uid);
    expect(s.colonne.passato.map((c) => c.uid)).toEqual([pres.uid]);
    expect(s.colonne.presente.map((c) => c.uid)).toEqual([fut.uid]);
    expect(s.colonne.presente[0].coperta).toBe(false);
    expect(s.colonne.futuro).toHaveLength(0);
    // Gas Caldo entrato nel Passato: Supporto Istantaneo per B
    expect(s.giocatori.B.supportoPep).toBe(1);
    // Plasma Caldo ora nel Presente
    expect(s.tp).toBe(1);
  });

  test('flusso invertito: Passato → Presente → Futuro → mazzo Futuro', () => {
    const s = statoVuoto();
    s.flusso = 'invertito';
    const pas = inCampo(s, 'A', 1, 'passato');
    const pres = inCampo(s, 'A', 2, 'presente');
    const fut = inCampo(s, 'B', 3, 'futuro');
    eseguiSlittamento(s);
    expect(s.giocatori.B.futuro[0].uid).toBe(fut.uid);
    expect(s.colonne.futuro.map((c) => c.uid)).toEqual([pres.uid]);
    expect(s.colonne.presente.map((c) => c.uid)).toEqual([pas.uid]);
    expect(s.colonne.passato).toHaveLength(0);
  });

  test('azzera lo spostamento di TP e i segnalini', () => {
    const s = statoVuoto();
    s.tpSpostamento = 3;
    const fc = inCampo(s, 'A', 2, 'futuro', { segnalino: 'caldo' });
    eseguiSlittamento(s);
    expect(s.tpSpostamento).toBe(0);
    expect(s.tp).toBe(0);
    expect(fc.segnalino).toBeNull();
  });
});

describe('Risorse', () => {
  test('ET al massimo del round, fino a 10', () => {
    const s = statoVuoto();
    s.giocatori.A.futuro = [carta('A', 1)];
    s.giocatori.B.futuro = [carta('B', 1)];
    s.round = 3;
    eseguiRisorse(s);
    expect(s.giocatori.A.etMax).toBe(5);
    expect(s.giocatori.A.et).toBe(5);
    s.round = 20;
    s.giocatori.A.futuro = [carta('A', 1)];
    s.giocatori.B.futuro = [carta('B', 1)];
    eseguiRisorse(s);
    expect(s.giocatori.B.etMax).toBe(10);
  });

  test('pesca dal Futuro in flusso normale, dalla Memoria in flusso invertito', () => {
    const s = statoVuoto();
    const f = carta('A', 1); const m = carta('A', 2);
    s.giocatori.A.futuro = [f]; s.giocatori.A.memoria = [m];
    expect(mazzoAttivo(s, 'A')).toBe(s.giocatori.A.futuro);
    expect(pesca(s, 'A')).toBe(true);
    expect(s.giocatori.A.mano.map((c) => c.uid)).toEqual([f.uid]);
    s.flusso = 'invertito';
    expect(pesca(s, 'A')).toBe(true);
    expect(s.giocatori.A.mano.map((c) => c.uid)).toEqual([f.uid, m.uid]);
  });

  test('pescare da un mazzo attivo vuoto registra il Collasso Entropico', () => {
    const s = statoVuoto();
    expect(pesca(s, 'B')).toBe(false);
    expect(s.sconfitte).toEqual([{ giocatore: 'B', motivo: 'collassoEntropico' }]);
  });

  test('Bonus Controllo a chi ha più Frammenti nel Presente, nessuno in parità', () => {
    const s = statoVuoto();
    s.giocatori.A.futuro = [carta('A', 1), carta('A', 1)];
    s.giocatori.B.futuro = [carta('B', 1), carta('B', 1)];
    inCampo(s, 'B', 1, 'presente');
    eseguiRisorse(s);
    expect(s.decisione).toEqual({ tipo: 'bonusControllo', giocatore: 'B' });
    s.decisione = null;
    inCampo(s, 'A', 1, 'presente');
    eseguiRisorse(s);
    expect(s.decisione).toBeNull();
  });

  test('azzera lo Scambio del round', () => {
    const s = statoVuoto();
    s.giocatori.A.futuro = [carta('A', 1)];
    s.giocatori.B.futuro = [carta('B', 1)];
    s.giocatori.A.scambioUsato = true;
    eseguiRisorse(s);
    expect(s.giocatori.A.scambioUsato).toBe(false);
  });
});
