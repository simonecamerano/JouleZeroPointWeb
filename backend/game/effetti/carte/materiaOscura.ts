import { azione, carta, DichiarazioneCarta, opzione, perdiIT, quando, scartaUna, scegliUno } from '../dsl';
import { vuotoDiProbabilita } from './speciali';

export const MATERIA_OSCURA = (): DichiarazioneCarta[] => [
  carta(67, 'Eco del Punto Zero',
    quando('inversione', scegliUno(
      opzione('entrambi i giocatori scartano 1 carta', scartaUna('entrambi')),
      opzione('entrambi i giocatori perdono 1 IT', perdiIT('entrambi', 1)),
    ))),
  carta(203, 'Vuoto di Probabilità',
    quando('entraPresente', azione(
      'guardi le prime 2 carte del tuo mazzo: puoi mettere un Frammento tra queste nel tuo Futuro coperto, le altre vanno in fondo al mazzo',
      vuotoDiProbabilita,
    ))),
];
