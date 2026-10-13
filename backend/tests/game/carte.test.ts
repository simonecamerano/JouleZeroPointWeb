import { intero, mescola } from '../../game/engine/rng';
import {
  costoEffettivo, contaInColonna, daCardDb, pepDi, proprieta, rpDi, validaMazzo,
} from '../../game/engine/carte';
import { catalogoProva, inCampo, mazzoProva, statoVuoto } from './helpers';

describe('rng', () => {
  test('stesso seed, stessa sequenza', () => {
    const a = { rng: 42 }; const b = { rng: 42 };
    const sa = [1, 2, 3, 4, 5, 6, 7, 8]; const sb = [...sa];
    mescola(a, sa); mescola(b, sb);
    expect(sa).toEqual(sb);
    expect(intero(a, 6)).toBe(intero(b, 6));
  });
  test('intero resta nell\'intervallo', () => {
    const r = { rng: 7 };
    for (let i = 0; i < 1000; i++) {
      const n = intero(r, 6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });
});

describe('validaMazzo', () => {
  const cat = catalogoProva();
  test('accetta 40 carte + Costruttore', () => {
    expect(validaMazzo(mazzoProva(), cat)).toBeNull();
  });
  test('rifiuta un mazzo di 39 carte', () => {
    const m = mazzoProva(); m.carte.pop();
    expect(validaMazzo(m, cat)).toMatch(/40 carte/);
  });
  test('rifiuta un Costruttore che non è un Costruttore', () => {
    expect(validaMazzo({ ...mazzoProva(), costruttore: 1 }, cat)).toMatch(/Costruttore/);
  });
  test('rifiuta il Costruttore dentro le 40', () => {
    const m = mazzoProva(); m.carte[39] = 100;
    expect(validaMazzo(m, cat)).toMatch(/Costruttore/);
  });
  test('rifiuta la quarta copia di una Stabile e la seconda di una Critica', () => {
    const m = mazzoProva(); m.carte[39] = 1;
    expect(validaMazzo(m, cat)).toMatch(/massimo 3/);
    const m2 = mazzoProva(); m2.carte[38] = 20; m2.carte[39] = 20;
    expect(validaMazzo(m2, cat)).toMatch(/massimo 1/);
  });
  test('rifiuta una carta sconosciuta', () => {
    const m = mazzoProva(); m.carte[39] = 999;
    expect(validaMazzo(m, cat)).toMatch(/999/);
  });
});

describe('valori di una carta in campo', () => {
  test('modifiche sommate, mai sotto zero', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 4, 'presente', {
      modifiche: [{ stat: 'pep', delta: 2, durata: 'round' }, { stat: 'rp', delta: -5, durata: 'round' }],
    });
    expect(pepDi(s, fc)).toBe(5);
    expect(rpDi(s, fc)).toBe(0);
  });
  test('🔴 aggiunge lo stato superiore, 🔵 quello inferiore, Materia Oscura immune', () => {
    const s = statoVuoto();
    expect(proprieta(s, inCampo(s, 'A', 1, 'presente', { segnalino: 'caldo' }))).toEqual(['Solido', 'Liquido']);
    expect(proprieta(s, inCampo(s, 'A', 1, 'presente', { segnalino: 'freddo' }))).toEqual(['Solido']);
    expect(proprieta(s, inCampo(s, 'A', 4, 'presente', { segnalino: 'freddo' }))).toEqual(['Plasma', 'Gas']);
    expect(proprieta(s, inCampo(s, 'A', 5, 'presente', { segnalino: 'caldo' }))).toEqual(['Materia Oscura']);
    expect(proprieta(s, inCampo(s, 'A', 1, 'presente', { statoForzato: 'Gas' }))).toEqual(['Gas']);
  });
  test('costo ridotto di 1 fuori dal Presente, mai sotto zero, solo per i Frammenti', () => {
    const cat = catalogoProva();
    expect(costoEffettivo(cat[1], 'presente')).toBe(3);
    expect(costoEffettivo(cat[1], 'futuro')).toBe(2);
    expect(costoEffettivo(cat[1], 'passato')).toBe(2);
    expect(costoEffettivo({ ...cat[1], costo: 0 }, 'passato')).toBe(0);
    expect(costoEffettivo(cat[6])).toBe(2);
  });
  test('contaInColonna conta per giocatore', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 1, 'presente'); inCampo(s, 'A', 2, 'presente'); inCampo(s, 'B', 3, 'presente');
    expect(contaInColonna(s, 'presente', 'A')).toBe(2);
    expect(contaInColonna(s, 'presente', 'B')).toBe(1);
  });
});

describe('daCardDb', () => {
  test('converte una carta del database', () => {
    expect(daCardDb({
      cardId: 1, name: 'Nucleo di Basalto', type: 'Solido', status: 'Freddo',
      cost_et: 4, pep: 1, rp: 5, rarity: 'Stabile', effect: 'Testo.',
    })).toEqual({
      cardId: 1, nome: 'Nucleo di Basalto', tipo: 'Solido', termica: 'Freddo',
      costo: 4, pep: 1, rp: 5, rarita: 'Stabile', effetto: 'Testo.',
    });
  });
  test('scarta un tipo sconosciuto e normalizza i campi mancanti', () => {
    expect(daCardDb({ cardId: 2, name: 'X', type: 'Boh' })).toBeNull();
    expect(daCardDb({ cardId: 3, name: 'Y', type: 'Costruttore', rarity: '' })).toEqual({
      cardId: 3, nome: 'Y', tipo: 'Costruttore', termica: 'Neutro',
      costo: 0, pep: 0, rp: 0, rarita: '', effetto: '',
    });
  });
});
