// Linguaggio delle dichiarazioni degli effetti delle carte (spec 1C, sezione 2).
// Ogni mattone ha una frase in italiano (`d`) e una funzione (`f`): la frase serve al riepilogo che Simone
// valida, la funzione al motore. Nessuna chiamata al motore al caricamento del modulo: engine ed effetti
// si importano a vicenda.
import { distruggi as distruggiCarta, sposta as spostaCarta } from '../engine/campo';
import { cercaInCampo, contaInColonna, def } from '../engine/carte';
import { log, nomeG, NOMI_COLONNA } from '../engine/log';
import { ordine, pesca as pescaCarta } from '../engine/risorse';
import { inverti, ricalcolaTP } from '../engine/temperatura';
import {
  altro, CartaCampo, Colonna, COLONNE, DefCarta, Domanda, Durata, EventoGioco, Momento, MomentoRitardato,
  PlayerId, Risposta, StatoPartita,
} from '../engine/types';
import { infliggiDanno, perdiVita } from '../engine/vita';
import { vietato } from './continui';

/** Lanciata da `chiedi` quando la risposta non c'è ancora: il dispatcher apre la decisione. */
export class Sospendi extends Error {
  constructor(public domanda: Domanda, public chi: PlayerId) {
    super('Scelta in sospeso');
  }
}

export interface Ctx {
  s: StatoPartita;
  sorgente: string;
  cardId: number;
  indice: number;
  controllore: PlayerId;
  evento: EventoGioco;
  dati: Record<string, string | number>;
  /** Restituisce la risposta già data o sospende l'effetto. `null` se la domanda non ha scelte possibili. */
  chiedi(d: Domanda, chi?: PlayerId): Risposta | null;
}

export interface Az { d: string; f: (c: Ctx) => void }
export interface Cond { d: string; f: (c: Ctx) => boolean }
export interface Sel { d: string; f: (c: Ctx) => string[] }
export type Chi = 'controllore' | 'avversario' | 'entrambi';
export type Bers = 'questa' | 'bersaglio';

export type Vieto = { tipo: 'evento'; giocatore: PlayerId } | { tipo: 'sposta'; uid: string };
export interface CtxContinuo { s: StatoPartita; sorgente: string; cardId: number; controllore: PlayerId }
export interface Continuo {
  /** Bonus PEP in Collisione alla carta `fc`. */
  pep?: (c: CtxContinuo, fc: CartaCampo) => number;
  vieta?: (c: CtxContinuo, v: Vieto) => boolean;
  /** Variazione del costo di una carta che `p` sta giocando. */
  costo?: (c: CtxContinuo, p: PlayerId, d: DefCarta, colonna?: Colonna) => number;
  limitaTP?: boolean;
  /** Sull'Evento stesso: si gioca solo durante la Collisione (I27). */
  soloInCollisione?: boolean;
}

export interface DefEffetto {
  tipo: 'innescato' | 'attivabile' | 'continuo' | 'ritardato';
  testo: string;
  momento?: Momento;
  esegui?: (c: Ctx) => void;
  quando?: 'azioni' | 'collisione';
  limite?: 'round';
  condizione?: Cond;
  continuo?: Continuo;
  nome?: string;
  /** Colonne oltre al Presente in cui il Frammento è attivo (testi che citano un'altra colonna). */
  attivaIn?: Colonna[];
}

export interface DichiarazioneCarta { cardId: number; nome: string; effetti: DefEffetto[] }

// ---- supporto ----

const inSequenza = (az: Az[]) => (c: Ctx): void => {
  for (const a of az) a.f(c);
};
const elenco = (az: Az[]): string => az.map((a) => a.d).join(', ');
const segno = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
const giocatoriDi = (c: Ctx, chi: Chi): PlayerId[] =>
  chi === 'controllore' ? [c.controllore] : chi === 'avversario' ? [altro(c.controllore)] : ordine(c.s);
