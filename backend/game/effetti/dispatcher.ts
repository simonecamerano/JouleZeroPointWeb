// Dispatcher degli effetti: dagli eventi emessi dal motore alla coda, e dalla coda all'esecuzione (spec 1C, 4-5).
import { cercaInCampo, def } from '../engine/carte';
import { log } from '../engine/log';
import { ordine } from '../engine/risorse';
import {
  Colonna, COLONNE, Domanda, MOMENTI_PROPRI, MomentoRitardato, Pendente, PlayerId, Risposta, StatoPartita,
} from '../engine/types';
import { Ctx, DefEffetto, Sospendi } from './dsl';
import { dichiarazioni } from './registro';

/** Effetti eseguibili in una sola chiamata di `avanza` prima di considerare la catena un ciclo. */
export const LIMITE_EFFETTI = 200;

export interface Fonte {
  uid: string;
  cardId: number;
  controllore: PlayerId;
  zona: Colonna | 'anomalia' | 'costruttore';
}

/** Costruttori, Frammenti scoperti in campo e Anomalia, in ordine di Iniziativa; l'Anomalia per ultima (I28). */
export function tutteLeFonti(s: StatoPartita): Fonte[] {
  const out: Fonte[] = [];
  for (const p of ordine(s)) {
    const g = s.giocatori[p];
    out.push({ uid: g.costruttore.uid, cardId: g.costruttore.cardId, controllore: p, zona: 'costruttore' });
    for (const col of COLONNE) {
      for (const fc of s.colonne[col]) {
        if (fc.owner === p && !fc.coperta) out.push({ uid: fc.uid, cardId: fc.cardId, controllore: p, zona: col });
      }
    }
  }
  if (s.anomalia) {
    out.push({ uid: s.anomalia.uid, cardId: s.anomalia.cardId, controllore: s.anomalia.owner, zona: 'anomalia' });
  }
  return out;
}

export function fontiAttive(s: StatoPartita): Fonte[] {
  return tutteLeFonti(s).filter((f) => !s.silenziate.includes(f.uid) && !s.manuali.includes(f.cardId));
}

/** Regola v6: un Frammento applica il testo solo nel Presente, salvo che il testo citi un'altra colonna. */
export function attivaNellaZona(f: Fonte, d: DefEffetto): boolean {
  if (f.zona === 'costruttore' || f.zona === 'anomalia' || f.zona === 'presente') return true;
  return (d.attivaIn ?? []).includes(f.zona);
}

/** Trasforma gli eventi registrati in effetti in coda, ordinati per Iniziativa con l'Anomalia in fondo. */
export function accoda(s: StatoPartita): void {
  const nuovi: { p: Pendente; rango: number }[] = [];
  const rango = (controllore: PlayerId, anomalia: boolean): number => (anomalia ? 2 : controllore === s.iniziativa ? 0 : 1);
  for (const e of s.eventi) {
    if (MOMENTI_PROPRI.includes(e.momento)) {
      if (e.cardId === undefined || !e.uid || !e.owner) continue;
      if (s.manuali.includes(e.cardId) || s.silenziate.includes(e.uid)) continue;
      const owner = e.owner;
      (dichiarazioni(s, e.cardId) ?? []).forEach((d, i) => {
        if (d.tipo !== 'innescato' || d.momento !== e.momento) return;
        if (e.momento === 'distrutta' && e.da !== 'presente' && !(d.attivaIn ?? []).includes(e.da as Colonna)) return;
        nuovi.push({
          p: { cardId: e.cardId!, indice: i, sorgente: e.uid!, controllore: owner, evento: e, scelte: [], dati: {} },
          rango: rango(owner, false),
        });
      });
      continue;
    }
    for (const f of fontiAttive(s)) {
      (dichiarazioni(s, f.cardId) ?? []).forEach((d, i) => {
        if (d.tipo !== 'innescato' || d.momento !== e.momento || !attivaNellaZona(f, d)) return;
        nuovi.push({
          p: { cardId: f.cardId, indice: i, sorgente: f.uid, controllore: f.controllore, evento: e, scelte: [], dati: {} },
          rango: rango(f.controllore, f.zona === 'anomalia'),
        });
      });
    }
  }
  s.eventi = [];
  nuovi.sort((a, b) => a.rango - b.rango);
  s.coda.push(...nuovi.map((n) => n.p));
}

