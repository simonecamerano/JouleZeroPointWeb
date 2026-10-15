import { bonusPep, costoPer, vietato } from '../../../game/effetti/continui';
import { mosseLegali, vista } from '../../../game/engine';
import { distruggi, sposta } from '../../../game/engine/campo';
import { avanza } from '../../../game/engine/round';
import { inverti, ricalcolaTP } from '../../../game/engine/temperatura';
import { gioca, inCampo, inMano, mossa, riempiMazzi, statoReale } from '../helpers';

describe('Solidi', () => {
  test('1 Nucleo di Basalto: non può essere spostato da effetti', () => {
    const s = statoReale();
    const fc = inCampo(s, 'A', 1, 'presente');
    expect(vietato(s, { tipo: 'sposta', uid: fc.uid })).toBe(true);
  });

  test('2 Faglia Primaria: distrutta, riduce di 2 i danni (I10)', () => {
    for (const [scelta, it] of [[true, 14], [false, 12]] as const) {
      const s = statoReale();
      const faglia = inCampo(s, 'A', 2, 'presente'); // 1/6
      inCampo(s, 'B', 63, 'presente'); // 7 PEP
      inCampo(s, 'B', 197, 'presente'); // 6 PEP
      s.fase = 'collisione';
      avanza(s);
      expect(s.decisione).toMatchObject({ tipo: 'sceltaEffetto', giocatore: 'A', cardId: 2, domanda: { tipo: 'siNo' } });
      const t = mossa(s, 'A', { tipo: 'rispondi', risposta: scelta });
      // 13 - 6 = 7, +2 Plasma, -1 Solido = 8; con Faglia 6.
      expect(t.giocatori.A.it).toBe(it);
      expect(t.giocatori.A.orizzonte.some((c) => c.uid === faglia.uid)).toBe(true);
    }
  });

  test('20 Pilastro di Contenimento: distrutto in Collisione, TP -1 dopo il prossimo Slittamento (I16)', () => {
    const s = statoReale();
    riempiMazzi(s);
    inCampo(s, 'A', 20, 'presente');
    inCampo(s, 'B', 63, 'presente');
    s.fase = 'collisione';
    avanza(s);
    expect(s.round).toBe(2);
    expect(s.log.some((l) => l.testo === 'Pilastro di Contenimento: TP -1')).toBe(true);
    expect(s.tp).toBe(-1);
  });

  test('50 Blocco Termico: la TP non si allontana più di 1 dal riferimento', () => {
    const s = statoReale();
    inCampo(s, 'A', 50, 'presente');
    s.tpSpostamento = 3;
    ricalcolaTP(s);
    expect(s.tp).toBe(1);
  });

  test('138 Monolite di Frenata: in Collisione con TP 0 niente Eventi', () => {
    const s = statoReale();
    inCampo(s, 'A', 138, 'presente'); // Freddo
    inCampo(s, 'B', 8, 'presente'); // Caldo: TP 0
    ricalcolaTP(s);
    const ev = inMano(s, 'B', 46);
    s.fase = 'collisione';
    s.finestra = { contesto: 'collisione', priorita: 'B', passi: 0, passiNecessari: 2 };
    expect(mosseLegali(s, 'B')).not.toContainEqual({ tipo: 'giocaCarta', uid: ev });
    s.tpSpostamento = 1;
    ricalcolaTP(s);
    expect(mosseLegali(s, 'B')).toContainEqual({ tipo: 'giocaCarta', uid: ev });
  });
});

