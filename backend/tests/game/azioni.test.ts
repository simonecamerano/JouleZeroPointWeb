import { giocaCarta, passa, passaTurno, scambio } from '../../game/engine/azioni';
import { applicaBase, usaEffetto } from '../../game/engine/manuale';
import { carta, inCampo, statoVuoto } from './helpers';

const inMano = (s: ReturnType<typeof statoVuoto>, p: 'A' | 'B', cardId: number) => {
  const c = carta(p, cardId);
  s.giocatori[p].mano.push(c);
  return c;
};

describe('giocaCarta', () => {
  test('Frammento nel Presente a costo pieno, apre la finestra all\'avversario', () => {
    const s = statoVuoto();
    s.giocatori.A.et = 3;
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'presente')).toBeNull();
    expect(s.giocatori.A.et).toBe(0);
    expect(s.colonne.presente.map((x) => x.uid)).toEqual([c.uid]);
    expect(s.stack).toHaveLength(1);
    expect(s.finestra).toEqual({ contesto: 'giocata', priorita: 'B', passi: 0, passiNecessari: 1 });
  });

  test('nel Futuro costa 1 in meno ed entra coperta', () => {
    const s = statoVuoto();
    s.giocatori.A.et = 2;
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'futuro')).toBeNull();
    expect(s.colonne.futuro[0].coperta).toBe(true);
    expect(s.giocatori.A.et).toBe(0);
  });

  test('nel Passato costa 1 in meno e dà Supporto Istantaneo', () => {
    const s = statoVuoto();
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'passato')).toBeNull();
    expect(s.giocatori.A.supportoRp).toBe(1);
  });

  test('rifiuta ET insufficienti senza toccare lo stato', () => {
    const s = statoVuoto();
    s.giocatori.A.et = 2;
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'presente')).toMatch(/ET insufficienti/);
    expect(s.giocatori.A.mano).toHaveLength(1);
    expect(s.giocatori.A.et).toBe(2);
  });

  test('capienza: 4 Frammenti propri per colonna, quelli avversari non contano', () => {
    const s = statoVuoto();
    s.giocatori.A.et = 10;
    for (let i = 0; i < 4; i++) inCampo(s, 'B', 1, 'presente');
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'passato');
    const c = inMano(s, 'A', 3);
    expect(giocaCarta(s, 'A', c.uid, 'passato')).toMatch(/Colonna piena/);
    expect(giocaCarta(s, 'A', c.uid, 'presente')).toBeNull();
  });

  test('Frammento senza colonna rifiutato', () => {
    const s = statoVuoto();
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid)).toMatch(/colonna/);
  });

  test('fuori turno rifiutato', () => {
    const s = statoVuoto();
    const c = inMano(s, 'B', 8);
    expect(giocaCarta(s, 'B', c.uid)).toMatch(/turno/);
  });

  test('Anomalia: sostituisce quella attiva, che va nell\'Orizzonte del suo proprietario', () => {
    const s = statoVuoto();
    const vecchia = carta('B', 7);
    s.anomalia = vecchia;
    const c = inMano(s, 'A', 7);
    expect(giocaCarta(s, 'A', c.uid)).toBeNull();
    expect(s.anomalia?.uid).toBe(c.uid);
    expect(s.giocatori.B.orizzonte.map((x) => x.uid)).toEqual([vecchia.uid]);
  });
});

describe('finestre di risposta', () => {
  test('in risposta solo Eventi, solo chi ha la priorità', () => {
    const s = statoVuoto();
    s.giocatori.B.et = 5;
    s.finestra = { contesto: 'giocata', priorita: 'B', passi: 0, passiNecessari: 1 };
    const fr = inMano(s, 'B', 1);
    const ev = inMano(s, 'B', 8);
    expect(giocaCarta(s, 'A', inMano(s, 'A', 8).uid)).toMatch(/priorità/);
    expect(giocaCarta(s, 'B', fr.uid, 'presente')).toMatch(/solo Eventi/);
    expect(giocaCarta(s, 'B', ev.uid)).toBeNull();
    expect(s.finestra).toEqual({ contesto: 'giocata', priorita: 'A', passi: 0, passiNecessari: 1 });
  });

  test('passa chiude una finestra di giocata; alla Collisione servono due passa', () => {
    const s = statoVuoto();
    s.finestra = { contesto: 'giocata', priorita: 'B', passi: 0, passiNecessari: 1 };
    expect(passa(s, 'A')).toMatch(/priorità/);
    expect(passa(s, 'B')).toBeNull();
    expect(s.finestra).toBeNull();
    s.finestra = { contesto: 'collisione', priorita: 'A', passi: 0, passiNecessari: 2 };
    expect(passa(s, 'A')).toBeNull();
    expect(s.finestra?.priorita).toBe('B');
    expect(passa(s, 'B')).toBeNull();
    expect(s.finestra).toBeNull();
  });

  test('un Evento giocato durante la finestra di Collisione mantiene il contesto', () => {
    const s = statoVuoto();
    s.fase = 'collisione';
    s.finestra = { contesto: 'collisione', priorita: 'A', passi: 0, passiNecessari: 2 };
    const ev = inMano(s, 'A', 8);
    expect(giocaCarta(s, 'A', ev.uid)).toBeNull();
    expect(s.finestra).toEqual({ contesto: 'collisione', priorita: 'B', passi: 0, passiNecessari: 1 });
  });
});

