import {
  azione, carta, distruggi, modifica, programma, puoi, quando, riduciDanniSubiti, ritardato, spostaIn, tp,
} from '../../../game/effetti/dsl';
import { registraPerTest } from '../../../game/effetti/registro';
import { scattaRitardati, LIMITE_EFFETTI } from '../../../game/effetti/dispatcher';
import { applica, mosseLegali, verificaInvarianti } from '../../../game/engine';
import { sposta } from '../../../game/engine/campo';
import { avanza } from '../../../game/engine/round';
import { inverti } from '../../../game/engine/temperatura';
import { inCampo, statoVuoto } from '../helpers';

let togli: (() => void)[] = [];
const dichiara = (...d: Parameters<typeof registraPerTest>) => togli.push(registraPerTest(...d));
afterEach(() => { togli.forEach((f) => f()); togli = []; });

describe('dispatcher', () => {
  test("un evento diventa effetto e si esegue al giro di avanza", () => {
    dichiara(carta(3, 'Carta 3', quando('entraPresente', tp(1))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'futuro');
    sposta(s, fc.uid, 'presente');
    avanza(s);
    expect(s.tp).toBe(2); // +1 perché Calda, +1 dall'effetto
    expect(s.coda).toEqual([]);
    expect(s.eventi).toEqual([]);
  });

  test("effetti simultanei: prima chi ha l'iniziativa, poi l'altro", () => {
    dichiara(carta(10, 'Carta 10', quando('inversione', azione('segna', (c) => { c.s.log.push({ round: 0, testo: `segno ${c.controllore}` }); }))));
    const s = statoVuoto();
    s.iniziativa = 'B';
    inCampo(s, 'A', 10, 'presente');
    inCampo(s, 'B', 10, 'presente');
    inverti(s, null);
    avanza(s);
    expect(s.log.filter((l) => l.testo.startsWith('segno')).map((l) => l.testo)).toEqual(['segno B', 'segno A']);
  });

  test('una scelta sospende senza applicare nulla, la risposta riparte da capo una volta sola', () => {
    dichiara(carta(10, 'Carta 10', quando('inversione', tp(1), puoi(tp(1)))));
    let s = statoVuoto();
    inCampo(s, 'A', 10, 'presente'); // Liquido Freddo; inCampo non ricalcola, la TP resta 0
    inverti(s, null);
    avanza(s);
    expect(s.decisione).toMatchObject({ tipo: 'sceltaEffetto', giocatore: 'A', cardId: 10, domanda: { tipo: 'siNo' } });
    expect([s.tp, s.tpSpostamento]).toEqual([0, 0]); // il primo tp(1) non resta applicato mentre si aspetta
    expect(mosseLegali(s, 'A')).toEqual([{ tipo: 'rispondi', risposta: true }, { tipo: 'rispondi', risposta: false }]);
    const r = applica(s, 'A', { tipo: 'rispondi', risposta: true });
    if (!r.ok) throw new Error(r.errore);
    s = r.stato;
    expect(s.tpSpostamento).toBe(2); // una volta sola per ciascun tp(1)
    expect(s.tp).toBe(1); // -1 dalla carta Fredda, +2 dagli effetti
    expect(s.decisione).toBeNull();
  });

  test('risposte non valide: rifiutate e stato invariato', () => {
    dichiara(carta(10, 'Carta 10', quando('inversione', puoi(tp(1)))));
    const s = statoVuoto();
    inCampo(s, 'A', 10, 'presente');
    inverti(s, null);
    avanza(s);
    expect(applica(s, 'A', { tipo: 'rispondi', risposta: 'A-1' })).toEqual({ ok: false, errore: 'Risposta non valida' });
    expect(applica(s, 'B', { tipo: 'rispondi', risposta: true })).toMatchObject({ ok: false });
  });

  test('errore in un effetto: stato riportato a prima, carta in manuale, pannello aperto', () => {
    dichiara(carta(3, 'Carta 3', quando('inversione', tp(1), azione('esplode', () => { throw new Error('boom'); }))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente');
    s.tp = 1;
    inverti(s, null);
    avanza(s);
    expect(s.tp).toBe(1);
    expect(s.manuali).toEqual([3]);
    expect(s.erroriEffetti[0]).toContain('boom');
    expect(s.decisione).toEqual({ tipo: 'effettoManuale', giocatore: 'A', uid: fc.uid, origine: 'libero' });
  });

  test("un effetto che distrugge la propria carta e poi la modifica non va in errore", () => {
    dichiara(carta(3, 'Carta 3', quando('inversione', distruggi(), modifica('pep', 1, 'round'))));
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente');
    inverti(s, null);
    avanza(s);
    expect(s.manuali).toEqual([]);
    expect(s.giocatori.A.orizzonte).toHaveLength(1);
  });

  test('ritardati: scattano al momento indicato', () => {
    dichiara(carta(3, 'Carta 3', quando('inversione', programma('dopo', 'fineRound')), ritardato('dopo', tp(-2))));
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente');
    inverti(s, null);
    avanza(s);
    expect(s.ritardati).toHaveLength(1);
    scattaRitardati(s, 'fineRound');
    avanza(s);
    expect(s.tp).toBe(-1);
    expect(s.ritardati).toEqual([]);
  });

  test('catena infinita: interrotta al limite, nessuna eccezione', () => {
    dichiara(carta(3, 'Carta 3',
      quando('entraPresente', spostaIn('passato')),
      quando('entraPassato', spostaIn('presente'))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'futuro');
    sposta(s, fc.uid, 'presente');
    avanza(s);
    expect(s.erroriEffetti).toContain('Catena di effetti oltre il limite');
    expect(s.coda).toEqual([]);
    expect(LIMITE_EFFETTI).toBe(200);
  });

  test('danni determinati: un effetto riduce il danno prima che si applichi', () => {
    dichiara(carta(100, 'Carta 100', quando('danniDeterminati', riduciDanniSubiti(2))));
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente'); // Plasma 3 PEP
    s.fase = 'collisione';
    avanza(s);
    expect(s.giocatori.B.it).toBe(18); // 3 + 1 Plasma - 2
  });

  test('fineCollisione e fineRound scattano in ordine', () => {
    const segna = (t: string) => azione(t, (c) => { c.s.log.push({ round: 0, testo: t }); });
    dichiara(carta(100, 'Carta 100', quando('fineCollisione', segna('fc')), quando('fineRound', segna('fr')), quando('inizioRound', segna('ir'))));
    const s = statoVuoto();
    s.fase = 'collisione';
    avanza(s);
    expect(s.log.filter((l) => ['fc', 'fr', 'ir'].includes(l.testo)).map((l) => l.testo)).toEqual(['fc', 'fc', 'fr', 'fr', 'ir', 'ir']);
  });

  test('invariante: niente effetti in sospeso senza una decisione', () => {
    const s = statoVuoto();
    s.eventi.push({ momento: 'inversione' });
    expect(verificaInvarianti(s)).toContain('effetti in sospeso senza una decisione');
  });
});