const A_CHI: Record<Chi, string> = { controllore: 'a te', avversario: "all'avversario", entrambi: 'a entrambi i giocatori' };
const PER_CHI: Record<Chi, string> = { controllore: 'per te', avversario: "per l'avversario", entrambi: 'per entrambi i giocatori' };
const DURATE: Record<Durata, string> = { collisione: 'fino a fine Collisione', round: 'fino a fine Round', permanente: 'permanente' };
const MOMENTI_RITARDATI: Record<MomentoRitardato, string> = {
  inizioRound: "all'inizio del prossimo Round", risorse: 'nella fase Risorse del prossimo Round',
  fineCollisione: 'alla fine della Collisione', fineRound: 'alla fine del Round',
};

export const nomeFonte = (c: Ctx): string => def(c.s, c.cardId).nome;
const uidDi = (c: Ctx, b: Bers): string | null =>
  b === 'questa' ? c.sorgente : typeof c.dati.bersaglio === 'string' ? c.dati.bersaglio : null;
const descBers = (b: Bers): string => (b === 'questa' ? 'questa carta' : 'il bersaglio');

// ---- azioni ----

export const tp = (n: number): Az => ({
  d: `TP ${segno(n)}`,
  f: (c) => {
    log(c.s, `${nomeFonte(c)}: TP ${segno(n)}`);
    c.s.tpSpostamento += n;
    ricalcolaTP(c.s);
  },
});

export const dannoIT = (chi: Chi, n: number): Az => ({
  d: `${n} danno IT ${A_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) infliggiDanno(c.s, p, n);
  },
});

/** Perdita di IT: non è un danno (I6). */
export const perdiIT = (chi: Chi, n: number): Az => ({
  d: `perdita di ${n} IT ${PER_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) perdiVita(c.s, p, n);
  },
});

export const pesca = (chi: Chi, n = 1): Az => ({
  d: `pesca ${n} ${n === 1 ? 'carta' : 'carte'} ${PER_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) for (let i = 0; i < n; i++) pescaCarta(c.s, p);
  },
});

export const guadagnaET = (chi: Chi, n: number): Az => ({
  d: `+${n} ET ${PER_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) {
      c.s.giocatori[p].et += n;
      log(c.s, `${nomeFonte(c)}: ${nomeG(p)} ottiene ${n} ET`);
    }
  },
});

/** Inversione provocata da un effetto: non volontaria, quindi senza la tassa di 1 IT. */
export const inversione = (): Az => ({
  d: "avviene un'Inversione Temporale",
  f: (c) => inverti(c.s, null),
});

export const distruggi = (b: Bers = 'questa'): Az => ({
  d: `distruggi ${descBers(b)}`,
  f: (c) => {
    const uid = uidDi(c, b);
    if (uid) distruggiCarta(c.s, uid);
  },
});

export const spostaIn = (colonna: Colonna, b: Bers = 'questa'): Az => ({
  d: `sposta ${descBers(b)} nel ${NOMI_COLONNA[colonna]}`,
  f: (c) => {
    const uid = uidDi(c, b);
    const t = uid ? cercaInCampo(c.s, uid) : null;
    if (!uid || !t || t.colonna === colonna) return;
    if (vietato(c.s, { tipo: 'sposta', uid })) {
      log(c.s, `${def(c.s, t.carta.cardId).nome} non può essere spostato`);
      return;
    }
    if (contaInColonna(c.s, colonna, t.carta.owner) >= 4) {
      log(c.s, `${nomeFonte(c)}: il ${NOMI_COLONNA[colonna]} è pieno, nessuno spostamento`);
      return;
    }
    spostaCarta(c.s, uid, colonna);
  },
});

export const spostaOpposto = (): Az => ({
  d: 'sposta il bersaglio dal Passato al Futuro o viceversa',
  f: (c) => {
    const uid = uidDi(c, 'bersaglio');
    const t = uid ? cercaInCampo(c.s, uid) : null;
    if (!t || t.colonna === 'presente') return;
    spostaIn(t.colonna === 'passato' ? 'futuro' : 'passato', 'bersaglio').f(c);
  },
});

export const modifica = (stat: 'pep' | 'rp', delta: number, durata: Durata, b: Bers = 'questa'): Az => ({
  d: `${segno(delta)} ${stat.toUpperCase()} ${DURATE[durata]} a ${descBers(b)}`,
  f: (c) => {
    const uid = uidDi(c, b);
    const t = uid ? cercaInCampo(c.s, uid) : null;
    if (!t) return;
    t.carta.modifiche.push({ stat, delta, durata });
    log(c.s, `${def(c.s, t.carta.cardId).nome}: ${segno(delta)} ${stat.toUpperCase()}`);
  },
});

