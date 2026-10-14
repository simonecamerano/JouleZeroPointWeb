import { carteUsate, catalogoDa, mazzoDaDeck, VERSIONE_SCRIPT } from '../../game/catalogo';
import { validaMazzo } from '../../game/engine';
import { catalogoProva, mazzoProva } from '../game/helpers';

describe('catalogo', () => {
  test('catalogoDa converte le carte del database e scarta quelle di tipo sconosciuto', () => {
    const cat = catalogoDa([
      { cardId: 1, name: 'Ghiaccio', type: 'Solido', status: 'Freddo', cost_et: 3, pep: 1, rp: 5, rarity: 'Stabile', effect: '' },
      { cardId: 2, name: 'Bozza', type: 'Prototipo' },
    ]);
    expect(Object.keys(cat)).toEqual(['1']);
    expect(cat[1]).toMatchObject({ nome: 'Ghiaccio', tipo: 'Solido', termica: 'Freddo', costo: 3 });
  });

  test('VERSIONE_SCRIPT è un hash di 12 caratteri esadecimali', () => {
    expect(VERSIONE_SCRIPT).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('mazzoDaDeck', () => {
  test('espande i conteggi in 40 cardId e tiene il Costruttore a parte', () => {
    const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((cardId) => ({ cardId, count: 3 }));
    cards.push({ cardId: 14, count: 1 });
    const m = mazzoDaDeck({ cards, costruttoreId: 100 });
    if (typeof m === 'string') throw new Error(m);
    expect(m.carte).toHaveLength(40);
    expect(m.costruttore).toBe(100);
    expect(validaMazzo(m, catalogoProva())).toBeNull();
  });

  test.each([
    [{ cards: 'x', costruttoreId: 100 }, 'Mazzo non leggibile'],
    [{ cards: [{ cardId: 1, count: -1 }], costruttoreId: 100 }, 'Mazzo non leggibile'],
    [{ cards: [{ cardId: 1.5, count: 1 }], costruttoreId: 100 }, 'Mazzo non leggibile'],
    [{ cards: [{ cardId: 1, count: 3 }], costruttoreId: 'a' }, 'Il mazzo non ha un Costruttore'],
    [{ cards: [{ cardId: 1, count: 500 }], costruttoreId: 100 }, 'Mazzo non leggibile'],
  ])('rifiuta %j', (deck, errore) => {
    expect(mazzoDaDeck(deck as never)).toBe(errore);
  });
});

describe('carteUsate', () => {
  test('tiene solo le carte dei mazzi, Costruttori compresi, come copie indipendenti', () => {
    const cat = catalogoProva();
    const m = mazzoProva();
    const foto = carteUsate(cat, [m, m]);
    const attesi = new Set([...m.carte, m.costruttore]);
    expect(Object.keys(foto).map(Number).sort((a, b) => a - b)).toEqual([...attesi].sort((a, b) => a - b));
    for (const id of attesi) expect(foto[id]).toEqual(cat[id]);
    // Una modifica successiva al catalogo non deve cambiare la fotografia già presa.
    (cat[m.carte[0]] as { costo: number }).costo = 999;
    expect(foto[m.carte[0]].costo).not.toBe(999);
  });
});
