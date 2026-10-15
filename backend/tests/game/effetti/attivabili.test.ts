import { attivabile, carta, questaNelPresente, quando, spostaIn, tp } from '../../../game/effetti/dsl';
import { registraPerTest } from '../../../game/effetti/registro';
import { applica, mosseLegali } from '../../../game/engine';
import { inCampo, inMano, statoVuoto } from '../helpers';

let togli: (() => void)[] = [];
afterEach(() => { togli.forEach((f) => f()); togli = []; });

describe('attivabili e stack', () => {
  test('attivabile una volta per Round nel proprio turno di azioni', () => {
    togli.push(registraPerTest(carta(3, 'Carta 3', attivabile({ quando: 'azioni', limite: 'round', se: questaNelPresente }, tp(1)))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente');
    expect(mosseLegali(s, 'A')).toContainEqual({ tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    const r = applica(s, 'A', { tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    if (!r.ok) throw new Error(r.errore);
    expect(r.stato.tp).toBe(2);
    expect(mosseLegali(r.stato, 'A')).not.toContainEqual({ tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    expect(applica(r.stato, 'A', { tipo: 'attivaEffetto', uid: fc.uid, indice: 0 })).toEqual({ ok: false, errore: 'Effetto non attivabile adesso' });
  });

  test("usaEffetto elencato solo per le carte senza dichiarazione, con testo", () => {
    const s = statoVuoto();
    const nove = inCampo(s, 'A', 9, 'presente'); // ha testo, nessuna dichiarazione
    inCampo(s, 'A', 3, 'presente'); // senza testo
    const mosse = mosseLegali(s, 'A');
    expect(mosse).toContainEqual({ tipo: 'usaEffetto', uid: nove.uid });
    expect(mosse).toContainEqual({ tipo: 'usaEffetto', uid: 'A-C' });
    expect(mosse.filter((m) => m.tipo === 'usaEffetto')).toHaveLength(2);
  });

  test('un Frammento dichiarato giocato nel Presente esegue il suo ingresso, senza pannello manuale', () => {
    togli.push(registraPerTest(carta(9, 'Carta 9', quando('entraPresente', tp(-1)))));
    const s = statoVuoto();
    const uid = inMano(s, 'A', 9); // Solido Freddo, costo 2
    let t = applica(s, 'A', { tipo: 'giocaCarta', uid, colonna: 'presente' });
    if (!t.ok) throw new Error(t.errore);
    t = applica(t.stato, 'B', { tipo: 'passa' });
    if (!t.ok) throw new Error(t.errore);
    expect(t.stato.tp).toBe(-2);
    expect(t.stato.decisione).toBeNull();
  });

  test('un Evento non dichiarato apre ancora il pannello manuale', () => {
    const s = statoVuoto();
    const uid = inMano(s, 'A', 6);
    let t = applica(s, 'A', { tipo: 'giocaCarta', uid });
    if (!t.ok) throw new Error(t.errore);
    t = applica(t.stato, 'B', { tipo: 'passa' });
    if (!t.ok) throw new Error(t.errore);
    expect(t.stato.decisione).toMatchObject({ tipo: 'effettoManuale', uid, origine: 'stack' });
  });

  test("un Frammento giocato emette frammentoGiocato anche se coperto", () => {
    const s = statoVuoto();
    const uid = inMano(s, 'A', 3);
    const t = applica(s, 'A', { tipo: 'giocaCarta', uid, colonna: 'futuro' });
    if (!t.ok) throw new Error(t.errore);
    // Prima del passa la carta è in stack: l'evento si emette solo alla risoluzione.
    expect(t.stato.eventi).toEqual([]);
  });

  test('spostaIn nel Futuro pieno non sposta e non va in errore', () => {
    togli.push(registraPerTest(carta(3, 'Carta 3', attivabile({ quando: 'azioni' }, spostaIn('futuro')))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente');
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'futuro');
    const r = applica(s, 'A', { tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    if (!r.ok) throw new Error(r.errore);
    expect(r.stato.colonne.presente.map((x) => x.uid)).toContain(fc.uid);
    expect(r.stato.manuali).toEqual([]);
  });
});