export const sconto = (colonna: Colonna, delta: number): Az => ({
  d: `la prossima carta che giochi nel ${NOMI_COLONNA[colonna]} in questo Round costa ${-delta} ET in meno`,
  f: (c) => {
    c.s.sconti.push({ giocatore: c.controllore, colonna, delta });
  },
});

/** Mostra il bersaglio (una carta coperta) solo al controllore. */
export const guarda = (): Az => ({
  d: 'guardi il bersaglio',
  f: (c) => {
    const uid = uidDi(c, 'bersaglio');
    const t = uid ? cercaInCampo(c.s, uid) : null;
    if (!t) return;
    log(c.s, `${nomeG(c.controllore)} guarda una carta coperta`);
    log(c.s, `${nomeFonte(c)}: la carta coperta è ${def(c.s, t.carta.cardId).nome}`, c.controllore);
  },
});

/** I14: un Evento in risposta viene annullato; una carta in campo o l'Anomalia resta senza effetti fino a fine Round. */
export const annullaOSilenzia = (): Az => ({
  d: "annulla il bersaglio: un Evento in risposta non si risolve, una carta in campo o l'Anomalia resta senza effetti fino a fine Round",
  f: (c) => {
    const uid = uidDi(c, 'bersaglio');
    if (!uid) return;
    const v = c.s.stack.find((x) => x.carta.uid === uid && !x.risolta);
    const nome = def(c.s, v ? v.carta.cardId : c.s.anomalia?.uid === uid ? c.s.anomalia.cardId : cercaInCampo(c.s, uid)!.carta.cardId).nome;
    if (v) {
      v.annullata = true;
      log(c.s, `${nomeFonte(c)}: ${nome} viene annullata`);
    } else {
      c.s.silenziate.push(uid);
      log(c.s, `${nomeFonte(c)}: ${nome} resta senza effetti fino a fine Round`);
    }
  },
});

export const riduciDanniSubiti = (n: number): Az => ({
  d: `riduci di ${n} i danni IT che subisci in questa Collisione`,
  f: (c) => {
    const k = c.s.collisione;
    if (!k) return;
    k.danno[c.controllore] = Math.max(0, k.danno[c.controllore] - n);
    log(c.s, `${nomeFonte(c)}: danni ridotti di ${n}`);
  },
});

/** Registra un effetto ritardato della stessa carta, dichiarato con `ritardato(nome, ...)`. */
export const programma = (nome: string, momento: MomentoRitardato): Az => ({
  d: `${MOMENTI_RITARDATI[momento]} «${nome}»`,
  f: (c) => {
    c.s.ritardati.push({
      cardId: c.cardId, indice: -1, nome, momento, sorgente: c.sorgente, controllore: c.controllore,
      evento: c.evento, scelte: [], dati: { ...c.dati },
    });
  },
});

/** Il bersaglio diventa la carta dell'evento (es. il Frammento appena giocato). */
export const suCartaGiocata = (): Az => ({
  d: 'sulla carta appena giocata',
  f: (c) => {
    if (c.evento.uid) c.dati.bersaglio = c.evento.uid;
  },
});

/** Via di uscita per i testi che il linguaggio non esprime. */
export const azione = (d: string, f: (c: Ctx) => void): Az => ({ d, f });

