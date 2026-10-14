import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { io as connetti, Socket } from 'socket.io-client';
import { connectTestDB, closeTestDB, clearDatabase } from '../setup';
import app from '../../app';
import User from '../../models/User';
import Deck from '../../models/Deck';
import Match from '../../models/Match';
import { initSocket } from '../../game/socket';
import { GestorePartite } from '../../game/partite';
import { catalogoProva } from '../game/helpers';
import type { Aggiornamento } from '../../game/partite';

let server: http.Server;
let url: string;
let chiudi: () => void;
let gestore: GestorePartite;
const aperti: Socket[] = [];

/** `unica`: carta messa al posto della 14, per riconoscere un mazzo dall'altro nei test sui segreti. */
async function utente(username: string, unica = 14) {
  const u = await User.create({
    username, usernameDisplay: username, email: `${username}@example.test`, password: 'Password123!',
    isVerified: true, privacyAccepted: true,
  });
  const token = jwt.sign({ id: u._id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((cardId) => ({ cardId, count: 3 }));
  cards.push({ cardId: unica, count: 1 });
  const deck = await Deck.create({ name: 'Prova', creator: username, cards, costruttoreId: 100 });
  return { id: String(u._id), token, deckId: String(deck._id) };
}

function socket(token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connetti(url, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
    aperti.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const emetti = <T = { ok: boolean; errore?: string; codice?: string; ruolo?: string }>(s: Socket, ev: string, dati: unknown) =>
  new Promise<T>((resolve) => s.emit(ev, dati, resolve));

const prossimo = (s: Socket) => new Promise<Aggiornamento>((resolve) => s.once('partita:aggiornamento', resolve));

const connessioniDi = (codice: string, ruolo: 'A' | 'B') =>
  (gestore as unknown as { partite: Map<string, { posti: Record<string, { connessioni: number }> }> })
    .partite.get(codice)!.posti[ruolo].connessioni;

beforeAll(async () => {
  await connectTestDB();
  server = http.createServer(app);
  const r = initSocket(server, { caricaCatalogo: async () => catalogoProva() });
  gestore = r.gestore;
  chiudi = () => { r.gestore.chiudi(); r.io.close(); };
  await new Promise<void>((res) => server.listen(0, res));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  aperti.splice(0).forEach((s) => s.disconnect());
  await clearDatabase();
});

afterAll(async () => {
  chiudi();
  await new Promise((res) => server.close(res));
  await closeTestDB();
});

async function partitaIniziata(unicaBob = 14) {
  const a = await utente('alice');
  const b = await utente('bob', unicaBob);
  const sa = await socket(a.token);
  const sb = await socket(b.token);
  const crea = await emetti(sa, 'partita:crea', { deckId: a.deckId });
  expect(crea.ok).toBe(true);
  const codice = crea.codice!;
  const [agA, agB] = await Promise.all([prossimo(sa), prossimo(sb), emetti(sb, 'partita:entra', { codice, deckId: b.deckId })]);
  return { a, b, sa, sb, codice, agA, agB };
}

describe('socket delle partite', () => {
  test('senza token la connessione è rifiutata', async () => {
    await expect(socket()).rejects.toThrow('Non autenticato');
  });

  test('con token di un utente inesistente la connessione è rifiutata', async () => {
    const token = jwt.sign({ id: '64b000000000000000000000' }, process.env.JWT_SECRET as string);
    await expect(socket(token)).rejects.toThrow('Non autenticato');
  });

  test('crea, invito, partita avviata: ognuno riceve solo la propria vista', async () => {
    const { agA, agB } = await partitaIniziata();
    expect(agA).toMatchObject({ statoTavolo: 'inCorso', ruolo: 'A', avversario: 'bob' });
    expect(agB).toMatchObject({ statoTavolo: 'inCorso', ruolo: 'B', avversario: 'alice' });
    expect(agA.vista!.giocatori.B.mano).toBeNull();
    const testo = JSON.stringify([agA, agB]);
    expect(testo).not.toContain('"rng"');
    expect(testo).not.toContain('"tpSpostamento"');
  });

  test('nessun segreto nel payload: né catalogo, né carte coperte dell avversario', async () => {
    // La 19 sta solo nel mazzo di bob: all'inizio è nella sua mano o nel suo mazzo, quindi coperta per alice.
    const { agA, agB } = await partitaIniziata(19);
    const perAlice = JSON.stringify(agA);
    expect(perAlice).not.toContain('"carte"');
    expect(perAlice).not.toContain('"rng"');
    expect(perAlice).not.toContain('"cardId":19');
    const bobLaVede = JSON.stringify(agB.vista!.giocatori.B).includes('"cardId":19');
    const inMazzo = agB.vista!.giocatori.B.carteFuturo > 0;
    expect(bobLaVede || inMazzo).toBe(true); // la carta esiste davvero nel gioco di bob
    expect(JSON.stringify(agB)).not.toContain('"carte"');
    expect(JSON.stringify(agB)).not.toContain('"rng"');
  });

  test('mazzo di un altro utente: rifiutato', async () => {
    const a = await utente('alice');
    const b = await utente('bob');
    const sa = await socket(a.token);
    expect(await emetti(sa, 'partita:crea', { deckId: b.deckId })).toEqual({ ok: false, errore: 'Mazzo non trovato' });
  });

  test('mazzo cancellato o modificato dopo la creazione: la partita usa la copia presa alla creazione', async () => {
    const a = await utente('alice');
    const b = await utente('bob');
    const sa = await socket(a.token);
    const sb = await socket(b.token);
    const { codice } = await emetti(sa, 'partita:crea', { deckId: a.deckId });
    await Deck.deleteOne({ _id: a.deckId });
    expect(await emetti(sb, 'partita:entra', { codice, deckId: b.deckId })).toEqual({ ok: true, ruolo: 'B' });
    await Deck.updateOne({ _id: b.deckId }, { $set: { cards: [{ cardId: 2, count: 1 }] } });
    await emetti(sa, 'partita:arrenditi', { codice });
    await new Promise((res) => setTimeout(res, 200));
    const m = await Match.findOne({ codice }).lean();
    expect(m!.mazzi.A.carte).toHaveLength(40);
    expect(m!.mazzi.B.carte).toHaveLength(40);
  });

  test('un terzo utente con il codice non entra e non riceve viste', async () => {
    const { codice } = await partitaIniziata();
    const c = await utente('carlo');
    const sc = await socket(c.token);
    let ricevuto = false;
    sc.on('partita:aggiornamento', () => { ricevuto = true; });
    expect(await emetti(sc, 'partita:entra', { codice, deckId: c.deckId })).toEqual({ ok: false, errore: 'La partita è già al completo' });
    expect(await emetti(sc, 'partita:azione', { codice, azione: { tipo: 'passa' } })).toEqual({ ok: false, errore: 'Non sei in questa partita' });
    await new Promise((r) => setTimeout(r, 100));
    expect(ricevuto).toBe(false);
  });

  test('mossa illegale: errore nell ack e vista rimandata al mittente', async () => {
    const { sa, sb, codice, agA } = await partitaIniziata();
    const [chi, s] = agA.mosse.length ? (['A', sb] as const) : (['B', sa] as const);
    const vista = prossimo(s);
    const r = await emetti(s, 'partita:azione', { codice, azione: { tipo: 'passa' } });
    expect(r).toEqual({ ok: false, errore: 'Non tocca a te' });
    expect((await vista).ruolo).toBe(chi === 'A' ? 'B' : 'A');
  });

  test.each([
    ['payload assente', undefined],
    ['codice numerico', { codice: 42, azione: { tipo: 'passa' } }],
    ['azione stringa', { codice: 'X', azione: 'passa' }],
  ])('payload malformato su azione (%s): errore nell ack, il server resta in piedi', async (_n, dati) => {
    const a = await utente('alice');
    const sa = await socket(a.token);
    const r = await emetti(sa, 'partita:azione', dati);
    expect(r.ok).toBe(false);
    expect(await emetti(sa, 'partita:mie', {})).toEqual({ ok: true, codici: [] });
  });

  test.each([
    ['crea senza deckId', 'partita:crea', {}],
    ['crea con deckId oggetto', 'partita:crea', { deckId: { $ne: null } }],
    ['entra con codice numerico', 'partita:entra', { codice: 42 }],
    ['entra senza payload', 'partita:entra', undefined],
    ['arrenditi con codice oggetto', 'partita:arrenditi', { codice: {} }],
  ])('payload malformato (%s): errore nell ack, il server resta in piedi', async (_n, ev, dati) => {
    const a = await utente('alice');
    const sa = await socket(a.token);
    const r = await emetti(sa, ev, dati);
    expect(r.ok).toBe(false);
    expect(typeof r.errore).toBe('string');
    expect(await emetti(sa, 'partita:mie', {})).toEqual({ ok: true, codici: [] });
  });

  test('ack mancante: il server non va in eccezione', async () => {
    const a = await utente('alice');
    const sa = await socket(a.token);
    sa.emit('partita:crea', { deckId: a.deckId });
    expect(await emetti(sa, 'partita:mie', {})).toMatchObject({ ok: true });
  });

  test('riconnessione: chi rientra riceve la vista corrente', async () => {
    const { a, sa, codice } = await partitaIniziata();
    sa.disconnect();
    const sa2 = await socket(a.token);
    const ag = prossimo(sa2);
    expect(await emetti(sa2, 'partita:entra', { codice })).toEqual({ ok: true, ruolo: 'A' });
    expect((await ag).statoTavolo).toBe('inCorso');
    expect(await emetti(sa2, 'partita:mie', {})).toEqual({ ok: true, codici: [codice] });
  });

  test('due schede dello stesso utente ricevono entrambe la vista', async () => {
    const { a, sa, sb, codice } = await partitaIniziata();
    const sa2 = await socket(a.token);
    await emetti(sa2, 'partita:entra', { codice });
    const agSa = prossimo(sa);
    const agSa2 = prossimo(sa2);
    const agSb = prossimo(sb);
    await emetti(sb, 'partita:arrenditi', { codice });
    expect((await agSa).statoTavolo).toBe('terminata');
    expect((await agSa2).statoTavolo).toBe('terminata');
    expect((await agSb).statoTavolo).toBe('terminata');
  });

  test('chiudere una delle due schede non rende l utente assente', async () => {
    const { a, sa, codice } = await partitaIniziata();
    const sa2 = await socket(a.token);
    await emetti(sa2, 'partita:entra', { codice });
    expect(connessioniDi(codice, 'A')).toBe(2);
    sa2.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    expect(connessioniDi(codice, 'A')).toBe(1);
    sa.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    expect(connessioniDi(codice, 'A')).toBe(0);
  });

  test('a fine partita il Match viene salvato con seed, mazzi e log', async () => {
    const { a, sa, codice } = await partitaIniziata();
    await emetti(sa, 'partita:arrenditi', { codice });
    await new Promise((r) => setTimeout(r, 200));
    const m = await Match.findOne({ codice }).lean();
    expect(m).not.toBeNull();
    expect(m!.esito).toEqual({ vincitore: 'B', motivo: 'abbandono' });
    expect(m!.giocatori.find((g) => g.ruolo === 'A')!.userId).toBe(a.id);
    expect(m!.mazzi.A.carte).toHaveLength(40);
    expect(Object.keys(m!.carte).length).toBeGreaterThan(0);
    expect(m!.log.length).toBeGreaterThan(0);
  });

  test('utente cancellato durante la partita: il Match salvato ha userId e username null', async () => {
    const { a, b, sa, codice } = await partitaIniziata();
    await User.deleteOne({ _id: b.id });
    await emetti(sa, 'partita:arrenditi', { codice });
    await new Promise((r) => setTimeout(r, 200));
    const m = await Match.findOne({ codice }).lean();
    expect(m).not.toBeNull();
    const gA = m!.giocatori.find((g) => g.ruolo === 'A')!;
    const gB = m!.giocatori.find((g) => g.ruolo === 'B')!;
    expect(gA.userId).toBe(a.id);
    expect(gA.username).toBe('alice');
    expect(gB.userId).toBeNull();
    expect(gB.username).toBeNull();
  });
});
