import { applica, chiDeveAgire, creaPartita, mosseLegali, verificaInvarianti } from '../../game/engine';
import { intero } from '../../game/engine/rng';
import { StatoPartita } from '../../game/engine/types';
import { catalogoProva, mazzoProva } from './helpers';

function partitaCasuale(seed: number): StatoPartita {
  let s = creaPartita({ seed, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
  const r = { rng: seed * 7919 };
  for (let passo = 0; passo < 3000 && !s.esito; passo++) {
    const p = chiDeveAgire(s);
    if (!p) throw new Error(`seed ${seed} passo ${passo}: nessuno deve agire ma la partita non è finita`);
    const mosse = mosseLegali(s, p);
    if (!mosse.length) throw new Error(`seed ${seed} passo ${passo}: nessuna mossa legale per ${p}`);
    const m = mosse[intero(r, mosse.length)];
    const res = applica(s, p, m);
    if (!res.ok) throw new Error(`seed ${seed} passo ${passo}: ${JSON.stringify(m)} rifiutata: ${res.errore}`);
    s = res.stato;
    // Il log non entra nelle regole: svuotarlo evita che ogni structuredClone diventi più lento a ogni passo.
    s.log = [];
    const inv = verificaInvarianti(s);
    if (inv.length) throw new Error(`seed ${seed} passo ${passo}: ${inv.join('; ')}`);
  }
  return s;
}

describe('partite simulate', () => {
  test('100 partite casuali: nessun blocco, nessuna mossa legale rifiutata, invarianti sempre veri', () => {
    let finite = 0;
    for (let seed = 1; seed <= 100; seed++) if (partitaCasuale(seed).esito) finite += 1;
    // Il gioco casuale non garantisce la fine entro 3000 passi, ma la maggior parte deve finire.
    expect(finite).toBeGreaterThanOrEqual(50);
  }, 120_000);

  test('la stessa sequenza di seed produce la stessa partita', () => {
    expect(partitaCasuale(42)).toEqual(partitaCasuale(42));
  });
});
