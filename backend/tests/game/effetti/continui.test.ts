import { carta, continuo } from '../../../game/effetti/dsl';
import { registraPerTest } from '../../../game/effetti/registro';
import { bonusPep, costoPer, eventoGiocabile, vietato } from '../../../game/effetti/continui';
import { applica, mosseLegali } from '../../../game/engine';
import { ricalcolaTP } from '../../../game/engine/temperatura';
import { inCampo, inMano, statoVuoto } from '../helpers';

let togli: (() => void)[] = [];
afterEach(() => { togli.forEach((f) => f()); togli = []; });

describe('effetti continui', () => {
  test('bonus PEP alla carta stessa, solo mentre è nel Presente', () => {
    togli.push(registraPerTest(carta(4, 'Carta 4', continuo('+1 PEP', { pep: (c, fc) => (fc.uid === c.sorgente ? 1 : 0) }))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 4, 'presente');
    expect(bonusPep(s, fc)).toBe(1);
    s.colonne.presente = [];
    s.colonne.passato.push(fc);
    expect(bonusPep(s, fc)).toBe(0);
  });

  test('divieto di giocare Eventi: né mossa legale né giocata accettata', () => {
    togli.push(registraPerTest(carta(1, 'Carta 1', continuo('niente Eventi', { vieta: (_c, v) => v.tipo === 'evento' }))));
    const s = statoVuoto();
    inCampo(s, 'B', 1, 'presente');
    const ev = inMano(s, 'A', 6);
    expect(vietato(s, { tipo: 'evento', giocatore: 'A' })).toBe(true);
    expect(eventoGiocabile(s, 'A', s.carte[6])).toBe(false);
    expect(mosseLegali(s, 'A')).not.toContainEqual({ tipo: 'giocaCarta', uid: ev });
    expect(applica(s, 'A', { tipo: 'giocaCarta', uid: ev })).toEqual({ ok: false, errore: 'Non puoi giocare Eventi adesso' });
  });

  test('Evento solo in Collisione', () => {
    togli.push(registraPerTest(carta(6, 'Carta 6', continuo('solo in Collisione', { soloInCollisione: true }))));
    const s = statoVuoto();
    expect(eventoGiocabile(s, 'A', s.carte[6])).toBe(false);
    s.fase = 'collisione';
    expect(eventoGiocabile(s, 'A', s.carte[6])).toBe(true);
  });

  test('sconto: riduce il costo nella colonna indicata e si consuma alla giocata', () => {
    const s = statoVuoto();
    const uid = inMano(s, 'A', 3); // costo 3, nel Futuro 2
    s.sconti.push({ giocatore: 'A', colonna: 'futuro', delta: -1 });
    expect(costoPer(s, 'A', s.carte[3], 'futuro')).toBe(1);
    expect(costoPer(s, 'A', s.carte[3], 'presente')).toBe(3);
    const r = applica(s, 'A', { tipo: 'giocaCarta', uid, colonna: 'futuro' });
    if (!r.ok) throw new Error(r.errore);
    expect(r.stato.giocatori.A.et).toBe(2);
    expect(r.stato.sconti).toEqual([]);
  });

  test('limite della TP: entro 1 dal riferimento del Round', () => {
    togli.push(registraPerTest(carta(2, 'Carta 2', continuo('TP limitata', { limitaTP: true }))));
    const s = statoVuoto();
    inCampo(s, 'A', 2, 'presente'); // Liquido Neutro
    s.tpRiferimento = 0;
    s.tpSpostamento = 3;
    ricalcolaTP(s);
    expect(s.tp).toBe(1);
  });
});
