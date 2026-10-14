import { randomBytes, randomInt } from 'crypto';
import {
  Azione, applica, arrendi, chiDeveAgire, creaPartita, DefCarta, Mazzo, mosseLegali, PlayerId,
  StatoPartita, validaMazzo, vista, Vista,
} from './engine';
import { carteUsate, VERSIONE_REGOLAMENTO, VERSIONE_SCRIPT } from './catalogo';
import type { VoceLogMatch } from '../models/Match';

export interface Utente { userId: string; username: string }
export type StatoTavolo = 'attesa' | 'inCorso' | 'pausa' | 'terminata';

export interface Aggiornamento {
  codice: string;
  statoTavolo: StatoTavolo;
  ruolo: PlayerId;
  avversario: string | null;
  vista: Vista | null;
  mosse: Azione[];
  scadenzaFinestra: number | null;
}

export interface PartitaSalvata {
  codice: string;
  giocatori: { ruolo: PlayerId; userId: string | null; username: string | null; deckId: string }[];
  mazzi: Record<PlayerId, Mazzo>;
  carte: Record<number, DefCarta>;
  seed: number;
  versioneRegolamento: string;
  versioneScript: string;
  esito: { vincitore: PlayerId | null; motivo: string };
  durata: number;
  round: number;
  log: VoceLogMatch[];
  iniziata: Date;
}

export interface OpzioniGestore {
  salva: (p: PartitaSalvata) => Promise<void>;
  notifica: (userId: string, a: Aggiornamento) => void;
  seed?: () => number;
  codice?: () => string;
  timeoutFinestraMs?: number;
}

export type Esito<T = undefined> = { ok: true; valore: T } | { ok: false; errore: string };

const MAX_PARTITE_APERTE = 3;
export const PAUSA_MS = 10 * 60 * 1000;
export const CHIUSURA_MS = 24 * 60 * 60 * 1000;
export const PULIZIA_MS = 10 * 60 * 1000;

interface Posto extends Utente { deckId: string; mazzo: Mazzo; connessioni: number }

interface Partita {
  codice: string;
  posti: Partial<Record<PlayerId, Posto>>;
  catalogo: Record<number, DefCarta>;
  seed: number;
  stato: StatoPartita | null;
  log: VoceLogMatch[];
  iniziata: Date | null;
  inPausa: boolean;
  salvata: boolean;
  scadenzaFinestra: number | null;
  timer: { finestra?: NodeJS.Timeout; pausa?: NodeJS.Timeout; chiusura?: NodeJS.Timeout; pulizia?: NodeJS.Timeout };
}

const ok = <T>(valore: T): Esito<T> => ({ ok: true, valore });
const no = (errore: string): Esito<never> => ({ ok: false, errore });

export class GestorePartite {
  private partite = new Map<string, Partita>();
  private o: Required<OpzioniGestore>;

  constructor(o: OpzioniGestore) {
    this.o = {
      seed: () => randomInt(1, 2 ** 31 - 1),
      codice: () => randomBytes(6).toString('base64url').slice(0, 8),
      timeoutFinestraMs: Number(process.env.MATCH_WINDOW_TIMEOUT_MS) || 20000,
      ...o,
    };
  }

  partiteDi(userId: string): string[] {
    return [...this.partite.values()]
      .filter((p) => !p.stato?.esito && this.ruoloDi(p, userId))
      .map((p) => p.codice);
  }

  /** Le partite aperte dell'utente con lo stato del tavolo: niente stato vero, solo codice e fase. */
  partiteAperteDi(userId: string): { codice: string; statoTavolo: StatoTavolo }[] {
    return [...this.partite.values()]
      .filter((p) => !p.stato?.esito && this.ruoloDi(p, userId))
      .map((p) => ({ codice: p.codice, statoTavolo: this.statoTavolo(p) }));
  }

