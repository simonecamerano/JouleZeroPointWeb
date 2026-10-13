# Rete e tavolo di gioco (tappa 1B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Due utenti loggati di joulezeropoint.com giocano una partita intera 1 contro 1 dal setup a una condizione di vittoria, con il motore 1A che gira sul server, Socket.IO come trasporto e un tavolo di gioco Vue in cui gli effetti delle carte si applicano a mano dal pannello azioni base.

**Architecture:** Il backend tiene le partite in corso in memoria in un `GestorePartite` senza dipendenze da rete né database (persistenza e catalogo iniettati), che chiama il motore puro di `backend/game/engine/`. Uno strato sottile `backend/game/socket.ts` autentica il socket con il JWT delle API, carica mazzi e catalogo da Mongo, traduce gli eventi in chiamate al gestore e invia a ciascun giocatore solo la propria `vista`. A fine partita il documento `Match` salva seed, mazzi e log delle azioni. Il frontend ha uno store Pinia `matchStore` che parla col socket e una `MatchView` che compone il tavolo in CSS Grid con i ritagli del tabellone 6.0.

**Tech Stack:** Backend TypeScript 5.9 (strict, CommonJS), Express 5, Socket.IO 4.8, Mongoose 9, Jest 30 + ts-jest, mongodb-memory-server. Frontend Vue 3.5 (`<script setup lang="ts">`), Pinia 3, vue-router 4, socket.io-client 4.8, Vitest 4. Node 24.

**Spec:** `docs/superpowers/specs/2026-10-13-partita-online-design.md` (sezioni 3, 4, 5.1, 7, 9, 10, 11). Motore: `docs/superpowers/plans/2026-10-13-motore-regole-1a.md`, branch `feature/motore-regole-1a`.

## Global Constraints

- Si lavora sul branch `feature/rete-tavolo-1b`, creato da `feature/motore-regole-1a` (il motore non è ancora su main).
- **Nessuna modifica a `backend/game/engine/`.** Se un task sembra richiederla, fermarsi e segnalarlo: è un cambio al piano 1A.
- Lo stato vero della partita (`StatoPartita`) e il log delle azioni non escono mai dal server. Al client arrivano solo `vista(stato, ruolo)` e `mosseLegali(stato, ruolo)`.
- Autenticazione socket: stesso JWT delle API (`jwt.verify(token, process.env.JWT_SECRET)` con payload `{ id }`), passato in `handshake.auth.token`. Solo utenti esistenti nel database.
- Mazzo valido: 40 carte + 1 Costruttore secondo `validaMazzo` del motore. Nel database un mazzo è `{ cards: { cardId, count }[], costruttoreId }`.
- Timeout finestra di risposta: **20 secondi**, poi `passa` automatico; configurabile con `MATCH_WINDOW_TIMEOUT_MS`.
- Giocatore assente: dopo **10 minuti** la partita va in pausa; dopo **24 ore** viene chiusa senza esito.
- Un riavvio del server perde le partite in corso (accettato per il playtest).
- Massimo **3 partite aperte per utente** (in attesa o in corso), per non far crescere la memoria.
- Codice d'invito: 8 caratteri da `crypto.randomBytes`, monouso.
- Identificatori, eventi socket, messaggi d'errore e testi dell'interfaccia in italiano.
- Socket.IO sul path standard `/socket.io/`, sullo stesso server HTTP di Express, porta `PORT` (3000 in produzione).
- Tavolo: desktop e tablet orizzontale; telefono verticale mostra l'invito a ruotare. Niente trascinamento.
- Comandi test: backend da `backend/` con `npx jest tests/match` (questa tappa) e `npm test` (tutto); frontend da `frontend/` con `npx vitest run`.

## Decisioni prese in questo piano

Punti che la spec lascia aperti, decisi qui. Ognuno vive in un solo punto del codice.

1. **Ruoli**: chi crea la partita è il Giocatore A, chi entra con l'invito è il Giocatore B. L'iniziativa la decide il dado del motore, quindi A non è avvantaggiato.
2. **Trasporto unico**: creazione, ingresso e mosse passano tutti dal socket con callback di conferma (ack). Nessuna rotta REST nuova.
3. **Il `Match` salva anche i due mazzi** (`mazzi.A`, `mazzi.B` nel formato `Mazzo`): senza mazzi seed e log non bastano a rigiocare la partita. Il catalogo non viene salvato: la rigiocata usa il catalogo corrente, e `versioneScript` dice quale versione degli script era attiva.
4. **`cardScripts.json` nasce vuoto** (`{}`) in questa tappa, solo per avere l'hash `versioneScript` dal primo `Match`. Gli script arrivano nella tappa 3.
5. **Partita chiusa senza esito** (24 ore di assenza, o partita in attesa mai iniziata): se era iniziata si salva con `esito: { vincitore: null, motivo: 'chiusa' }`; se non era iniziata non si salva niente.
6. **Partita in pausa**: le mosse vengono rifiutate con "Partita in pausa" e il timer della finestra si ferma; al rientro riparte da 20 secondi pieni.
7. **Dopo la fine** la partita resta in memoria 10 minuti, così entrambi vedono l'esito, poi si rimuove.
8. **GDPR**: alla cancellazione dell'account (manuale o da ritenzione) le partite **non** si cancellano, perché sono anche dell'avversario: si anonimizza il giocatore (`userId: null`, `username: null`). L'export dei dati include le partite dell'utente senza il log delle azioni dell'avversario oltre a quanto già visibile in partita (si esporta solo esito, data, round, ruolo e mazzo proprio).
9. **Timer di finestra e decisioni**: il timeout di 20 secondi vale solo per le finestre di risposta (`stato.finestra` aperta e nessuna `stato.decisione`). Le decisioni (iniziativa, mulligan, Bonus Controllo, capienza, effetto manuale) non hanno timeout: lo dice la spec (timer per turno fuori perimetro).

## Review Focus

1. **Due schede dello stesso utente**: lo stesso giocatore connesso da due browser deve ricevere la vista su entrambi, e chiudere una sola scheda non deve farlo risultare assente. Test in Task 4.
2. **Mossa arrivata dopo il timeout della finestra**: il `passa` automatico è già stato applicato; la mossa tardiva va rifiutata con errore leggibile e il client riceve di nuovo la vista corretta. Test in Task 3.
3. **Mazzo cancellato o modificato dopo la creazione della partita**: la partita usa la copia del mazzo presa alla creazione, non quella in database. Test in Task 4.
4. **Un estraneo che conosce il codice di una partita già piena** prova a entrarci o a mandare mosse: rifiutato, e non riceve nessuna vista. Test in Task 4.
5. **Payload malformati dal client** (`azione` assente, stringa, oggetto senza `tipo`, `codice` non stringa): errore nell'ack, nessuna eccezione non gestita che faccia cadere il processo. Test in Task 4.

## File Structure

| File | Responsabilità |
|---|---|
| `backend/game/cardScripts.json` | Script delle carte (vuoto in questa tappa) |
| `backend/game/catalogo.ts` | Catalogo dal database, conversione mazzo da `Deck` a `Mazzo`, hash degli script |
| `backend/models/Match.ts` | Modello Mongoose della partita conclusa |
| `backend/game/partite.ts` | `GestorePartite`: ciclo di vita, inviti, mosse, timer, persistenza iniettata |
| `backend/game/socket.ts` | Server Socket.IO: autenticazione, eventi, invio delle viste |
| `backend/index.ts` | Avvio con `http.createServer` e Socket.IO |
| `backend/app.ts` | Export di `allowedOrigins` |
| `backend/controllers/authController.ts`, `controllers/exportController.ts`, `tasks/retentionTask.ts` | Partite nell'export e nella cancellazione |
| `backend/tests/match/*.test.ts` | Test della tappa |
| `frontend/src/stores/matchStore.ts` | Stato client e socket |
| `frontend/src/views/MatchView.vue` | Lobby, invito e tavolo |
| `frontend/src/components/match/*.vue` | Pezzi del tavolo e pannelli |
| `frontend/public/images/match/*.png` | Ritagli del tabellone 6.0 |
| `frontend/nginx.conf`, `frontend/vite.config.ts`, `frontend/src/router/index.ts`, `frontend/src/stores/auth.ts` | Instradamento |

## Definition of Done (Contract)

**Obiettivo misurabile:**
- `cd backend && npx jest tests/match` verde; `cd backend && npm test` verde (compresi i test del motore 1A).
- `cd frontend && npx vitest run` verde e `npx vue-tsc --noEmit` (o `npm run build`) senza errori.
- Prova manuale del Task 10: due utenti in due browser completano una partita fino a un esito, e il documento `Match` corrispondente esiste in Mongo con `log` non vuoto, `seed`, `mazzi` ed `esito`.

**Vincoli:**
- Quelli di "Global Constraints", in particolare: nessuna modifica a `backend/game/engine/`, stato vero e log mai inviati al client.

**Formato output:**
- Un commit per task, 10 commit sul branch `feature/rete-tavolo-1b`, pushato su origin senza merge.

