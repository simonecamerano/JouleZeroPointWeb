export type PlayerId = 'A' | 'B';
export const GIOCATORI: PlayerId[] = ['A', 'B'];
export const altro = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');

export type Colonna = 'passato' | 'presente' | 'futuro';
export const COLONNE: Colonna[] = ['passato', 'presente', 'futuro'];

export type Flusso = 'normale' | 'invertito';
export type Fase = 'setup' | 'slittamento' | 'risorse' | 'azioni' | 'collisione' | 'fine' | 'terminata';

export type StatoMateria = 'Solido' | 'Liquido' | 'Gas' | 'Plasma' | 'Materia Oscura';
export const STATI: StatoMateria[] = ['Solido', 'Liquido', 'Gas', 'Plasma', 'Materia Oscura'];
export type TipoCarta = StatoMateria | 'Evento' | 'Anomalia' | 'Costruttore';
export type Termica = 'Caldo' | 'Freddo' | 'Neutro';
export type Rarita = 'Stabile' | 'Instabile' | 'Critica' | '';

export interface DefCarta {
  cardId: number;
  nome: string;
  tipo: TipoCarta;
  termica: Termica;
  costo: number;
  pep: number;
  rp: number;
  rarita: Rarita;
  effetto: string;
}

export interface Carta {
  uid: string;
  cardId: number;
  owner: PlayerId;
}

export type Durata = 'collisione' | 'round' | 'permanente';
export interface Modifica {
  stat: 'pep' | 'rp';
  delta: number;
  durata: Durata;
}

export interface CartaCampo extends Carta {
  coperta: boolean;
  segnalino: 'caldo' | 'freddo' | null;
  statoForzato: StatoMateria | null;
  modifiche: Modifica[];
}

export interface Giocatore {
  id: PlayerId;
  futuro: Carta[];
  memoria: Carta[];
  mano: Carta[];
  orizzonte: Carta[];
  costruttore: Carta;
  it: number;
  et: number;
  etMax: number;
  mulliganFatto: boolean;
  scambioUsato: boolean;
  supportoUsati: number;
  supportoPep: number;
  supportoRp: number;
  haPassato: boolean;
}

export interface VoceStack {
  carta: Carta;
  controllore: PlayerId;
  annullata: boolean;
  risolta: boolean;
}

export interface Finestra {
  contesto: 'giocata' | 'collisione';
  priorita: PlayerId;
  passi: number;
  passiNecessari: number;
}

export type Decisione =
  | { tipo: 'sceltaIniziativa'; giocatore: PlayerId }
  | { tipo: 'mulligan'; giocatore: PlayerId }
  | { tipo: 'bonusControllo'; giocatore: PlayerId }
  | { tipo: 'capienza'; giocatore: PlayerId; colonna: Colonna }
  | { tipo: 'effettoManuale'; giocatore: PlayerId; uid: string; origine: 'stack' | 'libero' };

export type MotivoFine = 'collasso' | 'sincronia' | 'collassoEntropico' | 'pareggio' | 'abbandono';
export interface Esito {
  vincitore: PlayerId | null;
  motivo: MotivoFine;
}

export interface VoceLog {
  round: number;
  testo: string;
  soloPer?: PlayerId;
}

export interface StatoPartita {
  rng: number;
  round: number;
  fase: Fase;
  flusso: Flusso;
  tp: number;
  tpSpostamento: number;
  iniziativa: PlayerId;
  attivo: PlayerId;
  colonne: Record<Colonna, CartaCampo[]>;
  anomalia: Carta | null;
  giocatori: Record<PlayerId, Giocatore>;
  stack: VoceStack[];
  finestra: Finestra | null;
  decisione: Decisione | null;
  sconfitte: { giocatore: PlayerId; motivo: MotivoFine }[];
  esito: Esito | null;
  carte: Record<number, DefCarta>;
  log: VoceLog[];
}

export type AzioneBase =
  | { op: 'modifica'; uid: string; stat: 'pep' | 'rp'; delta: number; durata: Durata }
  | { op: 'cambiaStato'; uid: string; stato: StatoMateria | null }
  | { op: 'sposta'; uid: string; colonna: Colonna }
  | { op: 'segnalino'; uid: string; segnalino: 'caldo' | 'freddo' | null }
  | { op: 'tp'; delta: number }
  | { op: 'inversione'; volontaria: boolean }
  | { op: 'dannoIT'; bersaglio: PlayerId; valore: number }
  | { op: 'distruggi'; uid: string }
  | { op: 'pesca' }
  | { op: 'scarta'; uid: string }
  | { op: 'annulla'; uid: string };

export type Azione =
  | { tipo: 'sceltaIniziativa'; tieni: boolean }
  | { tipo: 'mulligan'; esegui: boolean }
  | { tipo: 'bonusControllo'; pesca: boolean }
  | { tipo: 'capienza'; distruggi: string }
  | { tipo: 'giocaCarta'; uid: string; colonna?: Colonna }
  | { tipo: 'scambio'; uid: string }
  | { tipo: 'passaTurno' }
  | { tipo: 'passa' }
  | { tipo: 'usaEffetto'; uid: string }
  | { tipo: 'base'; base: AzioneBase }
  | { tipo: 'fatto' };

export type Risultato = { ok: true; stato: StatoPartita } | { ok: false; errore: string };
