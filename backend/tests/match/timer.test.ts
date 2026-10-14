import { GestorePartite, Aggiornamento, PartitaSalvata, PAUSA_MS, CHIUSURA_MS, PULIZIA_MS } from '../../game/partite';
import { catalogoProva, mazzoProva } from '../game/helpers';

const A = { userId: 'u1', username: 'alice' };
const B = { userId: 'u2', username: 'bob' };

function avviata(timeoutFinestraMs = 20000) {
  const salvate: PartitaSalvata[] = [];
  const notifiche: { userId: string; a: Aggiornamento }[] = [];
  const g = new GestorePartite({
    salva: async (p) => { salvate.push(p); },
    notifica: (userId, a) => notifiche.push({ userId, a }),
    seed: () => 42,
    codice: () => 'COD',
    timeoutFinestraMs,
  });
  g.crea(A, 'd1', mazzoProva(), catalogoProva());
  g.entra('COD', B, 'd2', mazzoProva());
  g.connesso('COD', 'u1');
  g.connesso('COD', 'u2');
  return { g, salvate, notifiche };
}

/** Gioca mosse legali (mai `passa`) finché non si apre una finestra di risposta. */
function finoAFinestra(g: GestorePartite): 'u1' | 'u2' {
  for (let i = 0; i < 2000; i++) {
    for (const u of ['u1', 'u2'] as const) {
      const ag = g.aggiornamentoPer('COD', u)!;
      if (!ag.mosse.length) continue;
      if (ag.vista!.finestra && !ag.vista!.decisione) return u;
      const m = ag.mosse.find((x) => x.tipo === 'giocaCarta') ?? ag.mosse[0];
      g.azione('COD', u, m);
    }
  }
  throw new Error('nessuna finestra di risposta in 2000 passi');
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('timer delle partite', () => {
  test('finestra di risposta: dopo il timeout parte un passa automatico, registrato come server', () => {
    const { g } = avviata();
    const chi = finoAFinestra(g);
    const ag = g.aggiornamentoPer('COD', chi)!;
    expect(ag.scadenzaFinestra).toBe(Date.now() + 20000);
    const prima = ag.vista;
    jest.advanceTimersByTime(19999);
    expect(g.aggiornamentoPer('COD', chi)!.vista).toEqual(prima);
    jest.advanceTimersByTime(1);
    expect(g.aggiornamentoPer('COD', chi)!.vista).not.toEqual(prima);
    g.chiudi();
  });

  test('una mossa tardiva dopo il passa automatico viene rifiutata e la vista rimandata', () => {
    const { g, notifiche } = avviata();
    const chi = finoAFinestra(g);
    const mossaTardiva = g.aggiornamentoPer('COD', chi)!.mosse.find((m) => m.tipo === 'giocaCarta') ?? { tipo: 'passa' as const };
    jest.advanceTimersByTime(20000);
    const ancoraLui = g.aggiornamentoPer('COD', chi)!.mosse.length > 0;
    expect(ancoraLui).toBe(false);
    const prima = notifiche.length;
    const r = g.azione('COD', chi, mossaTardiva);
    expect(r.ok).toBe(false);
    expect(notifiche.at(-1)!.userId).toBe(chi);
    expect(notifiche.length).toBe(prima + 1);
    g.chiudi();
  });

  test('una mossa entro il timeout annulla il timer', () => {
    const { g } = avviata();
    const chi = finoAFinestra(g);
    jest.advanceTimersByTime(10000);
    expect(g.azione('COD', chi, { tipo: 'passa' }).ok).toBe(true);
    const dopoPassa = g.aggiornamentoPer('COD', chi)!.vista;
    // Il vecchio timer sarebbe scattato a 20000; un eventuale nuovo timer scatta a 30000.
    jest.advanceTimersByTime(10001);
    expect(g.aggiornamentoPer('COD', chi)!.vista).toEqual(dopoPassa);
    g.chiudi();
  });

  test('due schede: chiuderne una non conta come assenza', () => {
    const { g } = avviata();
    g.connesso('COD', 'u1');
    g.disconnesso('COD', 'u1');
    jest.advanceTimersByTime(PAUSA_MS + 1);
    expect(g.aggiornamentoPer('COD', 'u1')!.statoTavolo).toBe('inCorso');
    g.chiudi();
  });

  test('assente 10 minuti: pausa, mosse rifiutate; al rientro la partita riprende', () => {
    const { g } = avviata();
    g.disconnesso('COD', 'u2');
    jest.advanceTimersByTime(PAUSA_MS - 1);
    expect(g.aggiornamentoPer('COD', 'u1')!.statoTavolo).toBe('inCorso');
    jest.advanceTimersByTime(1);
    expect(g.aggiornamentoPer('COD', 'u1')!.statoTavolo).toBe('pausa');
    expect(g.aggiornamentoPer('COD', 'u1')!.mosse).toEqual([]);
    expect(g.azione('COD', 'u1', { tipo: 'passaTurno' })).toEqual({ ok: false, errore: 'Partita in pausa' });
    g.connesso('COD', 'u2');
    expect(g.aggiornamentoPer('COD', 'u1')!.statoTavolo).toBe('inCorso');
    g.chiudi();
  });

  test('A chiude la scheda mentre aspetta: quando B entra la partita parte con A assente e scattano pausa e chiusura', async () => {
    const salvate: PartitaSalvata[] = [];
    const g = new GestorePartite({ salva: async (p) => { salvate.push(p); }, notifica: () => {}, seed: () => 42, codice: () => 'COD' });
    g.crea(A, 'd1', mazzoProva(), catalogoProva());
    g.entra('COD', B, 'd2', mazzoProva());
    g.connesso('COD', 'u2');
    jest.advanceTimersByTime(PAUSA_MS);
    expect(g.aggiornamentoPer('COD', 'u2')!.statoTavolo).toBe('pausa');
    jest.advanceTimersByTime(CHIUSURA_MS - PAUSA_MS);
    await Promise.resolve();
    expect(salvate).toHaveLength(1);
    expect(salvate[0].esito).toEqual({ vincitore: null, motivo: 'chiusa' });
    g.chiudi();
  });

  test('assente 24 ore: chiusa senza esito e salvata', async () => {
    const { g, salvate } = avviata();
    g.disconnesso('COD', 'u2');
    jest.advanceTimersByTime(CHIUSURA_MS);
    await Promise.resolve();
    expect(salvate).toHaveLength(1);
    expect(salvate[0].esito).toEqual({ vincitore: null, motivo: 'chiusa' });
    expect(g.aggiornamentoPer('COD', 'u1')).toBeNull();
    g.chiudi();
  });

  test('partita finita: resta visibile 10 minuti, poi sparisce', () => {
    const { g } = avviata();
    g.arrenditi('COD', 'u1');
    jest.advanceTimersByTime(PULIZIA_MS - 1);
    expect(g.aggiornamentoPer('COD', 'u2')!.statoTavolo).toBe('terminata');
    jest.advanceTimersByTime(1);
    expect(g.aggiornamentoPer('COD', 'u2')).toBeNull();
    g.chiudi();
  });

  test('partita mai iniziata: sparisce dopo 24 ore senza salvataggio', async () => {
    const salvate: PartitaSalvata[] = [];
    const g = new GestorePartite({ salva: async (p) => { salvate.push(p); }, notifica: () => {}, codice: () => 'W' });
    g.crea(A, 'd1', mazzoProva(), catalogoProva());
    jest.advanceTimersByTime(CHIUSURA_MS);
    await Promise.resolve();
    expect(g.aggiornamentoPer('W', 'u1')).toBeNull();
    expect(salvate).toHaveLength(0);
    g.chiudi();
  });
});
