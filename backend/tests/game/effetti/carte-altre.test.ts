import { mosseLegali, vista } from '../../../game/engine';
import { avanza } from '../../../game/engine/round';
import { inverti, ricalcolaTP } from '../../../game/engine/temperatura';
import { carta as nuovaCarta, gioca, inCampo, inMano, mossa, riempiMazzi, statoReale } from '../helpers';
import { StatoPartita } from '../../../game/engine/types';

const domanda = (s: StatoPartita) => (s.decisione as { domanda: { uids?: string[]; opzioni?: string[] } }).domanda;

describe('Materia Oscura', () => {
  test('67 Eco del Punto Zero: opzione scarto, ognuno sceglie la propria carta', () => {
    let s = statoReale();
    inCampo(s, 'A', 67, 'presente');
    inMano(s, 'A', 8);
    inMano(s, 'B', 8);
    inverti(s, null);
    avanza(s);
    expect(domanda(s).opzioni).toEqual(['entrambi i giocatori scartano 1 carta', 'entrambi i giocatori perdono 1 IT']);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: 0 });
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: domanda(s).uids![0] });
    expect(s.decisione).toMatchObject({ giocatore: 'B' });
    s = mossa(s, 'B', { tipo: 'rispondi', risposta: domanda(s).uids![0] });
    expect(s.giocatori.A.orizzonte).toHaveLength(1);
    expect(s.giocatori.B.orizzonte).toHaveLength(1);
  });

  test('67 Eco del Punto Zero: opzione IT, perdita non danno', () => {
    let s = statoReale();
    inCampo(s, 'A', 67, 'presente');
    inverti(s, null);
    avanza(s);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: 1 });
    expect([s.giocatori.A.it, s.giocatori.B.it]).toEqual([19, 19]);
  });

  test('203 Vuoto di Probabilità: un Frammento nel Futuro coperto, il resto in fondo, nomi solo a chi guarda', () => {
    let s = statoReale();
    s.giocatori.A.futuro = [nuovaCarta('A', 8), nuovaCarta('A', 19), nuovaCarta('A', 1)];
    const uid = inMano(s, 'A', 203);
    s = gioca(s, 'A', uid, 'presente');
    expect(domanda(s).opzioni).toEqual(['Sciame Termico', 'Nessuno']);
    expect(vista(s, 'B').decisione).toMatchObject({ domanda: null });
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: 0 });
    const futuro = s.colonne.futuro.filter((x) => x.owner === 'A');
    expect(futuro.map((x) => [x.cardId, x.coperta])).toEqual([[8, true]]);
    expect(s.giocatori.A.futuro.map((c) => c.cardId)).toEqual([1, 19]);
  });
});

describe('Eventi', () => {
  test('19 Shock Termico: solo in Collisione, poi TP +1 o -1', () => {
    let s = statoReale();
    const uid = inMano(s, 'A', 19);
    expect(mosseLegali(s, 'A')).not.toContainEqual({ tipo: 'giocaCarta', uid });
    s.fase = 'collisione';
    s.finestra = { contesto: 'collisione', priorita: 'A', passi: 0, passiNecessari: 2 };
    s = gioca(s, 'A', uid);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: 1 });
    expect(s.tp).toBe(-1);
  });

  test('46 Disintegrazione Istantanea: distrugge il Frammento scelto nel Presente', () => {
    let s = statoReale();
    const bersaglio = inCampo(s, 'B', 8, 'presente');
    const uid = inMano(s, 'A', 46);
    s = gioca(s, 'A', uid);
    expect(domanda(s).uids).toEqual([bersaglio.uid]);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: bersaglio.uid });
    expect(s.giocatori.B.orizzonte.map((c) => c.uid)).toContain(bersaglio.uid);
  });

  test('127 Deviazione Temporale: annulla un Evento in risposta', () => {
    let s = statoReale();
    s.attivo = 'B';
    const vittima = inCampo(s, 'A', 8, 'presente');
    const dis = inMano(s, 'B', 46);
    const dev = inMano(s, 'A', 127);
    s = mossa(s, 'B', { tipo: 'giocaCarta', uid: dis });
    s = mossa(s, 'A', { tipo: 'giocaCarta', uid: dev });
    s = mossa(s, 'B', { tipo: 'passa' });
    expect(domanda(s).uids).toContain(dis);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: dis });
    expect(s.colonne.presente.map((x) => x.uid)).toContain(vittima.uid);
    expect(s.giocatori.B.orizzonte.map((c) => c.uid)).toContain(dis);
  });

  test("127 Deviazione Temporale: un'Anomalia resta senza effetti fino a fine Round", () => {
    let s = statoReale();
    s.anomalia = nuovaCarta('B', 93);
    const dev = inMano(s, 'A', 127);
    s = gioca(s, 'A', dev);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: s.anomalia!.uid });
    expect(s.silenziate).toEqual([s.anomalia!.uid]);
  });
});

