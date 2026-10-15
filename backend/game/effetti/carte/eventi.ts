import {
  annullaOSilenzia, carta, carteAnnullabili, continuo, DichiarazioneCarta, distruggi, frammentiNelPresente,
  opzione, quando, scegli, scegliUno, tp,
} from '../dsl';

export const EVENTI = (): DichiarazioneCarta[] => [
  carta(19, 'Shock Termico',
    continuo('si gioca solo durante una Collisione', { soloInCollisione: true }),
    quando('immediato', scegliUno(opzione('TP +1', tp(1)), opzione('TP -1', tp(-1))))),
  carta(46, 'Disintegrazione Istantanea',
    quando('immediato', scegli(frammentiNelPresente, distruggi('bersaglio')))),
  carta(127, 'Deviazione Temporale',
    quando('immediato', scegli(carteAnnullabili, annullaOSilenzia()))),
];
