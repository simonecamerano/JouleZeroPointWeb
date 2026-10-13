import { applica, chiDeveAgire, creaPartita, vista } from '../../game/engine';
import { Azione, PlayerId, StatoPartita } from '../../game/engine/types';
import { catalogoProva, mazzoProva } from './helpers';

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
});
