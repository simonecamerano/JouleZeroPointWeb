import { contaInColonna, costoEffettivo, def, isFrammento } from './carte';
import { Azione, COLONNE, PlayerId, StatoPartita } from './types';

export function chiDeveAgire(s: StatoPartita): PlayerId | null {
  if (s.esito) return null;
  if (s.decisione) return s.decisione.giocatore;
  if (s.finestra) return s.finestra.priorita;
  if (s.fase === 'azioni') return s.attivo;
  return null;
}

/**
 * Mosse disponibili per `p`. Le azioni base del pannello manuale non sono elencate:
 * hanno parametri liberi e le valida `applica`. `usaEffetto` non è elencata.
 */
export function mosseLegali(s: StatoPartita, p: PlayerId): Azione[] {
  if (chiDeveAgire(s) !== p) return [];
  const d = s.decisione;
  if (d) {
    switch (d.tipo) {
      case 'sceltaIniziativa':
        return [{ tipo: 'sceltaIniziativa', tieni: true }, { tipo: 'sceltaIniziativa', tieni: false }];
      case 'mulligan':
        return [{ tipo: 'mulligan', esegui: false }, { tipo: 'mulligan', esegui: true }];
      case 'bonusControllo':
        return [{ tipo: 'bonusControllo', pesca: true }, { tipo: 'bonusControllo', pesca: false }];
      case 'capienza':
        return s.colonne[d.colonna]
          .filter((c) => c.owner === p)
          .map((c) => ({ tipo: 'capienza', distruggi: c.uid }) as Azione);
      case 'effettoManuale':
        return [{ tipo: 'fatto' }];
    }
  }
  const g = s.giocatori[p];
  const out: Azione[] = [];
  if (s.finestra) {
    out.push({ tipo: 'passa' });
    for (const c of g.mano) {
      const dc = def(s, c.cardId);
      if (dc.tipo === 'Evento' && dc.costo <= g.et) out.push({ tipo: 'giocaCarta', uid: c.uid });
    }
    return out;
  }
  out.push({ tipo: 'passaTurno' });
  for (const c of g.mano) {
    const dc = def(s, c.cardId);
    if (isFrammento(dc.tipo)) {
      for (const colonna of COLONNE) {
        if (contaInColonna(s, colonna, p) < 4 && costoEffettivo(dc, colonna) <= g.et) {
          out.push({ tipo: 'giocaCarta', uid: c.uid, colonna });
        }
      }
    } else if (dc.costo <= g.et) {
      out.push({ tipo: 'giocaCarta', uid: c.uid });
    }
  }
  if (!g.scambioUsato) for (const c of g.mano) out.push({ tipo: 'scambio', uid: c.uid });
  return out;
}