**Condizioni di FALLIMENTO (l'agente NON può dichiararsi finito se una è vera):**
- [ ] `git diff feature/motore-regole-1a -- backend/game/engine` non è vuoto.
- [ ] Un evento socket inviato al client contiene il campo `rng`, `carte` (il catalogo dello stato), o il `cardId` di una carta coperta avversaria (test del Task 4 rosso o assente).
- [ ] Un client non autenticato o un terzo utente riceve una vista di una partita altrui.
- [ ] Una mossa illegale modifica lo stato o non rimanda la vista al mittente.
- [ ] `npm test` nel backend ha test rossi che erano verdi prima del lavoro.
- [ ] Un test è stato modificato per farlo passare senza motivarlo nel messaggio di commit.
- [ ] La prova manuale del Task 10 non è stata eseguita, o è stata eseguita con un errore in console non spiegato.

## Rischi (Premortem)

1. **La connessione WebSocket non passa in produzione** (nginx senza `location /socket.io/`, header `Upgrade` mancanti, Coolify/Traefik davanti), e il tavolo resta muto pur funzionando in locale. → **mitigazione:** Task 6 aggiunge la location e il proxy Vite con `ws: true`; il Task 10 prova il polling e l'upgrade dal browser in locale col container nginx e annota il controllo da fare dopo il deploy (`/socket.io/?EIO=4&transport=polling` deve rispondere 200).
2. **Timer che si accumulano o scattano su partite già chiuse** (finestra, pausa, chiusura, pulizia), con `passa` applicati alla partita sbagliata o processo che non si chiude nei test. → **mitigazione:** ogni partita ha un solo oggetto `timer` per tipo, cancellato a ogni cambio di stato e in `rimuovi`; il Task 3 usa i fake timer di Jest su tutti i casi, e `GestorePartite.chiudi()` cancella tutto (usato in `afterAll`).
3. **Il tavolo è inutilizzabile in pratica** (carte illeggibili, non si capisce chi deve agire, il pannello manuale è troppo lento per giocare), e il playtest non parte anche se tutto è tecnicamente corretto. → **mitigazione:** barra di stato con "Tocca a te" evidenziato, carte con anteprima ingrandita al passaggio del mouse, pannello manuale con i bersagli già proposti dal campo; il Task 10 è una partita vera fino in fondo, e i problemi di usabilità trovati lì diventano voci nel registro del branch, non correzioni silenziose.

**RISCHIO PIÙ ALTO:** il #1. I test di integrazione girano su `localhost` senza proxy, quindi restano verdi anche con nginx sbagliato; si scopre solo in produzione.

---

### Task 1: Catalogo, mazzi e modello Match

**Files:**
- Create: `backend/game/cardScripts.json`
- Create: `backend/game/catalogo.ts`
- Create: `backend/models/Match.ts`
- Test: `backend/tests/match/catalogo.test.ts`

**Interfaces:**
- Consumes: dal motore `daCardDb`, `validaMazzo`, `DefCarta`, `Mazzo`, `PlayerId`, `Azione`; `getCachedCards()` da `backend/services/cardService.ts`.
- Produces:
  - `catalogoDa(cards: Array<{ cardId: number; name: string; type?: string; status?: string; cost_et?: number; pep?: number; rp?: number; rarity?: string; effect?: string }>): Record<number, DefCarta>`
  - `caricaCatalogo(): Promise<Record<number, DefCarta>>`
  - `mazzoDaDeck(deck: { cards: unknown; costruttoreId: unknown }): Mazzo | string` (stringa = errore leggibile)
  - `VERSIONE_SCRIPT: string` (sha256 esadecimale, primi 12 caratteri, di `cardScripts.json`)
  - `VERSIONE_REGOLAMENTO = '6.0'`
  - `Match` (modello Mongoose) e `IMatch`, con `VoceLogMatch { t: Date; giocatore: PlayerId | 'server'; azione: unknown }`

- [ ] **Step 0: Creare il branch**

```bash
cd /home/simone/Documenti/start2impact/JouleZeroPointDev
git checkout feature/rete-tavolo-1b
git pull
```

Il branch esiste già (creato da `feature/motore-regole-1a` insieme a questo piano).

- [ ] **Step 1: Scrivere il test che fallisce**

`backend/tests/match/catalogo.test.ts`:

```ts
import { catalogoDa, mazzoDaDeck, VERSIONE_SCRIPT } from '../../game/catalogo';
import { validaMazzo } from '../../game/engine';
import { catalogoProva } from '../game/helpers';

describe('catalogo', () => {
  test('catalogoDa converte le carte del database e scarta quelle di tipo sconosciuto', () => {
    const cat = catalogoDa([
      { cardId: 1, name: 'Ghiaccio', type: 'Solido', status: 'Freddo', cost_et: 3, pep: 1, rp: 5, rarity: 'Stabile', effect: '' },
      { cardId: 2, name: 'Bozza', type: 'Prototipo' },
    ]);
    expect(Object.keys(cat)).toEqual(['1']);
    expect(cat[1]).toMatchObject({ nome: 'Ghiaccio', tipo: 'Solido', termica: 'Freddo', costo: 3 });
  });

  test('VERSIONE_SCRIPT è un hash di 12 caratteri esadecimali', () => {
    expect(VERSIONE_SCRIPT).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('mazzoDaDeck', () => {
  test('espande i conteggi in 40 cardId e tiene il Costruttore a parte', () => {
    const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((cardId) => ({ cardId, count: 3 }));
    cards.push({ cardId: 14, count: 1 });
    const m = mazzoDaDeck({ cards, costruttoreId: 100 });
    if (typeof m === 'string') throw new Error(m);
    expect(m.carte).toHaveLength(40);
    expect(m.costruttore).toBe(100);
    expect(validaMazzo(m, catalogoProva())).toBeNull();
  });

  test.each([
    [{ cards: 'x', costruttoreId: 100 }, 'Mazzo non leggibile'],
    [{ cards: [{ cardId: 1, count: -1 }], costruttoreId: 100 }, 'Mazzo non leggibile'],
    [{ cards: [{ cardId: 1.5, count: 1 }], costruttoreId: 100 }, 'Mazzo non leggibile'],
    [{ cards: [{ cardId: 1, count: 3 }], costruttoreId: 'a' }, 'Il mazzo non ha un Costruttore'],
    [{ cards: [{ cardId: 1, count: 500 }], costruttoreId: 100 }, 'Mazzo non leggibile'],
  ])('rifiuta %j', (deck, errore) => {
    expect(mazzoDaDeck(deck as never)).toBe(errore);
  });
});
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `cd backend && npx jest tests/match/catalogo.test.ts`
Expected: FAIL, `Cannot find module '../../game/catalogo'`.

- [ ] **Step 3: Scrivere `cardScripts.json`, `catalogo.ts` e `Match.ts`**

`backend/game/cardScripts.json`:

```json
{}
```

`backend/game/catalogo.ts`:

```ts
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { daCardDb, DefCarta, Mazzo } from './engine';
import { getCachedCards } from '../services/cardService';

export const VERSIONE_REGOLAMENTO = '6.0';

export const VERSIONE_SCRIPT = createHash('sha256')
  .update(readFileSync(path.join(__dirname, 'cardScripts.json')))
  .digest('hex')
  .slice(0, 12);

type CartaDb = Parameters<typeof daCardDb>[0];

export function catalogoDa(cards: CartaDb[]): Record<number, DefCarta> {
  const out: Record<number, DefCarta> = {};
  for (const c of cards) {
    const d = daCardDb(c);
    if (d) out[d.cardId] = d;
  }
  return out;
}

export async function caricaCatalogo(): Promise<Record<number, DefCarta>> {
  const cards = await getCachedCards();
  return catalogoDa(cards.map((c) => (typeof c.toObject === 'function' ? c.toObject() : c) as CartaDb));
}

/** Converte un mazzo salvato dal deckbuilder ({cardId, count}[]) nel formato del motore. */
export function mazzoDaDeck(deck: { cards: unknown; costruttoreId: unknown }): Mazzo | string {
  if (!Number.isInteger(deck.costruttoreId)) return 'Il mazzo non ha un Costruttore';
  if (!Array.isArray(deck.cards)) return 'Mazzo non leggibile';
  const carte: number[] = [];
  for (const voce of deck.cards) {
    const { cardId, count } = (voce ?? {}) as { cardId?: unknown; count?: unknown };
    if (!Number.isInteger(cardId) || !Number.isInteger(count) || (count as number) < 0 || (count as number) > 40) {
      return 'Mazzo non leggibile';
    }
    for (let i = 0; i < (count as number); i++) carte.push(cardId as number);
  }
  return { carte, costruttore: deck.costruttoreId as number };
}
```

`backend/models/Match.ts`:

```ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import type { Mazzo, PlayerId } from '../game/engine';

export interface VoceLogMatch {
  t: Date;
  giocatore: PlayerId | 'server';
  azione: unknown;
}

export interface GiocatoreMatch {
  ruolo: PlayerId;
  userId: string | null;
  username: string | null;
  deckId: string;
}

export interface IMatch extends Document {
  codice: string;
  giocatori: GiocatoreMatch[];
  mazzi: Record<PlayerId, Mazzo>;
  seed: number;
  versioneRegolamento: string;
  versioneScript: string;
  esito: { vincitore: PlayerId | null; motivo: string };
  durata: number;
  round: number;
  log: VoceLogMatch[];
  controAI: boolean;
  iniziata: Date;
  createdAt: Date;
}

const matchSchema = new Schema<IMatch>({
  codice: { type: String, required: true, index: true },
  giocatori: [{
    _id: false,
    ruolo: { type: String, enum: ['A', 'B'], required: true },
    userId: { type: String, default: null, index: true },
    username: { type: String, default: null },
    deckId: { type: String, required: true },
  }],
  mazzi: { type: Schema.Types.Mixed, required: true },
  seed: { type: Number, required: true },
  versioneRegolamento: { type: String, required: true },
  versioneScript: { type: String, required: true },
  esito: {
    vincitore: { type: String, enum: ['A', 'B'], default: null },
    motivo: { type: String, required: true },
  },
  durata: { type: Number, required: true },
  round: { type: Number, required: true },
  log: { type: [Schema.Types.Mixed], default: [] },
  controAI: { type: Boolean, default: false },
  iniziata: { type: Date, required: true },
}, { timestamps: true });

const Match: Model<IMatch> = mongoose.models.Match || mongoose.model<IMatch>('Match', matchSchema);
export default Match;
```

- [ ] **Step 4: Eseguire il test e vederlo passare**

Run: `cd backend && npx jest tests/match/catalogo.test.ts && npx tsc --noEmit`
Expected: PASS, nessun errore di tipi.

- [ ] **Step 5: Commit**

```bash
git add backend/game/cardScripts.json backend/game/catalogo.ts backend/models/Match.ts backend/tests/match/catalogo.test.ts
git commit -m "feat(match): catalogo dal database, mazzo del deckbuilder nel formato del motore, modello Match"
```

---

### Task 2: GestorePartite, ciclo di vita e mosse

**Files:**
- Create: `backend/game/partite.ts`
- Test: `backend/tests/match/partite.test.ts`

**Interfaces:**
- Consumes: dal motore `creaPartita`, `applica`, `arrendi`, `chiDeveAgire`, `mosseLegali`, `vista`, `StatoPartita`, `PlayerId`, `Mazzo`, `DefCarta`, `Azione`, `Vista`, `validaMazzo`; da Task 1 `VERSIONE_REGOLAMENTO`, `VERSIONE_SCRIPT`, `VoceLogMatch`.
- Produces (usati da Task 3, 4):

```ts
export interface Utente { userId: string; username: string }
export type StatoTavolo = 'attesa' | 'inCorso' | 'pausa' | 'terminata';
export interface Aggiornamento {
  codice: string;
  statoTavolo: StatoTavolo;
  ruolo: PlayerId;
  avversario: string | null;      // username, null finché B non entra
  vista: Vista | null;            // null in attesa
  mosse: Azione[];
  scadenzaFinestra: number | null; // epoch ms, solo per chi deve rispondere
}
export interface PartitaSalvata {
  codice: string;
  giocatori: { ruolo: PlayerId; userId: string; username: string; deckId: string }[];
  mazzi: Record<PlayerId, Mazzo>;
  seed: number;
  versioneRegolamento: string;
  versioneScript: string;
  esito: { vincitore: PlayerId | null; motivo: string };
  durata: number;
  round: number;
  log: VoceLogMatch[];
  iniziata: Date;
}
export interface OpzioniGestore {
  salva: (p: PartitaSalvata) => Promise<void>;
  notifica: (userId: string, a: Aggiornamento) => void;
  seed?: () => number;            // default: crypto.randomInt(1, 2**31 - 1)
  codice?: () => string;          // default: 8 caratteri da crypto.randomBytes
  timeoutFinestraMs?: number;     // default: Number(process.env.MATCH_WINDOW_TIMEOUT_MS) || 20000
}
export type Esito<T = undefined> = { ok: true; valore: T } | { ok: false; errore: string };
export class GestorePartite {
  constructor(o: OpzioniGestore);
  crea(u: Utente, deckId: string, mazzo: Mazzo, catalogo: Record<number, DefCarta>): Esito<{ codice: string }>;
  entra(codice: string, u: Utente, deckId?: string, mazzo?: Mazzo): Esito<{ ruolo: PlayerId }>;
  azione(codice: string, userId: string, azione: unknown): Esito;
  arrenditi(codice: string, userId: string): Esito;
  aggiornamentoPer(codice: string, userId: string): Aggiornamento | null;
  connesso(codice: string, userId: string): void;   // Task 3
  disconnesso(codice: string, userId: string): void; // Task 3
  partiteDi(userId: string): string[];
  chiudi(): void;                                    // cancella tutti i timer (test, shutdown)
}
```

Il catalogo passato a `crea` serve a validare entrambi i mazzi e a creare lo stato: `entra` usa lo stesso catalogo salvato nella partita.

- [ ] **Step 1: Scrivere i test che falliscono**

`backend/tests/match/partite.test.ts`:

```ts
import { GestorePartite, Aggiornamento, PartitaSalvata } from '../../game/partite';
import { catalogoProva, mazzoProva } from '../game/helpers';

const A = { userId: 'u1', username: 'alice' };
const B = { userId: 'u2', username: 'bob' };
const C = { userId: 'u3', username: 'carlo' };

function nuovo() {
  const salvate: PartitaSalvata[] = [];
  const notifiche: { userId: string; a: Aggiornamento }[] = [];
  let n = 0;
  const g = new GestorePartite({
    salva: async (p) => { salvate.push(p); },
    notifica: (userId, a) => notifiche.push({ userId, a }),
    seed: () => 42,
    codice: () => `COD${++n}`,
  });
  return { g, salvate, notifiche };
}

function avviata() {
  const t = nuovo();
  const r = t.g.crea(A, 'd1', mazzoProva(), catalogoProva());
  if (!r.ok) throw new Error(r.errore);
  const e = t.g.entra(r.valore.codice, B, 'd2', mazzoProva());
  if (!e.ok) throw new Error(e.errore);
  return { ...t, codice: r.valore.codice };
}

afterEach(() => jest.useRealTimers());

describe('GestorePartite', () => {
  test('crea una partita in attesa con A come creatore', () => {
    const { g } = nuovo();
    const r = g.crea(A, 'd1', mazzoProva(), catalogoProva());
    expect(r).toEqual({ ok: true, valore: { codice: 'COD1' } });
    const ag = g.aggiornamentoPer('COD1', 'u1')!;
    expect(ag).toMatchObject({ statoTavolo: 'attesa', ruolo: 'A', avversario: null, vista: null, mosse: [] });
    g.chiudi();
  });

  test('rifiuta un mazzo non valido', () => {
    const { g } = nuovo();
    const m = mazzoProva();
    m.carte.pop();
    const r = g.crea(A, 'd1', m, catalogoProva());
    expect(r).toEqual({ ok: false, errore: 'Il mazzo deve avere 40 carte, ne ha 39' });
    g.chiudi();
  });

  test('B entra con il codice, la partita parte e tutti e due ricevono la propria vista', () => {
    const { g, notifiche, codice } = avviata();
    const ultima = (u: string) => notifiche.filter((n) => n.userId === u).at(-1)!.a;
    expect(ultima('u1')).toMatchObject({ statoTavolo: 'inCorso', ruolo: 'A', avversario: 'bob' });
    expect(ultima('u2')).toMatchObject({ statoTavolo: 'inCorso', ruolo: 'B', avversario: 'alice' });
    expect(ultima('u1').vista!.io).toBe('A');
    expect(ultima('u2').vista!.giocatori.A.mano).toBeNull();
    expect(JSON.stringify(ultima('u2'))).not.toMatch(/"rng"|"carte":\{/);
    g.chiudi();
  });

  test('il codice è monouso: un terzo utente non entra e non riceve viste', () => {
    const { g, notifiche, codice } = avviata();
    expect(g.entra(codice, C, 'd3', mazzoProva())).toEqual({ ok: false, errore: 'La partita è già al completo' });
    expect(g.aggiornamentoPer(codice, 'u3')).toBeNull();
    expect(notifiche.some((n) => n.userId === 'u3')).toBe(false);
    g.chiudi();
  });

  test('il creatore non può entrare come avversario di sé stesso', () => {
    const { g } = nuovo();
    g.crea(A, 'd1', mazzoProva(), catalogoProva());
    expect(g.entra('COD1', A, 'd1', mazzoProva())).toEqual({ ok: false, errore: 'Non puoi giocare contro te stesso' });
    g.chiudi();
  });

  test('chi è già giocatore rientra senza mazzo e riceve il suo ruolo', () => {
    const { g, codice } = avviata();
    expect(g.entra(codice, B)).toEqual({ ok: true, valore: { ruolo: 'B' } });
    g.chiudi();
  });

  test('codice inesistente', () => {
    const { g } = nuovo();
    expect(g.entra('NOPE', B, 'd2', mazzoProva())).toEqual({ ok: false, errore: 'Partita non trovata' });
    g.chiudi();
  });

  test('una mossa legale avanza la partita, una illegale viene rifiutata e la vista viene rimandata', () => {
    const { g, notifiche, codice } = avviata();
    const tocca = (['u1', 'u2'] as const).find((u) => g.aggiornamentoPer(codice, u)!.mosse.length > 0)!;
    const altro = tocca === 'u1' ? 'u2' : 'u1';
    const prima = notifiche.length;
    expect(g.azione(codice, altro, { tipo: 'passa' })).toEqual({ ok: false, errore: 'Non tocca a te' });
    expect(notifiche.length).toBe(prima + 1);
    expect(notifiche.at(-1)!.userId).toBe(altro);
    const mossa = g.aggiornamentoPer(codice, tocca)!.mosse[0];
    expect(g.azione(codice, tocca, mossa)).toEqual({ ok: true, valore: undefined });
    g.chiudi();
  });

  test.each([undefined, null, 'passa', 42, {}, { tipo: 7 }])('azione malformata %j: errore, nessuna eccezione', (az) => {
    const { g, codice } = avviata();
    const tocca = (['u1', 'u2'] as const).find((u) => g.aggiornamentoPer(codice, u)!.mosse.length > 0)!;
    const r = g.azione(codice, tocca, az);
    expect(r.ok).toBe(false);
    g.chiudi();
  });

  test('chi non è nella partita non può muovere', () => {
    const { g, codice } = avviata();
    expect(g.azione(codice, 'u3', { tipo: 'passa' })).toEqual({ ok: false, errore: 'Non sei in questa partita' });
    g.chiudi();
  });

  test('resa: la partita termina, viene salvata con seed, mazzi e log', async () => {
    const { g, salvate, codice } = avviata();
    expect(g.arrenditi(codice, 'u1')).toEqual({ ok: true, valore: undefined });
    await Promise.resolve();
    expect(salvate).toHaveLength(1);
    const p = salvate[0];
    expect(p).toMatchObject({ codice, seed: 42, versioneRegolamento: '6.0', esito: { vincitore: 'B', motivo: 'abbandono' } });
    expect(p.giocatori.map((x) => x.username)).toEqual(['alice', 'bob']);
    expect(p.mazzi.A.carte).toHaveLength(40);
    expect(p.log.at(-1)).toMatchObject({ giocatore: 'A', azione: { tipo: 'arrenditi' } });
    expect(g.aggiornamentoPer(codice, 'u2')!.statoTavolo).toBe('terminata');
    expect(g.azione(codice, 'u2', { tipo: 'passa' })).toEqual({ ok: false, errore: 'La partita è terminata' });
    g.chiudi();
  });

  test('massimo 3 partite aperte per utente', () => {
    const { g } = nuovo();
    for (let i = 0; i < 3; i++) expect(g.crea(A, 'd1', mazzoProva(), catalogoProva()).ok).toBe(true);
    expect(g.crea(A, 'd1', mazzoProva(), catalogoProva())).toEqual({ ok: false, errore: 'Hai già 3 partite aperte' });
    g.chiudi();
  });

  test('il mazzo è copiato alla creazione: modificarlo dopo non cambia la partita', () => {
    const { g } = nuovo();
    const m = mazzoProva();
    g.crea(A, 'd1', m, catalogoProva());
    m.carte.length = 0;
    expect(g.entra('COD1', B, 'd2', mazzoProva()).ok).toBe(true);
    g.chiudi();
  });

  test('una partita giocata fino in fondo con mosse legali viene salvata una sola volta', async () => {
    const { g, salvate, codice } = avviata();
    // 500 passi bastano a coprire setup, più round e finestre; di più rallenta (ogni passo clona viste e log).
    for (let passo = 0; passo < 500; passo++) {
      const ag = (['u1', 'u2'] as const).map((u) => [u, g.aggiornamentoPer(codice, u)!] as const);
      if (ag[0][1].statoTavolo === 'terminata') break;
      const turno = ag.find(([, a]) => a.mosse.length > 0);
      if (!turno) throw new Error(`passo ${passo}: nessuno ha mosse`);
      const [u, a] = turno;
      const r = g.azione(codice, u, a.mosse[passo % a.mosse.length]);
      if (!r.ok) throw new Error(`passo ${passo}: ${r.errore}`);
    }
    await Promise.resolve();
    if (g.aggiornamentoPer(codice, 'u1')!.statoTavolo === 'terminata') {
      expect(salvate).toHaveLength(1);
      expect(salvate[0].log.length).toBeGreaterThan(0);
    }
    g.chiudi();
  });
});
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `cd backend && npx jest tests/match/partite.test.ts`
Expected: FAIL, `Cannot find module '../../game/partite'`.

- [ ] **Step 3: Scrivere `partite.ts`**

`backend/game/partite.ts`:

```ts
import { randomBytes, randomInt } from 'crypto';
import {
  Azione, applica, arrendi, chiDeveAgire, creaPartita, DefCarta, Mazzo, mosseLegali, PlayerId,
  StatoPartita, validaMazzo, vista, Vista,
} from './engine';
import { VERSIONE_REGOLAMENTO, VERSIONE_SCRIPT } from './catalogo';
import type { VoceLogMatch } from '../models/Match';

export interface Utente { userId: string; username: string }
export type StatoTavolo = 'attesa' | 'inCorso' | 'pausa' | 'terminata';

export interface Aggiornamento {
  codice: string;
  statoTavolo: StatoTavolo;
  ruolo: PlayerId;
  avversario: string | null;
  vista: Vista | null;
  mosse: Azione[];
  scadenzaFinestra: number | null;
}

export interface PartitaSalvata {
  codice: string;
  giocatori: { ruolo: PlayerId; userId: string; username: string; deckId: string }[];
  mazzi: Record<PlayerId, Mazzo>;
  seed: number;
  versioneRegolamento: string;
  versioneScript: string;
  esito: { vincitore: PlayerId | null; motivo: string };
  durata: number;
  round: number;
  log: VoceLogMatch[];
  iniziata: Date;
}

export interface OpzioniGestore {
  salva: (p: PartitaSalvata) => Promise<void>;
  notifica: (userId: string, a: Aggiornamento) => void;
  seed?: () => number;
  codice?: () => string;
  timeoutFinestraMs?: number;
}

export type Esito<T = undefined> = { ok: true; valore: T } | { ok: false; errore: string };

const MAX_PARTITE_APERTE = 3;
export const PAUSA_MS = 10 * 60 * 1000;
export const CHIUSURA_MS = 24 * 60 * 60 * 1000;
export const PULIZIA_MS = 10 * 60 * 1000;

interface Posto extends Utente { deckId: string; mazzo: Mazzo; connessioni: number }

interface Partita {
  codice: string;
  posti: Partial<Record<PlayerId, Posto>>;
  catalogo: Record<number, DefCarta>;
  seed: number;
  stato: StatoPartita | null;
  log: VoceLogMatch[];
  iniziata: Date | null;
  inPausa: boolean;
  salvata: boolean;
  scadenzaFinestra: number | null;
  timer: { finestra?: NodeJS.Timeout; pausa?: NodeJS.Timeout; chiusura?: NodeJS.Timeout; pulizia?: NodeJS.Timeout };
}

const ok = <T>(valore: T): Esito<T> => ({ ok: true, valore });
const no = (errore: string): Esito<never> => ({ ok: false, errore });

export class GestorePartite {
  private partite = new Map<string, Partita>();
  private o: Required<OpzioniGestore>;

  constructor(o: OpzioniGestore) {
    this.o = {
      seed: () => randomInt(1, 2 ** 31 - 1),
      codice: () => randomBytes(6).toString('base64url').slice(0, 8),
      timeoutFinestraMs: Number(process.env.MATCH_WINDOW_TIMEOUT_MS) || 20000,
      ...o,
    };
  }

  partiteDi(userId: string): string[] {
    return [...this.partite.values()]
      .filter((p) => !p.stato?.esito && this.ruoloDi(p, userId))
      .map((p) => p.codice);
  }

  crea(u: Utente, deckId: string, mazzo: Mazzo, catalogo: Record<number, DefCarta>): Esito<{ codice: string }> {
    if (this.partiteDi(u.userId).length >= MAX_PARTITE_APERTE) return no(`Hai già ${MAX_PARTITE_APERTE} partite aperte`);
    const errore = validaMazzo(mazzo, catalogo);
    if (errore) return no(errore);
    let codice = this.o.codice();
    while (this.partite.has(codice)) codice = this.o.codice();
    const p: Partita = {
      codice, catalogo, seed: this.o.seed(), stato: null, log: [], iniziata: null,
      inPausa: false, salvata: false, scadenzaFinestra: null, timer: {},
      posti: { A: { ...u, deckId, mazzo: structuredClone(mazzo), connessioni: 0 } },
    };
    this.partite.set(codice, p);
    // Una partita mai iniziata si chiude dopo 24 ore senza salvare nulla.
    p.timer.chiusura = setTimeout(() => this.chiudiSenzaEsito(p), CHIUSURA_MS);
    return ok({ codice });
  }

  entra(codice: string, u: Utente, deckId?: string, mazzo?: Mazzo): Esito<{ ruolo: PlayerId }> {
    const p = this.partite.get(codice);
    if (!p) return no('Partita non trovata');
    const gia = this.ruoloDi(p, u.userId);
    if (gia) return ok({ ruolo: gia });
    if (p.posti.B) return no('La partita è già al completo');
    if (p.posti.A!.userId === u.userId) return no('Non puoi giocare contro te stesso');
    if (!deckId || !mazzo) return no('Scegli un mazzo');
    if (this.partiteDi(u.userId).length >= MAX_PARTITE_APERTE) return no(`Hai già ${MAX_PARTITE_APERTE} partite aperte`);
    const errore = validaMazzo(mazzo, p.catalogo);
    if (errore) return no(errore);
    p.posti.B = { ...u, deckId, mazzo: structuredClone(mazzo), connessioni: 0 };
    p.stato = creaPartita({ seed: p.seed, mazzi: { A: p.posti.A!.mazzo, B: p.posti.B.mazzo }, catalogo: p.catalogo });
    p.iniziata = new Date();
    clearTimeout(p.timer.chiusura);
    p.timer.chiusura = undefined;
    this.dopoCambio(p);
    return ok({ ruolo: 'B' });
  }

  azione(codice: string, userId: string, azione: unknown): Esito {
    const p = this.partite.get(codice);
    if (!p) return no('Partita non trovata');
    const ruolo = this.ruoloDi(p, userId);
    if (!ruolo) return no('Non sei in questa partita');
    const rifiuta = (errore: string): Esito => {
      this.notificaUno(p, ruolo);
      return no(errore);
    };
    if (!p.stato) return rifiuta('La partita non è ancora iniziata');
    if (p.stato.esito) return rifiuta('La partita è terminata');
    if (p.inPausa) return rifiuta('Partita in pausa');
    if (!azione || typeof azione !== 'object' || typeof (azione as { tipo?: unknown }).tipo !== 'string') {
      return rifiuta('Azione non valida');
    }
    // `applica` può ancora lanciare su input imprevisti (minor aperto del piano 1A): lo stato resta quello di prima.
    let r: ReturnType<typeof applica>;
    try {
      r = applica(p.stato, ruolo, azione as Azione);
    } catch (e) {
      console.error(`Partita ${p.codice}: applica ha lanciato ${(e as Error).message}`);
      return rifiuta('Mossa non applicabile');
    }
    if (!r.ok) return rifiuta(r.errore);
    p.stato = r.stato;
    p.log.push({ t: new Date(), giocatore: ruolo, azione });
    this.dopoCambio(p);
    return ok(undefined);
  }

  arrenditi(codice: string, userId: string): Esito {
    const p = this.partite.get(codice);
    if (!p) return no('Partita non trovata');
    const ruolo = this.ruoloDi(p, userId);
    if (!ruolo) return no('Non sei in questa partita');
    if (!p.stato) {
      this.rimuovi(p);
      return ok(undefined);
    }
    if (p.stato.esito) return no('La partita è terminata');
    p.stato = arrendi(p.stato, ruolo);
    p.log.push({ t: new Date(), giocatore: ruolo, azione: { tipo: 'arrenditi' } });
    this.dopoCambio(p);
    return ok(undefined);
  }

  aggiornamentoPer(codice: string, userId: string): Aggiornamento | null {
    const p = this.partite.get(codice);
    if (!p) return null;
    const ruolo = this.ruoloDi(p, userId);
    return ruolo ? this.aggiornamento(p, ruolo) : null;
  }

  connesso(_codice: string, _userId: string): void {}
  disconnesso(_codice: string, _userId: string): void {}

  chiudi(): void {
    for (const p of this.partite.values()) this.fermaTimer(p);
    this.partite.clear();
  }

  // --- interni ---

  private ruoloDi(p: Partita, userId: string): PlayerId | null {
    if (p.posti.A?.userId === userId) return 'A';
    if (p.posti.B?.userId === userId) return 'B';
    return null;
  }

  private statoTavolo(p: Partita): StatoTavolo {
    if (!p.stato) return 'attesa';
    if (p.stato.esito) return 'terminata';
    return p.inPausa ? 'pausa' : 'inCorso';
  }

  private aggiornamento(p: Partita, ruolo: PlayerId): Aggiornamento {
    const avv = p.posti[ruolo === 'A' ? 'B' : 'A'];
    const giocabile = p.stato && !p.stato.esito && !p.inPausa;
    return {
      codice: p.codice,
      statoTavolo: this.statoTavolo(p),
      ruolo,
      avversario: avv?.username ?? null,
      vista: p.stato ? vista(p.stato, ruolo) : null,
      mosse: giocabile ? mosseLegali(p.stato!, ruolo) : [],
      scadenzaFinestra: p.stato && giocabile && chiDeveAgire(p.stato) === ruolo ? p.scadenzaFinestra : null,
    };
  }

  private notificaUno(p: Partita, ruolo: PlayerId): void {
    const posto = p.posti[ruolo];
    if (posto) this.o.notifica(posto.userId, this.aggiornamento(p, ruolo));
  }

  protected notificaTutti(p: Partita): void {
    this.notificaUno(p, 'A');
    this.notificaUno(p, 'B');
  }

  /** Dopo ogni cambio di stato: timer della finestra, fine partita, notifiche. */
  protected dopoCambio(p: Partita): void {
    this.programmaFinestra(p);
    if (p.stato?.esito && !p.salvata) this.termina(p, { vincitore: p.stato.esito.vincitore, motivo: p.stato.esito.motivo });
    this.notificaTutti(p);
  }

  protected programmaFinestra(p: Partita): void {
    clearTimeout(p.timer.finestra);
    p.timer.finestra = undefined;
    p.scadenzaFinestra = null;
  }

  private termina(p: Partita, esito: PartitaSalvata['esito']): void {
    this.fermaTimer(p);
    p.salvata = true;
    const salvata: PartitaSalvata = {
      codice: p.codice,
      giocatori: (['A', 'B'] as PlayerId[]).map((ruolo) => {
        const g = p.posti[ruolo]!;
        return { ruolo, userId: g.userId, username: g.username, deckId: g.deckId };
      }),
      mazzi: { A: p.posti.A!.mazzo, B: p.posti.B!.mazzo },
      seed: p.seed,
      versioneRegolamento: VERSIONE_REGOLAMENTO,
      versioneScript: VERSIONE_SCRIPT,
      esito,
      durata: Date.now() - p.iniziata!.getTime(),
      round: p.stato!.round,
      log: p.log,
      iniziata: p.iniziata!,
    };
    this.o.salva(salvata).catch((e: Error) => {
      // Il salvataggio non deve far cadere il processo: la partita resta giocata, si perde solo il registro.
      console.error(`Salvataggio partita ${p.codice} fallito: ${e.message}`);
    });
    p.timer.pulizia = setTimeout(() => this.rimuovi(p), PULIZIA_MS);
  }

  protected chiudiSenzaEsito(p: Partita): void {
    if (p.stato && !p.salvata) {
      p.log.push({ t: new Date(), giocatore: 'server', azione: { tipo: 'chiusa' } });
      this.termina(p, { vincitore: null, motivo: 'chiusa' });
    }
    this.rimuovi(p);
  }

  protected fermaTimer(p: Partita): void {
    for (const t of Object.values(p.timer)) clearTimeout(t);
    p.timer = {};
  }

  protected rimuovi(p: Partita): void {
    this.fermaTimer(p);
    this.partite.delete(p.codice);
  }
}
```

Nota per l'implementatore: in `chiudiSenzaEsito` di una partita iniziata, `termina` programma la pulizia e subito dopo `rimuovi` la cancella; è voluto (dopo 24 ore di assenza non serve mostrare l'esito a nessuno).

- [ ] **Step 4: Eseguire i test e vederli passare**

Run: `cd backend && npx jest tests/match/partite.test.ts && npx tsc --noEmit`
Expected: PASS. Se il test "partita giocata fino in fondo" non arriva a un esito in 500 passi va bene (l'asserzione è condizionata): verifica solo che nessuna mossa legale sia rifiutata.

- [ ] **Step 5: Commit**

```bash
git add backend/game/partite.ts backend/tests/match/partite.test.ts
git commit -m "feat(match): GestorePartite con inviti monouso, mosse validate dal motore e salvataggio a fine partita"
```

---

### Task 3: Timer: finestra di risposta, pausa, chiusura

**Files:**
- Modify: `backend/game/partite.ts` (metodi `connesso`, `disconnesso`, `programmaFinestra`)
- Test: `backend/tests/match/timer.test.ts`

**Interfaces:**
- Consumes: `GestorePartite` del Task 2, `PAUSA_MS`, `CHIUSURA_MS`, `PULIZIA_MS`.
- Produces: `connesso(codice, userId)` e `disconnesso(codice, userId)` contano le connessioni per posto (più schede dello stesso utente = più connessioni). Usati dal Task 4.

- [ ] **Step 1: Scrivere i test che falliscono**

`backend/tests/match/timer.test.ts`:

```ts
import { GestorePartite, Aggiornamento, PartitaSalvata, PAUSA_MS, CHIUSURA_MS, PULIZIA_MS } from '../../game/partite';
import { catalogoProva, mazzoProva } from '../game/helpers';

const A = { userId: 'u1', username: 'alice' };
const B = { userId: 'u2', username: 'bob' };

function avviata(timeoutFinestraMs = 20000) {
  const salvate: PartitaSalvata[] = [];
  const notifiche: { userId: string; a: Aggiornamento }[] = [];
  const g = new GestorePartite({
    salva: async (p) => { salvate.push(p); },
    notifica: (userId, a) => notifiche.push({ userId, a }),
    seed: () => 42,
    codice: () => 'COD',
    timeoutFinestraMs,
  });
  g.crea(A, 'd1', mazzoProva(), catalogoProva());
  g.entra('COD', B, 'd2', mazzoProva());
  g.connesso('COD', 'u1');
  g.connesso('COD', 'u2');
  return { g, salvate, notifiche };
}

/** Gioca mosse legali (mai `passa`) finché non si apre una finestra di risposta. */
function finoAFinestra(g: GestorePartite): 'u1' | 'u2' {
  for (let i = 0; i < 2000; i++) {
    for (const u of ['u1', 'u2'] as const) {
      const ag = g.aggiornamentoPer('COD', u)!;
      if (!ag.mosse.length) continue;
      if (ag.vista!.finestra && !ag.vista!.decisione) return u;
      const m = ag.mosse.find((x) => x.tipo === 'giocaCarta') ?? ag.mosse[0];
      g.azione('COD', u, m);
    }
  }
  throw new Error('nessuna finestra di risposta in 2000 passi');
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('timer delle partite', () => {
  test('finestra di risposta: dopo il timeout parte un passa automatico, registrato come server', () => {
    const { g } = avviata();
    const chi = finoAFinestra(g);
    const ag = g.aggiornamentoPer('COD', chi)!;
    expect(ag.scadenzaFinestra).toBe(Date.now() + 20000);
    const prima = ag.vista;
    jest.advanceTimersByTime(19999);
    expect(g.aggiornamentoPer('COD', chi)!.vista).toEqual(prima);
    jest.advanceTimersByTime(1);
    expect(g.aggiornamentoPer('COD', chi)!.vista).not.toEqual(prima);
    g.chiudi();
  });

  test('una mossa tardiva dopo il passa automatico viene rifiutata e la vista rimandata', () => {
    const { g, notifiche } = avviata();
    const chi = finoAFinestra(g);
    const mossaTardiva = g.aggiornamentoPer('COD', chi)!.mosse.find((m) => m.tipo === 'giocaCarta') ?? { tipo: 'passa' as const };
    jest.advanceTimersByTime(20000);
    const ancoraLui = g.aggiornamentoPer('COD', chi)!.mosse.length > 0;
    if (!ancoraLui) {
      const prima = notifiche.length;
      const r = g.azione('COD', chi, mossaTardiva);
      expect(r.ok).toBe(false);
      expect(notifiche.at(-1)!.userId).toBe(chi);
      expect(notifiche.length).toBe(prima + 1);
    }
    g.chiudi();
  });

  test('una mossa entro il timeout annulla il timer', () => {
    const { g } = avviata();
    const chi = finoAFinestra(g);
    jest.advanceTimersByTime(10000);
    g.azione('COD', chi, { tipo: 'passa' });
    const dopoPassa = g.aggiornamentoPer('COD', chi)!.vista;
    // Il vecchio timer sarebbe scattato a 20000; un eventuale nuovo timer scatta a 30000.
    jest.advanceTimersByTime(10001);
    expect(g.aggiornamentoPer('COD', chi)!.vista).toEqual(dopoPassa);
    g.chiudi();
  });

  test('due schede: chiuderne una non conta come assenza', () => {
    const { g } = avviata();
    g.connesso('COD', 'u1');
    g.disconnesso('COD', 'u1');
    jest.advanceTimersByTime(PAUSA_MS + 1);
    expect(g.aggiornamentoPer('COD', 'u1')!.statoTavolo).toBe('inCorso');
    g.chiudi();
  });

  test('assente 10 minuti: pausa, mosse rifiutate; al rientro la partita riprende', () => {
    const { g } = avviata();
    g.disconnesso('COD', 'u2');
    jest.advanceTimersByTime(PAUSA_MS - 1);
    expect(g.aggiornamentoPer('COD', 'u1')!.statoTavolo).toBe('inCorso');
    jest.advanceTimersByTime(1);
    expect(g.aggiornamentoPer('COD', 'u1')!.statoTavolo).toBe('pausa');
    expect(g.aggiornamentoPer('COD', 'u1')!.mosse).toEqual([]);
    expect(g.azione('COD', 'u1', { tipo: 'passaTurno' })).toEqual({ ok: false, errore: 'Partita in pausa' });
    g.connesso('COD', 'u2');
    expect(g.aggiornamentoPer('COD', 'u1')!.statoTavolo).toBe('inCorso');
    g.chiudi();
  });

  test('assente 24 ore: chiusa senza esito e salvata', async () => {
    const { g, salvate } = avviata();
    g.disconnesso('COD', 'u2');
    jest.advanceTimersByTime(CHIUSURA_MS);
    await Promise.resolve();
    expect(salvate).toHaveLength(1);
    expect(salvate[0].esito).toEqual({ vincitore: null, motivo: 'chiusa' });
    expect(g.aggiornamentoPer('COD', 'u1')).toBeNull();
    g.chiudi();
  });

  test('partita finita: resta visibile 10 minuti, poi sparisce', () => {
    const { g } = avviata();
    g.arrenditi('COD', 'u1');
    jest.advanceTimersByTime(PULIZIA_MS - 1);
    expect(g.aggiornamentoPer('COD', 'u2')!.statoTavolo).toBe('terminata');
    jest.advanceTimersByTime(1);
    expect(g.aggiornamentoPer('COD', 'u2')).toBeNull();
    g.chiudi();
  });

  test('partita mai iniziata: sparisce dopo 24 ore senza salvataggio', async () => {
    const salvate: PartitaSalvata[] = [];
    const g = new GestorePartite({ salva: async (p) => { salvate.push(p); }, notifica: () => {}, codice: () => 'W' });
    g.crea(A, 'd1', mazzoProva(), catalogoProva());
    jest.advanceTimersByTime(CHIUSURA_MS);
    await Promise.resolve();
    expect(g.aggiornamentoPer('W', 'u1')).toBeNull();
    expect(salvate).toHaveLength(0);
    g.chiudi();
  });
});
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `cd backend && npx jest tests/match/timer.test.ts`
Expected: FAIL sui test di finestra (`scadenzaFinestra` è `null`), pausa e chiusura.

- [ ] **Step 3: Implementare i timer in `partite.ts`**

Sostituire i due metodi vuoti `connesso` / `disconnesso` e il corpo di `programmaFinestra` con:

```ts
  connesso(codice: string, userId: string): void {
    const p = this.partite.get(codice);
    if (!p) return;
    const ruolo = this.ruoloDi(p, userId);
    if (!ruolo) return;
    p.posti[ruolo]!.connessioni += 1;
    if (this.tuttiPresenti(p)) {
      clearTimeout(p.timer.pausa);
      p.timer.pausa = undefined;
      if (p.stato && !p.stato.esito) {
        clearTimeout(p.timer.chiusura);
        p.timer.chiusura = undefined;
      }
      if (p.inPausa) {
        p.inPausa = false;
        this.programmaFinestra(p);
        this.notificaTutti(p);
      }
    }
  }

  disconnesso(codice: string, userId: string): void {
    const p = this.partite.get(codice);
    if (!p) return;
    const ruolo = this.ruoloDi(p, userId);
    if (!ruolo) return;
    const posto = p.posti[ruolo]!;
    posto.connessioni = Math.max(0, posto.connessioni - 1);
    if (posto.connessioni > 0 || !p.stato || p.stato.esito) return;
    if (!p.timer.pausa) {
      p.timer.pausa = setTimeout(() => {
        p.timer.pausa = undefined;
        p.inPausa = true;
        this.programmaFinestra(p);
        this.notificaTutti(p);
      }, PAUSA_MS);
    }
    if (!p.timer.chiusura) p.timer.chiusura = setTimeout(() => this.chiudiSenzaEsito(p), CHIUSURA_MS);
  }

  private tuttiPresenti(p: Partita): boolean {
    return (['A', 'B'] as PlayerId[]).every((r) => !p.posti[r] || p.posti[r]!.connessioni > 0);
  }
```

e

```ts
  protected programmaFinestra(p: Partita): void {
    clearTimeout(p.timer.finestra);
    p.timer.finestra = undefined;
    p.scadenzaFinestra = null;
    const s = p.stato;
    if (!s || s.esito || p.inPausa || !s.finestra || s.decisione) return;
    const chi = chiDeveAgire(s);
    if (!chi) return;
    p.scadenzaFinestra = Date.now() + this.o.timeoutFinestraMs;
    p.timer.finestra = setTimeout(() => {
      p.timer.finestra = undefined;
      if (!p.stato || chiDeveAgire(p.stato) !== chi || !p.stato.finestra) return;
      let r: ReturnType<typeof applica>;
      try {
        r = applica(p.stato, chi, { tipo: 'passa' });
      } catch {
        return;
      }
      if (!r.ok) return;
      p.stato = r.stato;
      p.log.push({ t: new Date(), giocatore: 'server', azione: { tipo: 'passa', per: chi, motivo: 'timeout' } });
      this.dopoCambio(p);
    }, this.o.timeoutFinestraMs);
  }
```

Nota: `p.stato.decisione` ha la precedenza sulla finestra in `chiDeveAgire`, per questo il timer parte solo senza decisione aperta.

- [ ] **Step 4: Eseguire i test e vederli passare**

Run: `cd backend && npx jest tests/match && npx tsc --noEmit`
Expected: PASS su `catalogo`, `partite`, `timer`.

- [ ] **Step 5: Commit**

```bash
git add backend/game/partite.ts backend/tests/match/timer.test.ts
git commit -m "feat(match): passa automatico a 20 secondi, pausa dopo 10 minuti di assenza, chiusura a 24 ore"
```

---

### Task 4: Server Socket.IO

**Files:**
- Create: `backend/game/socket.ts`
- Modify: `backend/index.ts:34` (avvio con `http.createServer`)
- Modify: `backend/app.ts:59` (`export const allowedOrigins`)
- Modify: `backend/package.json` (dipendenze)
- Test: `backend/tests/match/socket.test.ts`

**Interfaces:**
- Consumes: `GestorePartite`, `Aggiornamento`, `PartitaSalvata` (Task 2-3); `caricaCatalogo`, `mazzoDaDeck` (Task 1); `Match` (Task 1); `User`, `Deck` da `backend/models/`.
- Produces: `initSocket(server: http.Server, opzioni?: { caricaCatalogo?: () => Promise<Record<number, DefCarta>>; gestore?: GestorePartite }): { io: Server; gestore: GestorePartite }`.
- Protocollo (usato da Task 6):

| Evento client → server | Payload | Ack |
|---|---|---|
| `partita:crea` | `{ deckId: string }` | `{ ok: true, codice } \| { ok: false, errore }` |
| `partita:entra` | `{ codice: string, deckId?: string }` | `{ ok: true, ruolo } \| { ok: false, errore }` |
| `partita:azione` | `{ codice: string, azione: Azione }` | `{ ok: true } \| { ok: false, errore }` |
| `partita:arrenditi` | `{ codice: string }` | `{ ok: true } \| { ok: false, errore }` |
| `partita:mie` | `{}` | `{ ok: true, codici: string[] }` |

| Evento server → client | Payload |
|---|---|
| `partita:aggiornamento` | `Aggiornamento` |

Ogni socket entra nella stanza `utente:<userId>`; il gestore notifica per utente, quindi tutte le schede dello stesso utente ricevono la vista. Un socket che ha fatto `partita:entra` su un codice è contato come connessione a quella partita fino alla disconnessione.

- [ ] **Step 1: Installare le dipendenze**

```bash
cd backend
npm install socket.io@4.8.1
npm install --save-dev socket.io-client@4.8.1
```

- [ ] **Step 2: Scrivere i test che falliscono**

`backend/tests/match/socket.test.ts`:

```ts
import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { io as connetti, Socket } from 'socket.io-client';
import { connectTestDB, closeTestDB, clearDatabase } from '../setup';
import app from '../../app';
import User from '../../models/User';
import Deck from '../../models/Deck';
import Match from '../../models/Match';
import { initSocket } from '../../game/socket';
import { catalogoProva } from '../game/helpers';
import type { Aggiornamento } from '../../game/partite';

let server: http.Server;
let url: string;
let chiudi: () => void;
const aperti: Socket[] = [];

async function utente(username: string) {
  const u = await User.create({
    username, usernameDisplay: username, email: `${username}@example.test`, password: 'Password123!',
    isVerified: true, privacyAccepted: true,
  });
  const token = jwt.sign({ id: u._id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((cardId) => ({ cardId, count: 3 }));
  cards.push({ cardId: 14, count: 1 });
  const deck = await Deck.create({ name: 'Prova', creator: username, cards, costruttoreId: 100 });
  return { id: String(u._id), token, deckId: String(deck._id) };
}

function socket(token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connetti(url, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
    aperti.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const emetti = <T = { ok: boolean; errore?: string; codice?: string; ruolo?: string }>(s: Socket, ev: string, dati: unknown) =>
  new Promise<T>((resolve) => s.emit(ev, dati, resolve));

const prossimo = (s: Socket) => new Promise<Aggiornamento>((resolve) => s.once('partita:aggiornamento', resolve));

beforeAll(async () => {
  await connectTestDB();
  server = http.createServer(app);
  const r = initSocket(server, { caricaCatalogo: async () => catalogoProva() });
  chiudi = () => { r.gestore.chiudi(); r.io.close(); };
  await new Promise<void>((res) => server.listen(0, res));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  aperti.splice(0).forEach((s) => s.disconnect());
  await clearDatabase();
});

afterAll(async () => {
  chiudi();
  await new Promise((res) => server.close(res));
  await closeTestDB();
});

async function partitaIniziata() {
  const a = await utente('alice');
  const b = await utente('bob');
  const sa = await socket(a.token);
  const sb = await socket(b.token);
  const crea = await emetti(sa, 'partita:crea', { deckId: a.deckId });
  expect(crea.ok).toBe(true);
  const codice = crea.codice!;
  const [agA, agB] = await Promise.all([prossimo(sa), prossimo(sb), emetti(sb, 'partita:entra', { codice, deckId: b.deckId })]);
  return { a, b, sa, sb, codice, agA, agB };
}

describe('socket delle partite', () => {
  test('senza token la connessione è rifiutata', async () => {
    await expect(socket()).rejects.toThrow('Non autenticato');
  });

  test('con token di un utente inesistente la connessione è rifiutata', async () => {
    const token = jwt.sign({ id: '64b000000000000000000000' }, process.env.JWT_SECRET as string);
    await expect(socket(token)).rejects.toThrow('Non autenticato');
  });

  test('crea, invito, partita avviata: ognuno riceve solo la propria vista', async () => {
    const { agA, agB } = await partitaIniziata();
    expect(agA).toMatchObject({ statoTavolo: 'inCorso', ruolo: 'A', avversario: 'bob' });
    expect(agB).toMatchObject({ statoTavolo: 'inCorso', ruolo: 'B', avversario: 'alice' });
    expect(agA.vista!.giocatori.B.mano).toBeNull();
    const testo = JSON.stringify([agA, agB]);
    expect(testo).not.toContain('"rng"');
    expect(testo).not.toContain('"tpSpostamento"');
  });

  test('mazzo di un altro utente: rifiutato', async () => {
    const a = await utente('alice');
    const b = await utente('bob');
    const sa = await socket(a.token);
    expect(await emetti(sa, 'partita:crea', { deckId: b.deckId })).toEqual({ ok: false, errore: 'Mazzo non trovato' });
  });

  test('mazzo cancellato dopo la creazione: la partita usa la copia presa alla creazione', async () => {
    const a = await utente('alice');
    const b = await utente('bob');
    const sa = await socket(a.token);
    const sb = await socket(b.token);
    const { codice } = await emetti(sa, 'partita:crea', { deckId: a.deckId });
    await Deck.deleteOne({ _id: a.deckId });
    const r = await emetti(sb, 'partita:entra', { codice, deckId: b.deckId });
    expect(r).toEqual({ ok: true, ruolo: 'B' });
  });

  test('un terzo utente con il codice non entra e non riceve viste', async () => {
    const { codice } = await partitaIniziata();
    const c = await utente('carlo');
    const sc = await socket(c.token);
    let ricevuto = false;
    sc.on('partita:aggiornamento', () => { ricevuto = true; });
    expect(await emetti(sc, 'partita:entra', { codice, deckId: c.deckId })).toEqual({ ok: false, errore: 'La partita è già al completo' });
    expect(await emetti(sc, 'partita:azione', { codice, azione: { tipo: 'passa' } })).toEqual({ ok: false, errore: 'Non sei in questa partita' });
    await new Promise((r) => setTimeout(r, 100));
    expect(ricevuto).toBe(false);
  });

  test('mossa illegale: errore nell ack e vista rimandata al mittente', async () => {
    const { sa, sb, codice, agA } = await partitaIniziata();
    const [chi, s] = agA.mosse.length ? (['A', sb] as const) : (['B', sa] as const);
    const vista = prossimo(s);
    const r = await emetti(s, 'partita:azione', { codice, azione: { tipo: 'passa' } });
    expect(r).toEqual({ ok: false, errore: 'Non tocca a te' });
    expect((await vista).ruolo).not.toBe(chi);
  });

  test.each([
    ['payload assente', undefined],
    ['codice numerico', { codice: 42, azione: { tipo: 'passa' } }],
    ['azione stringa', { codice: 'X', azione: 'passa' }],
  ])('payload malformato (%s): errore nell ack, il server resta in piedi', async (_n, dati) => {
    const a = await utente('alice');
    const sa = await socket(a.token);
    const r = await emetti(sa, 'partita:azione', dati);
    expect(r.ok).toBe(false);
    expect(await emetti(sa, 'partita:mie', {})).toEqual({ ok: true, codici: [] });
  });

  test('ack mancante: il server non va in eccezione', async () => {
    const a = await utente('alice');
    const sa = await socket(a.token);
    sa.emit('partita:crea', { deckId: a.deckId });
    expect(await emetti(sa, 'partita:mie', {})).toMatchObject({ ok: true });
  });

  test('riconnessione: chi rientra riceve la vista corrente', async () => {
    const { a, sa, codice } = await partitaIniziata();
    sa.disconnect();
    const sa2 = await socket(a.token);
    const ag = prossimo(sa2);
    expect(await emetti(sa2, 'partita:entra', { codice })).toEqual({ ok: true, ruolo: 'A' });
    expect((await ag).statoTavolo).toBe('inCorso');
    expect(await emetti(sa2, 'partita:mie', {})).toEqual({ ok: true, codici: [codice] });
  });

  test('due schede dello stesso utente ricevono entrambe la vista', async () => {
    const { a, b, sb, codice } = await partitaIniziata();
    const sa2 = await socket(a.token);
    await emetti(sa2, 'partita:entra', { codice });
    const agSb = prossimo(sb);
    const agSa2 = prossimo(sa2);
    await emetti(sb, 'partita:arrenditi', { codice });
    expect((await agSa2).statoTavolo).toBe('terminata');
    expect((await agSb).statoTavolo).toBe('terminata');
    void b;
  });

  test('a fine partita il Match viene salvato con seed, mazzi e log', async () => {
    const { a, sa, codice } = await partitaIniziata();
    await emetti(sa, 'partita:arrenditi', { codice });
    await new Promise((r) => setTimeout(r, 200));
    const m = await Match.findOne({ codice }).lean();
    expect(m).not.toBeNull();
    expect(m!.esito).toEqual({ vincitore: 'B', motivo: 'abbandono' });
    expect(m!.giocatori.find((g) => g.ruolo === 'A')!.userId).toBe(a.id);
    expect(m!.mazzi.A.carte).toHaveLength(40);
    expect(m!.log.length).toBeGreaterThan(0);
  });
});
```

Nota: se `User.create` richiede altri campi obbligatori, copiarli da `backend/tests/deck.test.ts`, che crea già utenti di prova.

- [ ] **Step 3: Eseguire i test e vederli fallire**

Run: `cd backend && npx jest tests/match/socket.test.ts`
Expected: FAIL, `Cannot find module '../../game/socket'`.

- [ ] **Step 4: Scrivere `socket.ts`**

`backend/game/socket.ts`:

```ts
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server, Socket } from 'socket.io';
import { allowedOrigins } from '../app';
import logger from '../config/logger';
import Deck from '../models/Deck';
import Match from '../models/Match';
import User from '../models/User';
import { caricaCatalogo as caricaCatalogoDb, mazzoDaDeck } from './catalogo';
import { DefCarta, Mazzo } from './engine';
import { GestorePartite, PartitaSalvata } from './partite';

interface DatiSocket { userId: string; username: string; partite: Set<string> }
type Ack = (r: unknown) => void;

export function initSocket(
  server: http.Server,
  opzioni: { caricaCatalogo?: () => Promise<Record<number, DefCarta>>; gestore?: GestorePartite } = {},
): { io: Server; gestore: GestorePartite } {
  const caricaCatalogo = opzioni.caricaCatalogo ?? caricaCatalogoDb;
  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    maxHttpBufferSize: 16 * 1024,
  });

  const gestore = opzioni.gestore ?? new GestorePartite({
    salva: async (p: PartitaSalvata) => { await Match.create(p); },
    notifica: (userId, a) => { io.to(`utente:${userId}`).emit('partita:aggiornamento', a); },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !process.env.JWT_SECRET) return next(new Error('Non autenticato'));
      const { id } = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
      if (!mongoose.isValidObjectId(id)) return next(new Error('Non autenticato'));
      const user = await User.findById(id).select('username');
      if (!user) return next(new Error('Non autenticato'));
      const dati: DatiSocket = { userId: String(user._id), username: user.username, partite: new Set() };
      socket.data = dati;
      return next();
    } catch {
      return next(new Error('Non autenticato'));
    }
  });

  async function mazzoDi(username: string, deckId: unknown): Promise<Mazzo | string> {
    if (typeof deckId !== 'string' || !mongoose.isValidObjectId(deckId)) return 'Mazzo non trovato';
    const deck = await Deck.findOne({ _id: deckId, creator: username.toLowerCase() }).lean();
    if (!deck) return 'Mazzo non trovato';
    return mazzoDaDeck(deck);
  }

  /** Avvolge un gestore di evento: payload sempre oggetto, ack sempre funzione, nessuna eccezione esce. */
  const evento = (socket: Socket, nome: string, fn: (d: Record<string, unknown>, s: DatiSocket) => Promise<unknown> | unknown) => {
    socket.on(nome, async (dati: unknown, ack?: unknown) => {
      const rispondi: Ack = typeof ack === 'function' ? (ack as Ack) : () => {};
      try {
        const d = dati && typeof dati === 'object' ? (dati as Record<string, unknown>) : {};
        rispondi(await fn(d, socket.data as DatiSocket));
      } catch (e) {
        logger.error(`MATCH_SOCKET: ${nome} fallito: ${(e as Error).message}`);
        rispondi({ ok: false, errore: 'Errore del server' });
      }
    });
  };

  io.on('connection', (socket) => {
    const s = socket.data as DatiSocket;
    socket.join(`utente:${s.userId}`);
    const utente = { userId: s.userId, username: s.username };

    const segui = (codice: string) => {
      if (s.partite.has(codice)) return;
      s.partite.add(codice);
      gestore.connesso(codice, s.userId);
    };

    evento(socket, 'partita:crea', async (d) => {
      const mazzo = await mazzoDi(s.username, d.deckId);
      if (typeof mazzo === 'string') return { ok: false, errore: mazzo };
      const r = gestore.crea(utente, d.deckId as string, mazzo, await caricaCatalogo());
      if (!r.ok) return r;
      segui(r.valore.codice);
      socket.emit('partita:aggiornamento', gestore.aggiornamentoPer(r.valore.codice, s.userId));
      return { ok: true, codice: r.valore.codice };
    });

    evento(socket, 'partita:entra', async (d) => {
      if (typeof d.codice !== 'string') return { ok: false, errore: 'Codice non valido' };
      const codice = d.codice;
      let mazzo: Mazzo | undefined;
      if (!gestore.aggiornamentoPer(codice, s.userId) && d.deckId !== undefined) {
        const m = await mazzoDi(s.username, d.deckId);
        if (typeof m === 'string') return { ok: false, errore: m };
        mazzo = m;
      }
      const r = gestore.entra(codice, utente, d.deckId as string | undefined, mazzo);
      if (!r.ok) return r;
      segui(codice);
      socket.emit('partita:aggiornamento', gestore.aggiornamentoPer(codice, s.userId));
      return { ok: true, ruolo: r.valore.ruolo };
    });

    evento(socket, 'partita:azione', (d) => {
      if (typeof d.codice !== 'string') return { ok: false, errore: 'Codice non valido' };
      const r = gestore.azione(d.codice, s.userId, d.azione);
      return r.ok ? { ok: true } : r;
    });

    evento(socket, 'partita:arrenditi', (d) => {
      if (typeof d.codice !== 'string') return { ok: false, errore: 'Codice non valido' };
      const r = gestore.arrenditi(d.codice, s.userId);
      return r.ok ? { ok: true } : r;
    });

    evento(socket, 'partita:mie', () => ({ ok: true, codici: gestore.partiteDi(s.userId) }));

    socket.on('disconnect', () => {
      for (const codice of s.partite) gestore.disconnesso(codice, s.userId);
    });
  });

  return { io, gestore };
}
```

Nota sul `crea`: il creatore riceve subito un aggiornamento con `statoTavolo: 'attesa'`; quando B entra, il gestore notifica entrambi. Nella `partita:entra` di B il server emette anche un aggiornamento diretto al socket: è un doppione innocuo per B (stesso contenuto) e serve a chi rientra dopo una riconnessione.

- [ ] **Step 5: Esportare `allowedOrigins` e avviare Socket.IO in `index.ts`**

In `backend/app.ts` riga 59 cambiare `const allowedOrigins = [` in `export const allowedOrigins = [`.

In `backend/index.ts` aggiungere gli import e sostituire il blocco "4. Activate Application Portal":

```ts
import http from 'http';
import { initSocket } from './game/socket';
```

```ts
    // 4. Activate Application Portal (HTTP + Socket.IO sullo stesso server)
    const server = http.createServer(app);
    initSocket(server);
    server.listen(PORT, () => {
      logger.info(`VIGIL_SYSTEM: Node operational on frequency ${PORT} in ${process.env.NODE_ENV} mode.`);
    });
```

- [ ] **Step 6: Eseguire i test e vederli passare**

Run: `cd backend && npx jest tests/match && npx tsc --noEmit && npm test`
Expected: PASS ovunque. Se `npm test` segnala open handle dal socket, controllare che `afterAll` chiami `chiudi()` prima di `server.close`.

- [ ] **Step 7: Commit**

```bash
git add backend/game/socket.ts backend/index.ts backend/app.ts backend/package.json backend/package-lock.json backend/tests/match/socket.test.ts
git commit -m "feat(match): server Socket.IO autenticato con JWT, eventi di partita e salvataggio del Match"
```

---

### Task 5: Partite nell'export GDPR, nella cancellazione e nella ritenzione

**Files:**
- Create: `backend/game/privacyMatch.ts`
- Modify: `backend/controllers/exportController.ts` (`exportUserData`, riga 19)
- Modify: `backend/controllers/authController.ts` (`deleteAccount`, righe 173-183)
- Modify: `backend/tasks/retentionTask.ts` (`purgeInactiveAccounts`, righe 66-69)
- Modify: `frontend/src/views/PrivacyView.vue` (paragrafo sulle partite)
- Test: `backend/tests/match/privacy.test.ts`

**Interfaces:**
- Consumes: `Match` (Task 1).
- Produces: `partiteDaEsportare(userId: string): Promise<Array<{ data: Date; ruolo: PlayerId; avversario: string | null; esito: { vincitore: PlayerId | null; motivo: string }; round: number; durata: number; mazzo: Mazzo }>>`, `anonimizzaPartite(userId: string): Promise<number>`.

- [ ] **Step 1: Scrivere i test che falliscono**

`backend/tests/match/privacy.test.ts`:

```ts
import { connectTestDB, closeTestDB, clearDatabase } from '../setup';
import Match from '../../models/Match';
import { anonimizzaPartite, partiteDaEsportare } from '../../game/privacyMatch';
import { mazzoProva } from '../game/helpers';

beforeAll(connectTestDB);
afterAll(closeTestDB);
beforeEach(clearDatabase);

async function partita() {
  return Match.create({
    codice: 'C1',
    giocatori: [
      { ruolo: 'A', userId: 'u1', username: 'alice', deckId: 'd1' },
      { ruolo: 'B', userId: 'u2', username: 'bob', deckId: 'd2' },
    ],
    mazzi: { A: mazzoProva(), B: mazzoProva() },
    seed: 1, versioneRegolamento: '6.0', versioneScript: 'abcdef012345',
    esito: { vincitore: 'B', motivo: 'collasso' }, durata: 1000, round: 7,
    log: [{ t: new Date(), giocatore: 'A', azione: { tipo: 'passaTurno' } }],
    iniziata: new Date(),
  });
}

test('export: solo le partite dell utente, con il proprio mazzo e senza il log', async () => {
  await partita();
  const out = await partiteDaEsportare('u1');
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ ruolo: 'A', avversario: 'bob', esito: { vincitore: 'B' }, round: 7 });
  expect(out[0].mazzo.carte).toHaveLength(40);
  expect(JSON.stringify(out)).not.toContain('passaTurno');
  expect(await partiteDaEsportare('u9')).toEqual([]);
});

test('cancellazione: il giocatore viene anonimizzato, la partita resta per l avversario', async () => {
  await partita();
  expect(await anonimizzaPartite('u1')).toBe(1);
  const m = await Match.findOne({ codice: 'C1' }).lean();
  expect(m!.giocatori[0]).toMatchObject({ ruolo: 'A', userId: null, username: null });
  expect(m!.giocatori[1]).toMatchObject({ userId: 'u2', username: 'bob' });
  expect(await partiteDaEsportare('u2')).toHaveLength(1);
  expect((await partiteDaEsportare('u2'))[0].avversario).toBeNull();
});
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `cd backend && npx jest tests/match/privacy.test.ts`
Expected: FAIL, `Cannot find module '../../game/privacyMatch'`.

- [ ] **Step 3: Scrivere `privacyMatch.ts`**

`backend/game/privacyMatch.ts`:

```ts
import Match from '../models/Match';
import type { Mazzo, PlayerId } from './engine';

export async function partiteDaEsportare(userId: string) {
  const partite = await Match.find({ 'giocatori.userId': userId }).select('-log').sort({ createdAt: -1 }).lean();
  return partite.map((m) => {
    const io = m.giocatori.find((g) => g.userId === userId)!;
    const avv = m.giocatori.find((g) => g.ruolo !== io.ruolo);
    return {
      data: m.iniziata,
      ruolo: io.ruolo as PlayerId,
      avversario: avv?.username ?? null,
      esito: m.esito,
      round: m.round,
      durata: m.durata,
      mazzo: m.mazzi[io.ruolo as PlayerId] as Mazzo,
    };
  });
}

/** Le partite restano all'avversario: si toglie solo il legame con l'account cancellato. */
export async function anonimizzaPartite(userId: string): Promise<number> {
  const r = await Match.updateMany(
    { 'giocatori.userId': userId },
    { $set: { 'giocatori.$[g].userId': null, 'giocatori.$[g].username': null } },
    { arrayFilters: [{ 'g.userId': userId }] },
  );
  return r.modifiedCount;
}
```

- [ ] **Step 4: Collegare export, cancellazione e ritenzione**

In `backend/controllers/exportController.ts`, dentro `exportUserData`, aggiungere l'import `import { partiteDaEsportare } from '../game/privacyMatch';` e, accanto a `decks_count` e `decks` nell'oggetto `content`, i campi:

```ts
      matches_count: partite.length,
      matches: partite,
```

con `const partite = await partiteDaEsportare(String(user._id));` calcolato prima di costruire la risposta (usare la stessa variabile utente già presente nella funzione: leggere il file e adattare il nome se non è `user`).

In `backend/controllers/authController.ts`, in `deleteAccount`, subito prima di `User.deleteOne` / `findByIdAndDelete` (righe 173-183):

```ts
    await anonimizzaPartite(String(user._id));
```

con `import { anonimizzaPartite } from '../game/privacyMatch';`.

In `backend/tasks/retentionTask.ts`, in `purgeInactiveAccounts`, accanto alle altre cancellazioni (righe 66-69), con lo stesso id usato per `Message.deleteMany({ userId })`:

```ts
        await anonimizzaPartite(String(userId));
```

- [ ] **Step 5: Aggiungere il paragrafo all'informativa**

In `frontend/src/views/PrivacyView.vue`, nella sezione che elenca i dati trattati (cercare la sezione sui mazzi salvati; se non c'è, subito prima della sezione "8. Intelligenza Artificiale e Trasparenza"), aggiungere:

```html
      <h3>Partite online</h3>
      <p>
        Quando giochi una partita online registriamo il tuo nome utente, il mazzo usato, le mosse
        della partita e il risultato. Servono a far funzionare la partita e a studiare il bilanciamento
        delle carte. Le partite compaiono nell'export dei tuoi dati. Se cancelli l'account, il tuo nome
        viene tolto dalle partite giocate, che restano in forma anonima perché appartengono anche al tuo
        avversario.
      </p>
```

Simone rilegge il testo prima del merge su main (voce nel Task 10).

- [ ] **Step 6: Eseguire i test e vederli passare**

Run: `cd backend && npx jest tests/match && npx tsc --noEmit && npm test`
Expected: PASS ovunque, compresi i test esistenti di auth ed export.

- [ ] **Step 7: Commit**

```bash
git add backend/game/privacyMatch.ts backend/controllers/exportController.ts backend/controllers/authController.ts backend/tasks/retentionTask.ts backend/tests/match/privacy.test.ts frontend/src/views/PrivacyView.vue
git commit -m "feat(match): partite nell'export GDPR, anonimizzate alla cancellazione dell'account"
```

---

### Task 6: matchStore e instradamento

**Files:**
- Modify: `frontend/package.json` (dipendenza)
- Create: `frontend/src/stores/matchStore.ts`
- Create: `frontend/src/types/match.ts`
- Modify: `frontend/src/router/index.ts` (rotte)
- Modify: `frontend/src/stores/auth.ts:58` (`isProtectedPath`)
- Modify: `frontend/vite.config.ts:108` (proxy `/socket.io` con `ws: true`)
- Modify: `frontend/nginx.conf` (location `/socket.io/` e allowlist SPA)
- Test: `frontend/src/stores/matchStore.spec.ts`

**Interfaces:**
- Consumes: protocollo socket del Task 4; `useAuthStore().token`.
- Produces: `frontend/src/types/match.ts` con copie lato client dei tipi `PlayerId`, `Colonna`, `Azione`, `AzioneBase`, `Vista`, `VistaCampo`, `VistaGiocatore`, `Aggiornamento` (stesse forme del backend, copiate a mano da `backend/game/engine/types.ts`, `vista.ts` e `backend/game/partite.ts`). Store:

```ts
useMatchStore(): {
  agg: Ref<Aggiornamento | null>;
  connesso: Ref<boolean>;
  errore: Ref<string | null>;
  selezionata: Ref<string | null>;            // uid della carta in mano selezionata
  vista: ComputedRef<Vista | null>;
  tocca: ComputedRef<boolean>;                // tocca a me
  mosseDi(uid: string): Azione[];             // mosse giocaCarta/scambio per quella carta
  colonneGiocabili: ComputedRef<Colonna[]>;   // per la carta selezionata
  connetti(): void;
  crea(deckId: string): Promise<string | null>;               // codice o null (errore in `errore`)
  entra(codice: string, deckId?: string): Promise<boolean>;
  invia(azione: Azione): Promise<boolean>;
  arrenditi(): Promise<boolean>;
  seleziona(uid: string | null): void;
  disconnetti(): void;
}
```

- [ ] **Step 1: Installare la dipendenza**

```bash
cd frontend
npm install socket.io-client@4.8.1
```

- [ ] **Step 2: Scrivere i tipi client**

`frontend/src/types/match.ts`:

```ts
// Copia lato client dei tipi del motore (backend/game/engine/types.ts, vista.ts) e del gestore
// (backend/game/partite.ts). Se cambiano lì, vanno aggiornati qui.
export type PlayerId = 'A' | 'B';
export type Colonna = 'passato' | 'presente' | 'futuro';
export type StatoMateria = 'Solido' | 'Liquido' | 'Gas' | 'Plasma' | 'Materia Oscura';
export type Durata = 'collisione' | 'round' | 'permanente';

export interface Carta { uid: string; cardId: number; owner: PlayerId }
export interface Modifica { stat: 'pep' | 'rp'; delta: number; durata: Durata }

export type AzioneBase =
  | { op: 'modifica'; uid: string; stat: 'pep' | 'rp'; delta: number; durata: Durata }
  | { op: 'cambiaStato'; uid: string; stato: StatoMateria | null }
  | { op: 'sposta'; uid: string; colonna: Colonna }
  | { op: 'segnalino'; uid: string; segnalino: 'caldo' | 'freddo' | null }
  | { op: 'tp'; delta: number }
  | { op: 'inversione'; volontaria: boolean }
  | { op: 'dannoIT'; bersaglio: PlayerId; valore: number }
  | { op: 'distruggi'; uid: string }
  | { op: 'pesca' }
  | { op: 'scarta'; uid: string }
  | { op: 'annulla'; uid: string };

export type Azione =
  | { tipo: 'sceltaIniziativa'; tieni: boolean }
  | { tipo: 'mulligan'; esegui: boolean }
  | { tipo: 'bonusControllo'; pesca: boolean }
  | { tipo: 'capienza'; distruggi: string }
  | { tipo: 'giocaCarta'; uid: string; colonna?: Colonna }
  | { tipo: 'scambio'; uid: string }
  | { tipo: 'passaTurno' }
  | { tipo: 'passa' }
  | { tipo: 'usaEffetto'; uid: string }
  | { tipo: 'base'; base: AzioneBase }
  | { tipo: 'fatto' };

export type Decisione =
  | { tipo: 'sceltaIniziativa'; giocatore: PlayerId }
  | { tipo: 'mulligan'; giocatore: PlayerId }
  | { tipo: 'bonusControllo'; giocatore: PlayerId }
  | { tipo: 'capienza'; giocatore: PlayerId; colonna: Colonna }
  | { tipo: 'effettoManuale'; giocatore: PlayerId; uid: string; origine: 'stack' | 'libero' };

export interface VistaCampo {
  uid: string; owner: PlayerId; coperta: boolean; cardId: number | null;
  segnalino: 'caldo' | 'freddo' | null; statoForzato: StatoMateria | null; modifiche: Modifica[];
}
export interface VistaStack { uid: string; cardId: number | null; controllore: PlayerId; annullata: boolean }
export interface VistaGiocatore {
  id: PlayerId; it: number; et: number; etMax: number; mano: Carta[] | null; carteInMano: number;
  carteFuturo: number; memoria: Carta[]; orizzonte: Carta[]; costruttore: Carta;
  supportoPep: number; supportoRp: number; scambioUsato: boolean; haPassato: boolean;
}
export interface Vista {
  io: PlayerId; round: number;
  fase: 'setup' | 'slittamento' | 'risorse' | 'azioni' | 'collisione' | 'fine' | 'terminata';
  flusso: 'normale' | 'invertito'; tp: number; iniziativa: PlayerId; attivo: PlayerId; tocca: PlayerId | null;
  anomalia: Carta | null; colonne: Record<Colonna, VistaCampo[]>; giocatori: Record<PlayerId, VistaGiocatore>;
  stack: VistaStack[];
  finestra: { contesto: 'giocata' | 'collisione'; priorita: PlayerId; passi: number; passiNecessari: number } | null;
  decisione: Decisione | null;
  esito: { vincitore: PlayerId | null; motivo: string } | null;
  log: { round: number; testo: string; soloPer?: PlayerId }[];
}
export interface Aggiornamento {
  codice: string; statoTavolo: 'attesa' | 'inCorso' | 'pausa' | 'terminata'; ruolo: PlayerId;
  avversario: string | null; vista: Vista | null; mosse: Azione[]; scadenzaFinestra: number | null;
}
```

- [ ] **Step 3: Scrivere il test dello store che fallisce**

`frontend/src/stores/matchStore.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const handlers: Record<string, ( ...a: unknown[] ) => void> = {}
const emit = vi.fn()
const fakeSocket = {
  on: vi.fn( ( ev: string, fn: ( ...a: unknown[] ) => void ) => { handlers[ev] = fn } ),
  emit,
  disconnect: vi.fn(),
  connected: true,
}
vi.mock( 'socket.io-client', () => ( { io: vi.fn( () => fakeSocket ) } ) )
vi.mock( './auth', () => ( { useAuthStore: () => ( { token: 'jwt-di-prova' } ) } ) )

import { io } from 'socket.io-client'
import { useMatchStore } from './matchStore'
import type { Aggiornamento } from '../types/match'

function aggiornamento( over: Partial<Aggiornamento> = {} ): Aggiornamento {
  return {
    codice: 'COD', statoTavolo: 'inCorso', ruolo: 'A', avversario: 'bob', scadenzaFinestra: null,
    mosse: [
      { tipo: 'passaTurno' },
      { tipo: 'giocaCarta', uid: 'A-1', colonna: 'presente' },
      { tipo: 'giocaCarta', uid: 'A-1', colonna: 'passato' },
      { tipo: 'scambio', uid: 'A-1' },
      { tipo: 'giocaCarta', uid: 'A-2' },
    ],
    vista: { io: 'A', tocca: 'A' } as Aggiornamento['vista'],
    ...over,
  }
}

describe( 'matchStore', () => {
  beforeEach( () => {
    setActivePinia( createPinia() )
    emit.mockReset()
  } )

  it( 'connette il socket con il token JWT', () => {
    useMatchStore().connetti()
    expect( io ).toHaveBeenCalledWith( { path: '/socket.io', auth: { token: 'jwt-di-prova' }, transports: ['websocket', 'polling'] } )
  } )

  it( 'salva l aggiornamento ricevuto e calcola tocca', () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    expect( s.agg?.codice ).toBe( 'COD' )
    expect( s.tocca ).toBe( true )
  } )

  it( 'colonneGiocabili segue la carta selezionata', () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    s.seleziona( 'A-1' )
    expect( s.colonneGiocabili ).toEqual( ['presente', 'passato'] )
    expect( s.mosseDi( 'A-1' ) ).toHaveLength( 3 )
    s.seleziona( 'A-9' )
    expect( s.colonneGiocabili ).toEqual( [] )
  } )

  it( 'invia un azione con il codice corrente e riporta l errore dell ack', async () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    emit.mockImplementation( ( _ev, _d, ack ) => ack( { ok: false, errore: 'Non tocca a te' } ) )
    expect( await s.invia( { tipo: 'passaTurno' } ) ).toBe( false )
    expect( emit ).toHaveBeenCalledWith( 'partita:azione', { codice: 'COD', azione: { tipo: 'passaTurno' } }, expect.any( Function ) )
    expect( s.errore ).toBe( 'Non tocca a te' )
  } )

  it( 'dopo una mossa riuscita la selezione si azzera', async () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    s.seleziona( 'A-1' )
    emit.mockImplementation( ( _ev, _d, ack ) => ack( { ok: true } ) )
    expect( await s.invia( { tipo: 'giocaCarta', uid: 'A-1', colonna: 'presente' } ) ).toBe( true )
    expect( s.selezionata ).toBeNull()
    expect( s.errore ).toBeNull()
  } )

  it( 'crea restituisce il codice', async () => {
    const s = useMatchStore()
    s.connetti()
    emit.mockImplementation( ( _ev, _d, ack ) => ack( { ok: true, codice: 'NUOVO' } ) )
    expect( await s.crea( 'deck1' ) ).toBe( 'NUOVO' )
  } )

  it( 'connect_error espone il messaggio', () => {
    const s = useMatchStore()
    s.connetti()
    handlers['connect_error']( new Error( 'Non autenticato' ) )
    expect( s.errore ).toBe( 'Non autenticato' )
    expect( s.connesso ).toBe( false )
  } )
} )
```

- [ ] **Step 4: Eseguire il test e vederlo fallire**

Run: `cd frontend && npx vitest run src/stores/matchStore.spec.ts`
Expected: FAIL, `Failed to resolve import "./matchStore"`.

- [ ] **Step 5: Scrivere lo store**

`frontend/src/stores/matchStore.ts`:

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from './auth'
import type { Aggiornamento, Azione, Colonna } from '../types/match'

type Risposta = { ok: boolean; errore?: string; codice?: string; ruolo?: string; codici?: string[] }

export const useMatchStore = defineStore( 'match', () => {
  const agg = ref<Aggiornamento | null>( null )
  const connesso = ref( false )
  const errore = ref<string | null>( null )
  const selezionata = ref<string | null>( null )
  let socket: Socket | null = null

  const vista = computed( () => agg.value?.vista ?? null )
  const tocca = computed( () => !!agg.value && !!vista.value && vista.value.tocca === agg.value.ruolo )

  function mosseDi( uid: string ): Azione[] {
    return ( agg.value?.mosse ?? [] ).filter( ( m ) => ( m.tipo === 'giocaCarta' || m.tipo === 'scambio' ) && m.uid === uid )
  }

  const colonneGiocabili = computed<Colonna[]>( () => {
    if ( !selezionata.value ) return []
    return mosseDi( selezionata.value )
      .flatMap( ( m ) => ( m.tipo === 'giocaCarta' && m.colonna ? [m.colonna] : [] ) )
  } )

  function connetti() {
    if ( socket ) return
    const auth = useAuthStore()
    socket = io( { path: '/socket.io', auth: { token: auth.token }, transports: ['websocket', 'polling'] } )
    socket.on( 'connect', () => { connesso.value = true; errore.value = null } )
    socket.on( 'disconnect', () => { connesso.value = false } )
    socket.on( 'connect_error', ( e: Error ) => { connesso.value = false; errore.value = e.message } )
    socket.on( 'partita:aggiornamento', ( a: Aggiornamento ) => {
      if ( agg.value && agg.value.codice !== a.codice ) return
      agg.value = a
      if ( selezionata.value && !a.vista?.giocatori[a.ruolo].mano?.some( ( c ) => c.uid === selezionata.value ) ) {
        selezionata.value = null
      }
    } )
  }

  function chiedi( evento: string, dati: unknown ): Promise<Risposta> {
    return new Promise( ( resolve ) => {
      if ( !socket ) return resolve( { ok: false, errore: 'Non connesso' } )
      socket.emit( evento, dati, ( r: Risposta ) => resolve( r ) )
    } )
  }

  async function esito( r: Risposta ): Promise<boolean> {
    errore.value = r.ok ? null : r.errore ?? 'Errore'
    return r.ok
  }

  async function crea( deckId: string ): Promise<string | null> {
    agg.value = null
    const r = await chiedi( 'partita:crea', { deckId } )
    return ( await esito( r ) ) ? r.codice ?? null : null
  }

  async function entra( codice: string, deckId?: string ): Promise<boolean> {
    if ( agg.value?.codice !== codice ) agg.value = null
    return esito( await chiedi( 'partita:entra', deckId ? { codice, deckId } : { codice } ) )
  }

  async function invia( azione: Azione ): Promise<boolean> {
    if ( !agg.value ) return false
    const ok = await esito( await chiedi( 'partita:azione', { codice: agg.value.codice, azione } ) )
    if ( ok ) selezionata.value = null
    return ok
  }

  async function arrenditi(): Promise<boolean> {
    if ( !agg.value ) return false
    return esito( await chiedi( 'partita:arrenditi', { codice: agg.value.codice } ) )
  }

  function seleziona( uid: string | null ) {
    selezionata.value = uid
  }

  function disconnetti() {
    socket?.disconnect()
    socket = null
    agg.value = null
    connesso.value = false
  }

  return {
    agg, connesso, errore, selezionata, vista, tocca, colonneGiocabili,
    mosseDi, connetti, crea, entra, invia, arrenditi, seleziona, disconnetti,
  }
} )
```

- [ ] **Step 6: Eseguire il test e vederlo passare**

Run: `cd frontend && npx vitest run src/stores/matchStore.spec.ts`
Expected: PASS.

- [ ] **Step 7: Rotte, protezione, proxy**

In `frontend/src/router/index.ts`, accanto alla rotta `deckbuilder`:

```ts
    { path: '/partita', name: 'partita', component: () => import( '../views/MatchView.vue' ), meta: { requiresAuth: true } },
    { path: '/partita/:codice', name: 'partita-codice', component: () => import( '../views/MatchView.vue' ), meta: { requiresAuth: true } },
```

Creare un segnaposto minimo `frontend/src/views/MatchView.vue` (lo riempie il Task 7) perché la build risolva l'import:

```vue
<script setup lang="ts"></script>
<template><main class="match-view"></main></template>
```

In `frontend/src/stores/auth.ts` riga 58: `['/admin', '/deckbuilder', '/profile', '/partita']`.

In `frontend/vite.config.ts`, dentro `server.proxy`, accanto a `'/api'`:

```ts
      '/socket.io': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
```

In `frontend/nginx.conf`:
- nella prima regex dell'allowlist SPA aggiungere `partita` all'alternanza: `^/(?:cards|...|forgot-password|partita)$`;
- nella seconda (`^/(?:starter-decks|news|verify-email|reset-password)/[^/]+$`) aggiungere `partita`;
- aggiungere, accanto a `location ^~ /api`:

```nginx
location ^~ /socket.io/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

Controllare anche che il service worker della PWA (`vite.config.ts`, sezione workbox) non intercetti `/socket.io`: se `navigateFallbackDenylist` esiste, aggiungere `/^\/socket\.io/`; se non esiste, non serve (il polling non è una navigazione).

- [ ] **Step 8: Verifica e commit**

Run: `cd frontend && npx vitest run && npm run build`
Expected: test verdi, build senza errori.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/match.ts frontend/src/stores/matchStore.ts frontend/src/stores/matchStore.spec.ts frontend/src/router/index.ts frontend/src/stores/auth.ts frontend/vite.config.ts frontend/nginx.conf frontend/src/views/MatchView.vue
git commit -m "feat(match): store della partita su Socket.IO, rotte /partita e proxy WebSocket"
```

---

### Task 7: Lobby: scelta del mazzo, invito, ingresso

**Files:**
- Modify: `frontend/src/views/MatchView.vue`
- Create: `frontend/src/components/match/MatchLobby.vue`
- Modify: un punto d'ingresso visibile: il componente della lista mazzi `frontend/src/components/DeckDashboard.vue` non va toccato; si aggiunge un link "Gioca online" alla barra di navigazione principale dove c'è "Deckbuilder" (cercare `to="/deckbuilder"` con grep e aggiungere accanto `<RouterLink to="/partita">Gioca online</RouterLink>` con le stesse classi)
- Test: `frontend/src/components/match/MatchLobby.spec.ts`

**Interfaces:**
- Consumes: `useMatchStore` (Task 6), `useDeckStore().fetchUserDecks()` e `userDecks` (`SavedDeck[]`).
- Produces: `MatchView.vue` che mostra `MatchLobby` finché `agg` è `null` o `statoTavolo === 'attesa'`, poi `MatchTable` (Task 8). `MatchLobby` props `{ codice: string | null }`, emette `creata(codice: string)`.

Comportamento:
- `/partita` senza codice: elenco dei propri mazzi validi (40 carte, Costruttore presente; il conteggio è la somma di `count`), bottone "Crea partita". Dopo la creazione la rotta diventa `/partita/<codice>` (`router.replace`) e la lobby mostra il link d'invito `${location.origin}/partita/<codice>` con bottone "Copia link" e la scritta "In attesa dell'avversario".
- `/partita/<codice>`: prima prova `entra(codice)` senza mazzo (rientro). Se l'errore è "Scegli un mazzo", mostra la scelta del mazzo con bottone "Entra nella partita". Altri errori ("Partita non trovata", "La partita è già al completo") si mostrano con un link a `/partita`.
- I mazzi con meno o più di 40 carte compaiono disattivati con la scritta "Mazzo incompleto: N carte".

- [ ] **Step 1: Scrivere il test che fallisce**

`frontend/src/components/match/MatchLobby.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const crea = vi.fn()
const entra = vi.fn()
const store = { crea, entra, errore: null as string | null, agg: null }
vi.mock( '../../stores/matchStore', () => ( { useMatchStore: () => store } ) )
vi.mock( '../../stores/deckStore', () => ( {
  useDeckStore: () => ( {
    fetchUserDecks: vi.fn(),
    userDecks: [
      { id: 'd1', name: 'Completo', costruttoreId: 100, cards: [{ cardId: 1, count: 40 }] },
      { id: 'd2', name: 'Corto', costruttoreId: 100, cards: [{ cardId: 1, count: 12 }] },
    ],
  } ),
} ) )
const replace = vi.fn()
vi.mock( 'vue-router', () => ( { useRouter: () => ( { replace } ) } ) )

import MatchLobby from './MatchLobby.vue'

describe( 'MatchLobby', () => {
  beforeEach( () => {
    setActivePinia( createPinia() )
    crea.mockReset(); entra.mockReset(); replace.mockReset()
    store.errore = null
  } )

  it( 'senza codice: i mazzi incompleti sono disattivati, crea porta alla rotta col codice', async () => {
    crea.mockResolvedValue( 'NUOVO123' )
    const w = mount( MatchLobby, { props: { codice: null } } )
    await flushPromises()
    expect( w.text() ).toContain( 'Mazzo incompleto: 12 carte' )
    await w.get( '[data-test="mazzo-d1"]' ).trigger( 'click' )
    await w.get( '[data-test="crea"]' ).trigger( 'click' )
    await flushPromises()
    expect( crea ).toHaveBeenCalledWith( 'd1' )
    expect( replace ).toHaveBeenCalledWith( '/partita/NUOVO123' )
  } )

  it( 'con codice: prova a rientrare, se serve un mazzo mostra la scelta e poi entra', async () => {
    entra.mockImplementationOnce( async () => { store.errore = 'Scegli un mazzo'; return false } )
    entra.mockResolvedValueOnce( true )
    const w = mount( MatchLobby, { props: { codice: 'COD' } } )
    await flushPromises()
    expect( entra ).toHaveBeenCalledWith( 'COD' )
    await w.get( '[data-test="mazzo-d1"]' ).trigger( 'click' )
    await w.get( '[data-test="entra"]' ).trigger( 'click' )
    await flushPromises()
    expect( entra ).toHaveBeenLastCalledWith( 'COD', 'd1' )
  } )

  it( 'partita al completo: messaggio e link alla lobby', async () => {
    entra.mockImplementationOnce( async () => { store.errore = 'La partita è già al completo'; return false } )
    const w = mount( MatchLobby, { props: { codice: 'COD' }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } } )
    await flushPromises()
    expect( w.text() ).toContain( 'La partita è già al completo' )
    expect( w.find( '[data-test="scelta-mazzo"]' ).exists() ).toBe( false )
  } )
} )
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `cd frontend && npx vitest run src/components/match/MatchLobby.spec.ts`
Expected: FAIL, `Failed to resolve import "./MatchLobby.vue"`.

- [ ] **Step 3: Scrivere `MatchLobby.vue` e `MatchView.vue`**

`frontend/src/components/match/MatchLobby.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchStore } from '../../stores/matchStore'
import { useDeckStore } from '../../stores/deckStore'

const props = defineProps<{ codice: string | null }>()
const match = useMatchStore()
const decks = useDeckStore()
const router = useRouter()

const scelto = ref<string | null>( null )
const serveMazzo = ref( props.codice === null )
const bloccante = ref<string | null>( null )
const copiato = ref( false )

const mazzi = computed( () => decks.userDecks.map( ( d ) => {
  const n = d.cards.reduce( ( t, c ) => t + c.count, 0 )
  return { id: String( d.id ), nome: d.name, n, valido: n === 40 && d.costruttoreId !== null }
} ) )

const linkInvito = computed( () => ( props.codice ? `${window.location.origin}/partita/${props.codice}` : '' ) )
const inAttesa = computed( () => match.agg?.statoTavolo === 'attesa' )

onMounted( async () => {
  await decks.fetchUserDecks()
  if ( props.codice ) {
    const ok = await match.entra( props.codice )
    if ( !ok ) {
      if ( match.errore === 'Scegli un mazzo' ) serveMazzo.value = true
      else bloccante.value = match.errore
    }
  }
} )

async function crea() {
  if ( !scelto.value ) return
  const codice = await match.crea( scelto.value )
  if ( codice ) router.replace( `/partita/${codice}` )
}

async function entra() {
  if ( !scelto.value || !props.codice ) return
  if ( await match.entra( props.codice, scelto.value ) ) serveMazzo.value = false
}

async function copia() {
  await navigator.clipboard.writeText( linkInvito.value )
  copiato.value = true
}
</script>

<template>
  <section class="lobby">
    <h1>Partita online</h1>

    <div v-if="bloccante" class="lobby__errore">
      <p>{{ bloccante }}</p>
      <RouterLink to="/partita">Crea una nuova partita</RouterLink>
    </div>

    <div v-else-if="inAttesa" class="lobby__invito">
      <p>In attesa dell'avversario. Mandagli questo link:</p>
      <code>{{ linkInvito }}</code>
      <button type="button" @click="copia">{{ copiato ? 'Copiato' : 'Copia link' }}</button>
    </div>

    <div v-else-if="serveMazzo" data-test="scelta-mazzo">
      <p>Scegli il mazzo con cui giocare.</p>
      <ul class="lobby__mazzi">
        <li v-for="m in mazzi" :key="m.id">
          <button
            type="button"
            :data-test="`mazzo-${m.id}`"
            :disabled="!m.valido"
            :class="{ scelto: scelto === m.id }"
            @click="scelto = m.id"
          >
            {{ m.nome }}
            <small v-if="!m.valido">Mazzo incompleto: {{ m.n }} carte</small>
          </button>
        </li>
      </ul>
      <button v-if="codice === null" type="button" data-test="crea" :disabled="!scelto" @click="crea">Crea partita</button>
      <button v-else type="button" data-test="entra" :disabled="!scelto" @click="entra">Entra nella partita</button>
      <p v-if="match.errore && match.errore !== 'Scegli un mazzo'" class="lobby__errore">{{ match.errore }}</p>
    </div>
  </section>
</template>

<style scoped>
.lobby { max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
.lobby__mazzi { list-style: none; padding: 0; display: grid; gap: .5rem; }
.lobby__mazzi button { width: 100%; text-align: left; padding: .75rem 1rem; }
.lobby__mazzi button.scelto { outline: 2px solid currentColor; }
.lobby__mazzi small { display: block; opacity: .7; }
.lobby__errore { color: #ff6b6b; }
.lobby__invito code { display: block; margin: .5rem 0; word-break: break-all; }
</style>
```

`frontend/src/views/MatchView.vue`:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMatchStore } from '../stores/matchStore'
import MatchLobby from '../components/match/MatchLobby.vue'
import MatchTable from '../components/match/MatchTable.vue'

