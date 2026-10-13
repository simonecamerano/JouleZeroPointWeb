import { aCarta, supportoIstantaneo } from './campo';
import { log } from './log';
import { ricalcolaTP } from './temperatura';
import { CartaCampo, StatoPartita } from './types';

export function eseguiSlittamento(s: StatoPartita): void {
  const { passato, presente, futuro } = s.colonne;
  s.colonne = { passato: [], presente: [], futuro: [] };
  const pulisci = (fc: CartaCampo): CartaCampo => {
    fc.segnalino = null;
    return fc;
  };

  if (s.flusso === 'normale') {
    for (const fc of passato) s.giocatori[fc.owner].memoria.unshift(aCarta(fc));
    for (const fc of presente) {
      s.colonne.passato.push(pulisci(fc));
      supportoIstantaneo(s, fc);
    }
    for (const fc of futuro) {
      fc.coperta = false;
      s.colonne.presente.push(pulisci(fc));
    }
  } else {
    for (const fc of futuro) s.giocatori[fc.owner].futuro.unshift(aCarta(fc));
    for (const fc of presente) s.colonne.futuro.push(pulisci(fc));
    for (const fc of passato) s.colonne.presente.push(pulisci(fc));
  }

  log(s, `Slittamento (flusso ${s.flusso})`);
  s.tpSpostamento = 0;
  ricalcolaTP(s);
}
