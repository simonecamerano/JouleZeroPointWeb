import { aCarta, supportoIstantaneo } from './campo';
import { emettiIngresso } from './eventi';
import { log } from './log';
import { ricalcolaTP } from './temperatura';
import { CartaCampo, Colonna, StatoPartita } from './types';
import { rinomina } from './uid';

export function eseguiSlittamento(s: StatoPartita): void {
  const { passato, presente, futuro } = s.colonne;
  s.colonne = { passato: [], presente: [], futuro: [] };
  const ingressi: { fc: CartaCampo; colonna: Colonna; da: Colonna }[] = [];
  const pulisci = (fc: CartaCampo): CartaCampo => {
    fc.segnalino = null;
    return fc;
  };

  if (s.flusso === 'normale') {
    for (const fc of passato) s.giocatori[fc.owner].memoria.unshift(aCarta(fc));
    for (const fc of presente) {
      s.colonne.passato.push(pulisci(fc));
      supportoIstantaneo(s, fc);
      ingressi.push({ fc, colonna: 'passato', da: 'presente' });
    }
    for (const fc of futuro) {
      fc.coperta = false;
      s.colonne.presente.push(pulisci(fc));
      ingressi.push({ fc, colonna: 'presente', da: 'futuro' });
    }
  } else {
    for (const fc of futuro) s.giocatori[fc.owner].futuro.unshift(rinomina(s, aCarta(fc)));
    for (const fc of presente) {
      s.colonne.futuro.push(pulisci(fc));
      ingressi.push({ fc, colonna: 'futuro', da: 'presente' });
    }
    for (const fc of passato) {
      s.colonne.presente.push(pulisci(fc));
      ingressi.push({ fc, colonna: 'presente', da: 'passato' });
    }
  }

  log(s, `Slittamento (flusso ${s.flusso})`);
  s.tpSpostamento = 0;
  ricalcolaTP(s);
  s.tpRiferimento = s.tp;
  // Le carte entrano insieme: gli effetti si accodano dopo il ricalcolo, li ordina il dispatcher.
  for (const i of ingressi) emettiIngresso(s, i.fc, i.colonna, i.da);
}
