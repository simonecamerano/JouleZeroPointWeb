import { distruggi, sposta } from './campo';
import { pepDi, proprieta, rpDi } from './carte';
import { log, nomeG } from './log';
import { ricalcolaTP } from './temperatura';
import { infliggiDanno } from './vita';
import { altro, GIOCATORI, PlayerId, StatoMateria, StatoPartita } from './types';

interface Totali {
  pep: number;
  rp: number;
  n: Record<StatoMateria, number>;
}

function totali(s: StatoPartita, p: PlayerId): Totali {
  const g = s.giocatori[p];
  const t: Totali = {
    pep: g.supportoPep, rp: g.supportoRp,
    n: { Solido: 0, Liquido: 0, Gas: 0, Plasma: 0, 'Materia Oscura': 0 },
  };
  for (const fc of s.colonne.presente.filter((c) => c.owner === p)) {
    t.pep += pepDi(s, fc);
    t.rp += rpDi(s, fc);
    for (const st of proprieta(s, fc)) t.n[st] += 1;
  }
  return t;
}

export function risolviCollisione(s: StatoPartita): void {
  const T: Record<PlayerId, Totali> = { A: totali(s, 'A'), B: totali(s, 'B') };
  const danno: Record<PlayerId, number> = { A: 0, B: 0 };
  const collasso: Record<PlayerId, boolean> = { A: false, B: false };

  for (const p of GIOCATORI) {
    const o = altro(p);
    log(s, `${nomeG(p)}: PEP ${T[p].pep} contro RP ${T[o].rp}`);
    if (T[p].pep > T[o].rp) {
      collasso[o] = true;
      let d = T[p].pep - T[o].rp;
      d += Math.min(2, T[p].n.Plasma);
      d -= Math.min(2, T[o].n.Solido);
      danno[o] = Math.max(0, d);
    }
  }

  if (danno.A === 0 && danno.B === 0) {
    for (const p of GIOCATORI) danno[altro(p)] += Math.min(2, T[p].n.Gas);
  }

  for (const p of GIOCATORI) infliggiDanno(s, p, danno[p]);

  // Chi si salva va deciso prima di toccare il campo: ogni distruzione ricalcola la TP
  // e quindi i segnalini, che cambierebbero le proprietà delle carte ancora da valutare.
  const condannate: { uid: string; salva: boolean }[] = [];
  for (const p of GIOCATORI) {
    if (!collasso[p]) continue;
    log(s, `Collasso del Presente di ${nomeG(p)}`);
    let salvati = 0;
    for (const fc of s.colonne.presente.filter((c) => c.owner === p)) {
      const salva = salvati < 2 && proprieta(s, fc).includes('Liquido');
      if (salva) salvati += 1;
      condannate.push({ uid: fc.uid, salva });
    }
  }
  // Il Presente collassa in blocco: la TP si ricalcola una volta sola, in fondo. Ricalcolarla carta per
  // carta la farebbe passare per valori intermedi (anche ±4, con Inversione) che dipendono dall'ordine.
  for (const c of condannate) {
    if (c.salva) sposta(s, c.uid, 'passato', { ricalcola: false });
    else distruggi(s, c.uid, { ricalcola: false });
  }

  for (const col of Object.values(s.colonne)) {
    for (const fc of col) fc.modifiche = fc.modifiche.filter((m) => m.durata !== 'collisione');
  }
  ricalcolaTP(s);
}