const route = useRoute()
const match = useMatchStore()
const codice = computed( () => ( typeof route.params.codice === 'string' ? route.params.codice : null ) )
const alTavolo = computed( () => !!match.agg && match.agg.statoTavolo !== 'attesa' && match.agg.codice === codice.value )

onMounted( () => match.connetti() )
onBeforeUnmount( () => match.disconnetti() )
</script>

<template>
  <main class="match-view">
    <MatchTable v-if="alTavolo" />
    <MatchLobby v-else :key="codice ?? 'nuova'" :codice="codice" />
  </main>
</template>
```

Per questo task `MatchTable.vue` è un segnaposto, sostituito nel Task 8:

```vue
<script setup lang="ts"></script>
<template><section class="match-table">Tavolo</section></template>
```

Poi aggiungere il link "Gioca online" nella navigazione (vedi Files).

- [ ] **Step 4: Eseguire il test e vederlo passare**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS e build senza errori.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/MatchView.vue frontend/src/components/match/ frontend/src/components/*.vue
git commit -m "feat(match): lobby con scelta del mazzo, link d'invito e rientro in partita"
```

---

### Task 8: Tavolo composto

**Files:**
- Create: `frontend/public/images/match/colonna-passato.webp`, `colonna-presente.webp`, `colonna-futuro.webp`, `termometro.webp`
- Create: `frontend/src/components/match/MatchCard.vue`
- Create: `frontend/src/components/match/MatchPile.vue`
- Create: `frontend/src/components/match/MatchThermometer.vue`
- Create: `frontend/src/components/match/MatchColumn.vue`
- Create: `frontend/src/components/match/MatchHand.vue`
- Create: `frontend/src/components/match/MatchStatusBar.vue`
- Create: `frontend/src/components/match/MatchLog.vue`
- Modify: `frontend/src/components/match/MatchTable.vue`
- Test: `frontend/src/components/match/MatchTable.spec.ts`

