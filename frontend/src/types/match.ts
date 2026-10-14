// Copia lato client dei tipi del motore (backend/game/engine/types.ts, vista.ts) e del gestore
// (backend/game/partite.ts). Se cambiano lì, vanno aggiornati qui.
export type PlayerId = 'A' | 'B';
export type Colonna = 'passato' | 'presente' | 'futuro';
export type StatoMateria = 'Solido' | 'Liquido' | 'Gas' | 'Plasma' | 'Materia Oscura';
export type Durata = 'collisione' | 'round' | 'permanente';

export interface Carta { uid: string; cardId: number; owner: PlayerId }
export interface Modifica { stat: 'pep' | 'rp'; delta: number; durata: Durata }

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

export type Decisione =
  | { tipo: 'sceltaIniziativa'; giocatore: PlayerId }
  | { tipo: 'mulligan'; giocatore: PlayerId }
  | { tipo: 'bonusControllo'; giocatore: PlayerId }
  | { tipo: 'capienza'; giocatore: PlayerId; colonna: Colonna }
  | { tipo: 'effettoManuale'; giocatore: PlayerId; uid: string; origine: 'stack' | 'libero' };

export interface VistaCampo {
  uid: string; owner: PlayerId; coperta: boolean; cardId: number | null;
  segnalino: 'caldo' | 'freddo' | null; statoForzato: StatoMateria | null; modifiche: Modifica[];
}
export interface VistaStack { uid: string; cardId: number | null; controllore: PlayerId; annullata: boolean }
export interface VistaGiocatore {
  id: PlayerId; it: number; et: number; etMax: number; mano: Carta[] | null; carteInMano: number;
  carteFuturo: number; memoria: Carta[]; orizzonte: Carta[]; costruttore: Carta;
  supportoPep: number; supportoRp: number; scambioUsato: boolean; haPassato: boolean;
}
export interface Vista {
  io: PlayerId; round: number;
  fase: 'setup' | 'slittamento' | 'risorse' | 'azioni' | 'collisione' | 'fine' | 'terminata';
  flusso: 'normale' | 'invertito'; tp: number; iniziativa: PlayerId; attivo: PlayerId; tocca: PlayerId | null;
  anomalia: Carta | null; colonne: Record<Colonna, VistaCampo[]>; giocatori: Record<PlayerId, VistaGiocatore>;
  stack: VistaStack[];
  finestra: { contesto: 'giocata' | 'collisione'; priorita: PlayerId; passi: number; passiNecessari: number } | null;
  decisione: Decisione | null;
  esito: { vincitore: PlayerId | null; motivo: string } | null;
  log: { round: number; testo: string; soloPer?: PlayerId }[];
}
export interface Aggiornamento {
  codice: string; statoTavolo: 'attesa' | 'inCorso' | 'pausa' | 'terminata'; ruolo: PlayerId;
  avversario: string | null; vista: Vista | null; mosse: Azione[]; scadenzaFinestra: number | null;
}
