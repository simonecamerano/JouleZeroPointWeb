import { createHash } from 'crypto';
import { daCardDb, DefCarta, Mazzo } from './engine';
import { getCachedCards } from '../services/cardService';
import { carteDichiarate, dichiarazioneRegistrata } from './effetti/registro';

export const VERSIONE_REGOLAMENTO = '6.0';

// Hash delle dichiarazioni degli effetti: cambia a ogni modifica di uno script, finisce nel log della partita.
export const VERSIONE_SCRIPT = createHash('sha256')
  .update(JSON.stringify(carteDichiarate().map((id) => {
    const d = dichiarazioneRegistrata(id)!;
    return [id, d.nome, d.effetti.map((e) => e.testo)];
  })))
  .digest('hex')
  .slice(0, 12);

type CartaDb = Parameters<typeof daCardDb>[0];

export function catalogoDa(cards: CartaDb[]): Record<number, DefCarta> {
  const out: Record<number, DefCarta> = {};
  for (const c of cards) {
    const d = daCardDb(c);
    if (d) out[d.cardId] = d;
  }
  return out;
}

export async function caricaCatalogo(): Promise<Record<number, DefCarta>> {
  const cards = await getCachedCards();
  return catalogoDa(cards.map((c) => (typeof c.toObject === 'function' ? c.toObject() : c) as CartaDb));
}

/** Converte un mazzo salvato dal deckbuilder ({cardId, count}[]) nel formato del motore. */
export function mazzoDaDeck(deck: { cards: unknown; costruttoreId: unknown }): Mazzo | string {
  if (!Number.isInteger(deck.costruttoreId)) return 'Il mazzo non ha un Costruttore';
  if (!Array.isArray(deck.cards)) return 'Mazzo non leggibile';
  const carte: number[] = [];
  for (const voce of deck.cards) {
    const { cardId, count } = (voce ?? {}) as { cardId?: unknown; count?: unknown };
    if (!Number.isInteger(cardId) || !Number.isInteger(count) || (count as number) < 0 || (count as number) > 40) {
      return 'Mazzo non leggibile';
    }
    for (let i = 0; i < (count as number); i++) carte.push(cardId as number);
  }
  return { carte, costruttore: deck.costruttoreId as number };
}

/** Fotografia delle carte usate dai mazzi, per rigiocare la partita anche dopo che il catalogo cambia. */
export function carteUsate(catalogo: Record<number, DefCarta>, mazzi: Mazzo[]): Record<number, DefCarta> {
  const out: Record<number, DefCarta> = {};
  for (const m of mazzi) {
    for (const id of [...m.carte, m.costruttore]) {
      if (catalogo[id] && !out[id]) out[id] = structuredClone(catalogo[id]);
    }
  }
  return out;
}