**Interfaces:**
- Consumes: `useMatchStore` (Task 6), `useCardStore().fetchCards()` e `getCardById(id)` (restituisce `Card` con `name`, `image_url`, `type`, `pep`, `rp`, `cost_et`, `effect`), tipi di `types/match.ts`.
- Produces: `MatchCard` props `{ cardId: number | null; coperta?: boolean; piccola?: boolean; segnalino?: 'caldo' | 'freddo' | null; evidenziata?: boolean; attenuata?: boolean; selezionata?: boolean }`, emette `click`. `MatchTable` monta i componenti e ospita i pannelli del Task 9 (slot `<MatchDecisionPanel />` e `<MatchManualPanel />` aggiunti nel Task 9).

Layout (spec sezione 7): CSS Grid a 7 colonne `orizzonte | memoria | termometro+anomalia | passato | presente | futuro | costruttore | futuro-mazzo`, due righe (avversario in alto, proprio in basso) per le pile laterali; le tre colonne centrali occupano entrambe le righe, con le carte avversarie nella metà alta e le proprie nella metà bassa. Ordine delle pile:

| Lato | In alto (avversario) | In basso (proprio) |
|---|---|---|
| Sinistra, esterno | Orizzonte | Orizzonte |
| Sinistra, interno | Memoria | Memoria |
| Sinistra, centro | Anomalia (sopra il termometro, unica) | |
| Destra, interno | Costruttore | Costruttore |
| Destra, esterno | Futuro (mazzo) | Futuro (mazzo) |

