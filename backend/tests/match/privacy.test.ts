import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { connectTestDB, closeTestDB, clearDatabase } from '../setup';
import Match from '../../models/Match';
import User from '../../models/User';
import { anonimizzaPartite, partiteDaEsportare } from '../../game/privacyMatch';
import { purgeInactiveAccounts } from '../../tasks/retentionTask';
import { mazzoProva } from '../game/helpers';

beforeAll(connectTestDB);
afterAll(closeTestDB);
beforeEach(clearDatabase);

async function partita(a = { userId: 'u1', username: 'alice' }, b = { userId: 'u2', username: 'bob' }) {
  return Match.create({
    codice: 'C1',
    giocatori: [
      { ruolo: 'A', ...a, deckId: 'd1' },
      { ruolo: 'B', ...b, deckId: 'd2' },
    ],
    mazzi: { A: mazzoProva(), B: mazzoProva() },
    carte: {},
    seed: 1, versioneRegolamento: '6.0', versioneScript: 'abcdef012345',
    esito: { vincitore: 'B', motivo: 'collasso' }, durata: 1000, round: 7,
    log: [
      { t: new Date(), giocatore: 'A', azione: { tipo: 'passaTurno' } },
      { t: new Date(), giocatore: 'B', azione: { tipo: 'giocaCarta', segreto: 'mossa-avversario' } },
      { t: new Date(), giocatore: 'server', azione: { tipo: 'timeout' } },
    ],
    iniziata: new Date(),
  });
}

async function utenteDiProva(username: string, overrides: Record<string, unknown> = {}) {
  const user = await User.create({
    username,
    usernameDisplay: username,
    email: `${username}@test.com`,
    password: 'hash-di-prova-non-usato',
    isVerified: true,
    privacyAccepted: true,
    privacyAcceptedAt: new Date(),
    ...overrides,
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret-at-least-thirty-two-chars-long');
  return { user, token };
}

describe('privacyMatch', () => {
  test('export: solo le partite dell utente, con il proprio mazzo e solo le proprie mosse', async () => {
    await partita();
    const out = await partiteDaEsportare('u1');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ruolo: 'A', esito: { vincitore: 'B' }, round: 7 });
    expect(out[0].mazzo.carte).toHaveLength(40);
    expect(out[0].mosse).toHaveLength(1);
    expect(out[0].mosse[0].azione).toEqual({ tipo: 'passaTurno' });
    const json = JSON.stringify(out);
    expect(json).not.toContain('mossa-avversario');
    expect(json).not.toContain('timeout');
    expect(json).not.toContain('bob');
    expect(out[0]).not.toHaveProperty('avversario');
    expect(await partiteDaEsportare('u9')).toEqual([]);
  });

  test('export lato avversario: vede le proprie mosse, non quelle di chi ha giocato A', async () => {
    await partita();
    const out = await partiteDaEsportare('u2');
    expect(out[0].ruolo).toBe('B');
    expect(JSON.stringify(out)).toContain('mossa-avversario');
    expect(JSON.stringify(out)).not.toContain('passaTurno');
  });

  test('cancellazione: il giocatore viene anonimizzato, la partita resta per l avversario', async () => {
    await partita();
    expect(await anonimizzaPartite('u1')).toBe(1);
    const m = await Match.findOne({ codice: 'C1' }).lean();
    expect(m!.giocatori[0]).toMatchObject({ ruolo: 'A', userId: null, username: null });
    expect(m!.giocatori[1]).toMatchObject({ userId: 'u2', username: 'bob' });
    expect(await partiteDaEsportare('u2')).toHaveLength(1);
    expect(await partiteDaEsportare('u1')).toEqual([]);
  });
});

describe('cablaggio: rotte e ritenzione', () => {
  test('DELETE /profile anonimizza le partite dell utente e lascia intatte quelle dell avversario', async () => {
    const { user, token } = await utenteDiProva('giocatorea');
    await partita({ userId: String(user._id), username: 'giocatorea' });

    const res = await request(app).delete('/api/v1/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);

    const m = await Match.findOne({ codice: 'C1' }).lean();
    expect(m!.giocatori[0]).toMatchObject({ ruolo: 'A', userId: null, username: null });
    expect(m!.giocatori[1]).toMatchObject({ ruolo: 'B', userId: 'u2', username: 'bob' });
  });

  test('GET /export-data contiene le partite con le sole mosse dell utente', async () => {
    const { user, token } = await utenteDiProva('giocatorea');
    await partita({ userId: String(user._id), username: 'giocatorea' });

    const res = await request(app).get('/api/v1/auth/export-data').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.content.matches_count).toBe(1);
    const [p] = res.body.content.matches;
    expect(p).toMatchObject({ ruolo: 'A', round: 7 });
    expect(p.mosse).toHaveLength(1);
    expect(p.mosse[0].azione).toEqual({ tipo: 'passaTurno' });
    expect(JSON.stringify(res.body)).not.toContain('mossa-avversario');
    expect(JSON.stringify(res.body)).not.toContain('bob');
  });

  test('purgeInactiveAccounts su un utente scaduto anonimizza le sue partite', async () => {
    const scaduto = new Date();
    scaduto.setMonth(scaduto.getMonth() - 30);
    const { user } = await utenteDiProva('inattivo', { lastLogin: scaduto });
    await partita({ userId: String(user._id), username: 'inattivo' });

    const out = await purgeInactiveAccounts(false);
    expect(out.deletedUsers).toBe(1);

    const m = await Match.findOne({ codice: 'C1' }).lean();
    expect(m!.giocatori[0]).toMatchObject({ userId: null, username: null });
    expect(m!.giocatori[1]).toMatchObject({ userId: 'u2', username: 'bob' });
  });
});
