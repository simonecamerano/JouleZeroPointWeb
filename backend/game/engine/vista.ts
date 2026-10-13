import { cercaInCampo } from './carte';
import { chiDeveAgire } from './legali';
import {
  Carta, Colonna, COLONNE, Decisione, Esito, Fase, Finestra, Flusso, Modifica, PlayerId, StatoMateria,
  StatoPartita, VoceLog,
} from './types';

export interface VistaCampo {
  uid: string;
  owner: PlayerId;
  coperta: boolean;
  cardId: number | null;
  segnalino: 'caldo' | 'freddo' | null;
  statoForzato: StatoMateria | null;
  modifiche: Modifica[];
}

export interface VistaStack {
  uid: string;
  cardId: number | null;
  controllore: PlayerId;
  annullata: boolean;
}

export interface VistaGiocatore {
  id: PlayerId;
  it: number;
  et: number;
  etMax: number;
  mano: Carta[] | null;
  carteInMano: number;
  carteFuturo: number;
  memoria: Carta[];
  orizzonte: Carta[];
  costruttore: Carta;
  supportoPep: number;
  supportoRp: number;
  scambioUsato: boolean;
  haPassato: boolean;
}

export interface Vista {
  io: PlayerId;
  round: number;
  fase: Fase;
  flusso: Flusso;
  tp: number;
  iniziativa: PlayerId;
  attivo: PlayerId;
  tocca: PlayerId | null;
  anomalia: Carta | null;
  colonne: Record<Colonna, VistaCampo[]>;
  giocatori: Record<PlayerId, VistaGiocatore>;
  stack: VistaStack[];
  finestra: Finestra | null;
  decisione: Decisione | null;
  esito: Esito | null;
  log: VoceLog[];
}

export function vista(s: StatoPartita, io: PlayerId): Vista {
  const nascosta = (uid: string): boolean => {
    const t = cercaInCampo(s, uid);
    return !!t && t.carta.coperta && t.carta.owner !== io;
  };
  const colonne = {} as Record<Colonna, VistaCampo[]>;
  for (const col of COLONNE) {
    colonne[col] = s.colonne[col].map((fc) => (fc.coperta && fc.owner !== io
      ? { uid: fc.uid, owner: fc.owner, coperta: true, cardId: null, segnalino: null, statoForzato: null, modifiche: [] }
      : {
        uid: fc.uid, owner: fc.owner, coperta: fc.coperta, cardId: fc.cardId,
        segnalino: fc.segnalino, statoForzato: fc.statoForzato, modifiche: fc.modifiche,
      }));
  }
  const giocatore = (p: PlayerId): VistaGiocatore => {
    const g = s.giocatori[p];
    return {
      id: p, it: g.it, et: g.et, etMax: g.etMax,
      mano: p === io ? g.mano : null, carteInMano: g.mano.length, carteFuturo: g.futuro.length,
      memoria: g.memoria, orizzonte: g.orizzonte, costruttore: g.costruttore,
      supportoPep: g.supportoPep, supportoRp: g.supportoRp, scambioUsato: g.scambioUsato, haPassato: g.haPassato,
    };
  };
  return structuredClone({
    io, round: s.round, fase: s.fase, flusso: s.flusso, tp: s.tp,
    iniziativa: s.iniziativa, attivo: s.attivo, tocca: chiDeveAgire(s),
    anomalia: s.anomalia, colonne,
    giocatori: { A: giocatore('A'), B: giocatore('B') },
    stack: s.stack.map((v) => ({
      uid: v.carta.uid, cardId: nascosta(v.carta.uid) ? null : v.carta.cardId,
      controllore: v.controllore, annullata: v.annullata,
    })),
    finestra: s.finestra, decisione: s.decisione, esito: s.esito,
    log: s.log.filter((l) => !l.soloPer || l.soloPer === io),
  });
}