- [ ] **Step 1: Ritagliare gli asset dal tabellone 6.0**

Sorgente: `/home/simone/Documenti/Joule Zero Point/tabellone6.0.png` (3500x1787). Coordinate verificate il 2026-10-13:

```bash
cd /home/simone/Documenti/start2impact/JouleZeroPointDev/frontend/public/images
mkdir -p match
SRC="/home/simone/Documenti/Joule Zero Point/tabellone6.0.png"
convert "$SRC" -crop 560x1720+840+34  +repage -resize 50% -quality 82 match/colonna-passato.webp
convert "$SRC" -crop 560x1720+1466+34 +repage -resize 50% -quality 82 match/colonna-presente.webp
convert "$SRC" -crop 560x1720+2094+34 +repage -resize 50% -quality 82 match/colonna-futuro.webp
convert "$SRC" -crop 300x770+515+505  +repage -resize 50% -quality 85 match/termometro.webp
ls -la match
```

Expected: quattro file `.webp`, ognuno sotto 150 KB. Aprirne uno per controllare che il bordo luminoso sia intero.

Sul termometro i numeri vanno da +4 (in alto, al 13,6% dell'altezza) a -4 (in basso, all'83,8%): passo 8,78% per unità di TP.

- [ ] **Step 2: Scrivere il test che fallisce**

