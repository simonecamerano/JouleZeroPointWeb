import {
  carta, continuo, danniDaSubire, DichiarazioneCarta, distruggi, inCollisione, programma, puoi, quando,
  riduciDanniSubiti, ritardato, se, tp,
} from '../dsl';

export const SOLIDI = (): DichiarazioneCarta[] => [
  carta(1, 'Nucleo di Basalto',
    continuo('non può essere spostato da effetti', { vieta: (c, v) => v.tipo === 'sposta' && v.uid === c.sorgente })),
  carta(2, 'Faglia Primaria',
    quando('danniDeterminati', se(danniDaSubire, puoi(distruggi(), riduciDanniSubiti(2))))),
  carta(20, 'Pilastro di Contenimento',
    quando('distrutta', se(inCollisione, programma('tp giù', 'inizioRound'))),
    ritardato('tp giù', tp(-1))),
  carta(50, 'Blocco Termico',
    continuo('la TP non può cambiare di più di 1 per Round', { limitaTP: true })),
  carta(138, 'Monolite di Frenata',
    continuo('durante la Collisione, con TP 0, nessun giocatore può giocare Eventi', {
      vieta: (c, v) => v.tipo === 'evento' && c.s.fase === 'collisione' && c.s.tp === 0,
    })),
];
