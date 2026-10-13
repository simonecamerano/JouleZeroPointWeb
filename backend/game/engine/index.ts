import { distruggi } from './campo';
import { cercaInCampo } from './carte';
import { giocaCarta, passa, passaTurno, scambio } from './azioni';
import { chiDeveAgire } from './legali';
import { log, nomeG } from './log';
import { applicaBase, usaEffetto } from './manuale';
import { pesca } from './risorse';
import { avanza } from './round';
import { mulligan, sceltaIniziativa } from './setup';
import { altro, Azione, PlayerId, Risultato, StatoPartita } from './types';

export * from './types';
export { creaPartita } from './setup';
export { chiDeveAgire, mosseLegali } from './legali';
export { validaMazzo, daCardDb } from './carte';
export type { Mazzo } from './carte';
export { vista } from './vista';
export type { Vista, VistaCampo, VistaGiocatore, VistaStack } from './vista';
export { verificaInvarianti } from './invarianti';

function esegui(s: StatoPartita, p: PlayerId, a: Azione): string | null {
  if (!a || typeof a !== 'object') return 'Azione sconosciuta';
  const d = s.decisione;
  const libero = (): string | null => (d ? 'Prima risolvi la decisione in corso' : null);
  switch (a.tipo) {
    case 'sceltaIniziativa':
      return d?.tipo === 'sceltaIniziativa' ? sceltaIniziativa(s, p, !!a.tieni) : 'Nessuna scelta di iniziativa in corso';
    case 'mulligan':
      return d?.tipo === 'mulligan' ? mulligan(s, p, !!a.esegui) : 'Nessun mulligan in corso';
    case 'bonusControllo':
      if (d?.tipo !== 'bonusControllo') return 'Nessun Bonus Controllo in corso';
      s.decisione = null;
      if (a.pesca) pesca(s, p);
      else log(s, `${nomeG(p)} rinuncia al Bonus Controllo`);
      return null;
    case 'capienza': {
      if (d?.tipo !== 'capienza') return 'Nessuna scelta di capienza in corso';
      const t = cercaInCampo(s, a.distruggi);
      if (!t || t.colonna !== d.colonna || t.carta.owner !== p) return 'Scegli un tuo Frammento in quella colonna';
      distruggi(s, a.distruggi);
      s.decisione = null;
      return null;
    }
    case 'giocaCarta':
      return libero() ?? giocaCarta(s, p, a.uid, a.colonna);
    case 'scambio':
      return libero() ?? scambio(s, p, a.uid);
    case 'passaTurno':
      return libero() ?? passaTurno(s, p);
    case 'passa':
      return libero() ?? passa(s, p);
    case 'usaEffetto':
      return libero() ?? usaEffetto(s, p, a.uid);
    case 'base':
      if (d?.tipo !== 'effettoManuale') return 'Nessun effetto in corso';
      if (!a.base || typeof a.base !== 'object') return 'Azione base mancante';
      return applicaBase(s, p, a.base);
    case 'fatto':
      if (d?.tipo !== 'effettoManuale') return 'Nessun effetto in corso';
      s.decisione = null;
      return null;
    default:
      return 'Azione sconosciuta';
  }
}

/** Applica un'azione su una copia dello stato. Lo stato ricevuto non viene mai modificato. */
export function applica(stato: StatoPartita, p: PlayerId, azione: Azione): Risultato {
  if (stato.esito) return { ok: false, errore: 'La partita è terminata' };
  if (chiDeveAgire(stato) !== p) return { ok: false, errore: 'Non tocca a te' };
  const s = structuredClone(stato);
  const errore = esegui(s, p, azione);
  if (errore) return { ok: false, errore };
  avanza(s);
  return { ok: true, stato: s };
}

export function arrendi(stato: StatoPartita, p: PlayerId): StatoPartita {
  const s = structuredClone(stato);
  if (s.esito) return s;
  s.esito = { vincitore: altro(p), motivo: 'abbandono' };
  s.fase = 'terminata';
  s.decisione = null;
  s.finestra = null;
  log(s, `${nomeG(p)} abbandona la partita`);
  return s;
}
