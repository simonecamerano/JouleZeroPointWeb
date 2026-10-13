import { risolviCollisione } from '../../game/engine/collisione';
import { inCampo, statoVuoto } from './helpers';

describe('Collisione', () => {
  test('PEP > RP: Collasso del Presente avversario e danno pari alla differenza', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente'); // Plasma 3/1
    const b = inCampo(s, 'B', 2, 'presente'); // Liquido 2/3... PEP 2 vs RP A 1
    // A: PEP 3 vs RP B 3 → nessun collasso. B: PEP 2 vs RP A 1 → collasso di A, danno 1
    risolviCollisione(s);
    expect(s.giocatori.A.it).toBe(19);
    expect(s.giocatori.B.it).toBe(20);
    expect(s.colonne.presente.map((c) => c.uid)).toEqual([b.uid]);
    expect(s.giocatori.A.orizzonte).toHaveLength(1);
  });

  test('PEP uguale a RP: lo scudo regge', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 2, 'presente'); // Liquido 2/3: PEP 2
    inCampo(s, 'B', 12, 'presente'); // Liquido Freddo 2/2: RP 2
    risolviCollisione(s);
    expect(s.giocatori.A.it).toBe(20);
    expect(s.giocatori.B.it).toBe(20);
    expect(s.colonne.presente).toHaveLength(2);
  });

  test('Plasma +1 danno per Plasma, massimo 2', () => {
    const s = statoVuoto();
    for (let i = 0; i < 3; i++) inCampo(s, 'A', 4, 'presente'); // 9 PEP, 3 Plasma
    risolviCollisione(s);
    expect(s.giocatori.B.it).toBe(20 - 9 - 2);
  });

  test('Solido -1 danno subito per Solido, massimo 2, mai sotto zero', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente', { modifiche: [{ stat: 'pep', delta: 5, durata: 'round' }] }); // 8 PEP
    for (let i = 0; i < 3; i++) inCampo(s, 'B', 9, 'presente', { modifiche: [{ stat: 'rp', delta: -4, durata: 'round' }] }); // RP 0
    risolviCollisione(s);
    // danno 8 + 1 Plasma - 2 Solido
    expect(s.giocatori.B.it).toBe(20 - 7);
  });

  test('Gas: 1 danno elusivo per Gas se nessuno infligge danni', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente'); // Gas 2/2
    inCampo(s, 'B', 1, 'presente'); // Solido 1/5
    risolviCollisione(s);
    expect(s.giocatori.B.it).toBe(19);
    expect(s.giocatori.A.it).toBe(20);
  });

  test('Liquido distrutto torna nel Passato, massimo 2, senza Supporto', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente', { modifiche: [{ stat: 'pep', delta: 20, durata: 'round' }] });
    for (let i = 0; i < 3; i++) inCampo(s, 'B', 12, 'presente'); // Liquido Freddo
    risolviCollisione(s);
    expect(s.colonne.passato.filter((c) => c.owner === 'B')).toHaveLength(2);
    expect(s.giocatori.B.orizzonte).toHaveLength(1);
    expect(s.giocatori.B.supportoRp).toBe(0);
  });

  test('Solido con 🔴 ha la Persistenza del Liquido', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente', { modifiche: [{ stat: 'pep', delta: 20, durata: 'round' }] });
    inCampo(s, 'B', 1, 'presente', { segnalino: 'caldo' });
    risolviCollisione(s);
    expect(s.colonne.passato.filter((c) => c.owner === 'B')).toHaveLength(1);
  });

  test('i segnalini valgono come all\'inizio della Collisione, anche dopo le prime distruzioni', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente', { modifiche: [{ stat: 'pep', delta: 30, durata: 'round' }] });
    // B: due Gas Caldi (TP alta) e un Solido con 🔴 messo per ultimo
    inCampo(s, 'B', 3, 'presente', { segnalino: 'caldo' });
    inCampo(s, 'B', 3, 'presente', { segnalino: 'caldo' });
    const solido = inCampo(s, 'B', 1, 'presente', { segnalino: 'caldo' });
    risolviCollisione(s);
    expect(s.colonne.passato.map((c) => c.uid)).toEqual([solido.uid]);
  });

  test('Supporto Istantaneo conta nei totali', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente'); // 2 PEP
    inCampo(s, 'B', 3, 'presente'); // 2 RP
    s.giocatori.A.supportoPep = 1;
    risolviCollisione(s);
    expect(s.giocatori.B.it).toBe(19);
  });

  test('le modifiche "collisione" scadono, le altre restano', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 1, 'passato', {
      modifiche: [{ stat: 'pep', delta: 1, durata: 'collisione' }, { stat: 'rp', delta: 1, durata: 'round' }],
    });
    risolviCollisione(s);
    expect(fc.modifiche).toEqual([{ stat: 'rp', delta: 1, durata: 'round' }]);
  });
});
