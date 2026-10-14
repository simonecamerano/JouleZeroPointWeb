import { GestorePartite, Aggiornamento, PartitaSalvata } from '../../game/partite';
import { catalogoProva, mazzoProva } from '../game/helpers';

const A = { userId: 'u1', username: 'alice' };
const B = { userId: 'u2', username: 'bob' };
const C = { userId: 'u3', username: 'carlo' };

function nuovo() {
  const salvate: PartitaSalvata[] = [];
  const notifiche: { userId: string; a: Aggiornamento }[] = [];
  let n = 0;
  const g = new GestorePartite({
    salva: async (p) => { salvate.push(p); },
    notifica: (userId, a) => notifiche.push({ userId, a }),
    seed: () => 42,
    codice: () => `COD${++n}`,
  });
  return { g, salvate, notifiche };
}

function avviata() {
  const t = nuovo();
  const r = t.g.crea(A, 'd1', mazzoProva(), catalogoProva());
  if (!r.ok) throw new Error(r.errore);
  const e = t.g.entra(r.valore.codice, B, 'd2', mazzoProva());
  if (!e.ok) throw new Error(e.errore);
  return { ...t, codice: r.valore.codice };
}

afterEach(() => jest.useRealTimers());

describe('GestorePartite', () => {
  test('crea una partita in attesa con A come creatore', () => {
    const { g } = nuovo();
    const r = g.crea(A, 'd1', mazzoProva(), catalogoProva());
    expect(r).toEqual({ ok: true, valore: { codice: 'COD1' } });
    const ag = g.aggiornamentoPer('COD1', 'u1')!;
    expect(ag).toMatchObject({ statoTavolo: 'attesa', ruolo: 'A', avversario: null, vista: null, mosse: [] });
    g.chiudi();
  });

  test('rifiuta un mazzo non valido', () => {
    const { g } = nuovo();
    const m = mazzoProva();
    m.carte.pop();
    const r = g.crea(A, 'd1', m, catalogoProva());
    expect(r).toEqual({ ok: false, errore: 'Il mazzo deve avere 40 carte, ne ha 39' });
    g.chiudi();
  });

  test('B entra con il codice, la partita parte e tutti e due ricevono la propria vista', () => {
    const { g, notifiche, codice } = avviata();
    const ultima = (u: string) => notifiche.filter((n) => n.userId === u).at(-1)!.a;
    expect(ultima('u1')).toMatchObject({ statoTavolo: 'inCorso', ruolo: 'A', avversario: 'bob' });
    expect(ultima('u2')).toMatchObject({ statoTavolo: 'inCorso', ruolo: 'B', avversario: 'alice' });
    expect(ultima('u1').vista!.io).toBe('A');
    expect(ultima('u2').vista!.giocatori.A.mano).toBeNull();
    expect(JSON.stringify(ultima('u2'))).not.toMatch(/"rng"|"carte":\{/);
    g.chiudi();
  });

  test('il codice è monouso: un terzo utente non entra e non riceve viste', () => {
    const { g, notifiche, codice } = avviata();
    expect(g.entra(codice, C, 'd3', mazzoProva())).toEqual({ ok: false, errore: 'La partita è già al completo' });
    expect(g.aggiornamentoPer(codice, 'u3')).toBeNull();
    expect(notifiche.some((n) => n.userId === 'u3')).toBe(false);
    g.chiudi();
  });

  test('il creatore che rifà entra si ricongiunge come A: non diventa avversario di sé stesso', () => {
    const { g } = nuovo();
    g.crea(A, 'd1', mazzoProva(), catalogoProva());
    expect(g.entra('COD1', A, 'd1', mazzoProva())).toEqual({ ok: true, valore: { ruolo: 'A' } });
    // il posto B resta libero: la partita è ancora in attesa e un altro utente può entrare
    expect(g.aggiornamentoPer('COD1', 'u1')).toMatchObject({ statoTavolo: 'attesa', ruolo: 'A', avversario: null });
    expect(g.entra('COD1', B, 'd2', mazzoProva())).toEqual({ ok: true, valore: { ruolo: 'B' } });
    g.chiudi();
  });

  test('chi è già giocatore rientra senza mazzo e riceve il suo ruolo', () => {
    const { g, codice } = avviata();
    expect(g.entra(codice, B)).toEqual({ ok: true, valore: { ruolo: 'B' } });
    g.chiudi();
  });

  test('codice inesistente', () => {
    const { g } = nuovo();
    expect(g.entra('NOPE', B, 'd2', mazzoProva())).toEqual({ ok: false, errore: 'Partita non trovata' });
    g.chiudi();
  });

  test('una mossa legale avanza la partita, una illegale viene rifiutata e la vista viene rimandata', () => {
    const { g, notifiche, codice } = avviata();
    const tocca = (['u1', 'u2'] as const).find((u) => g.aggiornamentoPer(codice, u)!.mosse.length > 0)!;
    const altro = tocca === 'u1' ? 'u2' : 'u1';
    const prima = notifiche.length;
    expect(g.azione(codice, altro, { tipo: 'passa' })).toEqual({ ok: false, errore: 'Non tocca a te' });
    expect(notifiche.length).toBe(prima + 1);
    expect(notifiche.at(-1)!.userId).toBe(altro);
    const mossa = g.aggiornamentoPer(codice, tocca)!.mosse[0];
    expect(g.azione(codice, tocca, mossa)).toEqual({ ok: true, valore: undefined });
    g.chiudi();
  });

  test.each([undefined, null, 'passa', 42, {}, { tipo: 7 }])('azione malformata %j: errore, nessuna eccezione', (az) => {
    const { g, codice } = avviata();
    const tocca = (['u1', 'u2'] as const).find((u) => g.aggiornamentoPer(codice, u)!.mosse.length > 0)!;
    const r = g.azione(codice, tocca, az);
    expect(r.ok).toBe(false);
    g.chiudi();
  });

  test('chi non è nella partita non può muovere', () => {
    const { g, codice } = avviata();
    expect(g.azione(codice, 'u3', { tipo: 'passa' })).toEqual({ ok: false, errore: 'Non sei in questa partita' });
    g.chiudi();
  });

  test('resa: la partita termina, viene salvata con seed, mazzi e log', async () => {
    const { g, salvate, codice } = avviata();
    expect(g.arrenditi(codice, 'u1')).toEqual({ ok: true, valore: undefined });
    await Promise.resolve();
    expect(salvate).toHaveLength(1);
    const p = salvate[0];
    expect(p).toMatchObject({ codice, seed: 42, versioneRegolamento: '6.0', esito: { vincitore: 'B', motivo: 'abbandono' } });
    expect(p.giocatori.map((x) => x.username)).toEqual(['alice', 'bob']);
    expect(p.mazzi.A.carte).toHaveLength(40);
    expect(p.log.at(-1)).toMatchObject({ giocatore: 'A', azione: { tipo: 'arrenditi' } });
    expect(g.aggiornamentoPer(codice, 'u2')!.statoTavolo).toBe('terminata');
    expect(g.azione(codice, 'u2', { tipo: 'passa' })).toEqual({ ok: false, errore: 'La partita è terminata' });
    g.chiudi();
  });

  test('massimo 3 partite aperte per utente', () => {
    const { g } = nuovo();
    for (let i = 0; i < 3; i++) expect(g.crea(A, 'd1', mazzoProva(), catalogoProva()).ok).toBe(true);
    expect(g.crea(A, 'd1', mazzoProva(), catalogoProva())).toEqual({ ok: false, errore: 'Hai già 3 partite aperte' });
    g.chiudi();
  });

  test('il mazzo è copiato alla creazione: modificarlo dopo non cambia la partita', () => {
    const { g } = nuovo();
    const m = mazzoProva();
    g.crea(A, 'd1', m, catalogoProva());
    m.carte.length = 0;
    expect(g.entra('COD1', B, 'd2', mazzoProva()).ok).toBe(true);
    g.chiudi();
  });

  test('una partita giocata fino in fondo con mosse legali (seed 42) termina e viene salvata una sola volta', async () => {
    const { g, salvate, codice } = avviata();
    // Col seed 42 e la scelta mosse[passo % mosse.length] la partita finisce con un esito entro 500 passi
    // (verificato su seed 1-40 e 42: tutte finiscono, in 43-220 passi).
    let fine = false;
    for (let passo = 0; passo < 500; passo++) {
      const ag = (['u1', 'u2'] as const).map((u) => [u, g.aggiornamentoPer(codice, u)!] as const);
      if (ag[0][1].statoTavolo === 'terminata') { fine = true; break; }
      const turno = ag.find(([, a]) => a.mosse.length > 0);
      if (!turno) throw new Error(`passo ${passo}: nessuno ha mosse`);
      const [u, a] = turno;
      const r = g.azione(codice, u, a.mosse[passo % a.mosse.length]);
      if (!r.ok) throw new Error(`passo ${passo}: ${r.errore}`);
    }
    expect(fine).toBe(true);
    await Promise.resolve();
    expect(salvate).toHaveLength(1);
    expect(salvate[0].log.length).toBeGreaterThan(0);
    expect(salvate[0].esito.motivo).not.toBe('chiusa');
    // altre mosse o notifiche dopo la fine non producono un secondo salvataggio
    g.azione(codice, 'u1', { tipo: 'passa' });
    await Promise.resolve();
    expect(salvate).toHaveLength(1);
    g.chiudi();
  });
});
