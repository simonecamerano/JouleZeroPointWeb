import { distruggi, metti, sposta } from '../../game/engine/campo';
import { inverti, ricalcolaTP } from '../../game/engine/temperatura';
import { carta, inCampo, statoVuoto } from './helpers';

describe('temperatura', () => {
  test('Caldi +1, Freddi -1, Neutri 0, solo nel Presente', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente'); // Gas Caldo
    inCampo(s, 'B', 4, 'presente'); // Plasma Caldo
    inCampo(s, 'B', 1, 'presente'); // Solido Freddo
    inCampo(s, 'A', 2, 'presente'); // Liquido Neutro
    inCampo(s, 'A', 3, 'passato');  // fuori dal Presente
    ricalcolaTP(s);
    expect(s.tp).toBe(1);
  });

  test('limitata a -4 / +4, spostamento da effetti incluso', () => {
    const s = statoVuoto();
    for (let i = 0; i < 3; i++) inCampo(s, 'A', 3, 'presente');
    s.tpSpostamento = 5;
    ricalcolaTP(s);
    expect(s.tp).toBe(4);
  });

  test('segnalini a +2 e -2, rimossi in mezzo, Materia Oscura immune', () => {
    const s = statoVuoto();
    const gas = inCampo(s, 'A', 3, 'presente');
    const mo = inCampo(s, 'A', 5, 'presente');
    s.tpSpostamento = 1;
    ricalcolaTP(s);
    expect(s.tp).toBe(2);
    expect(gas.segnalino).toBe('caldo');
    expect(mo.segnalino).toBeNull();
    s.tpSpostamento = -4;
    ricalcolaTP(s);
    expect(gas.segnalino).toBe('freddo');
    s.tpSpostamento = 0;
    ricalcolaTP(s);
    expect(gas.segnalino).toBeNull();
  });

  test('Inversione spontanea quando la TP arriva a ±4, una volta sola', () => {
    const s = statoVuoto();
    s.tpSpostamento = 4;
    ricalcolaTP(s);
    expect(s.flusso).toBe('invertito');
    ricalcolaTP(s);
    expect(s.flusso).toBe('invertito');
    s.tpSpostamento = -4;
    ricalcolaTP(s);
    expect(s.flusso).toBe('normale');
  });

  test('Inversione volontaria costa 1 IT al controllore', () => {
    const s = statoVuoto();
    inverti(s, 'B');
    expect(s.flusso).toBe('invertito');
    expect(s.giocatori.B.it).toBe(19);
    expect(s.giocatori.A.it).toBe(20);
  });
});

describe('campo', () => {
  test('mettere nel Presente ricalcola la TP', () => {
    const s = statoVuoto();
    metti(s, carta('A', 3), 'presente');
    expect(s.tp).toBe(1);
  });

  test('Supporto Istantaneo: +PEP se Calda, +RP se Fredda, Neutra nulla, massimo 2 per round', () => {
    const s = statoVuoto();
    metti(s, carta('A', 3), 'passato');
    metti(s, carta('A', 2), 'passato');
    metti(s, carta('A', 1), 'passato');
    metti(s, carta('A', 4), 'passato');
    const g = s.giocatori.A;
    expect(g.supportoPep).toBe(1);
    expect(g.supportoRp).toBe(1);
    expect(g.supportoUsati).toBe(2);
  });

  test('nessun Supporto se richiesto', () => {
    const s = statoVuoto();
    metti(s, carta('A', 3), 'passato', { supporto: false });
    expect(s.giocatori.A.supportoPep).toBe(0);
  });

  test('distruggere manda la carta nell\'Orizzonte del proprietario e aggiorna la TP', () => {
    const s = statoVuoto();
    const fc = metti(s, carta('B', 3), 'presente');
    expect(distruggi(s, fc.uid)).toBe(true);
    expect(s.colonne.presente).toHaveLength(0);
    expect(s.giocatori.B.orizzonte.map((c) => c.uid)).toEqual([fc.uid]);
    expect(s.tp).toBe(0);
    expect(distruggi(s, 'inesistente')).toBe(false);
  });

  test('spostare conserva le modifiche e toglie il segnalino', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente', {
      segnalino: 'caldo', modifiche: [{ stat: 'pep', delta: 1, durata: 'permanente' }],
    });
    const n = sposta(s, fc.uid, 'futuro');
    expect(n?.modifiche).toEqual([{ stat: 'pep', delta: 1, durata: 'permanente' }]);
    expect(n?.segnalino).toBeNull();
    expect(s.colonne.futuro).toHaveLength(1);
  });
});
