import { Colonna, PlayerId, StatoPartita } from './types';

export const NOMI_COLONNA: Record<Colonna, string> = {
  passato: 'Passato',
  presente: 'Presente',
  futuro: 'Futuro',
};

export const nomeG = (p: PlayerId): string => `Giocatore ${p}`;

export function log(s: StatoPartita, testo: string, soloPer?: PlayerId): void {
  s.log.push(soloPer ? { round: s.round, testo, soloPer } : { round: s.round, testo });
}