  crea(u: Utente, deckId: string, mazzo: Mazzo, catalogo: Record<number, DefCarta>): Esito<{ codice: string }> {
    if (this.partiteDi(u.userId).length >= MAX_PARTITE_APERTE) return no(`Hai già ${MAX_PARTITE_APERTE} partite aperte`);
    const errore = validaMazzo(mazzo, catalogo);
    if (errore) return no(errore);
    let codice = this.o.codice();
    while (this.partite.has(codice)) codice = this.o.codice();
    const p: Partita = {
      codice, catalogo, seed: this.o.seed(), stato: null, log: [], iniziata: null,
      inPausa: false, salvata: false, scadenzaFinestra: null, timer: {},
      posti: { A: { ...u, deckId, mazzo: structuredClone(mazzo), connessioni: 0 } },
    };
    this.partite.set(codice, p);
    // Una partita mai iniziata si chiude dopo 24 ore senza salvare nulla.
    p.timer.chiusura = setTimeout(() => this.chiudiSenzaEsito(p), CHIUSURA_MS);
    return ok({ codice });
  }

  entra(codice: string, u: Utente, deckId?: string, mazzo?: Mazzo): Esito<{ ruolo: PlayerId }> {
    const p = this.partite.get(codice);
    if (!p) return no('Partita non trovata');
    const gia = this.ruoloDi(p, u.userId);
    if (gia) return ok({ ruolo: gia });
    if (p.posti.B) return no('La partita è già al completo');
    if (p.posti.A!.userId === u.userId) return no('Non puoi giocare contro te stesso');
    if (!deckId || !mazzo) return no('Scegli un mazzo');
    if (this.partiteDi(u.userId).length >= MAX_PARTITE_APERTE) return no(`Hai già ${MAX_PARTITE_APERTE} partite aperte`);
    const errore = validaMazzo(mazzo, p.catalogo);
    if (errore) return no(errore);
    p.posti.B = { ...u, deckId, mazzo: structuredClone(mazzo), connessioni: 0 };
    p.stato = creaPartita({ seed: p.seed, mazzi: { A: p.posti.A!.mazzo, B: p.posti.B.mazzo }, catalogo: p.catalogo });
    p.iniziata = new Date();
    clearTimeout(p.timer.chiusura);
    p.timer.chiusura = undefined;
    this.dopoCambio(p);
    // Se A ha chiuso la scheda mentre aspettava, la partita parte con A assente: pausa e chiusura vanno armate ora.
    if (!this.tuttiPresenti(p)) this.armaAssenza(p);
    return ok({ ruolo: 'B' });
  }

  azione(codice: string, userId: string, azione: unknown): Esito {
    const p = this.partite.get(codice);
    if (!p) return no('Partita non trovata');
    const ruolo = this.ruoloDi(p, userId);
    if (!ruolo) return no('Non sei in questa partita');
    const rifiuta = (errore: string): Esito => {
      this.notificaUno(p, ruolo);
      return no(errore);
    };
    if (!p.stato) return rifiuta('La partita non è ancora iniziata');
    if (p.stato.esito) return rifiuta('La partita è terminata');
    if (p.inPausa) return rifiuta('Partita in pausa');
    if (!azione || typeof azione !== 'object' || typeof (azione as { tipo?: unknown }).tipo !== 'string') {
      return rifiuta('Azione non valida');
    }
    // `applica` può ancora lanciare su input imprevisti (minor aperto del piano 1A): lo stato resta quello di prima.
    let r: ReturnType<typeof applica>;
    try {
      r = applica(p.stato, ruolo, azione as Azione);
    } catch (e) {
      console.error(`Partita ${p.codice}: applica ha lanciato ${(e as Error).message}`);
      return rifiuta('Mossa non applicabile');
    }
    if (!r.ok) return rifiuta(r.errore);
    p.stato = r.stato;
    p.log.push({ t: new Date(), giocatore: ruolo, azione });
    this.dopoCambio(p);
    return ok(undefined);
  }

  arrenditi(codice: string, userId: string): Esito {
    const p = this.partite.get(codice);
    if (!p) return no('Partita non trovata');
    const ruolo = this.ruoloDi(p, userId);
    if (!ruolo) return no('Non sei in questa partita');
    if (!p.stato) {
      this.rimuovi(p);
      return ok(undefined);
    }
    if (p.stato.esito) return no('La partita è terminata');
    p.stato = arrendi(p.stato, ruolo);
    p.log.push({ t: new Date(), giocatore: ruolo, azione: { tipo: 'arrenditi' } });
    this.dopoCambio(p);
    return ok(undefined);
  }

