import {
  Carta, CartaCampo, Colonna, DefCarta, Giocatore, PlayerId, StatoPartita, TipoCarta,
} from '../../game/engine/types';
import { Mazzo } from '../../game/engine/carte';

export function catalogoProva(): Record<number, DefCarta> {
  const c: Record<number, DefCarta> = {};
  const add = (d: Partial<DefCarta> & { cardId: number; tipo: TipoCarta }) => {
    c[d.cardId] = {
      nome: `Carta ${d.cardId}`, termica: 'Neutro', costo: 1, pep: 1, rp: 1,
      rarita: 'Stabile', effetto: '', ...d,
    };
  };
  add({ cardId: 1, tipo: 'Solido', termica: 'Freddo', costo: 3, pep: 1, rp: 5 });
  add({ cardId: 2, tipo: 'Liquido', termica: 'Neutro', costo: 3, pep: 2, rp: 3 });
  add({ cardId: 3, tipo: 'Gas', termica: 'Caldo', costo: 3, pep: 2, rp: 2 });
  add({ cardId: 4, tipo: 'Plasma', termica: 'Caldo', costo: 3, pep: 3, rp: 1 });
  add({ cardId: 5, tipo: 'Materia Oscura', termica: 'Neutro', costo: 4, pep: 2, rp: 3 });
  add({ cardId: 6, tipo: 'Evento', costo: 2, pep: 0, rp: 0, effetto: 'Riduci la TP di 1.' });
  add({ cardId: 7, tipo: 'Anomalia', costo: 2, pep: 0, rp: 0, effetto: 'Regola permanente di prova.' });
  add({ cardId: 8, tipo: 'Evento', costo: 1, pep: 0, rp: 0, effetto: '' });
  add({ cardId: 9, tipo: 'Solido', termica: 'Freddo', costo: 2, pep: 0, rp: 4, effetto: 'Effetto di prova.' });
  for (let id = 10; id <= 19; id++) {
    add({ cardId: id, tipo: id % 2 ? 'Gas' : 'Liquido', termica: id % 2 ? 'Caldo' : 'Freddo', costo: 2, pep: 2, rp: 2 });
  }
  add({ cardId: 20, tipo: 'Plasma', termica: 'Caldo', rarita: 'Critica' });
  add({ cardId: 100, tipo: 'Costruttore', costo: 0, pep: 0, rp: 0, rarita: '', effetto: 'Effetto del Costruttore.' });
  return c;
}

/** 13 carte x 3 copie + 1 = 40. */
export function mazzoProva(): Mazzo {
  const carte: number[] = [];
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) carte.push(id, id, id);
  carte.push(14);
  return { carte, costruttore: 100 };
}

let contatore = 0;
export function carta(p: PlayerId, cardId: number): Carta {
  contatore += 1;
  return { uid: `${p}-T${contatore}`, cardId, owner: p };
}

export function inCampo(
  s: StatoPartita, p: PlayerId, cardId: number, colonna: Colonna, extra: Partial<CartaCampo> = {},
): CartaCampo {
  const fc: CartaCampo = {
    ...carta(p, cardId), coperta: false, segnalino: null, statoForzato: null, modifiche: [], ...extra,
  };
  s.colonne[colonna].push(fc);
  return fc;
}

export function statoVuoto(): StatoPartita {
  const g = (id: PlayerId): Giocatore => ({
    id, futuro: [], memoria: [], mano: [], orizzonte: [],
    costruttore: { uid: `${id}-C`, cardId: 100, owner: id },
    it: 20, et: 3, etMax: 3, mulliganFatto: true, scambioUsato: false,
    supportoUsati: 0, supportoPep: 0, supportoRp: 0, haPassato: false,
  });
  return {
    rng: 1, round: 1, fase: 'azioni', flusso: 'normale', tp: 0, tpSpostamento: 0,
    iniziativa: 'A', attivo: 'A',
    colonne: { passato: [], presente: [], futuro: [] },
    anomalia: null, giocatori: { A: g('A'), B: g('B') },
    stack: [], finestra: null, decisione: null, sconfitte: [], esito: null,
    carte: catalogoProva(), log: [],
  };
}
