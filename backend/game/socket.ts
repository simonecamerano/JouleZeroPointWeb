import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server, Socket } from 'socket.io';
import { allowedOrigins } from '../app';
import logger from '../config/logger';
import Deck from '../models/Deck';
import Match from '../models/Match';
import User from '../models/User';
import { caricaCatalogo as caricaCatalogoDb, mazzoDaDeck } from './catalogo';
import { DefCarta, Mazzo } from './engine';
import { GestorePartite, PartitaSalvata } from './partite';

interface DatiSocket { userId: string; username: string; partite: Set<string> }
type Ack = (r: unknown) => void;

export function initSocket(
  server: http.Server,
  opzioni: { caricaCatalogo?: () => Promise<Record<number, DefCarta>> } = {},
): { io: Server; gestore: GestorePartite } {
  const caricaCatalogo = opzioni.caricaCatalogo ?? caricaCatalogoDb;
  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    maxHttpBufferSize: 16 * 1024,
  });

  const gestore = new GestorePartite({
    salva: async (p: PartitaSalvata) => {
      // Un utente cancellato durante la partita non deve restare nel registro: il riferimento si azzera.
      const giocatori = await Promise.all(p.giocatori.map(async (g) => (
        (await User.exists({ _id: g.userId })) ? g : { ...g, userId: null, username: null }
      )));
      await Match.create({ ...p, giocatori });
    },
    notifica: (userId, a) => { io.to(`utente:${userId}`).emit('partita:aggiornamento', a); },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !process.env.JWT_SECRET) return next(new Error('Non autenticato'));
      const { id } = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
      if (!mongoose.isValidObjectId(id)) return next(new Error('Non autenticato'));
      const user = await User.findById(id).select('username');
      if (!user) return next(new Error('Non autenticato'));
      const dati: DatiSocket = { userId: String(user._id), username: user.username, partite: new Set() };
      socket.data = dati;
      return next();
    } catch {
      return next(new Error('Non autenticato'));
    }
  });

  async function mazzoDi(username: string, deckId: unknown): Promise<Mazzo | string> {
    if (typeof deckId !== 'string' || !mongoose.isValidObjectId(deckId)) return 'Mazzo non trovato';
    const deck = await Deck.findOne({ _id: deckId, creator: username.toLowerCase() }).lean();
    if (!deck) return 'Mazzo non trovato';
    return mazzoDaDeck(deck);
  }

  /** Avvolge un gestore di evento: payload sempre oggetto, ack sempre funzione, nessuna eccezione esce. */
  const evento = (socket: Socket, nome: string, fn: (d: Record<string, unknown>, s: DatiSocket) => Promise<unknown> | unknown) => {
    socket.on(nome, async (dati: unknown, ack?: unknown) => {
      const rispondi: Ack = typeof ack === 'function' ? (ack as Ack) : () => {};
      try {
        const d = dati && typeof dati === 'object' ? (dati as Record<string, unknown>) : {};
        rispondi(await fn(d, socket.data as DatiSocket));
      } catch (e) {
        logger.error(`MATCH_SOCKET: ${nome} fallito: ${(e as Error).message}`);
        rispondi({ ok: false, errore: 'Errore del server' });
      }
    });
  };

  io.on('connection', (socket) => {
    const s = socket.data as DatiSocket;
    socket.join(`utente:${s.userId}`);
    const utente = { userId: s.userId, username: s.username };

    const segui = (codice: string) => {
      // Se il socket si e' disconnesso durante un await, l'evento disconnect e' gia' passato: contarlo ora lascerebbe una connessione fantasma.
      if (!socket.connected || s.partite.has(codice)) return;
      s.partite.add(codice);
      gestore.connesso(codice, s.userId);
    };

    evento(socket, 'partita:crea', async (d) => {
      const mazzo = await mazzoDi(s.username, d.deckId);
      if (typeof mazzo === 'string') return { ok: false, errore: mazzo };
      const r = gestore.crea(utente, d.deckId as string, mazzo, await caricaCatalogo());
      if (!r.ok) return r;
      segui(r.valore.codice);
      socket.emit('partita:aggiornamento', gestore.aggiornamentoPer(r.valore.codice, s.userId));
      return { ok: true, codice: r.valore.codice };
    });

    evento(socket, 'partita:entra', async (d) => {
      if (typeof d.codice !== 'string') return { ok: false, errore: 'Codice non valido' };
      const codice = d.codice;
      let mazzo: Mazzo | undefined;
      if (!gestore.aggiornamentoPer(codice, s.userId) && d.deckId !== undefined) {
        const m = await mazzoDi(s.username, d.deckId);
        if (typeof m === 'string') return { ok: false, errore: m };
        mazzo = m;
      }
      const r = gestore.entra(codice, utente, d.deckId as string | undefined, mazzo);
      if (!r.ok) return r;
      segui(codice);
      socket.emit('partita:aggiornamento', gestore.aggiornamentoPer(codice, s.userId));
      return { ok: true, ruolo: r.valore.ruolo };
    });

    evento(socket, 'partita:azione', (d) => {
      if (typeof d.codice !== 'string') return { ok: false, errore: 'Codice non valido' };
      const r = gestore.azione(d.codice, s.userId, d.azione);
      return r.ok ? { ok: true } : r;
    });

    evento(socket, 'partita:arrenditi', (d) => {
      if (typeof d.codice !== 'string') return { ok: false, errore: 'Codice non valido' };
      const r = gestore.arrenditi(d.codice, s.userId);
      return r.ok ? { ok: true } : r;
    });

    evento(socket, 'partita:mie', () => ({ ok: true, codici: gestore.partiteDi(s.userId) }));

    socket.on('disconnect', () => {
      for (const codice of s.partite) gestore.disconnesso(codice, s.userId);
    });
  });

  return { io, gestore };
}