export const scartaUna = (chi: Chi): Az => ({
  d: `scarta 1 carta ${PER_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) {
      const g = c.s.giocatori[p];
      const r = c.chiedi({ tipo: 'bersaglio', testo: `${nomeFonte(c)}: scegli la carta da scartare`, uids: g.mano.map((x) => x.uid) }, p);
      const scelta = typeof r === 'string' ? g.mano.find((x) => x.uid === r) : undefined;
      if (!scelta) continue;
      g.mano = g.mano.filter((x) => x.uid !== scelta.uid);
      g.orizzonte.push(scelta);
      log(c.s, `${nomeG(p)} scarta ${def(c.s, scelta.cardId).nome}`);
    }
  },
});

// ---- combinatori ----

export const se = (cond: Cond, ...az: Az[]): Az => ({
  d: `se ${cond.d}: ${elenco(az)}`,
  f: (c) => {
    if (cond.f(c)) inSequenza(az)(c);
  },
});

export const puoi = (...az: Az[]): Az => ({
  d: `puoi: ${elenco(az)}`,
  f: (c) => {
    if (c.chiedi({ tipo: 'siNo', testo: `${nomeFonte(c)}: vuoi ${elenco(az)}?` }) === true) inSequenza(az)(c);
  },
});

export interface Opzione { d: string; az: Az[] }
export const opzione = (d: string, ...az: Az[]): Opzione => ({ d, az });

export const scegliUno = (...opz: Opzione[]): Az => ({
  d: `scegli: ${opz.map((o) => o.d).join(' oppure ')}`,
  f: (c) => {
    const r = c.chiedi({ tipo: 'opzione', testo: `${nomeFonte(c)}: scegli`, opzioni: opz.map((o) => o.d) });
    if (typeof r !== 'number' || !opz[r]) return;
    log(c.s, `${nomeFonte(c)}: ${opz[r].d}`);
    inSequenza(opz[r].az)(c);
  },
});

export const scegli = (sel: Sel, ...az: Az[]): Az => ({
  d: `scegli ${sel.d}, poi ${elenco(az)}`,
  f: (c) => {
    const r = c.chiedi({ tipo: 'bersaglio', testo: `${nomeFonte(c)}: scegli ${sel.d}`, uids: sel.f(c) });
    if (typeof r !== 'string') {
      log(c.s, `${nomeFonte(c)}: nessun bersaglio valido`);
      return;
    }
    c.dati.bersaglio = r;
    inSequenza(az)(c);
  },
});

export const primaVoltaPer = (per: 'round', ...az: Az[]): Az => ({
  d: `la prima volta per Round: ${elenco(az)}`,
  f: (c) => {
    const k = `${c.sorgente}:${c.indice}:${per}`;
    if (c.s.usi[k]) return;
    c.s.usi[k] = 1;
    inSequenza(az)(c);
  },
});

// ---- condizioni ----

export const tpAlmeno = (n: number): Cond => ({ d: `la TP è almeno ${segno(n)}`, f: (c) => c.s.tp >= n });
export const tpDiversaDa = (n: number): Cond => ({ d: `la TP è diversa da ${n}`, f: (c) => c.s.tp !== n });
export const inCollisione: Cond = { d: 'avviene durante la Collisione', f: (c) => !!c.evento.inCollisione };
export const danniDaSubire: Cond = {
  d: 'stai per subire danni IT', f: (c) => (c.s.collisione?.danno[c.controllore] ?? 0) > 0,
};
export const controlliIlPresente: Cond = {
  d: 'controlli il Presente',
  f: (c) => contaInColonna(c.s, 'presente', c.controllore) > contaInColonna(c.s, 'presente', altro(c.controllore)),
};
export const entratoDallAvversario: Cond = {
  d: "il Frammento è dell'avversario", f: (c) => !!c.evento.giocatore && c.evento.giocatore !== c.controllore,
};
export const giocatoNelFuturoDaTe: Cond = {
  d: 'hai giocato un Frammento nel Futuro',
  f: (c) => c.evento.momento === 'frammentoGiocato' && c.evento.colonna === 'futuro' && c.evento.giocatore === c.controllore,
};
export const questaNelPresente: Cond = {
  d: 'questa carta è nel Presente', f: (c) => cercaInCampo(c.s, c.sorgente)?.colonna === 'presente',
};
export const bersaglioNelPresente: Cond = {
  d: 'il bersaglio è ancora nel Presente',
  f: (c) => typeof c.dati.bersaglio === 'string' && cercaInCampo(c.s, c.dati.bersaglio)?.colonna === 'presente',
};
export const spazioIn = (col: Colonna): Cond => ({
  d: `c'è posto nel tuo ${NOMI_COLONNA[col]}`, f: (c) => contaInColonna(c.s, col, c.controllore) < 4,
});
export const haBersagli = (sel: Sel): Cond => ({ d: `esiste ${sel.d}`, f: (c) => sel.f(c).length > 0 });
export const tutte = (...cs: Cond[]): Cond => ({ d: cs.map((x) => x.d).join(' e '), f: (c) => cs.every((x) => x.f(c)) });

