// Registro delle dichiarazioni: cardId → effetti. Le carte si aggiungono con `registra` dai file in `carte/`.
import { StatoPartita } from '../engine/types';
import { ANOMALIE } from './carte/anomalie';
import { COSTRUTTORI } from './carte/costruttori';
import { EVENTI } from './carte/eventi';
import { GAS } from './carte/gas';
import { LIQUIDI } from './carte/liquidi';
import { MATERIA_OSCURA } from './carte/materiaOscura';
import { PLASMA } from './carte/plasma';
import { SOLIDI } from './carte/solidi';
import { DefEffetto, DichiarazioneCarta } from './dsl';

const registro = new Map<number, DichiarazioneCarta>();

// File delle carte: funzioni che restituiscono le dichiarazioni. Il Task 8 e il Task 9 le aggiungono qui.
// Anche l'elenco è una funzione: letto al caricamento potrebbe trovare un import ancora a metà.
const fonti = (): (() => DichiarazioneCarta[])[] => [SOLIDI, LIQUIDI, GAS, PLASMA, MATERIA_OSCURA, EVENTI, ANOMALIE, COSTRUTTORI];
let caricato = false;

/**
 * Registra le carte al primo uso e non al caricamento del modulo: engine ed effetti si importano a vicenda, e
 * al caricamento il linguaggio delle dichiarazioni può essere ancora a metà.
 */
function carica(): void {
  if (caricato) return;
  // Il flag si alza solo a registrazione finita: un errore (carta doppia) non lascia un registro a metà in silenzio.
  // Se `registra` lancia, a metà giro il registro ha già alcune carte: lo svuoto, così la chiamata dopo riprova da zero.
  try {
    for (const f of fonti()) registra(f());
  } catch (e) {
    registro.clear();
    throw e;
  }
  caricato = true;
}

export function registra(lista: DichiarazioneCarta[]): void {
  for (const d of lista) {
    if (registro.has(d.cardId)) throw new Error(`Carta ${d.cardId} dichiarata due volte`);
    registro.set(d.cardId, d);
  }
}

/** Effetti della carta, solo se il nome dichiarato coincide con quello del catalogo della partita. */
export function dichiarazioni(s: StatoPartita, cardId: number): DefEffetto[] | null {
  carica();
  const d = registro.get(cardId);
  return d && s.carte[cardId]?.nome === d.nome ? d.effetti : null;
}

export const haDichiarazione = (s: StatoPartita, cardId: number): boolean => dichiarazioni(s, cardId) !== null;

export function dichiarazioneRegistrata(cardId: number): DichiarazioneCarta | null {
  carica();
  return registro.get(cardId) ?? null;
}

export function carteDichiarate(): number[] {
  carica();
  return [...registro.keys()].sort((a, b) => a - b);
}

/** Solo per i test: registra (o sostituisce) una dichiarazione e restituisce la funzione che la toglie. */
export function registraPerTest(d: DichiarazioneCarta): () => void {
  carica();
  const prima = registro.get(d.cardId);
  registro.set(d.cardId, d);
  return () => {
    if (prima) registro.set(d.cardId, prima);
    else registro.delete(d.cardId);
  };
}
