import { applica, chiDeveAgire, creaPartita, vista } from '../../game/engine';
import { Azione, PlayerId, StatoPartita } from '../../game/engine/types';
import { catalogoProva, mazzoProva, statoVuoto } from './helpers';

function pronta(): StatoPartita {
  let s = creaPartita({ seed: 4, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
  const passo = (a: Azione) => {
    const r = applica(s, chiDeveAgire(s)!, a);
    if (!r.ok) throw new Error(r.errore);
    s = r.stato;
  };
  passo({ tipo: 'sceltaIniziativa', tieni: true });
  passo({ tipo: 'mulligan', esegui: false });
  passo({ tipo: 'mulligan', esegui: false });
  return s;
}

describe('vista', () => {
  test('la mano avversaria e i mazzi Futuro sono nascosti, la Memoria no', () => {
    const s = pronta();
    const v = vista(s, 'A');
    expect(v.giocatori.A.mano).toHaveLength(s.giocatori.A.mano.length);
    expect(v.giocatori.B.mano).toBeNull();
    expect(v.giocatori.B.carteInMano).toBe(s.giocatori.B.mano.length);
    expect(v.giocatori.A.carteFuturo).toBe(s.giocatori.A.futuro.length);
    expect(v.giocatori.B.memoria).toEqual(s.giocatori.B.memoria);
    expect(JSON.stringify(v)).not.toContain('"rng"');
  });

  test('una carta coperta nel Futuro non rivela il cardId all\'avversario: campo, stack, log', () => {
    let s = pronta();
    const a = s.attivo;
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    s.giocatori[a].mano.push({ uid: 'SEGRETA', cardId: 4, owner: a });
    const r = applica(s, a, { tipo: 'giocaCarta', uid: 'SEGRETA', colonna: 'futuro' });
    if (!r.ok) throw new Error(r.errore);
    s = r.stato;
    const vb = vista(s, b);
    const campo = vb.colonne.futuro.find((c) => c.uid === 'SEGRETA')!;
    expect(campo.coperta).toBe(true);
    expect(campo.cardId).toBeNull();
    const voce = vb.stack.find((x) => x.uid === 'SEGRETA')!;
    expect(voce.cardId).toBeNull();
    const nome = s.carte[4].nome;
    expect(vb.log.map((l) => l.testo).join('\n')).not.toContain(nome);
    // il proprietario la vede
    const va = vista(s, a);
    expect(va.colonne.futuro.find((c) => c.uid === 'SEGRETA')!.cardId).toBe(4);
  });

  test('le voci di log private arrivano solo al destinatario', () => {
    const s = pronta();
    const privateA = vista(s, 'A').log.filter((l) => l.testo.startsWith('Hai pescato'));
    const privateBvisteDaA = s.log.filter((l) => l.soloPer === 'B');
    expect(privateA.length).toBeGreaterThan(0);
    for (const l of privateBvisteDaA) expect(vista(s, 'A').log).not.toContainEqual(l);
  });

  test('gli uid non rivelano l\'ordine della lista del mazzo', () => {
    const s = pronta();
    const g = s.giocatori.A;
    const tutte = [...g.futuro, ...g.memoria, ...g.mano, ...g.orizzonte];
    expect(tutte).toHaveLength(40);
    const ordinate = tutte.sort((x, y) => Number(x.uid.slice(1)) - Number(y.uid.slice(1))).map((c) => c.cardId);
    expect(ordinate).not.toEqual(mazzoProva().carte);
  });

  test('annullare l\'effetto di un Frammento coperto non ne scrive il nome nel log pubblico', () => {
    let s = statoVuoto();
    s.giocatori.A.et = 5; s.giocatori.B.et = 5;
    s.giocatori.A.mano.push({ uid: 'SEG', cardId: 9, owner: 'A' });
    s.giocatori.B.mano.push({ uid: 'EVB', cardId: 6, owner: 'B' });
    const passo = (p: PlayerId, a: Azione) => {
      const r = applica(s, p, a);
      if (!r.ok) throw new Error(r.errore);
      s = r.stato;
    };
    passo('A', { tipo: 'giocaCarta', uid: 'SEG', colonna: 'futuro' });
    passo('B', { tipo: 'giocaCarta', uid: 'EVB' });
    passo('A', { tipo: 'passa' });
    passo('B', { tipo: 'base', base: { op: 'annulla', uid: 'SEG' } });
    expect(s.stack.find((v) => v.carta.uid === 'SEG')!.annullata).toBe(true);
    const testi = vista(s, 'B').log.map((l) => l.testo);
    expect(testi.join('\n')).not.toContain(s.carte[9].nome);
    expect(testi).toContain('L\'effetto di Un Frammento coperto viene annullato');
  });
});

test('la domanda di una scelta la vede solo chi sceglie', () => {
  const s = statoVuoto();
  s.decisione = {
    tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-C', cardId: 100,
    domanda: { tipo: 'bersaglio', testo: 'scegli', uids: ['A-1', 'A-2'] },
  };
  expect(vista(s, 'A').decisione).toEqual(s.decisione);
  expect(vista(s, 'B').decisione).toEqual({ tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-C', cardId: 100, domanda: null });
});

test('manuali e silenziate sono pubbliche', () => {
  const s = statoVuoto();
  s.manuali = [9];
  s.silenziate = ['B-3'];
  expect(vista(s, 'B')).toMatchObject({ manuali: [9], silenziate: ['B-3'] });
});
