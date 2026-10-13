import { distruggi, sposta } from './campo';
import { cercaInCampo, contaInColonna, def } from './carte';
import { log, nomeG } from './log';
import { pesca } from './risorse';
import { inverti, ricalcolaTP } from './temperatura';
import { AzioneBase, CartaCampo, COLONNE, GIOCATORI, PlayerId, STATI, StatoPartita } from './types';

const intero = (n: unknown, max: number): boolean =>
  typeof n === 'number' && Number.isInteger(n) && n !== 0 && Math.abs(n) <= max;

/** Nome di una carta in campo per il log pubblico: una carta coperta non si rivela. */
const nomeVisibile = (s: StatoPartita, fc: CartaCampo): string =>
  fc.coperta ? 'Un Frammento coperto' : def(s, fc.cardId).nome;

/** Apre il pannello degli effetti manuali su una fonte che il giocatore controlla. */
export function usaEffetto(s: StatoPartita, p: PlayerId, uid: string): string | null {
  const g = s.giocatori[p];
  const haPriorita = s.finestra
    ? s.finestra.priorita === p
    : s.fase === 'azioni' && s.attivo === p && !g.haPassato;
  if (!haPriorita) return 'Non hai la priorità';
  let cardId: number | null = null;
  if (g.costruttore.uid === uid) cardId = g.costruttore.cardId;
  else if (s.anomalia?.uid === uid) cardId = s.anomalia.cardId;
  else {
    const t = cercaInCampo(s, uid);
    if (t && t.carta.owner === p) {
      if (t.carta.coperta) return 'Una carta coperta non applica il suo effetto finché è coperta';
      cardId = t.carta.cardId;
    }
  }
  if (cardId === null) return 'Puoi usare solo il tuo Costruttore, l\'Anomalia attiva o un tuo Frammento in campo';
  s.decisione = { tipo: 'effettoManuale', giocatore: p, uid, origine: 'libero' };
  log(s, `${nomeG(p)} applica l'effetto di ${def(s, cardId).nome}`);
  return null;
}

export function applicaBase(s: StatoPartita, p: PlayerId, b: AzioneBase): string | null {
  const inCampo = (uid: string) => cercaInCampo(s, uid);
  switch (b.op) {
    case 'modifica': {
      const t = inCampo(b.uid);
      if (!t) return 'La carta non è in campo';
      if (b.stat !== 'pep' && b.stat !== 'rp') return 'Valore da modificare non valido';
      if (!intero(b.delta, 10)) return 'La modifica deve essere un intero tra -10 e 10, diverso da 0';
      if (!['collisione', 'round', 'permanente'].includes(b.durata)) return 'Durata non valida';
      t.carta.modifiche.push({ stat: b.stat, delta: b.delta, durata: b.durata });
      log(s, `${nomeVisibile(s, t.carta)}: ${b.delta > 0 ? '+' : ''}${b.delta} ${b.stat.toUpperCase()} (${b.durata})`);
      return null;
    }
    case 'cambiaStato': {
      const t = inCampo(b.uid);
      if (!t) return 'La carta non è in campo';
      if (b.stato !== null && !STATI.includes(b.stato)) return 'Stato non valido';
      t.carta.statoForzato = b.stato;
      ricalcolaTP(s);
      log(s, `${nomeVisibile(s, t.carta)} diventa ${b.stato ?? 'il suo stato originale'}`);
      return null;
    }
    case 'sposta': {
      const t = inCampo(b.uid);
      if (!t) return 'La carta non è in campo';
      if (!COLONNE.includes(b.colonna) || b.colonna === t.colonna) return 'Colonna di destinazione non valida';
      if (contaInColonna(s, b.colonna, t.carta.owner) >= 4) return 'Colonna piena: massimo 4 Frammenti per giocatore';
      sposta(s, b.uid, b.colonna);
      return null;
    }
    case 'segnalino': {
      const t = inCampo(b.uid);
      if (!t) return 'La carta non è in campo';
      if (![null, 'caldo', 'freddo'].includes(b.segnalino)) return 'Segnalino non valido';
      t.carta.segnalino = b.segnalino;
      log(s, `${nomeVisibile(s, t.carta)}: segnalino ${b.segnalino ?? 'rimosso'}`);
      return null;
    }
    case 'tp':
      if (!intero(b.delta, 8)) return 'La variazione di TP deve essere un intero tra -8 e 8, diverso da 0';
      s.tpSpostamento += b.delta;
      ricalcolaTP(s);
      return null;
    case 'inversione':
      inverti(s, b.volontaria ? p : null);
      return null;
    case 'dannoIT':
      if (!GIOCATORI.includes(b.bersaglio)) return 'Bersaglio non valido';
      if (!intero(b.valore, 20)) return 'Il danno deve essere un intero tra -20 e 20, diverso da 0';
      s.giocatori[b.bersaglio].it -= b.valore;
      log(s, `${nomeG(b.bersaglio)} ${b.valore > 0 ? 'perde' : 'recupera'} ${Math.abs(b.valore)} IT`);
      return null;
    case 'distruggi':
      return distruggi(s, b.uid) ? null : 'La carta non è in campo';
    case 'pesca':
      pesca(s, p);
      return null;
    case 'scarta': {
      const g = s.giocatori[p];
      const c = g.mano.find((x) => x.uid === b.uid);
      if (!c) return 'La carta non è nella tua mano';
      g.mano = g.mano.filter((x) => x.uid !== b.uid);
      g.orizzonte.push(c);
      log(s, `${nomeG(p)} scarta ${def(s, c.cardId).nome}`);
      return null;
    }
    case 'annulla': {
      const v = s.stack.find((x) => x.carta.uid === b.uid && !x.risolta);
      if (!v) return 'Nessun effetto da annullare con quella carta';
      v.annullata = true;
      log(s, `L'effetto di ${def(s, v.carta.cardId).nome} viene annullato`);
      return null;
    }
    default:
      return 'Azione base sconosciuta';
  }
}
