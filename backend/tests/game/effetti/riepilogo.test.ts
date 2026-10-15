import { riepilogoEffetti } from '../../../game/effetti/riepilogo';
import { carteDichiarate, dichiarazioneRegistrata } from '../../../game/effetti/registro';
import { catalogoReale } from '../helpers';

describe('riepilogo degli effetti', () => {
  test('ogni dichiarazione ha il nome esatto del catalogo', () => {
    const cat = catalogoReale();
    for (const id of carteDichiarate()) expect([id, dichiarazioneRegistrata(id)!.nome]).toEqual([id, cat[id]?.nome]);
  });

  test('le 23 carte pilota sono dichiarate', () => {
    expect(carteDichiarate()).toEqual([1, 2, 6, 8, 15, 19, 20, 30, 46, 50, 67, 79, 93, 103, 119, 127, 138, 173, 203, 223, 231, 255, 259]);
  });

  test('una riga per carta, con testo stampato e script o "manuale"', () => {
    const md = riepilogoEffetti(catalogoReale());
    expect(md).toContain('Automatiche: 23 su 120');
    expect(md).toContain('| 8 | Sciame Termico | Gas | Quando entra nel Presente: TP +1. | quando entra nel Presente: TP +1 |');
    expect(md).toMatch(/\| 254 \| Chronos, Custode del Presente \| Costruttore \| .* \| manuale, non ancora tradotta \|/);
    expect(md.split('\n').filter((r) => /^\| \d+ \|/.test(r))).toHaveLength(120);
  });
});