describe('Liquidi', () => {
  test('6 Il Mercuriale: una volta per Round dal Presente al Futuro', () => {
    const s = statoReale();
    const fc = inCampo(s, 'A', 6, 'presente');
    const t = mossa(s, 'A', { tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    expect(t.colonne.futuro.map((x) => x.uid)).toContain(fc.uid);
    expect(mosseLegali(t, 'A').some((m) => m.tipo === 'attivaEffetto')).toBe(false);
  });

  test('6 Il Mercuriale: con il Futuro pieno non è attivabile', () => {
    const s = statoReale();
    inCampo(s, 'A', 6, 'presente');
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'futuro');
    expect(mosseLegali(s, 'A').some((m) => m.tipo === 'attivaEffetto')).toBe(false);
  });

  test('103 Marea di Assorbimento: +1 RP fino a fine Round quando la TP cambia segno', () => {
    const s = statoReale();
    const fc = inCampo(s, 'A', 103, 'presente');
    s.segnoTP = 1;
    s.tpSpostamento = -2;
    ricalcolaTP(s);
    avanza(s);
    expect(fc.modifiche).toEqual([{ stat: 'rp', delta: 1, durata: 'round' }]);
  });

  test('223 Flusso di Innesco: guardi una coperta avversaria, solo tu, e il prossimo Futuro costa 1 in meno', () => {
    let s = statoReale();
    inCampo(s, 'B', 8, 'futuro', { coperta: true });
    const flusso = inMano(s, 'A', 223);
    inMano(s, 'A', 8);
    s = gioca(s, 'A', flusso, 'presente');
    expect(s.decisione).toMatchObject({ tipo: 'sceltaEffetto', giocatore: 'A', domanda: { tipo: 'bersaglio' } });
    const d = s.decisione as { domanda: { uids: string[] } };
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: d.domanda.uids[0] });
    expect(vista(s, 'A').log.some((l) => l.testo.includes('Sciame Termico'))).toBe(true);
    expect(vista(s, 'B').log.some((l) => l.testo.includes('Sciame Termico'))).toBe(false);
    expect(costoPer(s, 'A', s.carte[8], 'futuro')).toBe(2); // 4, -1 Futuro, -1 sconto
  });
});

describe('Gas', () => {
  test('8 Sciame Termico: +1 per il tipo e +1 per effetto', () => {
    let s = statoReale();
    const uid = inMano(s, 'A', 8);
    s = gioca(s, 'A', uid, 'presente');
    expect(s.tp).toBe(2);
  });

  test('30 Espulsione Termica: distrutta alla fine della Collisione se sopravvive', () => {
    const s = statoReale();
    const fc = inCampo(s, 'A', 30, 'presente');
    s.fase = 'collisione';
    avanza(s);
    expect(s.giocatori.A.orizzonte.some((c) => c.uid === fc.uid)).toBe(true);
  });

  test('79 Vapore di Turbolenza: TP +1 quando entra un Frammento avversario, non uno proprio', () => {
    const s = statoReale();
    inCampo(s, 'A', 79, 'presente');
    ricalcolaTP(s);
    const mio = inCampo(s, 'A', 103, 'futuro');
    sposta(s, mio.uid, 'presente');
    avanza(s);
    expect(s.tp).toBe(1);
    const suo = inCampo(s, 'B', 103, 'futuro');
    sposta(s, suo.uid, 'presente');
    avanza(s);
    expect(s.tp).toBe(2);
  });

  test('231 Vapore di Interferenza: TP +1 a ogni Inversione', () => {
    const s = statoReale();
    inCampo(s, 'A', 231, 'presente');
    ricalcolaTP(s);
    inverti(s, null);
    avanza(s);
    expect(s.tp).toBe(2);
  });
});

describe('Plasma', () => {
  test('15 Fulmine Residuo: 1 danno IT all ingresso e +1 PEP in Collisione', () => {
    let s = statoReale();
    const uid = inMano(s, 'A', 15);
    s = gioca(s, 'A', uid, 'presente');
    expect(s.giocatori.B.it).toBe(19);
    const fc = s.colonne.presente.find((x) => x.uid === uid)!;
    expect(bonusPep(s, fc)).toBe(1);
  });

  test('119 Fulmine di Esaurimento: distrutto dal Presente pesca 1, dal Passato no', () => {
    const s = statoReale();
    riempiMazzi(s);
    const a = inCampo(s, 'A', 119, 'presente');
    const b = inCampo(s, 'A', 119, 'passato');
    distruggi(s, a.uid);
    avanza(s);
    expect(s.giocatori.A.mano).toHaveLength(1);
    distruggi(s, b.uid);
    avanza(s);
    expect(s.giocatori.A.mano).toHaveLength(1);
  });

  test('119 Fulmine di Esaurimento: mazzo vuoto, Collasso Entropico e non un ripiego', () => {
    const s = statoReale();
    const a = inCampo(s, 'A', 119, 'presente');
    distruggi(s, a.uid);
    avanza(s);
    expect(s.manuali).toEqual([]);
    expect(s.esito).toEqual({ vincitore: 'B', motivo: 'collassoEntropico' });
  });
});
