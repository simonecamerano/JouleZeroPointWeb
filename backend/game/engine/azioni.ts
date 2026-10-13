import { metti } from './campo';
import { contaInColonna, costoEffettivo, def, isFrammento } from './carte';
import { log, nomeG, NOMI_COLONNA } from './log';
import { altro, Colonna, PlayerId, StatoPartita } from './types';

export function giocaCarta(s: StatoPartita, p: PlayerId, uid: string, colonna?: Colonna): string | null {
  const g = s.giocatori[p];
  const carta = g.mano.find((c) => c.uid === uid);
  if (!carta) return 'La carta non è nella tua mano';
  const d = def(s, carta.cardId);

  if (s.finestra) {
    if (s.finestra.priorita !== p) return 'Non hai la priorità';
    if (d.tipo !== 'Evento') return 'In risposta puoi giocare solo Eventi';
  } else if (s.fase !== 'azioni' || s.attivo !== p || g.haPassato) {
    return 'Non è il tuo turno di azioni';
  }

  if (isFrammento(d.tipo)) {
    if (!colonna) return 'Scegli la colonna in cui giocare il Frammento';
    if (contaInColonna(s, colonna, p) >= 4) return 'Colonna piena: massimo 4 tuoi Frammenti';
  }
  const costo = costoEffettivo(d, colonna);
  if (costo > g.et) return `ET insufficienti: servono ${costo}, ne hai ${g.et}`;

  g.et -= costo;
  g.mano = g.mano.filter((c) => c.uid !== uid);

  if (isFrammento(d.tipo)) {
    const coperta = colonna === 'futuro';
    metti(s, carta, colonna!, { coperta });
    if (coperta) {
      log(s, `${nomeG(p)} gioca un Frammento coperto nel Futuro`);
      log(s, `Hai giocato ${d.nome} coperto nel Futuro`, p);
    } else {
      log(s, `${nomeG(p)} gioca ${d.nome} nel ${NOMI_COLONNA[colonna!]}`);
    }
  } else if (d.tipo === 'Anomalia') {
    if (s.anomalia) {
      s.giocatori[s.anomalia.owner].orizzonte.push(s.anomalia);
      log(s, `${def(s, s.anomalia.cardId).nome} viene sostituita`);
    }
    s.anomalia = carta;
    log(s, `${nomeG(p)} attiva l'Anomalia ${d.nome}`);
  } else {
    log(s, `${nomeG(p)} gioca l'Evento ${d.nome}`);
  }

  s.stack.push({ carta, controllore: p, annullata: false, risolta: false });
  s.finestra = {
    contesto: s.fase === 'collisione' ? 'collisione' : 'giocata',
    priorita: altro(p), passi: 0, passiNecessari: 1,
  };
  return null;
}

export function passa(s: StatoPartita, p: PlayerId): string | null {
  const f = s.finestra;
  if (!f) return 'Nessuna finestra di risposta aperta';
  if (f.priorita !== p) return 'Non hai la priorità';
  f.passi += 1;
  log(s, `${nomeG(p)} passa`);
  if (f.passi >= f.passiNecessari) s.finestra = null;
  else f.priorita = altro(p);
  return null;
}

export function passaTurno(s: StatoPartita, p: PlayerId): string | null {
  if (s.fase !== 'azioni' || s.finestra) return 'Non puoi passare il turno adesso';
  if (s.attivo !== p) return 'Non è il tuo turno di azioni';
  s.giocatori[p].haPassato = true;
  log(s, `${nomeG(p)} termina le sue azioni`);
  if (!s.giocatori[altro(p)].haPassato) s.attivo = altro(p);
  return null;
}

export function scambio(s: StatoPartita, p: PlayerId, uid: string): string | null {
  const g = s.giocatori[p];
  if (s.fase !== 'azioni' || s.finestra || s.attivo !== p || g.haPassato) return 'Non è il tuo turno di azioni';
  if (g.scambioUsato) return 'Lo Scambio si fa una volta per round';
  const c = g.mano.find((x) => x.uid === uid);
  if (!c) return 'La carta non è nella tua mano';
  g.mano = g.mano.filter((x) => x.uid !== uid);
  g.orizzonte.push(c);
  g.et += 1;
  g.scambioUsato = true;
  log(s, `${nomeG(p)} scarta ${def(s, c.cardId).nome} per +1 ET`);
  return null;
}
