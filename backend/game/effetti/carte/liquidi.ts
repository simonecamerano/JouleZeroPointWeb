import {
  attivabile, carta, coperteAvversarieNelFuturo, DichiarazioneCarta, guarda, modifica, quando, questaNelPresente,
  scegli, sconto, spazioIn, spostaIn, tutte,
} from '../dsl';

export const LIQUIDI = (): DichiarazioneCarta[] => [
  carta(6, 'Il Mercuriale',
    attivabile({ quando: 'azioni', limite: 'round', se: tutte(questaNelPresente, spazioIn('futuro')) }, spostaIn('futuro'))),
  carta(103, 'Marea di Assorbimento',
    quando('cambioSegnoTP', modifica('rp', 1, 'round'))),
  carta(223, 'Flusso di Innesco',
    quando('entraPresente', scegli(coperteAvversarieNelFuturo, guarda()), sconto('futuro', -1))),
];