  /** Annulla un invito: solo il creatore, solo se la partita non e' ancora iniziata. Non salva nulla. */
  annulla(codice: string, userId: string): Esito {
    const p = this.partite.get(codice);
    if (!p) return no('Partita non trovata');
    if (p.posti.A?.userId !== userId) return no('Solo chi ha creato la partita può annullarla');
    if (p.stato) return no('La partita è già iniziata');
    this.rimuovi(p);
    return ok(undefined);
  }

  aggiornamentoPer(codice: string, userId: string): Aggiornamento | null {
    const p = this.partite.get(codice);
    if (!p) return null;
    const ruolo = this.ruoloDi(p, userId);
    return ruolo ? this.aggiornamento(p, ruolo) : null;
  }

  connesso(codice: string, userId: string): void {
    const p = this.partite.get(codice);
    if (!p) return;
    const ruolo = this.ruoloDi(p, userId);
    if (!ruolo) return;
    p.posti[ruolo]!.connessioni += 1;
    if (!this.tuttiPresenti(p)) return;
    clearTimeout(p.timer.pausa);
    p.timer.pausa = undefined;
    if (p.stato && !p.stato.esito) {
      clearTimeout(p.timer.chiusura);
      p.timer.chiusura = undefined;
    }
    if (p.inPausa) {
      p.inPausa = false;
      this.programmaFinestra(p);
      this.notificaTutti(p);
    }
  }

  disconnesso(codice: string, userId: string): void {
    const p = this.partite.get(codice);
    if (!p) return;
    const ruolo = this.ruoloDi(p, userId);
    if (!ruolo) return;
    const posto = p.posti[ruolo]!;
    posto.connessioni = Math.max(0, posto.connessioni - 1);
    if (posto.connessioni > 0) return;
    this.armaAssenza(p);
  }

  chiudi(): void {
    for (const p of this.partite.values()) this.fermaTimer(p);
    this.partite.clear();
  }

  // --- interni ---

  private ruoloDi(p: Partita, userId: string): PlayerId | null {
    if (p.posti.A?.userId === userId) return 'A';
    if (p.posti.B?.userId === userId) return 'B';
    return null;
  }

  private tuttiPresenti(p: Partita): boolean {
    return (['A', 'B'] as PlayerId[]).every((r) => !p.posti[r] || p.posti[r]!.connessioni > 0);
  }

  /** Arma pausa (10 minuti) e chiusura (24 ore) di una partita in corso con almeno un posto vuoto di connessioni. */
  private armaAssenza(p: Partita): void {
    if (!p.stato || p.stato.esito) return;
    if (!p.timer.pausa) {
      p.timer.pausa = setTimeout(() => {
        p.timer.pausa = undefined;
        p.inPausa = true;
        this.programmaFinestra(p);
        this.notificaTutti(p);
      }, PAUSA_MS);
    }
    if (!p.timer.chiusura) p.timer.chiusura = setTimeout(() => this.chiudiSenzaEsito(p), CHIUSURA_MS);
  }

  private statoTavolo(p: Partita): StatoTavolo {
    if (!p.stato) return 'attesa';
    if (p.stato.esito) return 'terminata';
    return p.inPausa ? 'pausa' : 'inCorso';
  }

  private aggiornamento(p: Partita, ruolo: PlayerId): Aggiornamento {
    const avv = p.posti[ruolo === 'A' ? 'B' : 'A'];
    const giocabile = p.stato && !p.stato.esito && !p.inPausa;
    return {
      codice: p.codice,
      statoTavolo: this.statoTavolo(p),
      ruolo,
      avversario: avv?.username ?? null,
      vista: p.stato ? vista(p.stato, ruolo) : null,
      mosse: giocabile ? mosseLegali(p.stato!, ruolo) : [],
      scadenzaFinestra: p.stato && giocabile && chiDeveAgire(p.stato) === ruolo ? p.scadenzaFinestra : null,
    };
  }

