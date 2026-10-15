import {
  carta, controlliIlPresente, DichiarazioneCarta, guadagnaET, inversione, perdiIT, programma, quando, ritardato,
  se, tpDiversaDa,
} from '../dsl';

export const ANOMALIE = (): DichiarazioneCarta[] => [
  carta(93, 'Faglia Temporale',
    quando('inizioCollisione', se(tpDiversaDa(0), inversione(), perdiIT('controllore', 1)))),
  carta(173, 'Accumulo Critico',
    quando('fineCollisione', se(controlliIlPresente, programma('ET in più', 'risorse'))),
    ritardato('ET in più', guadagnaET('controllore', 1))),
];
