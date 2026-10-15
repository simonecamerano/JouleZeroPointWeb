// Uso: npm run effetti:riepilogo. Scrive docs/effetti-carte.md dalla fixture del catalogo v6.
import { writeFileSync } from 'fs';
import { join } from 'path';
import { daCardDb } from '../game/engine/carte';
import { DefCarta } from '../game/engine/types';
import { riepilogoEffetti } from '../game/effetti/riepilogo';
import carte from '../tests/game/fixtures/carte-v6.json';

const catalogo: Record<number, DefCarta> = {};
for (const c of carte) {
  const d = daCardDb(c);
  if (d) catalogo[d.cardId] = d;
}
const uscita = join(__dirname, '..', '..', 'docs', 'effetti-carte.md');
writeFileSync(uscita, riepilogoEffetti(catalogo));
console.log(`Scritto ${uscita}`);
