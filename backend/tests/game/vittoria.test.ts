import { fineRound, haSincronia, verificaFine, verificaSincronia } from '../../game/engine/vittoria';
import { inCampo, statoVuoto } from './helpers';

describe('fine partita', () => {
  test('IT a 0 fa vincere l\'avversario per Collasso', () => {
    const s = statoVuoto();
    s.giocatori.B.it = 0;
    verificaFine(s);
    expect(s.esito).toEqual({ vincitore: 'A', motivo: 'collasso' });
  });

  test('IT ≤ 0 per entrambi è pareggio', () => {
    const s = statoVuoto();
    s.giocatori.A.it = -1; s.giocatori.B.it = 0;
    verificaFine(s);
    expect(s.esito).toEqual({ vincitore: null, motivo: 'pareggio' });
  });

  test('Collasso Entropico registrato fa perdere', () => {
    const s = statoVuoto();
    s.sconfitte.push({ giocatore: 'A', motivo: 'collassoEntropico' });
    verificaFine(s);
    expect(s.esito).toEqual({ vincitore: 'B', motivo: 'collassoEntropico' });
  });

  test('nessuna condizione: nessun esito', () => {
    const s = statoVuoto();
    verificaFine(s);
    expect(s.esito).toBeNull();
  });
});

describe('Sincronia', () => {
  const tuttiGliStati = (s: ReturnType<typeof statoVuoto>) => {
    inCampo(s, 'A', 1, 'passato');   // Solido
    inCampo(s, 'A', 2, 'presente');  // Liquido
    inCampo(s, 'A', 3, 'futuro');    // Gas
    inCampo(s, 'A', 4, 'futuro');    // Plasma
  };

  test('un Frammento per colonna e tutti e 5 gli stati', () => {
    const s = statoVuoto();
    tuttiGliStati(s);
    expect(haSincronia(s, 'A')).toBe(false);
    inCampo(s, 'A', 5, 'presente');
    expect(haSincronia(s, 'A')).toBe(true);
    verificaSincronia(s);
    expect(s.esito).toEqual({ vincitore: 'A', motivo: 'sincronia' });
  });

  test('serve almeno un Frammento in ogni colonna', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 1, 'presente'); inCampo(s, 'A', 2, 'presente'); inCampo(s, 'A', 3, 'futuro');
    inCampo(s, 'A', 4, 'futuro'); inCampo(s, 'A', 5, 'futuro');
    expect(haSincronia(s, 'A')).toBe(false);
  });

  test('una seconda Materia Oscura fa da jolly per un solo stato mancante', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 1, 'passato'); inCampo(s, 'A', 2, 'presente'); inCampo(s, 'A', 3, 'futuro');
    inCampo(s, 'A', 5, 'futuro');
    expect(haSincronia(s, 'A')).toBe(false); // manca Plasma, una sola MO
    inCampo(s, 'A', 5, 'futuro');
    expect(haSincronia(s, 'A')).toBe(true);
  });

  test('le carte dell\'avversario non contano', () => {
    const s = statoVuoto();
    tuttiGliStati(s);
    inCampo(s, 'B', 5, 'presente');
    expect(haSincronia(s, 'A')).toBe(false);
  });
});

describe('fineRound', () => {
  test('azzera i contatori del round, toglie le modifiche "round", passa l\'iniziativa', () => {
    const s = statoVuoto();
    const g = s.giocatori.A;
    g.supportoUsati = 2; g.supportoPep = 1; g.supportoRp = 1; g.haPassato = true;
    const fc = inCampo(s, 'A', 1, 'passato', {
      modifiche: [{ stat: 'pep', delta: 1, durata: 'round' }, { stat: 'rp', delta: 2, durata: 'permanente' }],
    });
    fineRound(s);
    expect([g.supportoUsati, g.supportoPep, g.supportoRp, g.haPassato]).toEqual([0, 0, 0, false]);
    expect(fc.modifiche).toEqual([{ stat: 'rp', delta: 2, durata: 'permanente' }]);
    expect(s.iniziativa).toBe('B');
    expect(s.round).toBe(2);
  });
});
