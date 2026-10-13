import {
  CartaCampo, Colonna, DefCarta, PlayerId, Rarita, STATI, StatoMateria, StatoPartita, Termica, TipoCarta,
} from './types';

export const ORDINE_STATI: StatoMateria[] = ['Solido', 'Liquido', 'Gas', 'Plasma'];
export const LIMITE_COPIE: Record<string, number> = { Stabile: 3, Instabile: 2, Critica: 1 };

export function isFrammento(tipo: TipoCarta): tipo is StatoMateria {
  return (STATI as string[]).includes(tipo);
}

export function def(s: StatoPartita, cardId: number): DefCarta {
  const d = s.carte[cardId];
  if (!d) throw new Error(`Carta ${cardId} assente dal catalogo della partita`);
  return d;
}

export function statoDi(s: StatoPartita, fc: CartaCampo): StatoMateria {
  return fc.statoForzato ?? (def(s, fc.cardId).tipo as StatoMateria);
}

/** Stati di cui la carta ha le proprietà in Collisione, tenendo conto dei segnalini termici. */
export function proprieta(s: StatoPartita, fc: CartaCampo): StatoMateria[] {
  const base = statoDi(s, fc);
  if (base === 'Materia Oscura') return [base];
  const i = ORDINE_STATI.indexOf(base);
  const out: StatoMateria[] = [base];
  if (fc.segnalino === 'caldo' && i < ORDINE_STATI.length - 1) out.push(ORDINE_STATI[i + 1]);
  if (fc.segnalino === 'freddo' && i > 0) out.push(ORDINE_STATI[i - 1]);
  return out;
}

function sommaModifiche(fc: CartaCampo, stat: 'pep' | 'rp'): number {
  return fc.modifiche.filter((m) => m.stat === stat).reduce((t, m) => t + m.delta, 0);
}

export function pepDi(s: StatoPartita, fc: CartaCampo): number {
  return Math.max(0, def(s, fc.cardId).pep + sommaModifiche(fc, 'pep'));
}

export function rpDi(s: StatoPartita, fc: CartaCampo): number {
  return Math.max(0, def(s, fc.cardId).rp + sommaModifiche(fc, 'rp'));
}

export function costoEffettivo(d: DefCarta, colonna?: Colonna): number {
  if (!isFrammento(d.tipo)) return d.costo;
  return Math.max(0, d.costo - (colonna && colonna !== 'presente' ? 1 : 0));
}

export interface Mazzo {
  carte: number[];
  costruttore: number;
}

export function validaMazzo(m: Mazzo, catalogo: Record<number, DefCarta>): string | null {
  if (m.carte.length !== 40) return `Il mazzo deve avere 40 carte, ne ha ${m.carte.length}`;
  const c = catalogo[m.costruttore];
  if (!c || c.tipo !== 'Costruttore') return 'Costruttore non valido';
  const conteggi = new Map<number, number>();
  for (const id of m.carte) {
    const d = catalogo[id];
    if (!d) return `Carta ${id} sconosciuta`;
    if (d.tipo === 'Costruttore') return 'Il Costruttore non va tra le 40 carte';
    conteggi.set(id, (conteggi.get(id) ?? 0) + 1);
  }
  for (const [id, n] of conteggi) {
    const limite = LIMITE_COPIE[catalogo[id].rarita] ?? 3;
    if (n > limite) return `${catalogo[id].nome}: massimo ${limite} copie, ne hai ${n}`;
  }
  return null;
}

const TIPI: TipoCarta[] = [...STATI, 'Evento', 'Anomalia', 'Costruttore'];

/** Converte un documento `Card` di MongoDB nella definizione usata dal motore. */
export function daCardDb(c: {
  cardId: number; name: string; type?: string; status?: string; cost_et?: number;
  pep?: number; rp?: number; rarity?: string; effect?: string;
}): DefCarta | null {
  if (!c.type || !TIPI.includes(c.type as TipoCarta)) return null;
  const termica: Termica = c.status === 'Caldo' || c.status === 'Freddo' ? c.status : 'Neutro';
  const rarita: Rarita = c.rarity === 'Stabile' || c.rarity === 'Instabile' || c.rarity === 'Critica' ? c.rarity : '';
  return {
    cardId: c.cardId, nome: c.name, tipo: c.type as TipoCarta, termica,
    costo: c.cost_et ?? 0, pep: c.pep ?? 0, rp: c.rp ?? 0, rarita, effetto: c.effect ?? '',
  };
}

export function cercaInCampo(s: StatoPartita, uid: string): { colonna: Colonna; carta: CartaCampo } | null {
  for (const colonna of ['passato', 'presente', 'futuro'] as Colonna[]) {
    const carta = s.colonne[colonna].find((c) => c.uid === uid);
    if (carta) return { colonna, carta };
  }
  return null;
}

export function contaInColonna(s: StatoPartita, colonna: Colonna, owner: PlayerId): number {
  return s.colonne[colonna].filter((c) => c.owner === owner).length;
}