  private notificaUno(p: Partita, ruolo: PlayerId): void {
    const posto = p.posti[ruolo];
    if (posto) this.o.notifica(posto.userId, this.aggiornamento(p, ruolo));
  }

  protected notificaTutti(p: Partita): void {
    this.notificaUno(p, 'A');
    this.notificaUno(p, 'B');
  }

  /** Dopo ogni cambio di stato: timer della finestra, fine partita, notifiche. */
  protected dopoCambio(p: Partita): void {
    this.programmaFinestra(p);
    if (p.stato?.esito && !p.salvata) this.termina(p, { vincitore: p.stato.esito.vincitore, motivo: p.stato.esito.motivo });
    this.notificaTutti(p);
  }

  protected programmaFinestra(p: Partita): void {
    clearTimeout(p.timer.finestra);
    p.timer.finestra = undefined;
    p.scadenzaFinestra = null;
    const s = p.stato;
    if (!s || s.esito || p.inPausa || !s.finestra || s.decisione) return;
    const chi = chiDeveAgire(s);
    if (!chi) return;
    p.scadenzaFinestra = Date.now() + this.o.timeoutFinestraMs;
    p.timer.finestra = setTimeout(() => {
      p.timer.finestra = undefined;
      if (!p.stato || chiDeveAgire(p.stato) !== chi || !p.stato.finestra) return;
      let r: ReturnType<typeof applica>;
      try {
        r = applica(p.stato, chi, { tipo: 'passa' });
      } catch (e) {
        this.passaAutomaticoFallito(p, (e as Error).message);
        return;
      }
      if (!r.ok) {
        this.passaAutomaticoFallito(p, r.errore);
        return;
      }
      p.stato = r.stato;
      p.log.push({ t: new Date(), giocatore: 'server', azione: { tipo: 'passa', per: chi, motivo: 'timeout' } });
      this.dopoCambio(p);
    }, this.o.timeoutFinestraMs);
  }

  /** Il passa automatico non e' riuscito: lo si segnala e la vista smette di mostrare una scadenza gia' passata. */
  private passaAutomaticoFallito(p: Partita, motivo: string): void {
    console.error(`Partita ${p.codice}: passa automatico fallito (${motivo})`);
    p.scadenzaFinestra = null;
    this.notificaTutti(p);
  }

  private termina(p: Partita, esito: PartitaSalvata['esito']): void {
    this.fermaTimer(p);
    p.salvata = true;
    const salvata: PartitaSalvata = {
      codice: p.codice,
      giocatori: (['A', 'B'] as PlayerId[]).map((ruolo) => {
        const g = p.posti[ruolo]!;
        return { ruolo, userId: g.userId, username: g.username, deckId: g.deckId };
      }),
      mazzi: { A: p.posti.A!.mazzo, B: p.posti.B!.mazzo },
      carte: carteUsate(p.catalogo, [p.posti.A!.mazzo, p.posti.B!.mazzo]),
      seed: p.seed,
      versioneRegolamento: VERSIONE_REGOLAMENTO,
      versioneScript: VERSIONE_SCRIPT,
      esito,
      durata: Date.now() - p.iniziata!.getTime(),
      round: p.stato!.round,
      log: p.log,
      iniziata: p.iniziata!,
    };
    this.o.salva(salvata).catch((e: Error) => {
      // Il salvataggio non deve far cadere il processo: la partita resta giocata, si perde solo il registro.
      console.error(`Salvataggio partita ${p.codice} fallito: ${e.message}`);
    });
    p.timer.pulizia = setTimeout(() => this.rimuovi(p), PULIZIA_MS);
  }

  protected chiudiSenzaEsito(p: Partita): void {
    if (p.stato && !p.salvata) {
      p.log.push({ t: new Date(), giocatore: 'server', azione: { tipo: 'chiusa' } });
      this.termina(p, { vincitore: null, motivo: 'chiusa' });
    }
    this.rimuovi(p);
  }

  protected fermaTimer(p: Partita): void {
    for (const t of Object.values(p.timer)) clearTimeout(t);
    p.timer = {};
  }

  protected rimuovi(p: Partita): void {
    this.fermaTimer(p);
    this.partite.delete(p.codice);
  }
}