describe('Anomalie', () => {
  test("93 Faglia Temporale: all'inizio della Collisione con TP diversa da 0, Inversione e il controllore perde 1 IT", () => {
    const s = statoReale();
    s.anomalia = nuovaCarta('A', 93);
    inCampo(s, 'B', 8, 'presente');
    ricalcolaTP(s);
    s.giocatori.A.haPassato = true;
    s.giocatori.B.haPassato = true;
    avanza(s);
    expect(s.flusso).toBe('invertito');
    expect(s.giocatori.A.it).toBe(19);
    expect(s.finestra?.contesto).toBe('collisione');
  });

  test('173 Accumulo Critico: controlli il Presente a fine Collisione, +1 ET nel prossimo Round', () => {
    const s = statoReale();
    riempiMazzi(s);
    s.anomalia = nuovaCarta('A', 173);
    inCampo(s, 'A', 1, 'presente');
    s.fase = 'collisione';
    avanza(s);
    expect(s.round).toBe(2);
    expect(s.giocatori.A.et).toBe(s.giocatori.A.etMax + 1);
    expect(s.giocatori.B.et).toBe(s.giocatori.B.etMax);
  });
});

describe('Costruttori', () => {
  test('255 Nyx: il primo Frammento nel Futuro va nel Presente e a fine Collisione è distrutto', () => {
    let s = statoReale();
    s.giocatori.A.costruttore.cardId = 255;
    const primo = inMano(s, 'A', 8);
    const secondo = inMano(s, 'A', 8);
    s = gioca(s, 'A', primo, 'futuro');
    expect(s.colonne.presente.map((x) => x.uid)).toContain(primo);
    expect(s.tp).toBe(2); // Caldo +1 e Sciame Termico +1 all'ingresso
    s = gioca(s, 'A', secondo, 'futuro');
    expect(s.colonne.futuro.map((x) => x.uid)).toContain(secondo);
    s.fase = 'collisione';
    s.finestra = null;
    avanza(s);
    expect(s.giocatori.A.orizzonte.map((c) => c.uid)).toContain(primo);
  });

  test('255 Nyx: Presente pieno, nessuno spostamento e nessun errore', () => {
    let s = statoReale();
    s.giocatori.A.costruttore.cardId = 255;
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'presente');
    const uid = inMano(s, 'A', 103);
    s = gioca(s, 'A', uid, 'futuro');
    expect(s.colonne.futuro.map((x) => x.uid)).toContain(uid);
    expect(s.manuali).toEqual([]);
  });

  test('259 Khepri: 1 IT per spostare un tuo Frammento dal Passato al Futuro, una volta per Round', () => {
    let s = statoReale();
    s.giocatori.A.costruttore.cardId = 259;
    const fc = inCampo(s, 'A', 103, 'passato'); // non il Nucleo di Basalto (1), che non si sposta
    s = mossa(s, 'A', { tipo: 'attivaEffetto', uid: 'A-C', indice: 0 });
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: fc.uid });
    expect(s.colonne.futuro.map((x) => x.uid)).toContain(fc.uid);
    expect(s.giocatori.A.it).toBe(19);
    expect(mosseLegali(s, 'A').some((m) => m.tipo === 'attivaEffetto')).toBe(false);
  });
});