`frontend/src/components/match/MatchTable.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import type { Aggiornamento, Vista, VistaGiocatore } from '../../types/match'

function giocatore( id: 'A' | 'B', mano: VistaGiocatore['mano'] ): VistaGiocatore {
  return {
    id, it: 20, et: 3, etMax: 3, mano, carteInMano: mano ? mano.length : 5, carteFuturo: 25,
    memoria: [], orizzonte: [], costruttore: { uid: `${id}-C`, cardId: 100, owner: id },
    supportoPep: 0, supportoRp: 0, scambioUsato: false, haPassato: false,
  }
}

const vista: Vista = {
  io: 'A', round: 2, fase: 'azioni', flusso: 'normale', tp: 2, iniziativa: 'A', attivo: 'A', tocca: 'A',
  anomalia: null,
  colonne: {
    passato: [],
    presente: [
      { uid: 'A-5', owner: 'A', coperta: false, cardId: 1, segnalino: 'caldo', statoForzato: null, modifiche: [] },
      { uid: 'B-7', owner: 'B', coperta: false, cardId: 2, segnalino: null, statoForzato: null, modifiche: [] },
    ],
    futuro: [{ uid: 'B-8', owner: 'B', coperta: true, cardId: null, segnalino: null, statoForzato: null, modifiche: [] }],
  },
  giocatori: { A: giocatore( 'A', [{ uid: 'A-1', cardId: 3, owner: 'A' }, { uid: 'A-2', cardId: 4, owner: 'A' }] ), B: giocatore( 'B', null ) },
  stack: [], finestra: null, decisione: null, esito: null,
  log: [{ round: 2, testo: 'Giocatore A gioca Carta 1 nel Presente' }],
}

const store = reactive( {
  agg: { codice: 'COD', statoTavolo: 'inCorso', ruolo: 'A', avversario: 'bob', scadenzaFinestra: null,
    mosse: [{ tipo: 'passaTurno' }, { tipo: 'giocaCarta', uid: 'A-1', colonna: 'presente' }], vista } as Aggiornamento,
  vista, tocca: true, selezionata: null as string | null, errore: null,
  colonneGiocabili: [] as string[],
  mosseDi: ( uid: string ) => ( uid === 'A-1' ? [{ tipo: 'giocaCarta', uid: 'A-1', colonna: 'presente' }] : [] ),
  seleziona: vi.fn(), invia: vi.fn(), arrenditi: vi.fn(),
} )
vi.mock( '../../stores/matchStore', () => ( { useMatchStore: () => store } ) )
vi.mock( '../../stores/cardStore', () => ( {
  useCardStore: () => ( { fetchCards: vi.fn(), getCardById: ( id: number ) => ( { id, name: `Carta ${id}`, image_url: `/img/${id}.png`, effect: '' } ) } ),
} ) )

import MatchTable from './MatchTable.vue'

describe( 'MatchTable', () => {
  beforeEach( () => setActivePinia( createPinia() ) )

  it( 'le carte avversarie stanno nella metà alta della colonna, le proprie in quella bassa', () => {
    const w = mount( MatchTable )
    const presente = w.get( '[data-test="colonna-presente"]' )
    expect( presente.get( '[data-test="meta-avversario"]' ).html() ).toContain( '/img/2.png' )
    expect( presente.get( '[data-test="meta-mia"]' ).html() ).toContain( '/img/1.png' )
  } )

  it( 'la carta coperta avversaria mostra il retro', () => {
    const w = mount( MatchTable )
    expect( w.get( '[data-test="colonna-futuro"]' ).html() ).toContain( 'Retro_Ufficiale.png' )
  } )

  it( 'mano avversaria come conteggio, mano propria con le carte e quelle non giocabili attenuate', () => {
    const w = mount( MatchTable )
    expect( w.get( '[data-test="mano-avversario"]' ).text() ).toContain( '5' )
    const mano = w.get( '[data-test="mano-mia"]' )
    expect( mano.findAll( '.match-card' ) ).toHaveLength( 2 )
    expect( mano.get( '[data-uid="A-2"]' ).classes() ).toContain( 'attenuata' )
    expect( mano.get( '[data-uid="A-1"]' ).classes() ).not.toContain( 'attenuata' )
  } )

  it( 'barra di stato: IT, ET, fase, flusso, round e Tocca a te', () => {
    const w = mount( MatchTable )
    const barra = w.get( '[data-test="barra-stato"]' ).text()
    for ( const t of ['IT 20', 'ET 3/3', 'Azioni', 'Normale', 'Round 2', 'Tocca a te'] ) expect( barra ).toContain( t )
  } )

  it( 'il termometro posiziona l indicatore sulla TP', () => {
    const w = mount( MatchTable )
    const style = w.get( '[data-test="indicatore-tp"]' ).attributes( 'style' )
    expect( style ).toContain( 'top: 31.16%' )
  } )

  it( 'click su una carta in mano la seleziona', async () => {
    const w = mount( MatchTable )
    await w.get( '[data-test="mano-mia"] [data-uid="A-1"]' ).trigger( 'click' )
    expect( store.seleziona ).toHaveBeenCalledWith( 'A-1' )
  } )

  it( 'il registro mostra le voci', () => {
    const w = mount( MatchTable )
    expect( w.get( '[data-test="registro"]' ).text() ).toContain( 'Giocatore A gioca Carta 1 nel Presente' )
  } )
} )
```

(`top` atteso per TP +2: 13,6 + (4 - 2) × 8,78 = 31,16.)

- [ ] **Step 3: Eseguire il test e vederlo fallire**

Run: `cd frontend && npx vitest run src/components/match/MatchTable.spec.ts`
Expected: FAIL (il segnaposto non ha i `data-test`).

- [ ] **Step 4: Scrivere i componenti**

`frontend/src/components/match/MatchCard.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useCardStore } from '../../stores/cardStore'

const props = defineProps<{
  cardId: number | null
  coperta?: boolean
  piccola?: boolean
  segnalino?: 'caldo' | 'freddo' | null
  evidenziata?: boolean
  attenuata?: boolean
  selezionata?: boolean
}>()
defineEmits<{ click: [] }>()
const cards = useCardStore()
const carta = computed( () => ( props.cardId === null ? null : cards.getCardById( props.cardId ) ?? null ) )
const retro = computed( () => props.coperta || props.cardId === null )
</script>

<template>
  <button
    type="button"
    class="match-card"
    :class="{ piccola, evidenziata, attenuata, selezionata }"
    :title="retro ? 'Carta coperta' : carta ? `${carta.name}\n${carta.effect}` : `Carta ${cardId}`"
    @click="$emit('click')"
  >
    <img v-if="retro" src="/Retro_Ufficiale.png" alt="Carta coperta" />
    <img v-else-if="carta?.image_url" :src="carta.image_url" :alt="carta.name" />
    <span v-else class="match-card__nome">{{ carta?.name ?? `Carta ${cardId}` }}</span>
    <span v-if="segnalino === 'caldo'" class="match-card__segnalino" aria-label="Riscaldato">🔴</span>
    <span v-if="segnalino === 'freddo'" class="match-card__segnalino" aria-label="Raffreddato">🔵</span>
  </button>
</template>

<style scoped>
.match-card { position: relative; width: var(--carta-l, 6.2rem); aspect-ratio: 2 / 3; padding: 0; border: 0; background: none; border-radius: .4rem; cursor: pointer; transition: transform .12s; }
.match-card.piccola { --carta-l: 4.2rem; }
.match-card img { width: 100%; height: 100%; object-fit: cover; border-radius: .4rem; }
.match-card:hover { transform: scale(1.8); z-index: 20; }
.match-card.attenuata { opacity: .4; }
.match-card.evidenziata { box-shadow: 0 0 .6rem .15rem #ffd36b; }
.match-card.selezionata { box-shadow: 0 0 .7rem .25rem #6bd3ff; transform: translateY(-.5rem); }
.match-card__nome { display: grid; place-items: center; height: 100%; font-size: .7rem; background: #1b1f33; border-radius: .4rem; }
.match-card__segnalino { position: absolute; top: .15rem; right: .15rem; font-size: .8rem; }
</style>
```