// ---- selettori ----

export const frammentiNelPresente: Sel = {
  d: 'un Frammento nel Presente', f: (c) => c.s.colonne.presente.map((x) => x.uid),
};
export const coperteAvversarieNelFuturo: Sel = {
  d: "una carta coperta nel Futuro dell'avversario",
  f: (c) => c.s.colonne.futuro.filter((x) => x.coperta && x.owner !== c.controllore).map((x) => x.uid),
};
export const tuoiFrammentiScambiabili: Sel = {
  d: 'un tuo Frammento spostabile nel Passato o nel Futuro, con posto nella colonna opposta',
  f: (c) => {
    const out: string[] = [];
    for (const [da, a] of [['passato', 'futuro'], ['futuro', 'passato']] as const) {
      if (contaInColonna(c.s, a, c.controllore) < 4) {
        out.push(...c.s.colonne[da]
          .filter((x) => x.owner === c.controllore && !vietato(c.s, { tipo: 'sposta', uid: x.uid }))
          .map((x) => x.uid));
      }
    }
    return out;
  },
};
export const carteAnnullabili: Sel = {
  d: "un Evento in risposta, una carta scoperta in campo o l'Anomalia",
  f: (c) => [...new Set([
    ...c.s.stack.filter((v) => !v.risolta && !v.annullata && v.carta.uid !== c.sorgente).map((v) => v.carta.uid),
    ...COLONNE.flatMap((col) => c.s.colonne[col].filter((x) => !x.coperta).map((x) => x.uid)),
    ...(c.s.anomalia ? [c.s.anomalia.uid] : []),
  ])],
};

// ---- dichiarazioni ----

const MOMENTI_TESTO: Record<Momento, string> = {
  entraPresente: 'quando entra nel Presente', entraPassato: 'quando entra nel Passato',
  entraFuturo: 'quando entra nel Futuro', distrutta: 'quando viene distrutta', immediato: 'quando si risolve',
  frammentoGiocato: 'quando un giocatore gioca un Frammento',
  frammentoEntraPresente: 'quando un Frammento entra nel Presente',
  inizioRound: "all'inizio del Round, dopo lo Slittamento", inizioCollisione: "all'inizio della Collisione",
  danniDeterminati: 'quando sono determinati i danni della Collisione',
  dannoIT: 'quando un giocatore subisce danni IT', fineCollisione: 'alla fine della Collisione',
  fineRound: 'alla fine del Round', inversione: "quando avviene un'Inversione Temporale",
  cambioSegnoTP: 'quando la TP cambia segno',
};

export const quando = (m: Momento, ...az: Az[]): DefEffetto => ({
  tipo: 'innescato', momento: m, esegui: inSequenza(az), testo: `${MOMENTI_TESTO[m]}: ${elenco(az)}`,
});

export const attivabile = (
  o: { quando: 'azioni' | 'collisione'; limite?: 'round'; se?: Cond }, ...az: Az[]
): DefEffetto => ({
  tipo: 'attivabile', quando: o.quando, limite: o.limite, condizione: o.se, esegui: inSequenza(az),
  testo: `attivabile ${o.quando === 'azioni' ? 'nel tuo turno di azioni' : 'nella finestra di Collisione'}`
    + `${o.limite ? ', una volta per Round' : ''}${o.se ? `, se ${o.se.d}` : ''}: ${elenco(az)}`,
});

export const continuo = (testo: string, c: Continuo): DefEffetto => ({ tipo: 'continuo', continuo: c, testo: `sempre: ${testo}` });

export const ritardato = (nome: string, ...az: Az[]): DefEffetto => ({
  tipo: 'ritardato', nome, esegui: inSequenza(az), testo: `«${nome}»: ${elenco(az)}`,
});

export const carta = (cardId: number, nome: string, ...effetti: DefEffetto[]): DichiarazioneCarta => ({ cardId, nome, effetti });

export const descrivi = (d: DichiarazioneCarta): string => d.effetti.map((e) => e.testo).join('. ');