describe('passaTurno e Scambio', () => {
  test('passaTurno passa il turno all\'altro', () => {
    const s = statoVuoto();
    expect(passaTurno(s, 'A')).toBeNull();
    expect(s.attivo).toBe('B');
    expect(passaTurno(s, 'B')).toBeNull();
    expect(s.giocatori.A.haPassato && s.giocatori.B.haPassato).toBe(true);
  });

  test('Scambio una volta per round: scarta una carta, +1 ET', () => {
    const s = statoVuoto();
    const c1 = inMano(s, 'A', 1); const c2 = inMano(s, 'A', 2);
    expect(scambio(s, 'A', c1.uid)).toBeNull();
    expect(s.giocatori.A.et).toBe(4);
    expect(s.giocatori.A.orizzonte.map((c) => c.uid)).toEqual([c1.uid]);
    expect(scambio(s, 'A', c2.uid)).toMatch(/una volta/);
  });
});

describe('effetti manuali', () => {
  test('usaEffetto apre la decisione sul proprio Costruttore', () => {
    const s = statoVuoto();
    expect(usaEffetto(s, 'A', 'A-C')).toBeNull();
    expect(s.decisione).toEqual({ tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' });
  });

  test('usaEffetto rifiuta il Costruttore avversario', () => {
    const s = statoVuoto();
    expect(usaEffetto(s, 'A', 'B-C')).toMatch(/Costruttore/);
  });

  test('azioni base: modifica, tp, danno, distruggi, sposta, segnalino, cambiaStato', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    const b = inCampo(s, 'B', 3, 'presente');
    const a = inCampo(s, 'A', 1, 'passato');
    expect(applicaBase(s, 'A', { op: 'modifica', uid: b.uid, stat: 'pep', delta: -2, durata: 'collisione' })).toBeNull();
    expect(b.modifiche).toEqual([{ stat: 'pep', delta: -2, durata: 'collisione' }]);
    expect(applicaBase(s, 'A', { op: 'tp', delta: -1 })).toBeNull();
    expect(s.tp).toBe(0);
    expect(applicaBase(s, 'A', { op: 'dannoIT', bersaglio: 'B', valore: 2 })).toBeNull();
    expect(s.giocatori.B.it).toBe(18);
    expect(applicaBase(s, 'A', { op: 'cambiaStato', uid: a.uid, stato: 'Gas' })).toBeNull();
    expect(applicaBase(s, 'A', { op: 'segnalino', uid: b.uid, segnalino: 'freddo' })).toBeNull();
    expect(b.segnalino).toBe('freddo');
    expect(applicaBase(s, 'A', { op: 'sposta', uid: a.uid, colonna: 'futuro' })).toBeNull();
    expect(s.colonne.futuro.map((c) => c.uid)).toEqual([a.uid]);
    expect(s.colonne.futuro[0].statoForzato).toBe('Gas');
    expect(applicaBase(s, 'A', { op: 'distruggi', uid: b.uid })).toBeNull();
    expect(s.giocatori.B.orizzonte).toHaveLength(1);
  });

  test('azioni base: valori non validi rifiutati', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    expect(applicaBase(s, 'A', { op: 'tp', delta: 1.5 })).toMatch(/intero/);
    expect(applicaBase(s, 'A', { op: 'tp', delta: 0 })).toMatch(/intero/);
    expect(applicaBase(s, 'A', { op: 'dannoIT', bersaglio: 'C' as 'A', valore: 1 })).toMatch(/Bersaglio/);
    expect(applicaBase(s, 'A', { op: 'distruggi', uid: 'nessuno' })).toMatch(/non è in campo/);
  });

  test('sposta rispetta la capienza', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'futuro');
    const a = inCampo(s, 'A', 1, 'passato');
    expect(applicaBase(s, 'A', { op: 'sposta', uid: a.uid, colonna: 'futuro' })).toMatch(/Colonna piena/);
  });

  test('annulla marca una voce dello stack non ancora risolta', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    const ev = carta('B', 6);
    s.stack.push({ carta: ev, controllore: 'B', annullata: false, risolta: false });
    expect(applicaBase(s, 'A', { op: 'annulla', uid: ev.uid })).toBeNull();
    expect(s.stack[0].annullata).toBe(true);
  });

  test('inversione volontaria via azione base', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    expect(applicaBase(s, 'A', { op: 'inversione', volontaria: true })).toBeNull();
    expect(s.flusso).toBe('invertito');
    expect(s.giocatori.A.it).toBe(19);
  });

  test('usaEffetto rifiuta un proprio Frammento coperto nel Futuro, senza cambiare stato', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'futuro', { coperta: true });
    expect(usaEffetto(s, 'A', fc.uid)).toMatch(/coperta/);
    expect(s.decisione).toBeNull();
    expect(s.log).toEqual([]);
  });

  test('modifica su una carta coperta non rivela il nome nel log pubblico', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    const b = inCampo(s, 'B', 3, 'presente', { coperta: true });
    expect(applicaBase(s, 'A', { op: 'modifica', uid: b.uid, stat: 'pep', delta: -2, durata: 'collisione' })).toBeNull();
    const pubblici = s.log.filter((v) => !v.soloPer && v.testo.includes(s.carte[3].nome));
    expect(pubblici).toEqual([]);
    expect(s.log.some((v) => v.testo.includes('Un Frammento coperto'))).toBe(true);
  });
});

describe('giocaCarta: colonna validata', () => {
  test('colonna non prevista rifiutata prima di ogni altro controllo, senza cambiare stato', () => {
    const s = statoVuoto();
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'nope' as 'presente')).toMatch(/Colonna non valida/);
    expect(s.giocatori.A.mano).toHaveLength(1);
    expect(s.giocatori.A.et).toBe(3);
    expect(s.colonne.presente).toEqual([]);
  });
});