`frontend/src/components/match/MatchPile.vue`:

```vue
<script setup lang="ts">
import MatchCard from './MatchCard.vue'
defineProps<{ titolo: string; cima: number | null; conteggio: number; coperta?: boolean; mia?: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <div class="pila" :class="mia ? 'pila--mia' : 'pila--avversario'">
    <span class="pila__titolo">{{ titolo }}</span>
    <MatchCard v-if="conteggio > 0" piccola :card-id="cima" :coperta="coperta" @click="$emit('click')" />
    <div v-else class="pila__vuota" />
    <span class="pila__conteggio">{{ conteggio }}</span>
  </div>
</template>

<style scoped>
.pila { display: flex; flex-direction: column; align-items: center; gap: .2rem; padding: .3rem; border: 1px solid #5c6bff55; border-radius: .5rem; box-shadow: inset 0 0 .6rem #5c6bff33; }
.pila__titolo { font-size: .65rem; text-transform: uppercase; letter-spacing: .05em; opacity: .8; }
.pila__vuota { width: 4.2rem; aspect-ratio: 2 / 3; border: 1px dashed #ffffff33; border-radius: .4rem; }
.pila__conteggio { font-size: .75rem; }
.pila--mia { border-color: #4fd1c5aa; }
.pila--avversario { border-color: #f6ad55aa; }
</style>
```

`frontend/src/components/match/MatchThermometer.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ tp: number; flusso: 'normale' | 'invertito' }>()
// +4 al 13,6% dell'altezza dell'immagine, -4 all'83,8%: 8,78% per unità (misurato sul tabellone 6.0).
const top = computed( () => `${( 13.6 + ( 4 - props.tp ) * 8.78 ).toFixed( 2 )}%` )
</script>

<template>
  <div class="termometro" :class="{ invertito: flusso === 'invertito' }">
    <img src="/images/match/termometro.webp" alt="Termometro" />
    <span data-test="indicatore-tp" class="termometro__indicatore" :style="{ top }" :aria-label="`TP ${tp}`" />
  </div>
</template>

<style scoped>
.termometro { position: relative; width: 4.5rem; }
.termometro img { width: 100%; display: block; }
.termometro__indicatore { position: absolute; left: 50%; width: 70%; height: .5rem; transform: translate(-50%, -50%); border-radius: .25rem; background: #fff; box-shadow: 0 0 .6rem #fff; transition: top .5s ease; }
.termometro.invertito { animation: inversione .8s ease; }
@keyframes inversione { 50% { transform: rotate(180deg); filter: hue-rotate(180deg); } }
</style>
```

`frontend/src/components/match/MatchColumn.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import type { Colonna, VistaCampo } from '../../types/match'
import MatchCard from './MatchCard.vue'

const props = defineProps<{ colonna: Colonna; carte: VistaCampo[] }>()
const emit = defineEmits<{ carta: [uid: string] }>()
const match = useMatchStore()
const io = computed( () => match.agg!.ruolo )
const mie = computed( () => props.carte.filter( ( c ) => c.owner === io.value ) )
const loro = computed( () => props.carte.filter( ( c ) => c.owner !== io.value ) )
const destinazione = computed( () => match.colonneGiocabili.includes( props.colonna ) )
const NOMI: Record<Colonna, string> = { passato: 'Passato', presente: 'Presente', futuro: 'Futuro' }

function gioca() {
  if ( !destinazione.value || !match.selezionata ) return
  match.invia( { tipo: 'giocaCarta', uid: match.selezionata, colonna: props.colonna } )
}
</script>

<template>
  <div
    :data-test="`colonna-${colonna}`"
    class="colonna"
    :class="{ destinazione }"
    :style="{ backgroundImage: `url(/images/match/colonna-${colonna}.webp)` }"
    @click.self="gioca"
  >
    <div data-test="meta-avversario" class="colonna__meta" @click.self="gioca">
      <MatchCard v-for="c in loro" :key="c.uid" :card-id="c.cardId" :coperta="c.coperta" :segnalino="c.segnalino" class="avversario" @click="emit('carta', c.uid)" />
    </div>
    <span class="colonna__nome">{{ NOMI[colonna] }}</span>
    <div data-test="meta-mia" class="colonna__meta" @click.self="gioca">
      <MatchCard v-for="c in mie" :key="c.uid" :card-id="c.cardId" :coperta="c.coperta" :segnalino="c.segnalino" class="mia" @click="emit('carta', c.uid)" />
    </div>
  </div>
</template>

<style scoped>
.colonna { display: grid; grid-template-rows: 1fr auto 1fr; background-size: 100% 100%; border-radius: .8rem; padding: .6rem .4rem; min-height: 0; }
.colonna.destinazione { box-shadow: 0 0 1rem .3rem #ffd36b; cursor: pointer; }
.colonna__meta { display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: .3rem; --carta-l: 4.6rem; }
.colonna__nome { text-align: center; font-size: .7rem; text-transform: uppercase; letter-spacing: .1em; opacity: .7; }
.avversario :deep(img) { outline: 2px solid #f6ad55; }
.mia :deep(img) { outline: 2px solid #4fd1c5; }
</style>
```

`frontend/src/components/match/MatchHand.vue`:

```vue
<script setup lang="ts">
import { useMatchStore } from '../../stores/matchStore'
import type { Carta } from '../../types/match'
import MatchCard from './MatchCard.vue'

defineProps<{ carte: Carta[] }>()
const match = useMatchStore()

function click( c: Carta ) {
  const mosse = match.mosseDi( c.uid )
  if ( !mosse.length ) return
  // Evento o Anomalia: una sola mossa senza colonna, si gioca subito.
  const senzaColonna = mosse.find( ( m ) => m.tipo === 'giocaCarta' && !m.colonna )
  if ( senzaColonna ) {
    match.invia( senzaColonna )
    return
  }
  match.seleziona( match.selezionata === c.uid ? null : c.uid )
}
</script>

<template>
  <div data-test="mano-mia" class="mano">
    <MatchCard
      v-for="c in carte"
      :key="c.uid"
      :data-uid="c.uid"
      :card-id="c.cardId"
      :attenuata="match.mosseDi(c.uid).length === 0"
      :selezionata="match.selezionata === c.uid"
      @click="click(c)"
    />
  </div>
</template>

<style scoped>
.mano { display: flex; justify-content: center; gap: .4rem; padding: .5rem; --carta-l: 6.5rem; }
</style>
```

Nota: in `MatchHand` un Evento giocabile si gioca al primo click. Lo Scambio si fa dal pannello del Task 9 (bottone "Scambia la carta selezionata"), perché richiede di selezionare prima la carta.

`frontend/src/components/match/MatchStatusBar.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/matchStore'

const match = useMatchStore()
const v = computed( () => match.vista! )
const io = computed( () => v.value.giocatori[match.agg!.ruolo] )
const avv = computed( () => v.value.giocatori[match.agg!.ruolo === 'A' ? 'B' : 'A'] )
const FASI: Record<string, string> = {
  setup: 'Preparazione', slittamento: 'Slittamento', risorse: 'Risorse', azioni: 'Azioni',
  collisione: 'Collisione', fine: 'Fine round', terminata: 'Terminata',
}
</script>

<template>
  <div data-test="barra-stato" class="barra">
    <span>Round {{ v.round }}</span>
    <span>{{ FASI[v.fase] }}</span>
    <span>{{ v.flusso === 'normale' ? 'Normale' : 'Invertito' }}</span>
    <span>TP {{ v.tp > 0 ? '+' : '' }}{{ v.tp }}</span>
    <span>Tu: IT {{ io.it }} · ET {{ io.et }}/{{ io.etMax }}</span>
    <span>{{ match.agg!.avversario }}: IT {{ avv.it }} · ET {{ avv.et }}/{{ avv.etMax }}</span>
    <span>{{ v.iniziativa === match.agg!.ruolo ? 'Hai l\'iniziativa' : 'Iniziativa all\'avversario' }}</span>
    <strong v-if="match.agg!.statoTavolo === 'pausa'" class="barra__pausa">Partita in pausa: avversario assente</strong>
    <strong v-else-if="match.tocca" class="barra__tocca">Tocca a te</strong>
    <span v-else>Tocca all'avversario</span>
  </div>
</template>

<style scoped>
.barra { display: flex; flex-wrap: wrap; gap: .4rem 1rem; align-items: center; padding: .4rem .8rem; font-size: .85rem; background: #0b0e1acc; border-radius: .5rem; }
.barra__tocca { color: #1a1300; background: #ffd36b; padding: .1rem .6rem; border-radius: .3rem; }
.barra__pausa { color: #ff6b6b; }
</style>
```

Il test cerca `IT 20` e `ET 3/3`: entrambi compaiono nella riga "Tu: IT 20 · ET 3/3".

`frontend/src/components/match/MatchLog.vue`:

```vue
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
const props = defineProps<{ voci: { round: number; testo: string }[] }>()
const box = ref<HTMLElement | null>( null )
watch( () => props.voci.length, async () => {
  await nextTick()
  if ( box.value ) box.value.scrollTop = box.value.scrollHeight
} )
</script>

<template>
  <aside ref="box" data-test="registro" class="registro" aria-live="polite">
    <p v-for="( v, i ) in voci" :key="i"><small>R{{ v.round }}</small> {{ v.testo }}</p>
  </aside>
</template>

<style scoped>
.registro { overflow-y: auto; font-size: .78rem; padding: .5rem; background: #0b0e1acc; border-radius: .5rem; }
.registro p { margin: 0 0 .3rem; }
.registro small { opacity: .6; margin-right: .3rem; }
</style>
```

`frontend/src/components/match/MatchTable.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import { useCardStore } from '../../stores/cardStore'
import type { PlayerId } from '../../types/match'
import MatchCard from './MatchCard.vue'
import MatchColumn from './MatchColumn.vue'
import MatchHand from './MatchHand.vue'
import MatchLog from './MatchLog.vue'
import MatchPile from './MatchPile.vue'
import MatchStatusBar from './MatchStatusBar.vue'
import MatchThermometer from './MatchThermometer.vue'

const match = useMatchStore()
const cards = useCardStore()
onMounted( () => cards.fetchCards() )

const v = computed( () => match.vista! )
const io = computed<PlayerId>( () => match.agg!.ruolo )
const lui = computed<PlayerId>( () => ( io.value === 'A' ? 'B' : 'A' ) )
const g = ( p: PlayerId ) => v.value.giocatori[p]
const cima = ( arr: { cardId: number }[] ) => ( arr.length ? arr[arr.length - 1].cardId : null )

const emit = defineEmits<{ carta: [uid: string] }>()
</script>

<template>
  <section class="tavolo">
    <MatchStatusBar class="tavolo__barra" />

    <div data-test="mano-avversario" class="tavolo__mano-avv">
      <MatchCard piccola :card-id="null" coperta />
      <span>× {{ g(lui).carteInMano }}</span>
    </div>

    <div class="tavolo__griglia">
      <MatchPile class="g-orizzonte-a" titolo="Orizzonte" :cima="cima(g(lui).orizzonte)" :conteggio="g(lui).orizzonte.length" />
      <MatchPile class="g-memoria-a" titolo="Memoria" :cima="cima(g(lui).memoria)" :conteggio="g(lui).memoria.length" />
      <div class="g-centro-sx">
        <MatchPile titolo="Anomalia" :cima="v.anomalia?.cardId ?? null" :conteggio="v.anomalia ? 1 : 0" />
        <MatchThermometer :tp="v.tp" :flusso="v.flusso" />
      </div>
      <MatchColumn class="g-passato" colonna="passato" :carte="v.colonne.passato" @carta="emit('carta', $event)" />
      <MatchColumn class="g-presente" colonna="presente" :carte="v.colonne.presente" @carta="emit('carta', $event)" />
      <MatchColumn class="g-futuro" colonna="futuro" :carte="v.colonne.futuro" @carta="emit('carta', $event)" />
      <MatchPile class="g-costr-a" titolo="Costruttore" :cima="g(lui).costruttore.cardId" :conteggio="1" />
      <MatchPile class="g-mazzo-a" titolo="Futuro" :cima="null" coperta :conteggio="g(lui).carteFuturo" />
      <MatchPile class="g-orizzonte-b" mia titolo="Orizzonte" :cima="cima(g(io).orizzonte)" :conteggio="g(io).orizzonte.length" />
      <MatchPile class="g-memoria-b" mia titolo="Memoria" :cima="cima(g(io).memoria)" :conteggio="g(io).memoria.length" />
      <MatchPile class="g-costr-b" mia titolo="Costruttore" :cima="g(io).costruttore.cardId" :conteggio="1" />
      <MatchPile class="g-mazzo-b" mia titolo="Futuro" :cima="null" coperta :conteggio="g(io).carteFuturo" />
    </div>

    <MatchHand class="tavolo__mano" :carte="g(io).mano ?? []" />
    <MatchLog class="tavolo__log" :voci="v.log" />
    <slot />

    <p class="tavolo__ruota">Ruota il dispositivo in orizzontale per giocare.</p>
  </section>
</template>

<style scoped>
.tavolo {
  display: grid; gap: .5rem; padding: .5rem; min-height: 100vh;
  grid-template-columns: 1fr 16rem; grid-template-rows: auto auto 1fr auto;
  grid-template-areas: 'barra barra' 'manoavv log' 'griglia log' 'mano log';
  background: radial-gradient(ellipse at center, #10142a, #04050b);
}
.tavolo__barra { grid-area: barra; }
.tavolo__mano-avv { grid-area: manoavv; display: flex; align-items: center; justify-content: center; gap: .5rem; }
.tavolo__mano { grid-area: mano; }
.tavolo__log { grid-area: log; max-height: calc(100vh - 4rem); }
.tavolo__griglia {
  grid-area: griglia; display: grid; gap: .5rem; min-height: 32rem;
  grid-template-columns: auto auto auto 1fr 1fr 1fr auto auto;
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    'orizA memA centro passato presente futuro costrA mazzoA'
    'orizB memB centro passato presente futuro costrB mazzoB';
}
.g-orizzonte-a { grid-area: orizA; } .g-memoria-a { grid-area: memA; }
.g-orizzonte-b { grid-area: orizB; } .g-memoria-b { grid-area: memB; }
.g-centro-sx { grid-area: centro; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; }
.g-passato { grid-area: passato; } .g-presente { grid-area: presente; } .g-futuro { grid-area: futuro; }
.g-costr-a { grid-area: costrA; } .g-mazzo-a { grid-area: mazzoA; }
.g-costr-b { grid-area: costrB; } .g-mazzo-b { grid-area: mazzoB; }
.tavolo__ruota { display: none; }
@media (orientation: portrait) and (max-width: 767px) {
  .tavolo > :not(.tavolo__ruota) { display: none; }
  .tavolo { display: grid; place-items: center; }
  .tavolo__ruota { display: block; text-align: center; padding: 2rem; }
}
</style>
```

Nota: l'evento `carta` di `MatchTable` serve al Task 9 (selezione dei bersagli nel pannello manuale).

- [ ] **Step 5: Eseguire il test e vederlo passare**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS e build senza errori.

- [ ] **Step 6: Commit**

```bash
git add frontend/public/images/match frontend/src/components/match
git commit -m "feat(match): tavolo composto con colonne e termometro dal tabellone 6.0, pile, mano, barra di stato e registro"
```

---

### Task 9: Pannelli: decisioni, finestre, effetti manuali

**Files:**
- Create: `frontend/src/components/match/MatchDecisionPanel.vue`
- Create: `frontend/src/components/match/MatchManualPanel.vue`
- Modify: `frontend/src/components/match/MatchTable.vue` (montare i pannelli, passare i click sulle carte al pannello manuale)
- Test: `frontend/src/components/match/MatchPanels.spec.ts`

