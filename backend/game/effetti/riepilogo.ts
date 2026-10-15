// Riepilogo per la validazione: testo stampato accanto a cosa fa lo script (spec 1C, sezione 8).
import { DefCarta } from '../engine/types';
import { descrivi } from './dsl';
import { dichiarazioneRegistrata } from './registro';

const cella = (t: string): string => t.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();

export function riepilogoEffetti(catalogo: Record<number, DefCarta>): string {
  const carte = Object.values(catalogo).sort((a, b) => a.cardId - b.cardId);
  let automatiche = 0;
  const righe = carte.map((d) => {
    const dich = dichiarazioneRegistrata(d.cardId);
    let script = 'manuale, non ancora tradotta';
    if (dich && dich.nome !== d.nome) script = `ATTENZIONE: dichiarata come «${dich.nome}», resta manuale`;
    else if (dich) {
      automatiche += 1;
      script = descrivi(dich);
    }
    return `| ${d.cardId} | ${cella(d.nome)} | ${d.tipo} | ${cella(d.effetto)} | ${cella(script)} |`;
  });
  return [
    '# Effetti delle carte',
    '',
    'Generato da `npm run effetti:riepilogo` nel backend. Non modificare a mano: una riga sbagliata si corregge nella dichiarazione in `backend/game/effetti/carte/`.',
    '',
    `Automatiche: ${automatiche} su ${carte.length}`,
    '',
    '| ID | Carta | Tipo | Testo stampato | Cosa fa lo script |',
    '|---|---|---|---|---|',
    ...righe,
    '',
  ].join('\n');
}
