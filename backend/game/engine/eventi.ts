import { CartaCampo, Colonna, EventoGioco, Origine, StatoPartita } from './types';

/** Registra un evento: lo trasforma in effetti il dispatcher, al prossimo giro di `avanza`. */
export function emetti(s: StatoPartita, e: EventoGioco): void {
  s.eventi.push(e);
}

/** Ingresso di un Frammento in una colonna. Una carta coperta non applica il suo testo (I2 e 1A n. 7). */
export function emettiIngresso(s: StatoPartita, fc: CartaCampo, colonna: Colonna, da: Origine): void {
  if (fc.coperta) return;
  const base = { uid: fc.uid, cardId: fc.cardId, owner: fc.owner, da };
  const momento = colonna === 'presente' ? 'entraPresente' : colonna === 'passato' ? 'entraPassato' : 'entraFuturo';
  emetti(s, { momento, ...base });
  if (colonna === 'presente') emetti(s, { momento: 'frammentoEntraPresente', ...base, giocatore: fc.owner });
}
