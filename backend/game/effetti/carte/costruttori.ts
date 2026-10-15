import {
  attivabile, bersaglioNelPresente, carta, DichiarazioneCarta, distruggi, giocatoNelFuturoDaTe, haBersagli,
  perdiIT, primaVoltaPer, programma, quando, ritardato, scegli, se, spostaIn, spostaOpposto, suCartaGiocata,
  tuoiFrammentiScambiabili,
} from '../dsl';

export const COSTRUTTORI = (): DichiarazioneCarta[] => [
  carta(255, 'Nyx, Architetta del Futuro',
    quando('frammentoGiocato', se(giocatoNelFuturoDaTe, primaVoltaPer('round',
      suCartaGiocata(), spostaIn('presente', 'bersaglio'), programma('distruggi se resta', 'fineCollisione')))),
    ritardato('distruggi se resta', se(bersaglioNelPresente, distruggi('bersaglio')))),
  carta(259, 'Khepri, Ricorsione Fluida',
    attivabile({ quando: 'azioni', limite: 'round', se: haBersagli(tuoiFrammentiScambiabili) },
      scegli(tuoiFrammentiScambiabili, perdiIT('controllore', 1), spostaOpposto()))),
];