**Interfaces:**
- Consumes: `useMatchStore` (Task 6), tipi `Azione`, `AzioneBase`, `Decisione`, `Colonna`, `PlayerId`.
- Produces: `MatchDecisionPanel` (nessuna prop) mostra, solo quando `match.tocca`, i bottoni per: `sceltaIniziativa` ("Tengo l'iniziativa" / "La cedo"), `mulligan` ("Tengo la mano" / "Mulligan"), `bonusControllo` ("Pesco la carta extra" / "Rinuncio"), `capienza` (testo "Scegli quale tuo Frammento distruggere nel <colonna>", poi click su una carta del campo), finestra aperta senza decisione ("Passa" più conto alla rovescia da `scadenzaFinestra`, più gli Eventi giocabili restano cliccabili in mano), fase Azioni senza finestra ("Passa il turno", "Scambia la carta selezionata" se c'è una mossa `scambio` per la carta selezionata, "Usa effetto del Costruttore", "Arrenditi" con conferma). Esito finale: "Hai vinto" / "Hai perso" / "Pareggio" con il motivo.
  `MatchManualPanel` props `{ bersaglio: string | null }` (ultimo uid cliccato sul tavolo), visibile quando `vista.decisione?.tipo === 'effettoManuale'` e `match.tocca`; mostra testo della carta (`getCardById(cardId).effect`) e le azioni base.

Etichette dei motivi di fine: `collasso` "Collasso (IT a zero)", `sincronia` "Sincronia", `collassoEntropico` "Collasso Entropico (mazzo vuoto)", `pareggio` "Pareggio", `abbandono` "Abbandono".

- [ ] **Step 1: Scrivere il test che fallisce**

`frontend/src/components/match/MatchPanels.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const invia = vi.fn().mockResolvedValue( true )
const arrenditi = vi.fn().mockResolvedValue( true )
const store = reactive( {
  agg: { ruolo: 'A', statoTavolo: 'inCorso', scadenzaFinestra: null as number | null, mosse: [] as unknown[] },
  vista: {
    io: 'A', fase: 'azioni', tocca: 'A', finestra: null as unknown, decisione: null as unknown, esito: null as unknown,
    colonne: { passato: [], presente: [{ uid: 'A-5', owner: 'A', cardId: 1, coperta: false }], futuro: [] },
    giocatori: { A: { costruttore: { uid: 'A-C', cardId: 100 }, mano: [{ uid: 'A-1', cardId: 3 }] }, B: { costruttore: { uid: 'B-C', cardId: 100 } } },
    stack: [],
  },
  tocca: true, selezionata: null as string | null,
  mosseDi: ( uid: string ) => ( uid === 'A-1' ? [{ tipo: 'scambio', uid: 'A-1' }] : [] ),
  invia, arrenditi,
} )
vi.mock( '../../stores/matchStore', () => ( { useMatchStore: () => store } ) )
vi.mock( '../../stores/cardStore', () => ( { useCardStore: () => ( { getCardById: () => ( { name: 'Carta 1', effect: 'Aumenta la TP di 1.' } ) } ) } ) )

import MatchDecisionPanel from './MatchDecisionPanel.vue'
import MatchManualPanel from './MatchManualPanel.vue'

beforeEach( () => {
  invia.mockClear()
  store.vista.decisione = null
  store.vista.finestra = null
  store.vista.esito = null
  store.tocca = true
  store.selezionata = null
} )

describe( 'MatchDecisionPanel', () => {
  it( 'mulligan', async () => {
    store.vista.decisione = { tipo: 'mulligan', giocatore: 'A' }
    const w = mount( MatchDecisionPanel )
    await w.get( '[data-test="mulligan-si"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'mulligan', esegui: true } )
  } )

  it( 'finestra di risposta: passa e conto alla rovescia', async () => {
    store.vista.finestra = { contesto: 'giocata', priorita: 'A', passi: 0, passiNecessari: 1 }
    store.agg.scadenzaFinestra = Date.now() + 15000
    const w = mount( MatchDecisionPanel )
    expect( w.text() ).toMatch( /1[45] s/ )
    await w.get( '[data-test="passa"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'passa' } )
  } )

  it( 'fase azioni: passa il turno, scambio della carta selezionata, effetto del Costruttore', async () => {
    store.selezionata = 'A-1'
    const w = mount( MatchDecisionPanel )
    await w.get( '[data-test="passa-turno"]' ).trigger( 'click' )
    await w.get( '[data-test="scambio"]' ).trigger( 'click' )
    await w.get( '[data-test="costruttore"]' ).trigger( 'click' )
    expect( invia.mock.calls.map( ( c ) => c[0] ) ).toEqual( [
      { tipo: 'passaTurno' }, { tipo: 'scambio', uid: 'A-1' }, { tipo: 'usaEffetto', uid: 'A-C' },
    ] )
  } )

  it( 'non mostra nulla di azionabile quando non tocca a me', () => {
    store.tocca = false
    const w = mount( MatchDecisionPanel )
    expect( w.find( 'button' ).exists() ).toBe( false )
  } )

  it( 'esito finale', () => {
    store.vista.esito = { vincitore: 'B', motivo: 'collasso' }
    const w = mount( MatchDecisionPanel )
    expect( w.text() ).toContain( 'Hai perso' )
    expect( w.text() ).toContain( 'Collasso (IT a zero)' )
  } )
} )

describe( 'MatchManualPanel', () => {
  beforeEach( () => { store.vista.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-5', origine: 'stack' } } )

  it( 'mostra il testo della carta e applica TP +1', async () => {
    const w = mount( MatchManualPanel, { props: { bersaglio: null } } )
    expect( w.text() ).toContain( 'Aumenta la TP di 1.' )
    await w.get( '[data-test="tp-piu"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'base', base: { op: 'tp', delta: 1 } } )
  } )

  it( 'modifica PEP sul bersaglio scelto dal tavolo', async () => {
    const w = mount( MatchManualPanel, { props: { bersaglio: 'A-5' } } )
    await w.get( '[data-test="pep-piu"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'base', base: { op: 'modifica', uid: 'A-5', stat: 'pep', delta: 1, durata: 'collisione' } } )
  } )

  it( 'le azioni su carta sono disattivate senza bersaglio', () => {
    const w = mount( MatchManualPanel, { props: { bersaglio: null } } )
    expect( w.get( '[data-test="distruggi"]' ).attributes( 'disabled' ) ).toBeDefined()
  } )

  it( 'danno IT all avversario e fatto', async () => {
    const w = mount( MatchManualPanel, { props: { bersaglio: null } } )
    await w.get( '[data-test="danno-avversario"]' ).trigger( 'click' )
    await w.get( '[data-test="fatto"]' ).trigger( 'click' )
    expect( invia.mock.calls.map( ( c ) => c[0] ) ).toEqual( [
      { tipo: 'base', base: { op: 'dannoIT', bersaglio: 'B', valore: 1 } }, { tipo: 'fatto' },
    ] )
  } )
} )
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `cd frontend && npx vitest run src/components/match/MatchPanels.spec.ts`
Expected: FAIL, componenti inesistenti.

- [ ] **Step 3: Scrivere i pannelli**

`frontend/src/components/match/MatchDecisionPanel.vue`:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import type { Decisione } from '../../types/match'

const match = useMatchStore()
const v = computed( () => match.vista! )
const d = computed( () => v.value.decisione as Decisione | null )
const io = computed( () => match.agg!.ruolo )
const NOMI_COL = { passato: 'Passato', presente: 'Presente', futuro: 'Futuro' } as const
const MOTIVI: Record<string, string> = {
  collasso: 'Collasso (IT a zero)', sincronia: 'Sincronia', collassoEntropico: 'Collasso Entropico (mazzo vuoto)',
  pareggio: 'Pareggio', abbandono: 'Abbandono', chiusa: 'Partita chiusa',
}

const ora = ref( Date.now() )
let t: ReturnType<typeof setInterval> | undefined
onMounted( () => { t = setInterval( () => { ora.value = Date.now() }, 500 ) } )
onBeforeUnmount( () => clearInterval( t ) )
const secondi = computed( () => ( match.agg!.scadenzaFinestra ? Math.max( 0, Math.ceil( ( match.agg!.scadenzaFinestra - ora.value ) / 1000 ) ) : null ) )

const scambio = computed( () => ( match.selezionata ? match.mosseDi( match.selezionata ).find( ( m ) => m.tipo === 'scambio' ) : undefined ) )
const esitoTesto = computed( () => {
  const e = v.value.esito
  if ( !e ) return ''
  return e.vincitore === null ? 'Pareggio' : e.vincitore === io.value ? 'Hai vinto' : 'Hai perso'
} )

function arrenditi() {
  if ( window.confirm( 'Vuoi davvero abbandonare la partita?' ) ) match.arrenditi()
}
</script>

<template>
  <div class="pannello">
    <template v-if="v.esito">
      <h2>{{ esitoTesto }}</h2>
      <p>{{ MOTIVI[v.esito.motivo] ?? v.esito.motivo }}</p>
      <RouterLink to="/partita">Nuova partita</RouterLink>
    </template>

    <template v-else-if="match.tocca && d">
      <template v-if="d.tipo === 'sceltaIniziativa'">
        <p>Hai vinto il dado.</p>
        <button data-test="iniziativa-tieni" @click="match.invia({ tipo: 'sceltaIniziativa', tieni: true })">Tengo l'iniziativa</button>
        <button data-test="iniziativa-cedi" @click="match.invia({ tipo: 'sceltaIniziativa', tieni: false })">La cedo</button>
      </template>
      <template v-else-if="d.tipo === 'mulligan'">
        <p>Vuoi rimescolare la mano e pescarne 4?</p>
        <button data-test="mulligan-no" @click="match.invia({ tipo: 'mulligan', esegui: false })">Tengo la mano</button>
        <button data-test="mulligan-si" @click="match.invia({ tipo: 'mulligan', esegui: true })">Mulligan</button>
      </template>
      <template v-else-if="d.tipo === 'bonusControllo'">
        <p>Bonus Controllo: hai più Frammenti nel Presente.</p>
        <button data-test="bonus-si" @click="match.invia({ tipo: 'bonusControllo', pesca: true })">Pesco la carta extra</button>
        <button data-test="bonus-no" @click="match.invia({ tipo: 'bonusControllo', pesca: false })">Rinuncio</button>
      </template>
      <p v-else-if="d.tipo === 'capienza'">Colonna piena: clicca il tuo Frammento da distruggere nel {{ NOMI_COL[d.colonna] }}.</p>
    </template>

    <template v-else-if="match.tocca && v.finestra">
      <p>{{ v.finestra.contesto === 'collisione' ? 'Collisione: puoi rispondere con un Evento' : 'Puoi rispondere con un Evento' }}</p>
      <p v-if="secondi !== null">{{ secondi }} s</p>
      <button data-test="passa" @click="match.invia({ tipo: 'passa' })">Passa</button>
    </template>

    <template v-else-if="match.tocca && v.fase === 'azioni'">
      <button data-test="passa-turno" @click="match.invia({ tipo: 'passaTurno' })">Passa il turno</button>
      <button v-if="scambio" data-test="scambio" @click="match.invia(scambio!)">Scambia la carta selezionata (+1 ET)</button>
      <button data-test="costruttore" @click="match.invia({ tipo: 'usaEffetto', uid: v.giocatori[io].costruttore.uid })">Usa effetto del Costruttore</button>
    </template>

    <button v-if="!v.esito && match.tocca" class="pannello__resa" data-test="arrenditi" @click="arrenditi">Arrenditi</button>
  </div>
</template>

<style scoped>
.pannello { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; padding: .5rem .8rem; background: #0b0e1add; border-radius: .5rem; }
.pannello p { margin: 0; }
.pannello__resa { margin-left: auto; opacity: .7; }
</style>
```

Nota: nel test "non mostra nulla di azionabile" anche "Arrenditi" sparisce perché è sotto `match.tocca`. Abbandonare quando non tocca a te passa da `arrenditi` lato server comunque: se serve, si sposta il bottone fuori dalla condizione in un secondo momento (non è nella spec).

`frontend/src/components/match/MatchManualPanel.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import { useCardStore } from '../../stores/cardStore'
import type { AzioneBase, Colonna, Durata, PlayerId, StatoMateria } from '../../types/match'

const props = defineProps<{ bersaglio: string | null }>()
const match = useMatchStore()
const cards = useCardStore()
const v = computed( () => match.vista! )
const io = computed( () => match.agg!.ruolo )
const avv = computed<PlayerId>( () => ( io.value === 'A' ? 'B' : 'A' ) )
const d = computed( () => ( v.value.decisione?.tipo === 'effettoManuale' ? v.value.decisione : null ) )
const visibile = computed( () => !!d.value && match.tocca )

function cardIdDi( uid: string ): number | null {
  for ( const col of Object.values( v.value.colonne ) ) {
    const c = col.find( ( x ) => x.uid === uid )
    if ( c ) return c.cardId
  }
  const s = v.value.stack.find( ( x ) => x.uid === uid )
  if ( s ) return s.cardId
  for ( const g of Object.values( v.value.giocatori ) ) {
    if ( g.costruttore.uid === uid ) return g.costruttore.cardId
    const m = g.mano?.find( ( x ) => x.uid === uid )
    if ( m ) return m.cardId
  }
  if ( v.value.anomalia?.uid === uid ) return v.value.anomalia.cardId
  return null
}

const carta = computed( () => {
  if ( !d.value ) return null
  const id = cardIdDi( d.value.uid )
  return id === null ? null : cards.getCardById( id ) ?? null
} )
const nomeBersaglio = computed( () => {
  if ( !props.bersaglio ) return null
  const id = cardIdDi( props.bersaglio )
  return id === null ? 'carta coperta' : cards.getCardById( id )?.name ?? `Carta ${id}`
} )

const durata = ref<Durata>( 'collisione' )
const stato = ref<StatoMateria>( 'Solido' )
const colonna = ref<Colonna>( 'presente' )

const base = ( b: AzioneBase ) => match.invia( { tipo: 'base', base: b } )
const suBersaglio = ( f: ( uid: string ) => AzioneBase ) => { if ( props.bersaglio ) base( f( props.bersaglio ) ) }
</script>

<template>
  <div v-if="visibile" class="manuale">
    <h3>{{ carta?.name ?? 'Effetto' }}</h3>
    <p class="manuale__testo">{{ carta?.effect || 'Nessun testo.' }}</p>
    <p>Bersaglio: <strong>{{ nomeBersaglio ?? 'clicca una carta sul tavolo' }}</strong></p>

    <div class="manuale__gruppo">
      <span>TP</span>
      <button data-test="tp-meno" @click="base({ op: 'tp', delta: -1 })">−1</button>
      <button data-test="tp-piu" @click="base({ op: 'tp', delta: 1 })">+1</button>
      <button data-test="inversione" @click="base({ op: 'inversione', volontaria: true })">Inversione (1 danno a te)</button>
    </div>

    <div class="manuale__gruppo">
      <span>IT</span>
      <button data-test="danno-avversario" @click="base({ op: 'dannoIT', bersaglio: avv, valore: 1 })">1 danno all'avversario</button>
      <button data-test="danno-me" @click="base({ op: 'dannoIT', bersaglio: io, valore: 1 })">1 danno a te</button>
      <button data-test="pesca" @click="base({ op: 'pesca' })">Pesca 1</button>
    </div>

    <div class="manuale__gruppo">
      <span>Sul bersaglio</span>
      <select v-model="durata" aria-label="Durata">
        <option value="collisione">fino a fine Collisione</option>
        <option value="round">fino a fine round</option>
        <option value="permanente">permanente</option>
      </select>
      <button data-test="pep-meno" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'modifica', uid, stat: 'pep', delta: -1, durata }))">PEP −1</button>
      <button data-test="pep-piu" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'modifica', uid, stat: 'pep', delta: 1, durata }))">PEP +1</button>
      <button data-test="rp-meno" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'modifica', uid, stat: 'rp', delta: -1, durata }))">RP −1</button>
      <button data-test="rp-piu" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'modifica', uid, stat: 'rp', delta: 1, durata }))">RP +1</button>
    </div>

    <div class="manuale__gruppo">
      <select v-model="stato" aria-label="Stato">
        <option v-for="s in ['Solido', 'Liquido', 'Gas', 'Plasma', 'Materia Oscura']" :key="s" :value="s">{{ s }}</option>
      </select>
      <button data-test="cambia-stato" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'cambiaStato', uid, stato }))">Cambia stato</button>
      <select v-model="colonna" aria-label="Colonna">
        <option value="passato">Passato</option>
        <option value="presente">Presente</option>
        <option value="futuro">Futuro</option>
      </select>
      <button data-test="sposta" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'sposta', uid, colonna }))">Sposta</button>
    </div>

    <div class="manuale__gruppo">
      <button data-test="caldo" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'segnalino', uid, segnalino: 'caldo' }))">🔴</button>
      <button data-test="freddo" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'segnalino', uid, segnalino: 'freddo' }))">🔵</button>
      <button data-test="togli-segnalino" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'segnalino', uid, segnalino: null }))">Togli segnalino</button>
      <button data-test="distruggi" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'distruggi', uid }))">Distruggi</button>
      <button data-test="scarta" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'scarta', uid }))">Scarta</button>
      <button data-test="annulla" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'annulla', uid }))">Annulla effetto</button>
    </div>

    <button data-test="fatto" class="manuale__fatto" @click="match.invia({ tipo: 'fatto' })">Fatto</button>
  </div>
</template>

<style scoped>
.manuale { position: fixed; right: 17rem; bottom: 1rem; width: min(30rem, 90vw); max-height: 70vh; overflow-y: auto; padding: 1rem; background: #0b0e1af2; border: 1px solid #5c6bff88; border-radius: .6rem; z-index: 30; }
.manuale__testo { white-space: pre-line; font-style: italic; }
.manuale__gruppo { display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; margin: .4rem 0; }
.manuale__fatto { width: 100%; margin-top: .5rem; }
</style>
```

- [ ] **Step 4: Montare i pannelli nel tavolo**

In `MatchTable.vue`:
- importare `MatchDecisionPanel`, `MatchManualPanel`, `ref`;
- aggiungere `const bersaglio = ref<string | null>( null )` e una funzione:

```ts
function cartaCliccata( uid: string ) {
  const d = v.value.decisione
  if ( match.tocca && d?.tipo === 'capienza' ) {
    match.invia( { tipo: 'capienza', distruggi: uid } )
    return
  }
  bersaglio.value = uid
}
```

- sostituire `@carta="emit('carta', $event)"` sulle tre `MatchColumn` con `@carta="cartaCliccata"`, togliere `defineEmits` e lo `<slot />`;
- dopo `<MatchHand ... />` inserire:

```vue
    <MatchDecisionPanel class="tavolo__pannello" />
    <MatchManualPanel :bersaglio="bersaglio" />
```

- aggiungere l'area `pannello` alla griglia: `grid-template-rows: auto auto 1fr auto auto;` e `grid-template-areas: 'barra barra' 'manoavv log' 'griglia log' 'pannello log' 'mano log';` con `.tavolo__pannello { grid-area: pannello; }`.

- [ ] **Step 5: Eseguire i test e vederli passare**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS su tutti gli spec (compreso `MatchTable.spec.ts`, che non deve rompersi per i pannelli: se lo fa per l'assenza di `RouterLink`, aggiungere `global: { stubs: { RouterLink: true } }` ai `mount` di quel file e motivarlo nel commit).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/match
git commit -m "feat(match): pannelli per decisioni, finestre di risposta con conto alla rovescia ed effetti manuali"
```

---

### Task 10: Prova end-to-end su due browser e chiusura

**Files:**
- Modify: `README.md` (sezione "Partita online": come avviarla in locale)
- Create: `docs/superpowers/plans/2026-10-13-rete-tavolo-1b-registro.md` (esito della prova)

**Interfaces:**
- Consumes: tutto.
- Produces: branch pushato, registro della prova.

- [ ] **Step 1: Suite completa**

```bash
cd /home/simone/Documenti/start2impact/JouleZeroPointDev
git diff feature/motore-regole-1a --stat -- backend/game/engine
cd backend && npx tsc --noEmit && npm test
cd ../frontend && npx vitest run && npm run build
```

Expected: il diff sul motore è vuoto; tutto verde.

- [ ] **Step 2: Avvio locale**

Backend con Mongo locale (`docker compose up -d mongo` se il `docker-compose.yml` lo prevede, altrimenti `MONGODB_URI` di sviluppo da `.env`), `PORT=3000`, poi frontend con `npm run dev` (porta 5174). Le carte devono essere nel database locale (se mancano, eseguire la sincronizzazione da Google Sheet già esistente in `services/cardSyncService.ts` come da README).

- [ ] **Step 3: Partita vera su due browser**

Con due utenti di prova (creati da `/register` in locale o già presenti nel database di sviluppo), ciascuno con un mazzo valido salvato dal deckbuilder:
1. Browser 1 (finestra normale): `/partita`, scegliere il mazzo, "Crea partita", copiare il link.
2. Browser 2 (finestra anonima): aprire il link, login, scegliere il mazzo, "Entra nella partita".
3. Giocare fino a un esito. Durante la partita provare almeno una volta: un Evento in risposta, il timeout di 20 secondi di una finestra, un effetto manuale con bersaglio, il Bonus Controllo, chiudere e riaprire una scheda (rientro), il messaggio "Ruota il dispositivo" con la finestra stretta in verticale.
4. Controllare in DevTools → Network → WS che i messaggi `partita:aggiornamento` non contengano `rng` né il catalogo, e che una carta coperta avversaria arrivi con `cardId: null`.
5. Controllare in Mongo che il documento `matches` esista con `log`, `seed`, `mazzi`, `esito`.

- [ ] **Step 4: Prova del proxy nginx**

```bash
cd /home/simone/Documenti/start2impact/JouleZeroPointDev
docker compose up -d --build
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost/socket.io/?EIO=4&transport=polling"
```

Expected: `200` (sostituire `localhost` con host e porta esposti dal `docker-compose.yml`). Poi una partita breve dal frontend servito da nginx, controllando in DevTools che il trasporto passi a `websocket` (richiesta `101 Switching Protocols`).

- [ ] **Step 5: Registro e README**

`docs/superpowers/plans/2026-10-13-rete-tavolo-1b-registro.md`: data, esito della partita di prova, problemi di usabilità trovati (uno per riga, con la decisione: corretto in questo branch / rinviato), controlli dello Step 3.4 e 3.5, esito del `curl` dello Step 4. Ultima riga: "Da fare dopo il deploy: `curl https://joulezeropoint.com/socket.io/?EIO=4&transport=polling` deve rispondere 200; Simone rilegge il paragrafo 'Partite online' dell'informativa prima del merge."

`README.md`: sezione "Partita online" con i passi dello Step 2 e la variabile `MATCH_WINDOW_TIMEOUT_MS`.

- [ ] **Step 6: Commit e push del branch (senza merge)**

```bash
git add README.md docs/superpowers/plans/2026-10-13-rete-tavolo-1b-registro.md
git commit -m "docs(match): prova end-to-end su due browser e istruzioni di avvio della partita online"
git push -u origin feature/rete-tavolo-1b
```
