import { carta, DichiarazioneCarta, distruggi, entratoDallAvversario, quando, se, tp } from '../dsl';

export const GAS = (): DichiarazioneCarta[] => [
  carta(8, 'Sciame Termico', quando('entraPresente', tp(1))),
  carta(30, 'Espulsione Termica', quando('entraPresente', tp(1)), quando('fineCollisione', distruggi())),
  carta(79, 'Vapore di Turbolenza', quando('frammentoEntraPresente', se(entratoDallAvversario, tp(1)))),
  carta(231, 'Vapore di Interferenza', quando('inversione', tp(1))),
];