/** Sposta in coda i ritardati del momento indicato. */
export function scattaRitardati(s: StatoPartita, momento: MomentoRitardato): void {
  const ora = s.ritardati.filter((r) => r.momento === momento);
  s.ritardati = s.ritardati.filter((r) => r.momento !== momento);
  for (const r of ora) {
    const indice = (dichiarazioni(s, r.cardId) ?? []).findIndex((d) => d.tipo === 'ritardato' && d.nome === r.nome);
    if (indice < 0) continue;
    s.coda.push({
      cardId: r.cardId, indice, sorgente: r.sorgente, controllore: r.controllore, evento: r.evento,
      scelte: r.scelte, dati: r.dati,
    });
  }
}

export function creaCtx(s: StatoPartita, p: Pendente): Ctx {
  let i = 0;
  return {
    s, sorgente: p.sorgente, cardId: p.cardId, indice: p.indice, controllore: p.controllore,
    evento: p.evento, dati: p.dati,
    chiedi(d: Domanda, chi: PlayerId = p.controllore): Risposta | null {
      if (risposteValide(d).length === 0) return null;
      const k = i++;
      if (k < p.scelte.length) return p.scelte[k];
      throw new Sospendi(d, chi);
    },
  };
}

type Foto = Omit<StatoPartita, 'carte'>;
function istantanea(s: StatoPartita): Foto {
  const { carte: _carte, ...resto } = s;
  return structuredClone(resto);
}
function ripristina(s: StatoPartita, foto: Foto): void {
  Object.assign(s, foto);
}

/**
 * Esegue il primo effetto in coda. Una scelta senza risposta riporta lo stato a prima dell'effetto e apre la
 * decisione: alla risposta l'effetto riparte da capo e rigioca le scelte già date, così nulla si applica due
 * volte. Un errore riporta lo stato a prima e mette la carta in manuale (spec 1C, sezione 5).
 */
export function eseguiProssimo(s: StatoPartita): void {
  const p = s.coda[0];
  const d = dichiarazioni(s, p.cardId)?.[p.indice];
  if (!d?.esegui || s.manuali.includes(p.cardId)) {
    s.coda.shift();
    return;
  }
  const foto = istantanea(s);
  try {
    d.esegui(creaCtx(s, p));
    s.coda.shift();
  } catch (e) {
    ripristina(s, foto);
    if (e instanceof Sospendi) {
      s.decisione = { tipo: 'sceltaEffetto', giocatore: e.chi, uid: p.sorgente, cardId: p.cardId, domanda: e.domanda };
      return;
    }
    ripiego(s, s.coda[0], e as Error);
  }
}

function ripiego(s: StatoPartita, p: Pendente, e: Error): void {
  s.coda.shift();
  s.manuali.push(p.cardId);
  const nome = def(s, p.cardId).nome;
  s.erroriEffetti.push(`${nome} (${p.cardId}), effetto ${p.indice}: ${e.message}`);
  log(s, `L'effetto di ${nome} non è riuscito: da qui in poi si applica a mano`);
  const presente = !!cercaInCampo(s, p.sorgente) || s.anomalia?.uid === p.sorgente
    || s.giocatori[p.controllore].costruttore.uid === p.sorgente;
  if (presente) s.decisione = { tipo: 'effettoManuale', giocatore: p.controllore, uid: p.sorgente, origine: 'libero' };
}

export function interrompiCatena(s: StatoPartita): void {
  s.coda = [];
  s.eventi = [];
  s.erroriEffetti.push('Catena di effetti oltre il limite');
  log(s, 'Troppi effetti a catena: la catena si interrompe qui');
}

export function azzeraUsi(s: StatoPartita, per: 'round' | 'collisione'): void {
  for (const k of Object.keys(s.usi)) if (k.endsWith(`:${per}`)) delete s.usi[k];
}

export function risposteValide(d: Domanda): Risposta[] {
  if (d.tipo === 'siNo') return [true, false];
  if (d.tipo === 'bersaglio') return [...d.uids];
  return d.opzioni.map((_, i) => i);
}

export function rispostaValida(d: Domanda, r: unknown): r is Risposta {
  return risposteValide(d).some((x) => x === r);
}

/** Risposta allo scadere del timer: No ai facoltativi, primo bersaglio o prima opzione agli obbligatori. */
export function rispostaDefault(d: Domanda): Risposta {
  return risposteValide(d)[d.tipo === 'siNo' ? 1 : 0];
}

export function rispondi(s: StatoPartita, p: PlayerId, r: unknown): string | null {
  const d = s.decisione;
  if (d?.tipo !== 'sceltaEffetto' || d.giocatore !== p) return 'Nessuna scelta in corso';
  if (!rispostaValida(d.domanda, r)) return 'Risposta non valida';
  s.coda[0].scelte.push(r);
  s.decisione = null;
  return null;
}
