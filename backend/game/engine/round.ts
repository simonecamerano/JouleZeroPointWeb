import { accoda, azzeraUsi, eseguiProssimo, interrompiCatena, LIMITE_EFFETTI, scattaRitardati } from '../effetti/dispatcher';
import { applicaCollisione, calcolaCollisione } from './collisione';
import { emetti } from './eventi';
import { cercaInCampo, contaInColonna, def } from './carte';
import { log } from './log';
import { eseguiRisorse, ordine } from './risorse';
import { eseguiSlittamento } from './slittamento';
import { COLONNE, Colonna, GIOCATORI, PlayerId, StatoPartita } from './types';
import { fineRound, verificaFine, verificaSincronia } from './vittoria';

function trovaEccesso(s: StatoPartita): { giocatore: PlayerId; colonna: Colonna } | null {
  for (const p of ordine(s)) {
    for (const colonna of COLONNE) if (contaInColonna(s, colonna, p) > 4) return { giocatore: p, colonna };
  }
  return null;
}

/** Risolve la voce in cima allo stack: apre l'effetto manuale una volta, poi la toglie. */
function risolviCimaStack(s: StatoPartita): void {
  const v = s.stack[s.stack.length - 1];
  const d = def(s, v.carta.cardId);
  const coperta = cercaInCampo(s, v.carta.uid)?.carta.coperta ?? false;
  if (!v.annullata && !v.risolta && !coperta && d.effetto.trim()) {
    v.risolta = true;
    s.decisione = { tipo: 'effettoManuale', giocatore: v.controllore, uid: v.carta.uid, origine: 'stack' };
    log(s, `Effetto di ${d.nome} da applicare: ${d.effetto}`);
    return;
  }
  s.stack.pop();
  if (d.tipo === 'Evento') s.giocatori[v.carta.owner].orizzonte.push(v.carta);
  // Alla Collisione, risolte le risposte, la finestra si riapre completa: il confronto
  // PEP contro RP avviene solo quando entrambi passano di fila senza più nulla da giocare.
  if (s.fase === 'collisione' && s.stack.length === 0) {
    s.finestra = { contesto: 'collisione', priorita: s.iniziativa, passi: 0, passiNecessari: 2 };
  }
}

/**
 * Esegue le fasi automatiche finché serve una decisione umana o la partita finisce.
 * Ordine a ogni giro: fine partita, decisione, capienza, effetti in coda, finestra, stack, fase.
 */
export function avanza(s: StatoPartita): void {
  let effetti = 0;
  for (let guardia = 0; guardia < 5000; guardia++) {
    verificaFine(s);
    if (s.esito) {
      s.fase = 'terminata';
      s.decisione = null;
      s.finestra = null;
      return;
    }
    if (s.decisione) return;
    const eccesso = trovaEccesso(s);
    if (eccesso) {
      s.decisione = { tipo: 'capienza', ...eccesso };
      return;
    }
    if (s.eventi.length) accoda(s);
    if (s.coda.length) {
      effetti += 1;
      if (effetti > LIMITE_EFFETTI) interrompiCatena(s);
      else eseguiProssimo(s);
      continue;
    }
    if (s.finestra) return;
    if (s.stack.length) {
      risolviCimaStack(s);
      continue;
    }
    switch (s.fase) {
      case 'setup':
      case 'terminata':
        return;
      case 'slittamento':
        s.fase = 'risorse';
        if (s.round > 1) eseguiSlittamento(s);
        emetti(s, { momento: 'inizioRound' });
        scattaRitardati(s, 'inizioRound');
        continue;
      case 'risorse':
        s.fase = 'azioni';
        for (const p of GIOCATORI) s.giocatori[p].haPassato = false;
        s.attivo = s.iniziativa;
        eseguiRisorse(s);
        scattaRitardati(s, 'risorse');
        continue;
      case 'azioni':
        if (!(s.giocatori.A.haPassato && s.giocatori.B.haPassato)) return;
        s.fase = 'collisione';
        emetti(s, { momento: 'inizioCollisione' });
        s.finestra = { contesto: 'collisione', priorita: s.iniziativa, passi: 0, passiNecessari: 2 };
        continue;
      case 'collisione':
        if (s.sottofase === null) {
          s.collisione = calcolaCollisione(s);
          s.sottofase = 'danni';
          emetti(s, { momento: 'danniDeterminati' });
        } else if (s.sottofase === 'danni') {
          applicaCollisione(s, s.collisione!);
          s.sottofase = 'chiusura';
          emetti(s, { momento: 'fineCollisione' });
          scattaRitardati(s, 'fineCollisione');
        } else {
          s.collisione = null;
          s.sottofase = null;
          azzeraUsi(s, 'collisione');
          s.fase = 'fine';
        }
        continue;
      case 'fine':
        if (s.sottofase === null) {
          verificaSincronia(s);
          if (s.esito) continue;
          s.sottofase = 'fineRound';
          emetti(s, { momento: 'fineRound' });
          scattaRitardati(s, 'fineRound');
        } else {
          fineRound(s);
          s.sottofase = null;
          s.fase = 'slittamento';
        }
        continue;
    }
  }
  throw new Error('avanza: troppi passi senza una decisione');
}
