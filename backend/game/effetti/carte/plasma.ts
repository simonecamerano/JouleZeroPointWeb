import { carta, continuo, dannoIT, DichiarazioneCarta, pesca, quando } from '../dsl';

export const PLASMA = (): DichiarazioneCarta[] => [
  carta(15, 'Fulmine Residuo',
    quando('entraPresente', dannoIT('avversario', 1)),
    continuo('durante la Collisione questo Frammento ottiene +1 PEP', { pep: (c, fc) => (fc.uid === c.sorgente ? 1 : 0) })),
  carta(119, 'Fulmine di Esaurimento', quando('distrutta', pesca('controllore'))),
];
