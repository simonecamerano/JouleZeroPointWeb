import { def, statoDi } from './carte';
import { emetti } from './eventi';
import { log, nomeG } from './log';
import { PlayerId, StatoPartita } from './types';

/** TP = Caldi - Freddi nel Presente + spostamento da effetti, limitata a -4 / +4. */
export function ricalcolaTP(s: StatoPartita): void {
  const prima = s.tp;
  let base = 0;
  for (const fc of s.colonne.presente) {
    const t = def(s, fc.cardId).termica;
    if (t === 'Caldo') base += 1;
    else if (t === 'Freddo') base -= 1;
  }
  s.tp = Math.max(-4, Math.min(4, base + s.tpSpostamento));
  const segnalino = s.tp >= 2 ? 'caldo' : s.tp <= -2 ? 'freddo' : null;
  for (const fc of s.colonne.presente) {
    fc.segnalino = statoDi(s, fc) === 'Materia Oscura' ? null : segnalino;
  }
  if (s.tp !== prima) log(s, `TP ${s.tp > 0 ? '+' : ''}${s.tp}`);
  const segno = Math.sign(s.tp) as -1 | 0 | 1;
  if (segno !== 0) {
    if (s.segnoTP !== 0 && segno !== s.segnoTP) emetti(s, { momento: 'cambioSegnoTP', valore: s.tp });
    s.segnoTP = segno;
  }
  if (Math.abs(s.tp) === 4 && s.tp !== prima) inverti(s, null);
}

/** Inverte il flusso. Con un controllore è volontaria e gli costa 1 IT. */
export function inverti(s: StatoPartita, controllore: PlayerId | null): void {
  s.flusso = s.flusso === 'normale' ? 'invertito' : 'normale';
  if (controllore) {
    s.giocatori[controllore].it -= 1;
    log(s, `${nomeG(controllore)} provoca un'Inversione Temporale e perde 1 IT. Flusso ${s.flusso}`);
  } else {
    log(s, `Inversione Temporale spontanea. Flusso ${s.flusso}`);
  }
  emetti(s, controllore ? { momento: 'inversione', giocatore: controllore } : { momento: 'inversione' });
}
