# Effetti delle carte 1C-a (infrastruttura e carte pilota) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** il motore applica da solo gli effetti delle carte tramite dichiarazioni tipizzate in TypeScript; 23 carte pilota automatiche, le altre restano manuali fino al piano 1C-b; il tavolo gestisce scelte, attivabili, anteprima delle carte e layout a tutta larghezza.

**Architecture:** il motore emette eventi (`s.eventi`) nei punti in cui cambia lo stato; il dispatcher li trasforma in una coda di effetti (`s.coda`) leggendo il registro delle dichiarazioni, e `avanza` esegue la coda prima di finestre, stack e fasi. Un effetto che chiede una scelta lancia `Sospendi`: lo stato torna a prima dell'effetto, si apre la decisione `sceltaEffetto`, e alla risposta l'effetto riparte da capo rigiocando le scelte già date. Un effetto che lancia un errore riporta lo stato a prima, mette la carta in `s.manuali` e apre il pannello manuale.

**Tech Stack:** Node 24, TypeScript, Jest (backend); Vue 3, Pinia, Vitest (frontend); Socket.IO; Docker Compose per la prova.

**Spec:** `docs/superpowers/specs/2026-10-15-effetti-carte-1c-design.md` (sezioni 2-10). Regolamento: `frontend/public/Regolamento_Joule_Zero_Point_v6.pdf`.

**Scostamenti dalla spec, decisi nel piano:**
- Ogni dichiarazione porta anche il **nome** della carta (`carta(8, 'Sciame Termico', ...)`). Il motore usa la dichiarazione solo se il nome coincide con quello del catalogo della partita. Motivo: le carte finte dei test del motore usano id 1-20 che coincidono con id reali, e una risincronizzazione del Google Sheet che sposta un id non deve far eseguire a una carta l'effetto di un'altra. Una dichiarazione con nome sbagliato ricade sul manuale e il riepilogo la segnala.
- `backend/game/cardScripts.json` (oggi `{}`) viene cancellato: l'hash `versioneScript` si calcola sul registro (spec sezione 3).

## Global Constraints

- Branch `feature/effetti-carte-1c`. Niente merge su `main` in questo piano.
- Regolamento v6.0; il testo della carta prevale. Le interpretazioni I1-I30 della spec sezione 9 sono decise e vanno applicate alla lettera.
- Il motore resta puro: niente I/O, niente `console`, niente `Date.now()`. Gli errori degli effetti vanno in `s.erroriEffetti`, li stampa `partite.ts`.
- Lo stato della partita resta JSON puro (`structuredClone`): nello stato mai funzioni, classi o `Map`.
- Nei moduli di `backend/game/effetti/` nessuna chiamata a funzioni del motore o del linguaggio al caricamento del modulo: i due pacchetti si importano a vicenda, e un modulo può essere ancora a metà caricamento quando un altro lo usa. Per questo i file delle carte esportano **funzioni** che restituiscono le dichiarazioni, e il registro le chiama solo al primo uso.
- Stile backend: 2 spazi, apici singoli, punto e virgola, commenti in italiano. Stile frontend: spazi dentro le parentesi `( x )`, niente punto e virgola, come i file esistenti.
- Testi visibili all'utente in italiano, niente em dash.
- Timeout di finestre e scelte: 20 secondi (`MATCH_WINDOW_TIMEOUT_MS`).
- Nomi delle carte nelle dichiarazioni identici al catalogo (`backend/tests/game/fixtures/carte-v6.json`, già nel repo: esportato dal Mongo di prova il 2026-10-15).
- Test backend: `cd backend && npx jest <file>`; suite intera `cd backend && npx jest`. Frontend: `cd frontend && npx vitest run <file>`, tipi `npx vue-tsc --noEmit`.

## Review Focus

1. Una scelta in sospeso quando la partita va in pausa (avversario disconnesso): il timer della scelta non deve scattare in pausa e deve ripartire alla ripresa. Test in Task 7.
2. Un effetto che distrugge o sposta la propria carta e poi agisce ancora su "questa carta": nessun errore, nessun ripiego, l'azione successiva si salta. Test in Task 4.
3. Una risposta con un bersaglio fuori elenco, o del tipo sbagliato, mandata a mano dal client: rifiutata, stato invariato. Test in Task 4.
4. Un effetto che fa pescare con il mazzo vuoto (Fulmine di Esaurimento): Collasso Entropico come da regolamento, non un ripiego in manuale. Test in Task 8.
5. Colonna di destinazione piena per Nyx, Khepri, Vuoto di Probabilità: l'effetto non sposta nulla e non va in errore. Test in Task 9 (Nyx) e Task 8 (Il Mercuriale).

---

## File

**Backend, nuovi:**
- `backend/game/engine/eventi.ts`: `emetti`, `emettiIngresso`.
- `backend/game/engine/vita.ts`: `infliggiDanno` (danno IT, innesca `dannoIT`), `perdiVita` (perdita di IT, non è un danno, I6).
- `backend/game/effetti/dsl.ts`: tipi `Ctx`, `Az`, `Cond`, `Sel`, `DefEffetto`, `Continuo`, `Vieto`; azioni, condizioni, selettori, costruttori di dichiarazione.
- `backend/game/effetti/registro.ts`: mappa `cardId` → dichiarazione, controllo del nome.
- `backend/game/effetti/dispatcher.ts`: fonti attive, coda, esecuzione con sospensione e ripiego, ritardati, risposte.
- `backend/game/effetti/continui.ts`: bonus PEP, divieti, costi, limite della TP, Eventi giocabili.
- `backend/game/effetti/attivabili.ts`: mosse `attivaEffetto` e `usaEffetto`, esecuzione dell'attivazione.
- `backend/game/effetti/riepilogo.ts`: tabella markdown testo stampato contro script.
- `backend/game/effetti/carte/{solidi,liquidi,gas,plasma,materiaOscura,eventi,anomalie,costruttori}.ts`, `carte/speciali.ts`.
- `backend/scripts/riepilogoEffetti.ts`.
- Test: `backend/tests/game/effetti/{eventi,dsl,dispatcher,continui,attivabili,carte-frammenti,carte-altre,riepilogo}.test.ts`.

**Backend, modificati:** `engine/types.ts`, `engine/setup.ts`, `engine/campo.ts`, `engine/slittamento.ts`, `engine/temperatura.ts`, `engine/collisione.ts`, `engine/round.ts`, `engine/azioni.ts`, `engine/legali.ts`, `engine/index.ts`, `engine/vista.ts`, `engine/vittoria.ts`, `engine/invarianti.ts`, `game/catalogo.ts`, `game/partite.ts`, `backend/package.json`, `tests/game/helpers.ts`, `tests/game/simulazione.test.ts`.

**Frontend, modificati:** `types/match.ts`, `stores/matchStore.ts`, `components/match/{MatchHand,MatchCard,MatchColumn,MatchPile,MatchDecisionPanel,MatchTable,MatchStatusBar}.vue`, `views/MatchView.vue`, `App.vue`, spec esistenti. Nuovo: `components/match/MatchPreview.vue`.

---

### Task 1: Tipi e stato degli effetti

**Files:**
- Modify: `backend/game/engine/types.ts`
- Modify: `backend/game/engine/setup.ts:24-31`
- Modify: `backend/game/engine/vittoria.ts` (`fineRound`)
- Modify: `backend/tests/game/helpers.ts`
- Test: `backend/tests/game/effetti/eventi.test.ts` (creato qui, esteso nel Task 2)

**Interfaces:**
- Produces: i tipi `Momento`, `MOMENTI_PROPRI`, `MomentoRitardato`, `Origine`, `EventoGioco`, `Domanda`, `Risposta`, `Pendente`, `Ritardato`, `Sconto`, `CalcoloCollisione`, `Sottofase`; i nuovi campi di `StatoPartita`; la decisione `sceltaEffetto`; le azioni `rispondi` e `attivaEffetto`. Helper di test `catalogoReale()`, `statoReale()`, `inMano()`, `riempiMazzi()`, `mossa()`, `gioca()`.

- [ ] **Step 1: Scrivi il test che fallisce**

`backend/tests/game/effetti/eventi.test.ts`:

```ts
import { creaPartita } from '../../../game/engine';
import { fineRound } from '../../../game/engine/vittoria';
import { catalogoProva, catalogoReale, mazzoProva, statoVuoto } from '../helpers';

describe('stato degli effetti', () => {
  test('una partita nuova ha tutti i campi degli effetti vuoti', () => {
    const s = creaPartita({ seed: 1, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
    expect(s.eventi).toEqual([]);
    expect(s.coda).toEqual([]);
    expect(s.ritardati).toEqual([]);
    expect(s.usi).toEqual({});
    expect(s.silenziate).toEqual([]);
    expect(s.manuali).toEqual([]);
    expect(s.sconti).toEqual([]);
    expect(s.collisione).toBeNull();
    expect(s.sottofase).toBeNull();
    expect(s.tpRiferimento).toBe(0);
    expect(s.segnoTP).toBe(0);
    expect(s.erroriEffetti).toEqual([]);
  });

  test('fineRound azzera usi del round, carte silenziate e sconti, non quelli di Collisione', () => {
    const s = statoVuoto();
    s.usi = { 'A-1:0:round': 1, 'A-2:0:collisione': 1 };
    s.silenziate = ['B-3'];
    s.sconti = [{ giocatore: 'A', colonna: 'futuro', delta: -1 }];
    fineRound(s);
    expect(s.usi).toEqual({ 'A-2:0:collisione': 1 });
    expect(s.silenziate).toEqual([]);
    expect(s.sconti).toEqual([]);
  });

  test('il catalogo reale di prova ha le 120 carte del set', () => {
    const c = catalogoReale();
    expect(Object.keys(c)).toHaveLength(120);
    expect(c[8].nome).toBe('Sciame Termico');
    expect(c[255].tipo).toBe('Costruttore');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `cd backend && npx jest tests/game/effetti/eventi.test.ts`
Expected: FAIL in compilazione: `Property 'eventi' does not exist on type 'StatoPartita'` e `catalogoReale` non esportata.

- [ ] **Step 3: Aggiungi i tipi**

In `backend/game/engine/types.ts`, dopo `export type Durata = ...` e la sua interfaccia `Modifica`, aggiungi:

```ts
/** Momenti in cui un effetto innescato può scattare. I "propri" riguardano la carta stessa dell'evento. */
export type Momento =
  | 'entraPresente' | 'entraPassato' | 'entraFuturo' | 'distrutta' | 'immediato'
  | 'frammentoGiocato' | 'frammentoEntraPresente' | 'inizioRound' | 'inizioCollisione'
  | 'danniDeterminati' | 'dannoIT' | 'fineCollisione' | 'fineRound' | 'inversione' | 'cambioSegnoTP';
export const MOMENTI_PROPRI: Momento[] = ['entraPresente', 'entraPassato', 'entraFuturo', 'distrutta', 'immediato'];
export type MomentoRitardato = 'inizioRound' | 'risorse' | 'fineCollisione' | 'fineRound';
export type Origine = Colonna | 'mano';

export interface EventoGioco {
  momento: Momento;
  /** Carta coinvolta: quella che entra, viene distrutta, viene giocata o si risolve. */
  uid?: string;
  cardId?: number;
  owner?: PlayerId;
  /** Ingressi: colonna o zona di provenienza. `distrutta`: colonna in cui stava. */
  da?: Origine;
  /** `frammentoGiocato`: colonna in cui è stato giocato. */
  colonna?: Colonna;
  /** `dannoIT`: chi subisce. `frammentoGiocato` e `frammentoEntraPresente`: di chi è il Frammento. `inversione`: chi la provoca. */
  giocatore?: PlayerId;
  valore?: number;
  inCollisione?: boolean;
}

export type Domanda =
  | { tipo: 'siNo'; testo: string }
  | { tipo: 'bersaglio'; testo: string; uids: string[] }
  | { tipo: 'opzione'; testo: string; opzioni: string[] };
export type Risposta = boolean | string | number;

/** Un effetto in coda. `scelte` sono le risposte già date, rigiocate a ogni ripresa. */
export interface Pendente {
  cardId: number;
  indice: number;
  sorgente: string;
  controllore: PlayerId;
  evento: EventoGioco;
  scelte: Risposta[];
  dati: Record<string, string | number>;
}

export interface Ritardato extends Pendente {
  momento: MomentoRitardato;
  nome: string;
}

export interface Sconto {
  giocatore: PlayerId;
  colonna: Colonna;
  delta: number;
}

export interface CalcoloCollisione {
  danno: Record<PlayerId, number>;
  collasso: Record<PlayerId, boolean>;
}

export type Sottofase = null | 'danni' | 'chiusura' | 'fineRound';
```

Nella `Decisione` aggiungi la riga:

```ts
  | { tipo: 'sceltaEffetto'; giocatore: PlayerId; uid: string; cardId: number; domanda: Domanda }
```

In `StatoPartita`, dopo `log: VoceLog[];`, aggiungi:

```ts
  /** Eventi emessi e non ancora trasformati in effetti. */
  eventi: EventoGioco[];
  /** Effetti in attesa; il primo è quello in corso (anche sospeso su una scelta). */
  coda: Pendente[];
  ritardati: Ritardato[];
  /** Contatori "una volta per": chiave `uid:indice:round` o `uid:indice:collisione`. */
  usi: Record<string, number>;
  /** Carte senza effetti fino a fine Round (Deviazione Temporale). */
  silenziate: string[];
  /** cardId in ripiego manuale per il resto della partita. */
  manuali: number[];
  sconti: Sconto[];
  collisione: CalcoloCollisione | null;
  sottofase: Sottofase;
  /** TP subito dopo l'ultimo Slittamento: riferimento di Blocco Termico. */
  tpRiferimento: number;
  /** Segno dell'ultima TP diversa da 0 (I9). */
  segnoTP: -1 | 0 | 1;
  /** Errori degli effetti, che il gestore delle partite stampa sul server e svuota. */
  erroriEffetti: string[];
```

Nella `Azione` aggiungi:

```ts
  | { tipo: 'rispondi'; risposta: Risposta }
  | { tipo: 'attivaEffetto'; uid: string; indice: number }
```

- [ ] **Step 4: Inizializza i campi**

In `backend/game/engine/setup.ts`, nell'oggetto `s` di `creaPartita`, dopo `carte, log: [],` aggiungi:

```ts
    eventi: [], coda: [], ritardati: [], usi: {}, silenziate: [], manuali: [], sconti: [],
    collisione: null, sottofase: null, tpRiferimento: 0, segnoTP: 0, erroriEffetti: [],
```

In `backend/tests/game/helpers.ts`, in `statoVuoto()`, dopo `carte: catalogoProva(), log: [],` aggiungi la stessa riga.

In `backend/game/engine/vittoria.ts`, in `fineRound`, prima di `s.iniziativa = altro(s.iniziativa);` aggiungi:

```ts
  for (const k of Object.keys(s.usi)) if (k.endsWith(':round')) delete s.usi[k];
  s.silenziate = [];
  s.sconti = [];
```

- [ ] **Step 5: Aggiungi gli helper di test**

In fondo a `backend/tests/game/helpers.ts`:

```ts
import { applica, chiDeveAgire } from '../../game/engine';
import { daCardDb } from '../../game/engine/carte';
import { Azione } from '../../game/engine/types';
import carteV6 from './fixtures/carte-v6.json';

/** Le 120 carte vere del set, dalla fixture esportata dal Mongo di prova. */
export function catalogoReale(): Record<number, DefCarta> {
  const out: Record<number, DefCarta> = {};
  for (const c of carteV6) {
    const d = daCardDb(c);
    if (d) out[d.cardId] = d;
  }
  return out;
}

/** Stato vuoto con le carte vere; i Costruttori sono Chronos (254), che non ha dichiarazione nel 1C-a. */
export function statoReale(): StatoPartita {
  const s = statoVuoto();
  s.carte = catalogoReale();
  s.giocatori.A.costruttore.cardId = 254;
  s.giocatori.B.costruttore.cardId = 254;
  s.giocatori.A.et = 10;
  s.giocatori.B.et = 10;
  return s;
}

export function inMano(s: StatoPartita, p: PlayerId, cardId: number): string {
  const c = carta(p, cardId);
  s.giocatori[p].mano.push(c);
  return c.uid;
}

export function riempiMazzi(s: StatoPartita, cardId = 1, n = 10): void {
  for (const p of ['A', 'B'] as PlayerId[]) for (let i = 0; i < n; i++) s.giocatori[p].futuro.push(carta(p, cardId));
}

/** Applica una mossa e fallisce il test se il motore la rifiuta. */
export function mossa(s: StatoPartita, p: PlayerId, a: Azione): StatoPartita {
  const r = applica(s, p, a);
  if (!r.ok) throw new Error(`${JSON.stringify(a)} rifiutata: ${r.errore}`);
  return r.stato;
}

/** Gioca una carta e fa passare l'avversario nella finestra di risposta. */
export function gioca(s: StatoPartita, p: PlayerId, uid: string, colonna?: Colonna): StatoPartita {
  let t = mossa(s, p, { tipo: 'giocaCarta', uid, colonna });
  const o: PlayerId = p === 'A' ? 'B' : 'A';
  if (t.finestra && chiDeveAgire(t) === o) t = mossa(t, o, { tipo: 'passa' });
  return t;
}
```

Sposta gli `import` in cima al file insieme a quelli esistenti (`StatoPartita`, `PlayerId`, `Colonna`, `DefCarta` sono già importati da `types`).

- [ ] **Step 6: Esegui i test**

Run: `cd backend && npx jest tests/game/effetti/eventi.test.ts && npx tsc --noEmit`
Expected: PASS, nessun errore di tipo. Se `tsc` segnala altri punti che costruiscono uno `StatoPartita` a mano, aggiungi lì la stessa riga dello Step 4.

- [ ] **Step 7: Suite e commit**

Run: `cd backend && npx jest tests/game`
Expected: PASS (nessun comportamento cambiato).

```bash
git add backend/game/engine/types.ts backend/game/engine/setup.ts backend/game/engine/vittoria.ts backend/tests/game/helpers.ts backend/tests/game/effetti/eventi.test.ts backend/tests/game/fixtures/carte-v6.json
git commit -m "feat(effetti): tipi e campi di stato per gli effetti automatici"
```

---

### Task 2: Eventi emessi dal motore

**Files:**
- Create: `backend/game/engine/eventi.ts`, `backend/game/engine/vita.ts`
- Modify: `backend/game/engine/campo.ts` (`distruggi`, `sposta`)
- Modify: `backend/game/engine/slittamento.ts`
- Modify: `backend/game/engine/temperatura.ts`
- Modify: `backend/game/engine/collisione.ts` (danni via `infliggiDanno`)
- Test: `backend/tests/game/effetti/eventi.test.ts`

**Interfaces:**
- Consumes: tipi del Task 1.
- Produces: `emetti(s: StatoPartita, e: EventoGioco): void`; `emettiIngresso(s: StatoPartita, fc: CartaCampo, colonna: Colonna, da: Origine): void`; `infliggiDanno(s: StatoPartita, p: PlayerId, n: number): void`; `perdiVita(s: StatoPartita, p: PlayerId, n: number): void`. `metti` **non** emette: emettono i chiamanti.

- [ ] **Step 1: Scrivi i test che falliscono**

Aggiungi a `backend/tests/game/effetti/eventi.test.ts`:

```ts
import { distruggi, sposta } from '../../../game/engine/campo';
import { eseguiSlittamento } from '../../../game/engine/slittamento';
import { inverti, ricalcolaTP } from '../../../game/engine/temperatura';
import { infliggiDanno, perdiVita } from '../../../game/engine/vita';
import { inCampo } from '../helpers';

describe('eventi emessi dal motore', () => {
  test('sposta nel Presente emette entraPresente e frammentoEntraPresente', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'futuro');
    sposta(s, fc.uid, 'presente');
    expect(s.eventi.map((e) => e.momento)).toEqual(['entraPresente', 'frammentoEntraPresente']);
    expect(s.eventi[0]).toMatchObject({ uid: fc.uid, cardId: 3, owner: 'A', da: 'futuro' });
    expect(s.eventi[1]).toMatchObject({ giocatore: 'A' });
  });

  test('una carta coperta che entra non emette il proprio ingresso', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente');
    sposta(s, fc.uid, 'futuro');
    s.eventi = [];
    const coperta = inCampo(s, 'B', 3, 'passato', { coperta: true });
    sposta(s, coperta.uid, 'futuro');
    expect(s.eventi).toEqual([]);
  });

  test('distruggi emette distrutta con colonna e contesto di Collisione', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'B', 1, 'presente');
    s.fase = 'collisione';
    distruggi(s, fc.uid);
    expect(s.eventi).toEqual([
      { momento: 'distrutta', uid: fc.uid, cardId: 1, owner: 'B', da: 'presente', inCollisione: true },
    ]);
  });

  test('lo Slittamento emette gli ingressi e fissa la TP di riferimento', () => {
    const s = statoVuoto();
    const f = inCampo(s, 'A', 3, 'futuro', { coperta: true });
    const p = inCampo(s, 'B', 1, 'presente');
    eseguiSlittamento(s);
    expect(s.eventi.map((e) => [e.momento, e.uid])).toEqual([
      ['entraPassato', p.uid],
      ['entraPresente', f.uid],
      ['frammentoEntraPresente', f.uid],
    ]);
    expect(s.tpRiferimento).toBe(s.tp);
  });

  test('cambio di segno della TP: da +1 a -1 sì, da +1 a 0 no', () => {
    const s = statoVuoto();
    s.tpSpostamento = 1;
    ricalcolaTP(s);
    expect(s.segnoTP).toBe(1);
    s.tpSpostamento = 0;
    ricalcolaTP(s);
    expect(s.eventi).toEqual([]);
    s.tpSpostamento = -1;
    ricalcolaTP(s);
    expect(s.eventi).toEqual([{ momento: 'cambioSegnoTP', valore: -1 }]);
    expect(s.segnoTP).toBe(-1);
  });

  test("l'Inversione emette inversione con chi la provoca", () => {
    const s = statoVuoto();
    inverti(s, 'A');
    inverti(s, null);
    expect(s.eventi).toEqual([{ momento: 'inversione', giocatore: 'A' }, { momento: 'inversione' }]);
  });

  test('danno IT emette dannoIT, perdita di IT no (I6)', () => {
    const s = statoVuoto();
    infliggiDanno(s, 'B', 2);
    perdiVita(s, 'A', 1);
    expect(s.giocatori.B.it).toBe(18);
    expect(s.giocatori.A.it).toBe(19);
    expect(s.eventi).toEqual([{ momento: 'dannoIT', giocatore: 'B', valore: 2, inCollisione: false }]);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/effetti/eventi.test.ts`
Expected: FAIL, `Cannot find module '../../../game/engine/vita'`.

- [ ] **Step 3: Crea `engine/eventi.ts` e `engine/vita.ts`**

`backend/game/engine/eventi.ts`:

```ts
import { CartaCampo, Colonna, EventoGioco, Origine, StatoPartita } from './types';

/** Registra un evento: lo trasforma in effetti il dispatcher, al prossimo giro di `avanza`. */
export function emetti(s: StatoPartita, e: EventoGioco): void {
  s.eventi.push(e);
}

/** Ingresso di un Frammento in una colonna. Una carta coperta non applica il suo testo (I2 e 1A n. 7). */
export function emettiIngresso(s: StatoPartita, fc: CartaCampo, colonna: Colonna, da: Origine): void {
  if (fc.coperta) return;
  const base = { uid: fc.uid, cardId: fc.cardId, owner: fc.owner, da };
  const momento = colonna === 'presente' ? 'entraPresente' : colonna === 'passato' ? 'entraPassato' : 'entraFuturo';
  emetti(s, { momento, ...base });
  if (colonna === 'presente') emetti(s, { momento: 'frammentoEntraPresente', ...base, giocatore: fc.owner });
}
```

`backend/game/engine/vita.ts`:

```ts
import { emetti } from './eventi';
import { log, nomeG } from './log';
import { PlayerId, StatoPartita } from './types';

/** Danno IT: lo riducono gli effetti che riducono i danni e innesca "se subisci danni IT". */
export function infliggiDanno(s: StatoPartita, p: PlayerId, n: number): void {
  if (n <= 0) return;
  s.giocatori[p].it -= n;
  log(s, `${nomeG(p)} subisce ${n} danni IT (IT ${s.giocatori[p].it})`);
  emetti(s, { momento: 'dannoIT', giocatore: p, valore: n, inCollisione: s.fase === 'collisione' });
}

/** Perdita di IT come costo o penalità: non è un danno (interpretazione I6). */
export function perdiVita(s: StatoPartita, p: PlayerId, n: number): void {
  if (n <= 0) return;
  s.giocatori[p].it -= n;
  log(s, `${nomeG(p)} perde ${n} IT (IT ${s.giocatori[p].it})`);
}
```

- [ ] **Step 4: Emetti da `campo.ts`**

In `backend/game/engine/campo.ts` importa `import { emetti, emettiIngresso } from './eventi';` e sostituisci `distruggi` e `sposta` con:

```ts
export function distruggi(s: StatoPartita, uid: string, opz: { ricalcola?: boolean } = {}): boolean {
  const t = cercaInCampo(s, uid);
  const fc = togli(s, uid, opz);
  if (!fc || !t) return false;
  s.giocatori[fc.owner].orizzonte.push(aCarta(fc));
  log(s, `${def(s, fc.cardId).nome} finisce nell'Orizzonte degli Eventi`);
  emetti(s, {
    momento: 'distrutta', uid: fc.uid, cardId: fc.cardId, owner: fc.owner, da: t.colonna,
    inCollisione: s.fase === 'collisione',
  });
  return true;
}

/** Sposta per effetto: conserva modifiche e stato forzato, non dà Supporto Istantaneo salvo richiesta. */
export function sposta(
  s: StatoPartita, uid: string, colonna: Colonna, opz: { supporto?: boolean; ricalcola?: boolean } = {},
): CartaCampo | null {
  const da = cercaInCampo(s, uid)?.colonna;
  const fc = togli(s, uid, { ricalcola: opz.ricalcola });
  if (!fc || !da) return null;
  const coperta = fc.coperta && colonna === 'futuro';
  const n = metti(s, aCarta(fc), colonna, { supporto: opz.supporto ?? false, coperta });
  n.modifiche = fc.modifiche;
  n.statoForzato = fc.statoForzato;
  if (colonna === 'presente' && opz.ricalcola !== false) ricalcolaTP(s);
  log(s, `${coperta ? 'Un Frammento coperto' : def(s, fc.cardId).nome} si sposta nel ${NOMI_COLONNA[colonna]}`);
  emettiIngresso(s, n, colonna, da);
  return n;
}
```

- [ ] **Step 5: Emetti dallo Slittamento**

Sostituisci `eseguiSlittamento` in `backend/game/engine/slittamento.ts` con:

```ts
export function eseguiSlittamento(s: StatoPartita): void {
  const { passato, presente, futuro } = s.colonne;
  s.colonne = { passato: [], presente: [], futuro: [] };
  const ingressi: { fc: CartaCampo; colonna: Colonna; da: Colonna }[] = [];
  const pulisci = (fc: CartaCampo): CartaCampo => {
    fc.segnalino = null;
    return fc;
  };

  if (s.flusso === 'normale') {
    for (const fc of passato) s.giocatori[fc.owner].memoria.unshift(aCarta(fc));
    for (const fc of presente) {
      s.colonne.passato.push(pulisci(fc));
      supportoIstantaneo(s, fc);
      ingressi.push({ fc, colonna: 'passato', da: 'presente' });
    }
    for (const fc of futuro) {
      fc.coperta = false;
      s.colonne.presente.push(pulisci(fc));
      ingressi.push({ fc, colonna: 'presente', da: 'futuro' });
    }
  } else {
    for (const fc of futuro) s.giocatori[fc.owner].futuro.unshift(rinomina(s, aCarta(fc)));
    for (const fc of presente) {
      s.colonne.futuro.push(pulisci(fc));
      ingressi.push({ fc, colonna: 'futuro', da: 'presente' });
    }
    for (const fc of passato) {
      s.colonne.presente.push(pulisci(fc));
      ingressi.push({ fc, colonna: 'presente', da: 'passato' });
    }
  }

  log(s, `Slittamento (flusso ${s.flusso})`);
  s.tpSpostamento = 0;
  ricalcolaTP(s);
  s.tpRiferimento = s.tp;
  // Le carte entrano insieme: gli effetti si accodano dopo il ricalcolo, li ordina il dispatcher.
  for (const i of ingressi) emettiIngresso(s, i.fc, i.colonna, i.da);
}
```

Aggiungi agli import `Colonna` da `./types` e `emettiIngresso` da `./eventi`.

- [ ] **Step 6: Emetti da `temperatura.ts`**

In `backend/game/engine/temperatura.ts` importa `emetti` da `./eventi`. In `ricalcolaTP`, sostituisci le ultime due righe (`if (s.tp !== prima) log(...)` e `if (Math.abs(s.tp) === 4 ...)`) con:

```ts
  if (s.tp !== prima) log(s, `TP ${s.tp > 0 ? '+' : ''}${s.tp}`);
  const segno = Math.sign(s.tp) as -1 | 0 | 1;
  if (segno !== 0) {
    if (s.segnoTP !== 0 && segno !== s.segnoTP) emetti(s, { momento: 'cambioSegnoTP', valore: s.tp });
    s.segnoTP = segno;
  }
  if (Math.abs(s.tp) === 4 && s.tp !== prima) inverti(s, null);
```

In `inverti`, in fondo alla funzione:

```ts
  emetti(s, controllore ? { momento: 'inversione', giocatore: controllore } : { momento: 'inversione' });
```

- [ ] **Step 7: Danni di Collisione via `infliggiDanno`**

In `backend/game/engine/collisione.ts` importa `infliggiDanno` da `./vita` e sostituisci il ciclo che applica i danni:

```ts
  for (const p of GIOCATORI) infliggiDanno(s, p, danno[p]);
```

(`infliggiDanno` scrive lo stesso testo di log usato finora.)

- [ ] **Step 8: Esegui i test**

Run: `cd backend && npx jest tests/game && npx tsc --noEmit`
Expected: PASS. Gli eventi si accumulano in `s.eventi` senza conseguenze: il dispatcher arriva nel Task 4.

- [ ] **Step 9: Commit**

```bash
git add backend/game/engine/eventi.ts backend/game/engine/vita.ts backend/game/engine/campo.ts backend/game/engine/slittamento.ts backend/game/engine/temperatura.ts backend/game/engine/collisione.ts backend/tests/game/effetti/eventi.test.ts
git commit -m "feat(effetti): il motore emette gli eventi di ingresso, distruzione, TP, Inversione e danno"
```

---

### Task 3: Linguaggio delle dichiarazioni e registro

**Files:**
- Create: `backend/game/effetti/dsl.ts`, `backend/game/effetti/registro.ts`
- Test: `backend/tests/game/effetti/dsl.test.ts`

**Interfaces:**
- Consumes: `emetti`, `infliggiDanno`, `perdiVita` (Task 2); `sposta`, `distruggi`, `metti` da `engine/campo`; `inverti`, `ricalcolaTP`; `pesca`, `ordine` da `engine/risorse`.
- Produces (usati da tutti i task successivi):
  - Tipi: `Ctx`, `Az`, `Cond`, `Sel`, `Chi`, `Bers`, `Vieto`, `CtxContinuo`, `Continuo`, `DefEffetto`, `DichiarazioneCarta`, `Opzione`; classe `Sospendi`.
  - Azioni: `tp`, `dannoIT`, `perdiIT`, `pesca`, `guadagnaET`, `inversione`, `distruggi`, `spostaIn`, `spostaOpposto`, `modifica`, `sconto`, `guarda`, `annullaOSilenzia`, `riduciDanniSubiti`, `programma`, `suCartaGiocata`, `azione`, `scartaUna`.
  - Combinatori: `se`, `puoi`, `opzione`, `scegliUno`, `scegli`, `primaVoltaPer`.
  - Condizioni: `tpAlmeno`, `tpDiversaDa`, `inCollisione`, `danniDaSubire`, `controlliIlPresente`, `entratoDallAvversario`, `giocatoNelFuturoDaTe`, `questaNelPresente`, `bersaglioNelPresente`, `spazioIn`, `haBersagli`, `tutte`.
  - Selettori: `frammentiNelPresente`, `coperteAvversarieNelFuturo`, `tuoiFrammentiScambiabili`, `carteAnnullabili`.
  - Dichiarazioni: `quando`, `attivabile`, `continuo`, `ritardato`, `carta`, `descrivi`.
  - Registro: `registra(lista)`, `dichiarazioni(s, cardId): DefEffetto[] | null`, `haDichiarazione(s, cardId): boolean`, `dichiarazioneRegistrata(cardId): DichiarazioneCarta | null`, `carteDichiarate(): number[]`, `registraPerTest(d): () => void`.

- [ ] **Step 1: Scrivi i test che falliscono**

`backend/tests/game/effetti/dsl.test.ts`:

```ts
import {
  attivabile, azione, carta, Ctx, descrivi, inCollisione, opzione, puoi, quando, ritardato, scegliUno, se,
  spazioIn, tp, tpAlmeno,
} from '../../../game/effetti/dsl';
import {
  carteDichiarate, dichiarazioneRegistrata, dichiarazioni, haDichiarazione, registraPerTest,
} from '../../../game/effetti/registro';
import { Domanda, Risposta } from '../../../game/engine/types';
import { inCampo, statoVuoto } from '../helpers';

function ctx(over: Partial<Ctx> = {}): Ctx {
  const s = statoVuoto();
  return {
    s, sorgente: 'A-X', cardId: 3, indice: 0, controllore: 'A', evento: { momento: 'immediato' }, dati: {},
    chiedi: () => null, ...over,
  };
}

describe('linguaggio delle dichiarazioni', () => {
  test('ogni mattone si descrive in italiano', () => {
    const d = carta(12, 'Impulso Ionico',
      quando('entraPresente', se(tpAlmeno(1), tp(1))),
      ritardato('perdita', tp(-1)));
    expect(descrivi(d)).toBe('quando entra nel Presente: se la TP è almeno +1: TP +1. «perdita»: TP -1');
    expect(attivabile({ quando: 'azioni', limite: 'round', se: spazioIn('futuro') }, tp(1)).testo)
      .toBe("attivabile nel tuo turno di azioni, una volta per Round, se c'è posto nel tuo Futuro: TP +1");
  });

  test('tp sposta la TP e la ricalcola', () => {
    const c = ctx();
    tp(2).f(c);
    expect(c.s.tp).toBe(2);
    expect(c.s.tpSpostamento).toBe(2);
  });

  test('puoi chiede Sì/No e applica solo con Sì', () => {
    const domande: Domanda[] = [];
    let risposta: Risposta = false;
    const c = ctx({ chiedi: (d) => { domande.push(d); return risposta; } });
    const az = puoi(tp(1));
    az.f(c);
    expect(c.s.tp).toBe(0);
    risposta = true;
    az.f(c);
    expect(c.s.tp).toBe(1);
    expect(domande[0]).toEqual({ tipo: 'siNo', testo: 'Carta 3: vuoi TP +1?' });
  });

  test('scegliUno applica l opzione scelta', () => {
    const c = ctx({ chiedi: () => 1 });
    scegliUno(opzione('TP +1', tp(1)), opzione('TP -1', tp(-1))).f(c);
    expect(c.s.tp).toBe(-1);
  });

  test('inCollisione legge il contesto dell evento', () => {
    expect(inCollisione.f(ctx({ evento: { momento: 'distrutta', inCollisione: true } }))).toBe(true);
    expect(inCollisione.f(ctx())).toBe(false);
  });

  test('azione è la via di uscita in codice', () => {
    const c = ctx();
    azione('metti un segno', (x) => { x.dati.segno = 1; }).f(c);
    expect(c.dati.segno).toBe(1);
  });
});

describe('registro', () => {
  test('la dichiarazione vale solo se il nome coincide con il catalogo della partita', () => {
    const togli = registraPerTest(carta(3, 'Carta 3', quando('entraPresente', tp(1))));
    const s = statoVuoto();
    expect(haDichiarazione(s, 3)).toBe(true);
    expect(dichiarazioni(s, 3)).toHaveLength(1);
    s.carte[3] = { ...s.carte[3], nome: 'Altro nome' };
    expect(dichiarazioni(s, 3)).toBeNull();
    expect(dichiarazioneRegistrata(3)?.nome).toBe('Carta 3');
    togli();
    expect(dichiarazioneRegistrata(3)).toBeNull();
    expect(carteDichiarate()).not.toContain(3);
  });

  test('inCampo resta usabile con le dichiarazioni', () => {
    const s = statoVuoto();
    expect(inCampo(s, 'A', 3, 'presente').cardId).toBe(3);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/effetti/dsl.test.ts`
Expected: FAIL, `Cannot find module '../../../game/effetti/dsl'`.

- [ ] **Step 3: Scrivi `backend/game/effetti/dsl.ts`**

```ts
// Linguaggio delle dichiarazioni degli effetti delle carte (spec 1C, sezione 2).
// Ogni mattone ha una frase in italiano (`d`) e una funzione (`f`): la frase serve al riepilogo che Simone
// valida, la funzione al motore. Nessuna chiamata al motore al caricamento del modulo: engine ed effetti
// si importano a vicenda.
import { distruggi as distruggiCarta, sposta as spostaCarta } from '../engine/campo';
import { cercaInCampo, contaInColonna, def } from '../engine/carte';
import { log, nomeG, NOMI_COLONNA } from '../engine/log';
import { ordine, pesca as pescaCarta } from '../engine/risorse';
import { inverti, ricalcolaTP } from '../engine/temperatura';
import {
  altro, CartaCampo, Colonna, COLONNE, DefCarta, Domanda, Durata, EventoGioco, Momento, MomentoRitardato,
  PlayerId, Risposta, StatoPartita,
} from '../engine/types';
import { infliggiDanno, perdiVita } from '../engine/vita';
import { vietato } from './continui';

/** Lanciata da `chiedi` quando la risposta non c'è ancora: il dispatcher apre la decisione. */
export class Sospendi extends Error {
  constructor(public domanda: Domanda, public chi: PlayerId) {
    super('Scelta in sospeso');
  }
}

export interface Ctx {
  s: StatoPartita;
  sorgente: string;
  cardId: number;
  indice: number;
  controllore: PlayerId;
  evento: EventoGioco;
  dati: Record<string, string | number>;
  /** Restituisce la risposta già data o sospende l'effetto. `null` se la domanda non ha scelte possibili. */
  chiedi(d: Domanda, chi?: PlayerId): Risposta | null;
}

export interface Az { d: string; f: (c: Ctx) => void }
export interface Cond { d: string; f: (c: Ctx) => boolean }
export interface Sel { d: string; f: (c: Ctx) => string[] }
export type Chi = 'controllore' | 'avversario' | 'entrambi';
export type Bers = 'questa' | 'bersaglio';

export type Vieto = { tipo: 'evento'; giocatore: PlayerId } | { tipo: 'sposta'; uid: string };
export interface CtxContinuo { s: StatoPartita; sorgente: string; cardId: number; controllore: PlayerId }
export interface Continuo {
  /** Bonus PEP in Collisione alla carta `fc`. */
  pep?: (c: CtxContinuo, fc: CartaCampo) => number;
  vieta?: (c: CtxContinuo, v: Vieto) => boolean;
  /** Variazione del costo di una carta che `p` sta giocando. */
  costo?: (c: CtxContinuo, p: PlayerId, d: DefCarta, colonna?: Colonna) => number;
  limitaTP?: boolean;
  /** Sull'Evento stesso: si gioca solo durante la Collisione (I27). */
  soloInCollisione?: boolean;
}

export interface DefEffetto {
  tipo: 'innescato' | 'attivabile' | 'continuo' | 'ritardato';
  testo: string;
  momento?: Momento;
  esegui?: (c: Ctx) => void;
  quando?: 'azioni' | 'collisione';
  limite?: 'round';
  condizione?: Cond;
  continuo?: Continuo;
  nome?: string;
  /** Colonne oltre al Presente in cui il Frammento è attivo (testi che citano un'altra colonna). */
  attivaIn?: Colonna[];
}

export interface DichiarazioneCarta { cardId: number; nome: string; effetti: DefEffetto[] }

// ---- supporto ----

const inSequenza = (az: Az[]) => (c: Ctx): void => {
  for (const a of az) a.f(c);
};
const elenco = (az: Az[]): string => az.map((a) => a.d).join(', ');
const segno = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
const giocatoriDi = (c: Ctx, chi: Chi): PlayerId[] =>
  chi === 'controllore' ? [c.controllore] : chi === 'avversario' ? [altro(c.controllore)] : ordine(c.s);
const A_CHI: Record<Chi, string> = { controllore: 'a te', avversario: "all'avversario", entrambi: 'a entrambi i giocatori' };
const PER_CHI: Record<Chi, string> = { controllore: 'per te', avversario: "per l'avversario", entrambi: 'per entrambi i giocatori' };
const DURATE: Record<Durata, string> = { collisione: 'fino a fine Collisione', round: 'fino a fine Round', permanente: 'permanente' };
const MOMENTI_RITARDATI: Record<MomentoRitardato, string> = {
  inizioRound: "all'inizio del prossimo Round", risorse: 'nella fase Risorse del prossimo Round',
  fineCollisione: 'alla fine della Collisione', fineRound: 'alla fine del Round',
};

export const nomeFonte = (c: Ctx): string => def(c.s, c.cardId).nome;
const uidDi = (c: Ctx, b: Bers): string | null =>
  b === 'questa' ? c.sorgente : typeof c.dati.bersaglio === 'string' ? c.dati.bersaglio : null;
const descBers = (b: Bers): string => (b === 'questa' ? 'questa carta' : 'il bersaglio');

// ---- azioni ----

export const tp = (n: number): Az => ({
  d: `TP ${segno(n)}`,
  f: (c) => {
    log(c.s, `${nomeFonte(c)}: TP ${segno(n)}`);
    c.s.tpSpostamento += n;
    ricalcolaTP(c.s);
  },
});

export const dannoIT = (chi: Chi, n: number): Az => ({
  d: `${n} danno IT ${A_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) infliggiDanno(c.s, p, n);
  },
});

/** Perdita di IT: non è un danno (I6). */
export const perdiIT = (chi: Chi, n: number): Az => ({
  d: `perdita di ${n} IT ${PER_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) perdiVita(c.s, p, n);
  },
});

export const pesca = (chi: Chi, n = 1): Az => ({
  d: `pesca ${n} ${n === 1 ? 'carta' : 'carte'} ${PER_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) for (let i = 0; i < n; i++) pescaCarta(c.s, p);
  },
});

export const guadagnaET = (chi: Chi, n: number): Az => ({
  d: `+${n} ET ${PER_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) {
      c.s.giocatori[p].et += n;
      log(c.s, `${nomeFonte(c)}: ${nomeG(p)} ottiene ${n} ET`);
    }
  },
});

/** Inversione provocata da un effetto: non volontaria, quindi senza la tassa di 1 IT. */
export const inversione = (): Az => ({
  d: "avviene un'Inversione Temporale",
  f: (c) => inverti(c.s, null),
});

export const distruggi = (b: Bers = 'questa'): Az => ({
  d: `distruggi ${descBers(b)}`,
  f: (c) => {
    const uid = uidDi(c, b);
    if (uid) distruggiCarta(c.s, uid);
  },
});

export const spostaIn = (colonna: Colonna, b: Bers = 'questa'): Az => ({
  d: `sposta ${descBers(b)} nel ${NOMI_COLONNA[colonna]}`,
  f: (c) => {
    const uid = uidDi(c, b);
    const t = uid ? cercaInCampo(c.s, uid) : null;
    if (!uid || !t || t.colonna === colonna) return;
    if (vietato(c.s, { tipo: 'sposta', uid })) {
      log(c.s, `${def(c.s, t.carta.cardId).nome} non può essere spostato`);
      return;
    }
    if (contaInColonna(c.s, colonna, t.carta.owner) >= 4) {
      log(c.s, `${nomeFonte(c)}: il ${NOMI_COLONNA[colonna]} è pieno, nessuno spostamento`);
      return;
    }
    spostaCarta(c.s, uid, colonna);
  },
});

export const spostaOpposto = (): Az => ({
  d: 'sposta il bersaglio dal Passato al Futuro o viceversa',
  f: (c) => {
    const uid = uidDi(c, 'bersaglio');
    const t = uid ? cercaInCampo(c.s, uid) : null;
    if (!t || t.colonna === 'presente') return;
    spostaIn(t.colonna === 'passato' ? 'futuro' : 'passato', 'bersaglio').f(c);
  },
});

export const modifica = (stat: 'pep' | 'rp', delta: number, durata: Durata, b: Bers = 'questa'): Az => ({
  d: `${segno(delta)} ${stat.toUpperCase()} ${DURATE[durata]} a ${descBers(b)}`,
  f: (c) => {
    const uid = uidDi(c, b);
    const t = uid ? cercaInCampo(c.s, uid) : null;
    if (!t) return;
    t.carta.modifiche.push({ stat, delta, durata });
    log(c.s, `${def(c.s, t.carta.cardId).nome}: ${segno(delta)} ${stat.toUpperCase()}`);
  },
});

export const sconto = (colonna: Colonna, delta: number): Az => ({
  d: `la prossima carta che giochi nel ${NOMI_COLONNA[colonna]} in questo Round costa ${-delta} ET in meno`,
  f: (c) => {
    c.s.sconti.push({ giocatore: c.controllore, colonna, delta });
  },
});

/** Mostra il bersaglio (una carta coperta) solo al controllore. */
export const guarda = (): Az => ({
  d: 'guardi il bersaglio',
  f: (c) => {
    const uid = uidDi(c, 'bersaglio');
    const t = uid ? cercaInCampo(c.s, uid) : null;
    if (!t) return;
    log(c.s, `${nomeG(c.controllore)} guarda una carta coperta`);
    log(c.s, `${nomeFonte(c)}: la carta coperta è ${def(c.s, t.carta.cardId).nome}`, c.controllore);
  },
});

/** I14: un Evento in risposta viene annullato; una carta in campo o l'Anomalia resta senza effetti fino a fine Round. */
export const annullaOSilenzia = (): Az => ({
  d: "annulla il bersaglio: un Evento in risposta non si risolve, una carta in campo o l'Anomalia resta senza effetti fino a fine Round",
  f: (c) => {
    const uid = uidDi(c, 'bersaglio');
    if (!uid) return;
    const v = c.s.stack.find((x) => x.carta.uid === uid && !x.risolta);
    const nome = def(c.s, v ? v.carta.cardId : c.s.anomalia?.uid === uid ? c.s.anomalia.cardId : cercaInCampo(c.s, uid)!.carta.cardId).nome;
    if (v) {
      v.annullata = true;
      log(c.s, `${nomeFonte(c)}: ${nome} viene annullata`);
    } else {
      c.s.silenziate.push(uid);
      log(c.s, `${nomeFonte(c)}: ${nome} resta senza effetti fino a fine Round`);
    }
  },
});

export const riduciDanniSubiti = (n: number): Az => ({
  d: `riduci di ${n} i danni IT che subisci in questa Collisione`,
  f: (c) => {
    const k = c.s.collisione;
    if (!k) return;
    k.danno[c.controllore] = Math.max(0, k.danno[c.controllore] - n);
    log(c.s, `${nomeFonte(c)}: danni ridotti di ${n}`);
  },
});

/** Registra un effetto ritardato della stessa carta, dichiarato con `ritardato(nome, ...)`. */
export const programma = (nome: string, momento: MomentoRitardato): Az => ({
  d: `${MOMENTI_RITARDATI[momento]} «${nome}»`,
  f: (c) => {
    c.s.ritardati.push({
      cardId: c.cardId, indice: -1, nome, momento, sorgente: c.sorgente, controllore: c.controllore,
      evento: c.evento, scelte: [], dati: { ...c.dati },
    });
  },
});

/** Il bersaglio diventa la carta dell'evento (es. il Frammento appena giocato). */
export const suCartaGiocata = (): Az => ({
  d: 'sulla carta appena giocata',
  f: (c) => {
    if (c.evento.uid) c.dati.bersaglio = c.evento.uid;
  },
});

/** Via di uscita per i testi che il linguaggio non esprime. */
export const azione = (d: string, f: (c: Ctx) => void): Az => ({ d, f });

export const scartaUna = (chi: Chi): Az => ({
  d: `scarta 1 carta ${PER_CHI[chi]}`,
  f: (c) => {
    for (const p of giocatoriDi(c, chi)) {
      const g = c.s.giocatori[p];
      const r = c.chiedi({ tipo: 'bersaglio', testo: `${nomeFonte(c)}: scegli la carta da scartare`, uids: g.mano.map((x) => x.uid) }, p);
      const scelta = typeof r === 'string' ? g.mano.find((x) => x.uid === r) : undefined;
      if (!scelta) continue;
      g.mano = g.mano.filter((x) => x.uid !== scelta.uid);
      g.orizzonte.push(scelta);
      log(c.s, `${nomeG(p)} scarta ${def(c.s, scelta.cardId).nome}`);
    }
  },
});

// ---- combinatori ----

export const se = (cond: Cond, ...az: Az[]): Az => ({
  d: `se ${cond.d}: ${elenco(az)}`,
  f: (c) => {
    if (cond.f(c)) inSequenza(az)(c);
  },
});

export const puoi = (...az: Az[]): Az => ({
  d: `puoi: ${elenco(az)}`,
  f: (c) => {
    if (c.chiedi({ tipo: 'siNo', testo: `${nomeFonte(c)}: vuoi ${elenco(az)}?` }) === true) inSequenza(az)(c);
  },
});

export interface Opzione { d: string; az: Az[] }
export const opzione = (d: string, ...az: Az[]): Opzione => ({ d, az });

export const scegliUno = (...opz: Opzione[]): Az => ({
  d: `scegli: ${opz.map((o) => o.d).join(' oppure ')}`,
  f: (c) => {
    const r = c.chiedi({ tipo: 'opzione', testo: `${nomeFonte(c)}: scegli`, opzioni: opz.map((o) => o.d) });
    if (typeof r !== 'number' || !opz[r]) return;
    log(c.s, `${nomeFonte(c)}: ${opz[r].d}`);
    inSequenza(opz[r].az)(c);
  },
});

export const scegli = (sel: Sel, ...az: Az[]): Az => ({
  d: `scegli ${sel.d}, poi ${elenco(az)}`,
  f: (c) => {
    const r = c.chiedi({ tipo: 'bersaglio', testo: `${nomeFonte(c)}: scegli ${sel.d}`, uids: sel.f(c) });
    if (typeof r !== 'string') {
      log(c.s, `${nomeFonte(c)}: nessun bersaglio valido`);
      return;
    }
    c.dati.bersaglio = r;
    inSequenza(az)(c);
  },
});

export const primaVoltaPer = (per: 'round', ...az: Az[]): Az => ({
  d: `la prima volta per Round: ${elenco(az)}`,
  f: (c) => {
    const k = `${c.sorgente}:${c.indice}:${per}`;
    if (c.s.usi[k]) return;
    c.s.usi[k] = 1;
    inSequenza(az)(c);
  },
});

// ---- condizioni ----

export const tpAlmeno = (n: number): Cond => ({ d: `la TP è almeno ${segno(n)}`, f: (c) => c.s.tp >= n });
export const tpDiversaDa = (n: number): Cond => ({ d: `la TP è diversa da ${n}`, f: (c) => c.s.tp !== n });
export const inCollisione: Cond = { d: 'avviene durante la Collisione', f: (c) => !!c.evento.inCollisione };
export const danniDaSubire: Cond = {
  d: 'stai per subire danni IT', f: (c) => (c.s.collisione?.danno[c.controllore] ?? 0) > 0,
};
export const controlliIlPresente: Cond = {
  d: 'controlli il Presente',
  f: (c) => contaInColonna(c.s, 'presente', c.controllore) > contaInColonna(c.s, 'presente', altro(c.controllore)),
};
export const entratoDallAvversario: Cond = {
  d: "il Frammento è dell'avversario", f: (c) => !!c.evento.giocatore && c.evento.giocatore !== c.controllore,
};
export const giocatoNelFuturoDaTe: Cond = {
  d: 'hai giocato un Frammento nel Futuro',
  f: (c) => c.evento.momento === 'frammentoGiocato' && c.evento.colonna === 'futuro' && c.evento.giocatore === c.controllore,
};
export const questaNelPresente: Cond = {
  d: 'questa carta è nel Presente', f: (c) => cercaInCampo(c.s, c.sorgente)?.colonna === 'presente',
};
export const bersaglioNelPresente: Cond = {
  d: 'il bersaglio è ancora nel Presente',
  f: (c) => typeof c.dati.bersaglio === 'string' && cercaInCampo(c.s, c.dati.bersaglio)?.colonna === 'presente',
};
export const spazioIn = (col: Colonna): Cond => ({
  d: `c'è posto nel tuo ${NOMI_COLONNA[col]}`, f: (c) => contaInColonna(c.s, col, c.controllore) < 4,
});
export const haBersagli = (sel: Sel): Cond => ({ d: `esiste ${sel.d}`, f: (c) => sel.f(c).length > 0 });
export const tutte = (...cs: Cond[]): Cond => ({ d: cs.map((x) => x.d).join(' e '), f: (c) => cs.every((x) => x.f(c)) });

// ---- selettori ----

export const frammentiNelPresente: Sel = {
  d: 'un Frammento nel Presente', f: (c) => c.s.colonne.presente.map((x) => x.uid),
};
export const coperteAvversarieNelFuturo: Sel = {
  d: "una carta coperta nel Futuro dell'avversario",
  f: (c) => c.s.colonne.futuro.filter((x) => x.coperta && x.owner !== c.controllore).map((x) => x.uid),
};
export const tuoiFrammentiScambiabili: Sel = {
  d: 'un tuo Frammento nel Passato o nel Futuro, con posto nella colonna opposta',
  f: (c) => {
    const out: string[] = [];
    for (const [da, a] of [['passato', 'futuro'], ['futuro', 'passato']] as const) {
      if (contaInColonna(c.s, a, c.controllore) < 4) {
        out.push(...c.s.colonne[da].filter((x) => x.owner === c.controllore).map((x) => x.uid));
      }
    }
    return out;
  },
};
export const carteAnnullabili: Sel = {
  d: "un Evento in risposta, una carta scoperta in campo o l'Anomalia",
  f: (c) => [...new Set([
    ...c.s.stack.filter((v) => !v.risolta && !v.annullata && v.carta.uid !== c.sorgente).map((v) => v.carta.uid),
    ...COLONNE.flatMap((col) => c.s.colonne[col].filter((x) => !x.coperta).map((x) => x.uid)),
    ...(c.s.anomalia ? [c.s.anomalia.uid] : []),
  ])],
};

// ---- dichiarazioni ----

const MOMENTI_TESTO: Record<Momento, string> = {
  entraPresente: 'quando entra nel Presente', entraPassato: 'quando entra nel Passato',
  entraFuturo: 'quando entra nel Futuro', distrutta: 'quando viene distrutta', immediato: 'quando si risolve',
  frammentoGiocato: 'quando un giocatore gioca un Frammento',
  frammentoEntraPresente: 'quando un Frammento entra nel Presente',
  inizioRound: "all'inizio del Round, dopo lo Slittamento", inizioCollisione: "all'inizio della Collisione",
  danniDeterminati: 'quando sono determinati i danni della Collisione',
  dannoIT: 'quando un giocatore subisce danni IT', fineCollisione: 'alla fine della Collisione',
  fineRound: 'alla fine del Round', inversione: "quando avviene un'Inversione Temporale",
  cambioSegnoTP: 'quando la TP cambia segno',
};

export const quando = (m: Momento, ...az: Az[]): DefEffetto => ({
  tipo: 'innescato', momento: m, esegui: inSequenza(az), testo: `${MOMENTI_TESTO[m]}: ${elenco(az)}`,
});

export const attivabile = (
  o: { quando: 'azioni' | 'collisione'; limite?: 'round'; se?: Cond }, ...az: Az[]
): DefEffetto => ({
  tipo: 'attivabile', quando: o.quando, limite: o.limite, condizione: o.se, esegui: inSequenza(az),
  testo: `attivabile ${o.quando === 'azioni' ? 'nel tuo turno di azioni' : 'nella finestra di Collisione'}`
    + `${o.limite ? ', una volta per Round' : ''}${o.se ? `, se ${o.se.d}` : ''}: ${elenco(az)}`,
});

export const continuo = (testo: string, c: Continuo): DefEffetto => ({ tipo: 'continuo', continuo: c, testo: `sempre: ${testo}` });

export const ritardato = (nome: string, ...az: Az[]): DefEffetto => ({
  tipo: 'ritardato', nome, esegui: inSequenza(az), testo: `«${nome}»: ${elenco(az)}`,
});

export const carta = (cardId: number, nome: string, ...effetti: DefEffetto[]): DichiarazioneCarta => ({ cardId, nome, effetti });

export const descrivi = (d: DichiarazioneCarta): string => d.effetti.map((e) => e.testo).join('. ');
```

`continui.ts` non esiste ancora: crealo ora con il solo `vietato`, che il Task 5 completa:

```ts
// Effetti continui: il motore li interroga quando calcola un valore o controlla una mossa (spec 1C, 4.2).
import { StatoPartita } from '../engine/types';
import { Vieto } from './dsl';

export function vietato(_s: StatoPartita, _v: Vieto): boolean {
  return false;
}
```

- [ ] **Step 4: Scrivi `backend/game/effetti/registro.ts`**

```ts
// Registro delle dichiarazioni: cardId → effetti. Le carte si aggiungono con `registra` dai file in `carte/`.
import { StatoPartita } from '../engine/types';
import { DefEffetto, DichiarazioneCarta } from './dsl';

const registro = new Map<number, DichiarazioneCarta>();

// File delle carte: funzioni che restituiscono le dichiarazioni. Il Task 8 e il Task 9 le aggiungono qui.
// Anche l'elenco è una funzione: letto al caricamento potrebbe trovare un import ancora a metà.
const fonti = (): (() => DichiarazioneCarta[])[] => [];
let caricato = false;

/**
 * Registra le carte al primo uso e non al caricamento del modulo: engine ed effetti si importano a vicenda, e
 * al caricamento il linguaggio delle dichiarazioni può essere ancora a metà.
 */
function carica(): void {
  if (caricato) return;
  caricato = true;
  for (const f of fonti()) registra(f());
}

export function registra(lista: DichiarazioneCarta[]): void {
  for (const d of lista) {
    if (registro.has(d.cardId)) throw new Error(`Carta ${d.cardId} dichiarata due volte`);
    registro.set(d.cardId, d);
  }
}

/** Effetti della carta, solo se il nome dichiarato coincide con quello del catalogo della partita. */
export function dichiarazioni(s: StatoPartita, cardId: number): DefEffetto[] | null {
  carica();
  const d = registro.get(cardId);
  return d && s.carte[cardId]?.nome === d.nome ? d.effetti : null;
}

export const haDichiarazione = (s: StatoPartita, cardId: number): boolean => dichiarazioni(s, cardId) !== null;

export function dichiarazioneRegistrata(cardId: number): DichiarazioneCarta | null {
  carica();
  return registro.get(cardId) ?? null;
}

export function carteDichiarate(): number[] {
  carica();
  return [...registro.keys()].sort((a, b) => a - b);
}

/** Solo per i test: registra (o sostituisce) una dichiarazione e restituisce la funzione che la toglie. */
export function registraPerTest(d: DichiarazioneCarta): () => void {
  carica();
  const prima = registro.get(d.cardId);
  registro.set(d.cardId, d);
  return () => {
    if (prima) registro.set(d.cardId, prima);
    else registro.delete(d.cardId);
  };
}
```

- [ ] **Step 5: Esegui i test**

Run: `cd backend && npx jest tests/game/effetti/dsl.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/game/effetti backend/tests/game/effetti/dsl.test.ts
git commit -m "feat(effetti): linguaggio dichiarativo tipizzato e registro delle carte"
```

---

### Task 4: Dispatcher, scelte, ripiego e nuovo ciclo di `avanza`

**Files:**
- Create: `backend/game/effetti/dispatcher.ts`
- Modify: `backend/game/engine/collisione.ts` (split in calcolo e applicazione)
- Modify: `backend/game/engine/round.ts` (`avanza`)
- Modify: `backend/game/engine/index.ts` (`rispondi`, export di `rispostaDefault`)
- Modify: `backend/game/engine/legali.ts` (decisione `sceltaEffetto`)
- Modify: `backend/game/engine/invarianti.ts`
- Test: `backend/tests/game/effetti/dispatcher.test.ts`

**Interfaces:**
- Consumes: DSL e registro (Task 3), eventi (Task 2).
- Produces:
  - `interface Fonte { uid: string; cardId: number; controllore: PlayerId; zona: Colonna | 'anomalia' | 'costruttore' }`
  - `tutteLeFonti(s): Fonte[]`, `fontiAttive(s): Fonte[]` (senza silenziate e manuali), `attivaNellaZona(f: Fonte, d: DefEffetto): boolean`
  - `accoda(s): void`, `eseguiProssimo(s): void`, `scattaRitardati(s, m: MomentoRitardato): void`, `creaCtx(s, p: Pendente): Ctx`
  - `azzeraUsi(s, per: 'round' | 'collisione'): void`, `interrompiCatena(s): void`, `LIMITE_EFFETTI = 200`
  - `risposteValide(d: Domanda): Risposta[]`, `rispostaValida(d: Domanda, r: unknown): r is Risposta`, `rispostaDefault(d: Domanda): Risposta`, `rispondi(s, p, r: unknown): string | null`
  - In `collisione.ts`: `calcolaCollisione(s): CalcoloCollisione`, `applicaCollisione(s, c: CalcoloCollisione): void`; `risolviCollisione(s)` resta come scorciatoia per i test esistenti.

- [ ] **Step 1: Scrivi i test che falliscono**

`backend/tests/game/effetti/dispatcher.test.ts`:

```ts
import {
  azione, carta, distruggi, modifica, programma, puoi, quando, riduciDanniSubiti, ritardato, spostaIn, tp,
} from '../../../game/effetti/dsl';
import { registraPerTest } from '../../../game/effetti/registro';
import { scattaRitardati, LIMITE_EFFETTI } from '../../../game/effetti/dispatcher';
import { applica, mosseLegali, verificaInvarianti } from '../../../game/engine';
import { sposta } from '../../../game/engine/campo';
import { avanza } from '../../../game/engine/round';
import { inverti } from '../../../game/engine/temperatura';
import { inCampo, statoVuoto } from '../helpers';

let togli: (() => void)[] = [];
const dichiara = (...d: Parameters<typeof registraPerTest>) => togli.push(registraPerTest(...d));
afterEach(() => { togli.forEach((f) => f()); togli = []; });

describe('dispatcher', () => {
  test("un evento diventa effetto e si esegue al giro di avanza", () => {
    dichiara(carta(3, 'Carta 3', quando('entraPresente', tp(1))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'futuro');
    sposta(s, fc.uid, 'presente');
    avanza(s);
    expect(s.tp).toBe(2); // +1 perché Calda, +1 dall'effetto
    expect(s.coda).toEqual([]);
    expect(s.eventi).toEqual([]);
  });

  test("effetti simultanei: prima chi ha l'iniziativa, poi l'altro", () => {
    dichiara(carta(10, 'Carta 10', quando('inversione', azione('segna', (c) => { c.s.log.push({ round: 0, testo: `segno ${c.controllore}` }); }))));
    const s = statoVuoto();
    s.iniziativa = 'B';
    inCampo(s, 'A', 10, 'presente');
    inCampo(s, 'B', 10, 'presente');
    inverti(s, null);
    avanza(s);
    expect(s.log.filter((l) => l.testo.startsWith('segno')).map((l) => l.testo)).toEqual(['segno B', 'segno A']);
  });

  test('una scelta sospende senza applicare nulla, la risposta riparte da capo una volta sola', () => {
    dichiara(carta(10, 'Carta 10', quando('inversione', tp(1), puoi(tp(1)))));
    let s = statoVuoto();
    inCampo(s, 'A', 10, 'presente'); // Liquido Freddo; inCampo non ricalcola, la TP resta 0
    inverti(s, null);
    avanza(s);
    expect(s.decisione).toMatchObject({ tipo: 'sceltaEffetto', giocatore: 'A', cardId: 10, domanda: { tipo: 'siNo' } });
    expect([s.tp, s.tpSpostamento]).toEqual([0, 0]); // il primo tp(1) non resta applicato mentre si aspetta
    expect(mosseLegali(s, 'A')).toEqual([{ tipo: 'rispondi', risposta: true }, { tipo: 'rispondi', risposta: false }]);
    const r = applica(s, 'A', { tipo: 'rispondi', risposta: true });
    if (!r.ok) throw new Error(r.errore);
    s = r.stato;
    expect(s.tpSpostamento).toBe(2); // una volta sola per ciascun tp(1)
    expect(s.tp).toBe(1); // -1 dalla carta Fredda, +2 dagli effetti
    expect(s.decisione).toBeNull();
  });

  test('risposte non valide: rifiutate e stato invariato', () => {
    dichiara(carta(10, 'Carta 10', quando('inversione', puoi(tp(1)))));
    const s = statoVuoto();
    inCampo(s, 'A', 10, 'presente');
    inverti(s, null);
    avanza(s);
    expect(applica(s, 'A', { tipo: 'rispondi', risposta: 'A-1' })).toEqual({ ok: false, errore: 'Risposta non valida' });
    expect(applica(s, 'B', { tipo: 'rispondi', risposta: true })).toMatchObject({ ok: false });
  });

  test('errore in un effetto: stato riportato a prima, carta in manuale, pannello aperto', () => {
    dichiara(carta(3, 'Carta 3', quando('inversione', tp(1), azione('esplode', () => { throw new Error('boom'); }))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente');
    s.tp = 1;
    inverti(s, null);
    avanza(s);
    expect(s.tp).toBe(1);
    expect(s.manuali).toEqual([3]);
    expect(s.erroriEffetti[0]).toContain('boom');
    expect(s.decisione).toEqual({ tipo: 'effettoManuale', giocatore: 'A', uid: fc.uid, origine: 'libero' });
  });

  test("un effetto che distrugge la propria carta e poi la modifica non va in errore", () => {
    dichiara(carta(3, 'Carta 3', quando('inversione', distruggi(), modifica('pep', 1, 'round'))));
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente');
    inverti(s, null);
    avanza(s);
    expect(s.manuali).toEqual([]);
    expect(s.giocatori.A.orizzonte).toHaveLength(1);
  });

  test('ritardati: scattano al momento indicato', () => {
    dichiara(carta(3, 'Carta 3', quando('inversione', programma('dopo', 'fineRound')), ritardato('dopo', tp(-2))));
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente');
    inverti(s, null);
    avanza(s);
    expect(s.ritardati).toHaveLength(1);
    scattaRitardati(s, 'fineRound');
    avanza(s);
    expect(s.tp).toBe(-1);
    expect(s.ritardati).toEqual([]);
  });

  test('catena infinita: interrotta al limite, nessuna eccezione', () => {
    dichiara(carta(3, 'Carta 3',
      quando('entraPresente', spostaIn('passato')),
      quando('entraPassato', spostaIn('presente'))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'futuro');
    sposta(s, fc.uid, 'presente');
    avanza(s);
    expect(s.erroriEffetti).toContain('Catena di effetti oltre il limite');
    expect(s.coda).toEqual([]);
    expect(LIMITE_EFFETTI).toBe(200);
  });

  test('danni determinati: un effetto riduce il danno prima che si applichi', () => {
    dichiara(carta(100, 'Carta 100', quando('danniDeterminati', riduciDanniSubiti(2))));
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente'); // Plasma 3 PEP
    s.fase = 'collisione';
    avanza(s);
    expect(s.giocatori.B.it).toBe(18); // 3 + 1 Plasma - 2
  });

  test('fineCollisione e fineRound scattano in ordine', () => {
    const segna = (t: string) => azione(t, (c) => { c.s.log.push({ round: 0, testo: t }); });
    dichiara(carta(100, 'Carta 100', quando('fineCollisione', segna('fc')), quando('fineRound', segna('fr')), quando('inizioRound', segna('ir'))));
    const s = statoVuoto();
    s.fase = 'collisione';
    avanza(s);
    expect(s.log.filter((l) => ['fc', 'fr', 'ir'].includes(l.testo)).map((l) => l.testo)).toEqual(['fc', 'fc', 'fr', 'fr', 'ir', 'ir']);
  });

  test('invariante: niente effetti in sospeso senza una decisione', () => {
    const s = statoVuoto();
    s.eventi.push({ momento: 'inversione' });
    expect(verificaInvarianti(s)).toContain('effetti in sospeso senza una decisione');
  });
});
```

Nota sull'ultimo test di Collisione: i Costruttori di `statoVuoto` sono entrambi la carta 100, quindi ogni effetto del Costruttore scatta due volte (A e B). Le mazzi sono vuoti: dopo la Collisione la partita finisce per Collasso Entropico nella fase Risorse, ma `inizioRound` viene prima.

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/effetti/dispatcher.test.ts`
Expected: FAIL, `Cannot find module '../../../game/effetti/dispatcher'`.

- [ ] **Step 3: Scrivi `backend/game/effetti/dispatcher.ts`**

```ts
// Dispatcher degli effetti: dagli eventi emessi dal motore alla coda, e dalla coda all'esecuzione (spec 1C, 4-5).
import { cercaInCampo, def } from '../engine/carte';
import { log } from '../engine/log';
import { ordine } from '../engine/risorse';
import {
  Colonna, COLONNE, Domanda, MOMENTI_PROPRI, MomentoRitardato, Pendente, PlayerId, Risposta, StatoPartita,
} from '../engine/types';
import { Ctx, DefEffetto, Sospendi } from './dsl';
import { dichiarazioni } from './registro';

/** Effetti eseguibili in una sola chiamata di `avanza` prima di considerare la catena un ciclo. */
export const LIMITE_EFFETTI = 200;

export interface Fonte {
  uid: string;
  cardId: number;
  controllore: PlayerId;
  zona: Colonna | 'anomalia' | 'costruttore';
}

/** Costruttori, Frammenti scoperti in campo e Anomalia, in ordine di Iniziativa; l'Anomalia per ultima (I28). */
export function tutteLeFonti(s: StatoPartita): Fonte[] {
  const out: Fonte[] = [];
  for (const p of ordine(s)) {
    const g = s.giocatori[p];
    out.push({ uid: g.costruttore.uid, cardId: g.costruttore.cardId, controllore: p, zona: 'costruttore' });
    for (const col of COLONNE) {
      for (const fc of s.colonne[col]) {
        if (fc.owner === p && !fc.coperta) out.push({ uid: fc.uid, cardId: fc.cardId, controllore: p, zona: col });
      }
    }
  }
  if (s.anomalia) {
    out.push({ uid: s.anomalia.uid, cardId: s.anomalia.cardId, controllore: s.anomalia.owner, zona: 'anomalia' });
  }
  return out;
}

export function fontiAttive(s: StatoPartita): Fonte[] {
  return tutteLeFonti(s).filter((f) => !s.silenziate.includes(f.uid) && !s.manuali.includes(f.cardId));
}

/** Regola v6: un Frammento applica il testo solo nel Presente, salvo che il testo citi un'altra colonna. */
export function attivaNellaZona(f: Fonte, d: DefEffetto): boolean {
  if (f.zona === 'costruttore' || f.zona === 'anomalia' || f.zona === 'presente') return true;
  return (d.attivaIn ?? []).includes(f.zona);
}

/** Trasforma gli eventi registrati in effetti in coda, ordinati per Iniziativa con l'Anomalia in fondo. */
export function accoda(s: StatoPartita): void {
  const nuovi: { p: Pendente; rango: number }[] = [];
  const rango = (controllore: PlayerId, anomalia: boolean): number => (anomalia ? 2 : controllore === s.iniziativa ? 0 : 1);
  for (const e of s.eventi) {
    if (MOMENTI_PROPRI.includes(e.momento)) {
      if (e.cardId === undefined || !e.uid || !e.owner) continue;
      if (s.manuali.includes(e.cardId) || s.silenziate.includes(e.uid)) continue;
      const owner = e.owner;
      (dichiarazioni(s, e.cardId) ?? []).forEach((d, i) => {
        if (d.tipo !== 'innescato' || d.momento !== e.momento) return;
        if (e.momento === 'distrutta' && e.da !== 'presente' && !(d.attivaIn ?? []).includes(e.da as Colonna)) return;
        nuovi.push({
          p: { cardId: e.cardId!, indice: i, sorgente: e.uid!, controllore: owner, evento: e, scelte: [], dati: {} },
          rango: rango(owner, false),
        });
      });
      continue;
    }
    for (const f of fontiAttive(s)) {
      (dichiarazioni(s, f.cardId) ?? []).forEach((d, i) => {
        if (d.tipo !== 'innescato' || d.momento !== e.momento || !attivaNellaZona(f, d)) return;
        nuovi.push({
          p: { cardId: f.cardId, indice: i, sorgente: f.uid, controllore: f.controllore, evento: e, scelte: [], dati: {} },
          rango: rango(f.controllore, f.zona === 'anomalia'),
        });
      });
    }
  }
  s.eventi = [];
  nuovi.sort((a, b) => a.rango - b.rango);
  s.coda.push(...nuovi.map((n) => n.p));
}

/** Sposta in coda i ritardati del momento indicato. */
export function scattaRitardati(s: StatoPartita, momento: MomentoRitardato): void {
  const ora = s.ritardati.filter((r) => r.momento === momento);
  s.ritardati = s.ritardati.filter((r) => r.momento !== momento);
  for (const r of ora) {
    const indice = (dichiarazioni(s, r.cardId) ?? []).findIndex((d) => d.tipo === 'ritardato' && d.nome === r.nome);
    if (indice < 0) continue;
    s.coda.push({
      cardId: r.cardId, indice, sorgente: r.sorgente, controllore: r.controllore, evento: r.evento,
      scelte: r.scelte, dati: r.dati,
    });
  }
}

export function creaCtx(s: StatoPartita, p: Pendente): Ctx {
  let i = 0;
  return {
    s, sorgente: p.sorgente, cardId: p.cardId, indice: p.indice, controllore: p.controllore,
    evento: p.evento, dati: p.dati,
    chiedi(d: Domanda, chi: PlayerId = p.controllore): Risposta | null {
      if (risposteValide(d).length === 0) return null;
      const k = i++;
      if (k < p.scelte.length) return p.scelte[k];
      throw new Sospendi(d, chi);
    },
  };
}

type Foto = Omit<StatoPartita, 'carte'>;
function istantanea(s: StatoPartita): Foto {
  const { carte: _carte, ...resto } = s;
  return structuredClone(resto);
}
function ripristina(s: StatoPartita, foto: Foto): void {
  Object.assign(s, foto);
}

/**
 * Esegue il primo effetto in coda. Una scelta senza risposta riporta lo stato a prima dell'effetto e apre la
 * decisione: alla risposta l'effetto riparte da capo e rigioca le scelte già date, così nulla si applica due
 * volte. Un errore riporta lo stato a prima e mette la carta in manuale (spec 1C, sezione 5).
 */
export function eseguiProssimo(s: StatoPartita): void {
  const p = s.coda[0];
  const d = dichiarazioni(s, p.cardId)?.[p.indice];
  if (!d?.esegui || s.manuali.includes(p.cardId)) {
    s.coda.shift();
    return;
  }
  const foto = istantanea(s);
  try {
    d.esegui(creaCtx(s, p));
    s.coda.shift();
  } catch (e) {
    ripristina(s, foto);
    if (e instanceof Sospendi) {
      s.decisione = { tipo: 'sceltaEffetto', giocatore: e.chi, uid: p.sorgente, cardId: p.cardId, domanda: e.domanda };
      return;
    }
    ripiego(s, s.coda[0], e as Error);
  }
}

function ripiego(s: StatoPartita, p: Pendente, e: Error): void {
  s.coda.shift();
  s.manuali.push(p.cardId);
  const nome = def(s, p.cardId).nome;
  s.erroriEffetti.push(`${nome} (${p.cardId}), effetto ${p.indice}: ${e.message}`);
  log(s, `L'effetto di ${nome} non è riuscito: da qui in poi si applica a mano`);
  const presente = !!cercaInCampo(s, p.sorgente) || s.anomalia?.uid === p.sorgente
    || s.giocatori[p.controllore].costruttore.uid === p.sorgente;
  if (presente) s.decisione = { tipo: 'effettoManuale', giocatore: p.controllore, uid: p.sorgente, origine: 'libero' };
}

export function interrompiCatena(s: StatoPartita): void {
  s.coda = [];
  s.eventi = [];
  s.erroriEffetti.push('Catena di effetti oltre il limite');
  log(s, 'Troppi effetti a catena: la catena si interrompe qui');
}

export function azzeraUsi(s: StatoPartita, per: 'round' | 'collisione'): void {
  for (const k of Object.keys(s.usi)) if (k.endsWith(`:${per}`)) delete s.usi[k];
}

export function risposteValide(d: Domanda): Risposta[] {
  if (d.tipo === 'siNo') return [true, false];
  if (d.tipo === 'bersaglio') return [...d.uids];
  return d.opzioni.map((_, i) => i);
}

export function rispostaValida(d: Domanda, r: unknown): r is Risposta {
  return risposteValide(d).some((x) => x === r);
}

/** Risposta allo scadere del timer: No ai facoltativi, primo bersaglio o prima opzione agli obbligatori. */
export function rispostaDefault(d: Domanda): Risposta {
  return risposteValide(d)[d.tipo === 'siNo' ? 1 : 0];
}

export function rispondi(s: StatoPartita, p: PlayerId, r: unknown): string | null {
  const d = s.decisione;
  if (d?.tipo !== 'sceltaEffetto' || d.giocatore !== p) return 'Nessuna scelta in corso';
  if (!rispostaValida(d.domanda, r)) return 'Risposta non valida';
  s.coda[0].scelte.push(r);
  s.decisione = null;
  return null;
}
```

- [ ] **Step 4: Dividi la Collisione**

In `backend/game/engine/collisione.ts` sostituisci `risolviCollisione` con:

```ts
/** Calcola danni e Collassi senza toccare il campo: tra calcolo e applicazione scattano i `danniDeterminati`. */
export function calcolaCollisione(s: StatoPartita): CalcoloCollisione {
  const T: Record<PlayerId, Totali> = { A: totali(s, 'A'), B: totali(s, 'B') };
  const danno: Record<PlayerId, number> = { A: 0, B: 0 };
  const collasso: Record<PlayerId, boolean> = { A: false, B: false };
  for (const p of GIOCATORI) {
    const o = altro(p);
    log(s, `${nomeG(p)}: PEP ${T[p].pep} contro RP ${T[o].rp}`);
    if (T[p].pep > T[o].rp) {
      collasso[o] = true;
      let d = T[p].pep - T[o].rp;
      d += Math.min(2, T[p].n.Plasma);
      d -= Math.min(2, T[o].n.Solido);
      danno[o] = Math.max(0, d);
    }
  }
  if (danno.A === 0 && danno.B === 0) {
    for (const p of GIOCATORI) danno[altro(p)] += Math.min(2, T[p].n.Gas);
  }
  return { danno, collasso };
}

/** Applica danni e Collassi calcolati. I condannati sono le carte nel Presente al momento dell'applicazione. */
export function applicaCollisione(s: StatoPartita, c: CalcoloCollisione): void {
  for (const p of GIOCATORI) infliggiDanno(s, p, c.danno[p]);

  // Chi si salva va deciso prima di toccare il campo: ogni distruzione ricalcola la TP
  // e quindi i segnalini, che cambierebbero le proprietà delle carte ancora da valutare.
  const condannate: { uid: string; salva: boolean }[] = [];
  for (const p of GIOCATORI) {
    if (!c.collasso[p]) continue;
    log(s, `Collasso del Presente di ${nomeG(p)}`);
    let salvati = 0;
    for (const fc of s.colonne.presente.filter((x) => x.owner === p)) {
      const salva = salvati < 2 && proprieta(s, fc).includes('Liquido');
      if (salva) salvati += 1;
      condannate.push({ uid: fc.uid, salva });
    }
  }
  // Il Presente collassa in blocco: la TP si ricalcola una volta sola, in fondo.
  for (const x of condannate) {
    if (x.salva) sposta(s, x.uid, 'passato', { ricalcola: false });
    else distruggi(s, x.uid, { ricalcola: false });
  }

  for (const col of Object.values(s.colonne)) {
    for (const fc of col) fc.modifiche = fc.modifiche.filter((m) => m.durata !== 'collisione');
  }
  ricalcolaTP(s);
}

/** Calcolo e applicazione di fila, senza effetti in mezzo: la usano i test della 1A. */
export function risolviCollisione(s: StatoPartita): void {
  applicaCollisione(s, calcolaCollisione(s));
}
```

Aggiungi `CalcoloCollisione` agli import da `./types`.

- [ ] **Step 5: Riscrivi `avanza`**

In `backend/game/engine/round.ts` importa:

```ts
import { accoda, azzeraUsi, eseguiProssimo, interrompiCatena, LIMITE_EFFETTI, scattaRitardati } from '../effetti/dispatcher';
import { applicaCollisione, calcolaCollisione } from './collisione';
import { emetti } from './eventi';
```

(togli l'import di `risolviCollisione`) e sostituisci `avanza` con:

```ts
/**
 * Esegue le fasi automatiche finché serve una decisione umana o la partita finisce.
 * Ordine a ogni giro: fine partita, decisione, capienza, effetti in coda, finestra, stack, fase.
 */
export function avanza(s: StatoPartita): void {
  let effetti = 0;
  for (let guardia = 0; guardia < 5000; guardia++) {
    verificaFine(s);
    if (s.esito) {
      s.fase = 'terminata';
      s.decisione = null;
      s.finestra = null;
      return;
    }
    if (s.decisione) return;
    const eccesso = trovaEccesso(s);
    if (eccesso) {
      s.decisione = { tipo: 'capienza', ...eccesso };
      return;
    }
    if (s.eventi.length) accoda(s);
    if (s.coda.length) {
      effetti += 1;
      if (effetti > LIMITE_EFFETTI) interrompiCatena(s);
      else eseguiProssimo(s);
      continue;
    }
    if (s.finestra) return;
    if (s.stack.length) {
      risolviCimaStack(s);
      continue;
    }
    switch (s.fase) {
      case 'setup':
      case 'terminata':
        return;
      case 'slittamento':
        s.fase = 'risorse';
        if (s.round > 1) eseguiSlittamento(s);
        emetti(s, { momento: 'inizioRound' });
        scattaRitardati(s, 'inizioRound');
        continue;
      case 'risorse':
        s.fase = 'azioni';
        for (const p of GIOCATORI) s.giocatori[p].haPassato = false;
        s.attivo = s.iniziativa;
        eseguiRisorse(s);
        scattaRitardati(s, 'risorse');
        continue;
      case 'azioni':
        if (!(s.giocatori.A.haPassato && s.giocatori.B.haPassato)) return;
        s.fase = 'collisione';
        emetti(s, { momento: 'inizioCollisione' });
        s.finestra = { contesto: 'collisione', priorita: s.iniziativa, passi: 0, passiNecessari: 2 };
        continue;
      case 'collisione':
        if (s.sottofase === null) {
          s.collisione = calcolaCollisione(s);
          s.sottofase = 'danni';
          emetti(s, { momento: 'danniDeterminati' });
        } else if (s.sottofase === 'danni') {
          applicaCollisione(s, s.collisione!);
          s.sottofase = 'chiusura';
          emetti(s, { momento: 'fineCollisione' });
          scattaRitardati(s, 'fineCollisione');
        } else {
          s.collisione = null;
          s.sottofase = null;
          azzeraUsi(s, 'collisione');
          s.fase = 'fine';
        }
        continue;
      case 'fine':
        if (s.sottofase === null) {
          verificaSincronia(s);
          if (s.esito) continue;
          s.sottofase = 'fineRound';
          emetti(s, { momento: 'fineRound' });
          scattaRitardati(s, 'fineRound');
        } else {
          fineRound(s);
          s.sottofase = null;
          s.fase = 'slittamento';
        }
        continue;
    }
  }
  throw new Error('avanza: troppi passi senza una decisione');
}
```

Attenzione: nel caso `'azioni'` la versione precedente faceva `return` dopo aver aperto la finestra; ora fa `continue`, così gli effetti di `inizioCollisione` si risolvono prima che la finestra aspetti un giocatore.

- [ ] **Step 6: `rispondi`, mosse legali, invariante**

In `backend/game/engine/index.ts`:

```ts
import { rispondi } from '../effetti/dispatcher';
// ...
export { rispostaDefault } from '../effetti/dispatcher';
```

e in `esegui`, prima di `default:`:

```ts
    case 'rispondi':
      return rispondi(s, p, a.risposta);
```

In `backend/game/engine/legali.ts` importa `risposteValide` da `../effetti/dispatcher` e aggiungi nello `switch (d.tipo)`:

```ts
      case 'sceltaEffetto':
        return risposteValide(d.domanda).map((risposta) => ({ tipo: 'rispondi', risposta }) as Azione);
```

In `backend/game/engine/invarianti.ts`, prima di `return err;`:

```ts
  if (!s.esito && !s.decisione && (s.coda.length || s.eventi.length)) err.push('effetti in sospeso senza una decisione');
```

- [ ] **Step 7: Esegui i test**

Run: `cd backend && npx jest tests/game && npx tsc --noEmit`
Expected: PASS, compresi `simulazione.test.ts` (nessuna carta di prova è dichiarata) e i test della 1A.

- [ ] **Step 8: Commit**

```bash
git add backend/game/effetti/dispatcher.ts backend/game/engine/collisione.ts backend/game/engine/round.ts backend/game/engine/index.ts backend/game/engine/legali.ts backend/game/engine/invarianti.ts backend/tests/game/effetti/dispatcher.test.ts
git commit -m "feat(effetti): dispatcher con coda, scelte sospese, ripiego manuale e Collisione in due passi"
```

---

### Task 5: Effetti continui

**Files:**
- Modify: `backend/game/effetti/continui.ts`
- Modify: `backend/game/engine/collisione.ts` (`totali`)
- Modify: `backend/game/engine/azioni.ts` (`giocaCarta`)
- Modify: `backend/game/engine/legali.ts`
- Modify: `backend/game/engine/temperatura.ts` (`ricalcolaTP`)
- Test: `backend/tests/game/effetti/continui.test.ts`

**Interfaces:**
- Consumes: `fontiAttive`, `attivaNellaZona` (Task 4), `dichiarazioni` (Task 3).
- Produces: `bonusPep(s, fc): number`, `vietato(s, v: Vieto): boolean`, `costoPer(s, p, d: DefCarta, colonna?): number`, `consumaSconto(s, p, d, colonna?): void`, `tpLimitata(s, tp: number): number`, `eventoGiocabile(s, p, d: DefCarta): boolean`.

- [ ] **Step 1: Scrivi i test che falliscono**

`backend/tests/game/effetti/continui.test.ts`:

```ts
import { carta, continuo } from '../../../game/effetti/dsl';
import { registraPerTest } from '../../../game/effetti/registro';
import { bonusPep, costoPer, eventoGiocabile, vietato } from '../../../game/effetti/continui';
import { applica, mosseLegali } from '../../../game/engine';
import { ricalcolaTP } from '../../../game/engine/temperatura';
import { inCampo, inMano, statoVuoto } from '../helpers';

let togli: (() => void)[] = [];
afterEach(() => { togli.forEach((f) => f()); togli = []; });

describe('effetti continui', () => {
  test('bonus PEP alla carta stessa, solo mentre è nel Presente', () => {
    togli.push(registraPerTest(carta(4, 'Carta 4', continuo('+1 PEP', { pep: (c, fc) => (fc.uid === c.sorgente ? 1 : 0) }))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 4, 'presente');
    expect(bonusPep(s, fc)).toBe(1);
    s.colonne.presente = [];
    s.colonne.passato.push(fc);
    expect(bonusPep(s, fc)).toBe(0);
  });

  test('divieto di giocare Eventi: né mossa legale né giocata accettata', () => {
    togli.push(registraPerTest(carta(1, 'Carta 1', continuo('niente Eventi', { vieta: (_c, v) => v.tipo === 'evento' }))));
    const s = statoVuoto();
    inCampo(s, 'B', 1, 'presente');
    const ev = inMano(s, 'A', 6);
    expect(vietato(s, { tipo: 'evento', giocatore: 'A' })).toBe(true);
    expect(eventoGiocabile(s, 'A', s.carte[6])).toBe(false);
    expect(mosseLegali(s, 'A')).not.toContainEqual({ tipo: 'giocaCarta', uid: ev });
    expect(applica(s, 'A', { tipo: 'giocaCarta', uid: ev })).toEqual({ ok: false, errore: 'Non puoi giocare Eventi adesso' });
  });

  test('Evento solo in Collisione', () => {
    togli.push(registraPerTest(carta(6, 'Carta 6', continuo('solo in Collisione', { soloInCollisione: true }))));
    const s = statoVuoto();
    expect(eventoGiocabile(s, 'A', s.carte[6])).toBe(false);
    s.fase = 'collisione';
    expect(eventoGiocabile(s, 'A', s.carte[6])).toBe(true);
  });

  test('sconto: riduce il costo nella colonna indicata e si consuma alla giocata', () => {
    const s = statoVuoto();
    const uid = inMano(s, 'A', 3); // costo 3, nel Futuro 2
    s.sconti.push({ giocatore: 'A', colonna: 'futuro', delta: -1 });
    expect(costoPer(s, 'A', s.carte[3], 'futuro')).toBe(1);
    expect(costoPer(s, 'A', s.carte[3], 'presente')).toBe(3);
    const r = applica(s, 'A', { tipo: 'giocaCarta', uid, colonna: 'futuro' });
    if (!r.ok) throw new Error(r.errore);
    expect(r.stato.giocatori.A.et).toBe(2);
    expect(r.stato.sconti).toEqual([]);
  });

  test('limite della TP: entro 1 dal riferimento del Round', () => {
    togli.push(registraPerTest(carta(2, 'Carta 2', continuo('TP limitata', { limitaTP: true }))));
    const s = statoVuoto();
    inCampo(s, 'A', 2, 'presente'); // Liquido Neutro
    s.tpRiferimento = 0;
    s.tpSpostamento = 3;
    ricalcolaTP(s);
    expect(s.tp).toBe(1);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/effetti/continui.test.ts`
Expected: FAIL, `bonusPep` non esportata.

- [ ] **Step 3: Scrivi `continui.ts`**

```ts
// Effetti continui: il motore li interroga quando calcola un valore o controlla una mossa (spec 1C, 4.2).
import { costoEffettivo, isFrammento } from '../engine/carte';
import { CartaCampo, Colonna, DefCarta, PlayerId, StatoPartita } from '../engine/types';
import { Continuo, CtxContinuo, Vieto } from './dsl';
import { attivaNellaZona, fontiAttive } from './dispatcher';
import { dichiarazioni } from './registro';

function continuiAttivi(s: StatoPartita): { c: CtxContinuo; k: Continuo }[] {
  const out: { c: CtxContinuo; k: Continuo }[] = [];
  for (const f of fontiAttive(s)) {
    for (const d of dichiarazioni(s, f.cardId) ?? []) {
      if (d.tipo !== 'continuo' || !d.continuo || !attivaNellaZona(f, d)) continue;
      out.push({ c: { s, sorgente: f.uid, cardId: f.cardId, controllore: f.controllore }, k: d.continuo });
    }
  }
  return out;
}

export function bonusPep(s: StatoPartita, fc: CartaCampo): number {
  return continuiAttivi(s).reduce((t, { c, k }) => t + (k.pep ? k.pep(c, fc) : 0), 0);
}

export function vietato(s: StatoPartita, v: Vieto): boolean {
  return continuiAttivi(s).some(({ c, k }) => !!k.vieta && k.vieta(c, v));
}

const scontoPer = (s: StatoPartita, p: PlayerId, d: DefCarta, colonna?: Colonna) =>
  isFrammento(d.tipo) && colonna ? s.sconti.find((x) => x.giocatore === p && x.colonna === colonna) : undefined;

export function costoPer(s: StatoPartita, p: PlayerId, d: DefCarta, colonna?: Colonna): number {
  let costo = costoEffettivo(d, colonna);
  for (const { c, k } of continuiAttivi(s)) if (k.costo) costo += k.costo(c, p, d, colonna);
  costo += scontoPer(s, p, d, colonna)?.delta ?? 0;
  return Math.max(0, costo);
}

/** Toglie lo sconto usato da una giocata. */
export function consumaSconto(s: StatoPartita, p: PlayerId, d: DefCarta, colonna?: Colonna): void {
  const sc = scontoPer(s, p, d, colonna);
  if (sc) s.sconti.splice(s.sconti.indexOf(sc), 1);
}

/** Blocco Termico: la TP resta entro 1 dal valore subito dopo l'ultimo Slittamento (I1). */
export function tpLimitata(s: StatoPartita, tp: number): number {
  if (!continuiAttivi(s).some(({ k }) => k.limitaTP)) return tp;
  return Math.max(s.tpRiferimento - 1, Math.min(s.tpRiferimento + 1, tp));
}

export function eventoGiocabile(s: StatoPartita, p: PlayerId, d: DefCarta): boolean {
  if (d.tipo !== 'Evento') return true;
  if (vietato(s, { tipo: 'evento', giocatore: p })) return false;
  const soloInCollisione = (dichiarazioni(s, d.cardId) ?? []).some((e) => e.continuo?.soloInCollisione);
  return !soloInCollisione || s.fase === 'collisione';
}
```

- [ ] **Step 4: Collega i continui al motore**

`collisione.ts`, in `totali`: importa `bonusPep` da `../effetti/continui` e cambia la somma del PEP:

```ts
    t.pep += pepDi(s, fc) + bonusPep(s, fc);
```

`temperatura.ts`, in `ricalcolaTP`: importa `tpLimitata` da `../effetti/continui` e sostituisci la riga del clamp:

```ts
  s.tp = Math.max(-4, Math.min(4, tpLimitata(s, base + s.tpSpostamento)));
```

`azioni.ts`, in `giocaCarta`: importa `consumaSconto`, `costoPer`, `eventoGiocabile` da `../effetti/continui`; dopo i controlli di finestra e turno aggiungi

```ts
  if (!eventoGiocabile(s, p, d)) return 'Non puoi giocare Eventi adesso';
```

sostituisci `const costo = costoEffettivo(d, colonna);` con `const costo = costoPer(s, p, d, colonna);`, e subito dopo `g.et -= costo;` aggiungi `consumaSconto(s, p, d, colonna);`. Nella chiamata a `metti` non cambia nulla: `metti` non emette eventi, li emette la risoluzione dello stack (Task 6).

`legali.ts`: importa `costoPer`, `eventoGiocabile`; nel ramo `s.finestra` la condizione diventa

```ts
      if (dc.tipo === 'Evento' && eventoGiocabile(s, p, dc) && costoPer(s, p, dc) <= g.et) out.push({ tipo: 'giocaCarta', uid: c.uid });
```

nel ramo azioni `costoEffettivo(dc, colonna) <= g.et` diventa `costoPer(s, p, dc, colonna) <= g.et`, e `else if (dc.costo <= g.et)` diventa `else if (eventoGiocabile(s, p, dc) && costoPer(s, p, dc) <= g.et)`. Togli l'import di `costoEffettivo` se non serve più.

- [ ] **Step 5: Esegui i test**

Run: `cd backend && npx jest tests/game && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/game/effetti/continui.ts backend/game/engine/collisione.ts backend/game/engine/azioni.ts backend/game/engine/legali.ts backend/game/engine/temperatura.ts backend/tests/game/effetti/continui.test.ts
git commit -m "feat(effetti): effetti continui su PEP, divieti, costi e limite della TP"
```

---

### Task 6: Attivabili, risoluzione dello stack e manuale solo per le carte non tradotte

**Files:**
- Create: `backend/game/effetti/attivabili.ts`
- Modify: `backend/game/engine/round.ts` (`risolviCimaStack`)
- Modify: `backend/game/engine/legali.ts`, `backend/game/engine/index.ts`
- Modify: `backend/tests/game/simulazione.test.ts` (il giocatore casuale non usa il pannello manuale)
- Test: `backend/tests/game/effetti/attivabili.test.ts`

**Interfaces:**
- Consumes: `fontiAttive`, `tutteLeFonti`, `attivaNellaZona`, `creaCtx` (Task 4).
- Produces: `mosseEffetti(s, p, momento: 'azioni' | 'collisione'): Azione[]`, `attivaEffetto(s, p, uid, indice): string | null`. Le carte con dichiarazione non aprono più il pannello manuale alla risoluzione; quelle senza (o in `manuali`) sì, e hanno la mossa `usaEffetto` elencata.

- [ ] **Step 1: Scrivi i test che falliscono**

`backend/tests/game/effetti/attivabili.test.ts`:

```ts
import { attivabile, carta, questaNelPresente, quando, spostaIn, tp } from '../../../game/effetti/dsl';
import { registraPerTest } from '../../../game/effetti/registro';
import { applica, mosseLegali } from '../../../game/engine';
import { inCampo, inMano, statoVuoto } from '../helpers';

let togli: (() => void)[] = [];
afterEach(() => { togli.forEach((f) => f()); togli = []; });

describe('attivabili e stack', () => {
  test('attivabile una volta per Round nel proprio turno di azioni', () => {
    togli.push(registraPerTest(carta(3, 'Carta 3', attivabile({ quando: 'azioni', limite: 'round', se: questaNelPresente }, tp(1)))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente');
    expect(mosseLegali(s, 'A')).toContainEqual({ tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    const r = applica(s, 'A', { tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    if (!r.ok) throw new Error(r.errore);
    expect(r.stato.tp).toBe(2);
    expect(mosseLegali(r.stato, 'A')).not.toContainEqual({ tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    expect(applica(r.stato, 'A', { tipo: 'attivaEffetto', uid: fc.uid, indice: 0 })).toEqual({ ok: false, errore: 'Effetto non attivabile adesso' });
  });

  test("usaEffetto elencato solo per le carte senza dichiarazione, con testo", () => {
    const s = statoVuoto();
    const nove = inCampo(s, 'A', 9, 'presente'); // ha testo, nessuna dichiarazione
    inCampo(s, 'A', 3, 'presente'); // senza testo
    const mosse = mosseLegali(s, 'A');
    expect(mosse).toContainEqual({ tipo: 'usaEffetto', uid: nove.uid });
    expect(mosse).toContainEqual({ tipo: 'usaEffetto', uid: 'A-C' });
    expect(mosse.filter((m) => m.tipo === 'usaEffetto')).toHaveLength(2);
  });

  test('un Frammento dichiarato giocato nel Presente esegue il suo ingresso, senza pannello manuale', () => {
    togli.push(registraPerTest(carta(9, 'Carta 9', quando('entraPresente', tp(-1)))));
    const s = statoVuoto();
    const uid = inMano(s, 'A', 9); // Solido Freddo, costo 2
    let t = applica(s, 'A', { tipo: 'giocaCarta', uid, colonna: 'presente' });
    if (!t.ok) throw new Error(t.errore);
    t = applica(t.stato, 'B', { tipo: 'passa' });
    if (!t.ok) throw new Error(t.errore);
    expect(t.stato.tp).toBe(-2);
    expect(t.stato.decisione).toBeNull();
  });

  test('un Evento non dichiarato apre ancora il pannello manuale', () => {
    const s = statoVuoto();
    const uid = inMano(s, 'A', 6);
    let t = applica(s, 'A', { tipo: 'giocaCarta', uid });
    if (!t.ok) throw new Error(t.errore);
    t = applica(t.stato, 'B', { tipo: 'passa' });
    if (!t.ok) throw new Error(t.errore);
    expect(t.stato.decisione).toMatchObject({ tipo: 'effettoManuale', uid, origine: 'stack' });
  });

  test("un Frammento giocato emette frammentoGiocato anche se coperto", () => {
    const s = statoVuoto();
    const uid = inMano(s, 'A', 3);
    const t = applica(s, 'A', { tipo: 'giocaCarta', uid, colonna: 'futuro' });
    if (!t.ok) throw new Error(t.errore);
    // Prima del passa la carta è in stack: l'evento si emette solo alla risoluzione.
    expect(t.stato.eventi).toEqual([]);
  });

  test('spostaIn nel Futuro pieno non sposta e non va in errore', () => {
    togli.push(registraPerTest(carta(3, 'Carta 3', attivabile({ quando: 'azioni' }, spostaIn('futuro')))));
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente');
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'futuro');
    const r = applica(s, 'A', { tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    if (!r.ok) throw new Error(r.errore);
    expect(r.stato.colonne.presente.map((x) => x.uid)).toContain(fc.uid);
    expect(r.stato.manuali).toEqual([]);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/effetti/attivabili.test.ts`
Expected: FAIL, nessuna mossa `attivaEffetto` elencata.

- [ ] **Step 3: Scrivi `attivabili.ts`**

```ts
// Effetti attivabili ("puoi, una volta per Round...") e mosse del pannello manuale (spec 1C, 4.3).
import { def } from '../engine/carte';
import { log, nomeG } from '../engine/log';
import { Azione, PlayerId, StatoPartita } from '../engine/types';
import { attivaNellaZona, creaCtx, Fonte, fontiAttive, tutteLeFonti } from './dispatcher';
import { dichiarazioni, haDichiarazione } from './registro';

function momentoAperto(s: StatoPartita, p: PlayerId, m: 'azioni' | 'collisione'): boolean {
  if (s.decisione) return false;
  if (m === 'azioni') {
    return s.fase === 'azioni' && !s.finestra && s.attivo === p && !s.giocatori[p].haPassato;
  }
  return s.finestra?.contesto === 'collisione' && s.finestra.priorita === p;
}

const chiaveUso = (f: Fonte, i: number, per: string): string => `${f.uid}:${i}:${per}`;

export function mosseEffetti(s: StatoPartita, p: PlayerId, m: 'azioni' | 'collisione'): Azione[] {
  const out: Azione[] = [];
  if (!momentoAperto(s, p, m)) return out;
  for (const f of fontiAttive(s)) {
    if (f.controllore !== p) continue;
    (dichiarazioni(s, f.cardId) ?? []).forEach((d, i) => {
      if (d.tipo !== 'attivabile' || d.quando !== m || !attivaNellaZona(f, d)) return;
      if (d.limite && s.usi[chiaveUso(f, i, d.limite)]) return;
      const ctx = creaCtx(s, {
        cardId: f.cardId, indice: i, sorgente: f.uid, controllore: p,
        evento: { momento: 'immediato', uid: f.uid, cardId: f.cardId, owner: p }, scelte: [], dati: {},
      });
      if (d.condizione && !d.condizione.f(ctx)) return;
      out.push({ tipo: 'attivaEffetto', uid: f.uid, indice: i });
    });
  }
  if (m === 'azioni') {
    // Pannello manuale: Costruttore, Anomalia e Frammenti nel Presente senza dichiarazione o in ripiego.
    for (const f of tutteLeFonti(s)) {
      if (f.controllore !== p || !['costruttore', 'anomalia', 'presente'].includes(f.zona)) continue;
      const manuale = !haDichiarazione(s, f.cardId) || s.manuali.includes(f.cardId);
      if (manuale && def(s, f.cardId).effetto.trim()) out.push({ tipo: 'usaEffetto', uid: f.uid });
    }
  }
  return out;
}

export function attivaEffetto(s: StatoPartita, p: PlayerId, uid: string, indice: number): string | null {
  const m = s.finestra ? 'collisione' : 'azioni';
  const ok = mosseEffetti(s, p, m).some((x) => x.tipo === 'attivaEffetto' && x.uid === uid && x.indice === indice);
  if (!ok) return 'Effetto non attivabile adesso';
  const f = fontiAttive(s).find((x) => x.uid === uid)!;
  const d = dichiarazioni(s, f.cardId)![indice];
  if (d.limite) s.usi[chiaveUso(f, indice, d.limite)] = 1;
  log(s, `${nomeG(p)} attiva l'effetto di ${def(s, f.cardId).nome}`);
  s.coda.push({
    cardId: f.cardId, indice, sorgente: uid, controllore: p,
    evento: { momento: 'immediato', uid, cardId: f.cardId, owner: p }, scelte: [], dati: {},
  });
  return null;
}
```

- [ ] **Step 4: Mosse legali e azione**

`legali.ts`: importa `mosseEffetti` da `../effetti/attivabili`. Nel ramo `if (s.finestra) { ... }`, prima del `return out;`, aggiungi `out.push(...mosseEffetti(s, p, 'collisione'));`. In fondo, prima dell'ultimo `return out;`, aggiungi `out.push(...mosseEffetti(s, p, 'azioni'));`. Aggiorna il commento della funzione: "`usaEffetto` è elencata solo per le carte senza dichiarazione o in ripiego".

`index.ts`: importa `attivaEffetto` da `../effetti/attivabili` e in `esegui`:

```ts
    case 'attivaEffetto':
      return libero() ?? attivaEffetto(s, p, a.uid, a.indice);
```

- [ ] **Step 5: Risoluzione dello stack**

In `round.ts` importa `emetti, emettiIngresso` da `./eventi`, `haDichiarazione` da `../effetti/registro`, `isFrammento` da `./carte`, e sostituisci `risolviCimaStack` con:

```ts
/**
 * Risolve la voce in cima allo stack in due giri: il primo emette gli effetti della carta (o apre il pannello
 * manuale se la carta non ha dichiarazione), il secondo, a effetti risolti, la toglie.
 */
function risolviCimaStack(s: StatoPartita): void {
  const v = s.stack[s.stack.length - 1];
  const d = def(s, v.carta.cardId);
  if (!v.risolta) {
    v.risolta = true;
    if (v.annullata) return;
    const t = cercaInCampo(s, v.carta.uid);
    const automatica = haDichiarazione(s, d.cardId) && !s.manuali.includes(d.cardId);
    const manuale = (): void => {
      s.decisione = { tipo: 'effettoManuale', giocatore: v.controllore, uid: v.carta.uid, origine: 'stack' };
      log(s, `Effetto di ${d.nome} da applicare: ${d.effetto}`);
    };
    if (isFrammento(d.tipo)) {
      if (!t) return;
      emetti(s, {
        momento: 'frammentoGiocato', uid: v.carta.uid, cardId: d.cardId, owner: v.controllore,
        giocatore: v.controllore, colonna: t.colonna,
      });
      emettiIngresso(s, t.carta, t.colonna, 'mano');
      if (!automatica && !t.carta.coperta && d.effetto.trim()) manuale();
      return;
    }
    if (d.tipo === 'Evento' && automatica) {
      emetti(s, { momento: 'immediato', uid: v.carta.uid, cardId: d.cardId, owner: v.controllore });
      return;
    }
    if (!automatica && d.effetto.trim()) manuale();
    return;
  }
  s.stack.pop();
  if (d.tipo === 'Evento') s.giocatori[v.carta.owner].orizzonte.push(v.carta);
  // Alla Collisione, risolte le risposte, la finestra si riapre completa: il confronto
  // PEP contro RP avviene solo quando entrambi passano di fila senza più nulla da giocare.
  if (s.fase === 'collisione' && s.stack.length === 0) {
    s.finestra = { contesto: 'collisione', priorita: s.iniziativa, passi: 0, passiNecessari: 2 };
  }
}
```

- [ ] **Step 6: Il giocatore casuale non usa il pannello manuale**

In `backend/tests/game/simulazione.test.ts`, in `partitaCasuale`, sostituisci `const mosse = mosseLegali(s, p);` con:

```ts
    // Il pannello manuale non si simula: `usaEffetto` aprirebbe effetti a vuoto senza fine.
    const mosse = mosseLegali(s, p).filter((m) => m.tipo !== 'usaEffetto');
```

- [ ] **Step 7: Esegui i test**

Run: `cd backend && npx jest tests/game && npx tsc --noEmit`
Expected: PASS. Se un test della 1B o della 1A si aspettava `usaEffetto` assente dalle mosse legali, aggiornalo alla nuova regola e scrivi nel commit quale.

- [ ] **Step 8: Commit**

```bash
git add backend/game/effetti/attivabili.ts backend/game/engine/round.ts backend/game/engine/legali.ts backend/game/engine/index.ts backend/tests/game/simulazione.test.ts backend/tests/game/effetti/attivabili.test.ts
git commit -m "feat(effetti): effetti attivabili, stack che esegue le dichiarazioni, manuale solo per le carte non tradotte"
```

---

### Task 7: Vista, timer delle scelte, errori sul server

**Files:**
- Modify: `backend/game/engine/vista.ts`
- Modify: `backend/game/partite.ts` (`programmaFinestra`, `dopoCambio`)
- Modify: `backend/tests/game/simulazione.test.ts` (`controllaVista`)
- Test: `backend/tests/game/vista.test.ts`, test esistenti del gestore in `backend/tests/match/`

**Interfaces:**
- Consumes: `rispostaDefault` (Task 4).
- Produces: `VistaDecisione` esportato da `vista.ts`; `Vista.decisione: VistaDecisione | null`, `Vista.manuali: number[]`, `Vista.silenziate: string[]`. Lato server la scelta scade come una finestra.

- [ ] **Step 1: Scrivi i test che falliscono**

In `backend/tests/game/vista.test.ts` aggiungi:

```ts
test("la domanda di una scelta la vede solo chi sceglie", () => {
  const s = statoVuoto();
  s.decisione = {
    tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-C', cardId: 100,
    domanda: { tipo: 'bersaglio', testo: 'scegli', uids: ['A-1', 'A-2'] },
  };
  expect(vista(s, 'A').decisione).toEqual(s.decisione);
  expect(vista(s, 'B').decisione).toEqual({ tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-C', cardId: 100, domanda: null });
});

test('manuali e silenziate sono pubbliche', () => {
  const s = statoVuoto();
  s.manuali = [9];
  s.silenziate = ['B-3'];
  expect(vista(s, 'B')).toMatchObject({ manuali: [9], silenziate: ['B-3'] });
});
```

(importa `statoVuoto` da `./helpers` se il file non lo fa già).

Nei test del gestore delle partite (`backend/tests/match/`, il file che oggi verifica il "passa" automatico allo scadere della finestra), aggiungi un test sul modello di quello esistente: porta la partita a una `sceltaEffetto` scrivendo direttamente lo stato (`p.stato = { ...p.stato, decisione: { tipo: 'sceltaEffetto', ... }, coda: [pendente] }` con una dichiarazione registrata con `registraPerTest`), chiama `dopoCambio`, fai scadere il timer con i fake timer di Jest come fa il test esistente, e verifica che (a) lo stato abbia applicato `rispostaDefault` e (b) con la partita in pausa (`p.inPausa = true`) il timer non sia programmato e venga riprogrammato alla ripresa. Il nome del file e degli helper lo trovi con `grep -rn "timeout" backend/tests/match`.

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/vista.test.ts`
Expected: FAIL, la vista di B mostra la domanda.

- [ ] **Step 3: Vista**

In `backend/game/engine/vista.ts`:

```ts
export type VistaDecisione =
  | Exclude<Decisione, { tipo: 'sceltaEffetto' }>
  | { tipo: 'sceltaEffetto'; giocatore: PlayerId; uid: string; cardId: number; domanda: Domanda | null };
```

In `Vista` cambia `decisione: Decisione | null;` in `decisione: VistaDecisione | null;` e aggiungi `manuali: number[]; silenziate: string[];`. Nel `return structuredClone({...})` sostituisci `decisione: s.decisione,` con

```ts
    // Le opzioni di una scelta possono nominare carte coperte o della mano: le vede solo chi sceglie.
    decisione: s.decisione?.tipo === 'sceltaEffetto' && s.decisione.giocatore !== io
      ? { ...s.decisione, domanda: null } : s.decisione,
    manuali: s.manuali, silenziate: s.silenziate,
```

Aggiungi `Domanda` agli import.

- [ ] **Step 4: Timer e errori nel gestore**

In `backend/game/partite.ts` importa `rispostaDefault` (e il tipo `Azione`, `StatoPartita`) da `./engine` e aggiungi fuori dalla classe:

```ts
/** Azione che il server applica allo scadere del timer: passa in una finestra, risposta prudente in una scelta. */
function azioneAutomatica(s: StatoPartita): Azione | null {
  if (s.decisione?.tipo === 'sceltaEffetto') return { tipo: 'rispondi', risposta: rispostaDefault(s.decisione.domanda) };
  if (s.finestra && !s.decisione) return { tipo: 'passa' };
  return null;
}
```

In `programmaFinestra` sostituisci la condizione di uscita con

```ts
    if (!s || s.esito || p.inPausa || !azioneAutomatica(s)) return;
```

e il corpo del timer con

```ts
    p.timer.finestra = setTimeout(() => {
      p.timer.finestra = undefined;
      const azione = p.stato ? azioneAutomatica(p.stato) : null;
      if (!p.stato || !azione || chiDeveAgire(p.stato) !== chi) return;
      let r: ReturnType<typeof applica>;
      try {
        r = applica(p.stato, chi, azione);
      } catch (e) {
        this.passaAutomaticoFallito(p, (e as Error).message);
        return;
      }
      if (!r.ok) {
        this.passaAutomaticoFallito(p, r.errore);
        return;
      }
      p.stato = r.stato;
      p.log.push({ t: new Date(), giocatore: 'server', azione: { ...azione, per: chi, motivo: 'timeout' } });
      this.dopoCambio(p);
    }, this.o.timeoutFinestraMs);
```

Se il tipo delle voci di `p.log` accetta solo `{ tipo: 'passa', ... }`, allargalo a `Azione & { per: PlayerId; motivo: 'timeout' }`.

In `dopoCambio`, come prima riga:

```ts
    if (p.stato?.erroriEffetti.length) {
      for (const e of p.stato.erroriEffetti) console.error(`Partita ${p.codice}: effetto in errore, ${e}`);
      p.stato.erroriEffetti = [];
    }
```

- [ ] **Step 5: Non-fuga nella simulazione**

In `backend/tests/game/simulazione.test.ts`, in `controllaVista`, all'inizio:

```ts
  if (v.decisione?.tipo === 'sceltaEffetto' && v.decisione.giocatore !== v.io && v.decisione.domanda !== null) {
    return `${v.io} vede la domanda di una scelta altrui`;
  }
```

- [ ] **Step 6: Esegui i test**

Run: `cd backend && npx jest && npx tsc --noEmit`
Expected: PASS su tutta la suite backend.

- [ ] **Step 7: Commit**

```bash
git add backend/game/engine/vista.ts backend/game/partite.ts backend/tests
git commit -m "feat(effetti): vista che nasconde le scelte altrui, timer delle scelte, errori degli effetti nel log del server"
```

---

### Task 8: Carte pilota, Frammenti (14 carte)

**Files:**
- Create: `backend/game/effetti/carte/solidi.ts`, `liquidi.ts`, `gas.ts`, `plasma.ts`
- Modify: `backend/game/effetti/registro.ts` (registrazione)
- Test: `backend/tests/game/effetti/carte-frammenti.test.ts`

**Interfaces:**
- Consumes: DSL (Task 3), continui (Task 5), attivabili (Task 6).
- Produces: `SOLIDI`, `LIQUIDI`, `GAS`, `PLASMA`: `DichiarazioneCarta[]`, registrate al caricamento di `registro.ts`.

- [ ] **Step 1: Scrivi i test che falliscono**

`backend/tests/game/effetti/carte-frammenti.test.ts`:

```ts
import { bonusPep, costoPer, vietato } from '../../../game/effetti/continui';
import { applica, mosseLegali, vista } from '../../../game/engine';
import { distruggi, sposta } from '../../../game/engine/campo';
import { avanza } from '../../../game/engine/round';
import { inverti, ricalcolaTP } from '../../../game/engine/temperatura';
import { gioca, inCampo, inMano, mossa, riempiMazzi, statoReale } from '../helpers';

describe('Solidi', () => {
  test('1 Nucleo di Basalto: non può essere spostato da effetti', () => {
    const s = statoReale();
    const fc = inCampo(s, 'A', 1, 'presente');
    expect(vietato(s, { tipo: 'sposta', uid: fc.uid })).toBe(true);
  });

  test('2 Faglia Primaria: distrutta, riduce di 2 i danni (I10)', () => {
    for (const [scelta, it] of [[true, 14], [false, 12]] as const) {
      const s = statoReale();
      const faglia = inCampo(s, 'A', 2, 'presente'); // 1/6
      inCampo(s, 'B', 63, 'presente'); // 7 PEP
      inCampo(s, 'B', 197, 'presente'); // 6 PEP
      s.fase = 'collisione';
      avanza(s);
      expect(s.decisione).toMatchObject({ tipo: 'sceltaEffetto', giocatore: 'A', cardId: 2, domanda: { tipo: 'siNo' } });
      const t = mossa(s, 'A', { tipo: 'rispondi', risposta: scelta });
      // 13 - 6 = 7, +2 Plasma, -1 Solido = 8; con Faglia 6.
      expect(t.giocatori.A.it).toBe(it);
      expect(t.giocatori.A.orizzonte.some((c) => c.uid === faglia.uid)).toBe(true);
    }
  });

  test('20 Pilastro di Contenimento: distrutto in Collisione, TP -1 dopo il prossimo Slittamento (I16)', () => {
    const s = statoReale();
    riempiMazzi(s);
    inCampo(s, 'A', 20, 'presente');
    inCampo(s, 'B', 63, 'presente');
    s.fase = 'collisione';
    avanza(s);
    expect(s.round).toBe(2);
    expect(s.log.some((l) => l.testo === 'Pilastro di Contenimento: TP -1')).toBe(true);
    expect(s.tp).toBe(-1);
  });

  test('50 Blocco Termico: la TP non si allontana più di 1 dal riferimento', () => {
    const s = statoReale();
    inCampo(s, 'A', 50, 'presente');
    s.tpSpostamento = 3;
    ricalcolaTP(s);
    expect(s.tp).toBe(1);
  });

  test('138 Monolite di Frenata: in Collisione con TP 0 niente Eventi', () => {
    const s = statoReale();
    inCampo(s, 'A', 138, 'presente'); // Freddo
    inCampo(s, 'B', 8, 'presente'); // Caldo: TP 0
    ricalcolaTP(s);
    const ev = inMano(s, 'B', 46);
    s.fase = 'collisione';
    s.finestra = { contesto: 'collisione', priorita: 'B', passi: 0, passiNecessari: 2 };
    expect(mosseLegali(s, 'B')).not.toContainEqual({ tipo: 'giocaCarta', uid: ev });
    s.tpSpostamento = 1;
    ricalcolaTP(s);
    expect(mosseLegali(s, 'B')).toContainEqual({ tipo: 'giocaCarta', uid: ev });
  });
});

describe('Liquidi', () => {
  test('6 Il Mercuriale: una volta per Round dal Presente al Futuro', () => {
    const s = statoReale();
    const fc = inCampo(s, 'A', 6, 'presente');
    const t = mossa(s, 'A', { tipo: 'attivaEffetto', uid: fc.uid, indice: 0 });
    expect(t.colonne.futuro.map((x) => x.uid)).toContain(fc.uid);
    expect(mosseLegali(t, 'A').some((m) => m.tipo === 'attivaEffetto')).toBe(false);
  });

  test('6 Il Mercuriale: con il Futuro pieno non è attivabile', () => {
    const s = statoReale();
    inCampo(s, 'A', 6, 'presente');
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'futuro');
    expect(mosseLegali(s, 'A').some((m) => m.tipo === 'attivaEffetto')).toBe(false);
  });

  test('103 Marea di Assorbimento: +1 RP fino a fine Round quando la TP cambia segno', () => {
    const s = statoReale();
    const fc = inCampo(s, 'A', 103, 'presente');
    s.segnoTP = 1;
    s.tpSpostamento = -2;
    ricalcolaTP(s);
    avanza(s);
    expect(fc.modifiche).toEqual([{ stat: 'rp', delta: 1, durata: 'round' }]);
  });

  test('223 Flusso di Innesco: guardi una coperta avversaria, solo tu, e il prossimo Futuro costa 1 in meno', () => {
    let s = statoReale();
    inCampo(s, 'B', 8, 'futuro', { coperta: true });
    const flusso = inMano(s, 'A', 223);
    inMano(s, 'A', 8);
    s = gioca(s, 'A', flusso, 'presente');
    expect(s.decisione).toMatchObject({ tipo: 'sceltaEffetto', giocatore: 'A', domanda: { tipo: 'bersaglio' } });
    const d = s.decisione as { domanda: { uids: string[] } };
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: d.domanda.uids[0] });
    expect(vista(s, 'A').log.some((l) => l.testo.includes('Sciame Termico'))).toBe(true);
    expect(vista(s, 'B').log.some((l) => l.testo.includes('Sciame Termico'))).toBe(false);
    expect(costoPer(s, 'A', s.carte[8], 'futuro')).toBe(2); // 4, -1 Futuro, -1 sconto
  });
});

describe('Gas', () => {
  test('8 Sciame Termico: +1 per il tipo e +1 per effetto', () => {
    let s = statoReale();
    const uid = inMano(s, 'A', 8);
    s = gioca(s, 'A', uid, 'presente');
    expect(s.tp).toBe(2);
  });

  test('30 Espulsione Termica: distrutta alla fine della Collisione se sopravvive', () => {
    const s = statoReale();
    const fc = inCampo(s, 'A', 30, 'presente');
    s.fase = 'collisione';
    avanza(s);
    expect(s.giocatori.A.orizzonte.some((c) => c.uid === fc.uid)).toBe(true);
  });

  test('79 Vapore di Turbolenza: TP +1 quando entra un Frammento avversario, non uno proprio', () => {
    const s = statoReale();
    inCampo(s, 'A', 79, 'presente');
    ricalcolaTP(s);
    const mio = inCampo(s, 'A', 103, 'futuro');
    sposta(s, mio.uid, 'presente');
    avanza(s);
    expect(s.tp).toBe(1);
    const suo = inCampo(s, 'B', 103, 'futuro');
    sposta(s, suo.uid, 'presente');
    avanza(s);
    expect(s.tp).toBe(2);
  });

  test("231 Vapore di Interferenza: TP +1 a ogni Inversione", () => {
    const s = statoReale();
    inCampo(s, 'A', 231, 'presente');
    ricalcolaTP(s);
    inverti(s, null);
    avanza(s);
    expect(s.tp).toBe(2);
  });
});

describe('Plasma', () => {
  test('15 Fulmine Residuo: 1 danno IT all ingresso e +1 PEP in Collisione', () => {
    let s = statoReale();
    const uid = inMano(s, 'A', 15);
    s = gioca(s, 'A', uid, 'presente');
    expect(s.giocatori.B.it).toBe(19);
    const fc = s.colonne.presente.find((x) => x.uid === uid)!;
    expect(bonusPep(s, fc)).toBe(1);
  });

  test('119 Fulmine di Esaurimento: distrutto dal Presente pesca 1, dal Passato no', () => {
    const s = statoReale();
    riempiMazzi(s);
    const a = inCampo(s, 'A', 119, 'presente');
    const b = inCampo(s, 'A', 119, 'passato');
    distruggi(s, a.uid);
    avanza(s);
    expect(s.giocatori.A.mano).toHaveLength(1);
    distruggi(s, b.uid);
    avanza(s);
    expect(s.giocatori.A.mano).toHaveLength(1);
  });

  test('119 Fulmine di Esaurimento: mazzo vuoto, Collasso Entropico e non un ripiego', () => {
    const s = statoReale();
    const a = inCampo(s, 'A', 119, 'presente');
    distruggi(s, a.uid);
    avanza(s);
    expect(s.manuali).toEqual([]);
    expect(s.esito).toEqual({ vincitore: 'B', motivo: 'collassoEntropico' });
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/effetti/carte-frammenti.test.ts`
Expected: FAIL (nessuna carta dichiarata).

- [ ] **Step 3: Scrivi le dichiarazioni**

`backend/game/effetti/carte/solidi.ts`:

```ts
import {
  carta, continuo, danniDaSubire, DichiarazioneCarta, distruggi, inCollisione, programma, puoi, quando,
  riduciDanniSubiti, ritardato, se, tp,
} from '../dsl';

export const SOLIDI = (): DichiarazioneCarta[] => [
  carta(1, 'Nucleo di Basalto',
    continuo('non può essere spostato da effetti', { vieta: (c, v) => v.tipo === 'sposta' && v.uid === c.sorgente })),
  carta(2, 'Faglia Primaria',
    quando('danniDeterminati', se(danniDaSubire, puoi(distruggi(), riduciDanniSubiti(2))))),
  carta(20, 'Pilastro di Contenimento',
    quando('distrutta', se(inCollisione, programma('tp giù', 'inizioRound'))),
    ritardato('tp giù', tp(-1))),
  carta(50, 'Blocco Termico',
    continuo('la TP non può cambiare di più di 1 per Round', { limitaTP: true })),
  carta(138, 'Monolite di Frenata',
    continuo('durante la Collisione, con TP 0, nessun giocatore può giocare Eventi', {
      vieta: (c, v) => v.tipo === 'evento' && c.s.fase === 'collisione' && c.s.tp === 0,
    })),
];
```

`backend/game/effetti/carte/liquidi.ts`:

```ts
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
```

Nota su 223: con `scegli` senza bersagli validi l'effetto scrive "nessun bersaglio valido" e salta le azioni dentro `scegli`; lo `sconto` è fuori, quindi si applica comunque.

`backend/game/effetti/carte/gas.ts`:

```ts
import { carta, DichiarazioneCarta, distruggi, entratoDallAvversario, quando, se, tp } from '../dsl';

export const GAS = (): DichiarazioneCarta[] => [
  carta(8, 'Sciame Termico', quando('entraPresente', tp(1))),
  carta(30, 'Espulsione Termica', quando('entraPresente', tp(1)), quando('fineCollisione', distruggi())),
  carta(79, 'Vapore di Turbolenza', quando('frammentoEntraPresente', se(entratoDallAvversario, tp(1)))),
  carta(231, 'Vapore di Interferenza', quando('inversione', tp(1))),
];
```

`backend/game/effetti/carte/plasma.ts`:

```ts
import { carta, continuo, dannoIT, DichiarazioneCarta, pesca, quando } from '../dsl';

export const PLASMA = (): DichiarazioneCarta[] => [
  carta(15, 'Fulmine Residuo',
    quando('entraPresente', dannoIT('avversario', 1)),
    continuo('durante la Collisione questo Frammento ottiene +1 PEP', { pep: (c, fc) => (fc.uid === c.sorgente ? 1 : 0) })),
  carta(119, 'Fulmine di Esaurimento', quando('distrutta', pesca('controllore'))),
];
```

In `registro.ts` importa in cima `GAS`, `LIQUIDI`, `PLASMA`, `SOLIDI` da `./carte/...` e cambia la riga di `fonti`:

```ts
const fonti = (): (() => DichiarazioneCarta[])[] => [SOLIDI, LIQUIDI, GAS, PLASMA];
```

Mai `registra(...)` al caricamento del modulo: le carte si registrano in `carica()`, al primo uso.

- [ ] **Step 4: Esegui i test**

Run: `cd backend && npx jest tests/game && npx tsc --noEmit`
Expected: PASS. Se un test della 1A con `catalogoProva` cambia comportamento, il controllo sul nome (Task 3) non sta funzionando: le carte di prova si chiamano `Carta N` e non devono mai eseguire una dichiarazione reale.

- [ ] **Step 5: Commit**

```bash
git add backend/game/effetti backend/tests/game/effetti/carte-frammenti.test.ts
git commit -m "feat(effetti): carte pilota dei Frammenti (14)"
```

---

### Task 9: Carte pilota, Materia Oscura, Eventi, Anomalie, Costruttori (9 carte)

**Files:**
- Create: `backend/game/effetti/carte/materiaOscura.ts`, `eventi.ts`, `anomalie.ts`, `costruttori.ts`, `speciali.ts`
- Modify: `backend/game/effetti/registro.ts`
- Test: `backend/tests/game/effetti/carte-altre.test.ts`

**Interfaces:**
- Produces: `MATERIA_OSCURA`, `EVENTI`, `ANOMALIE`, `COSTRUTTORI`; `vuotoDiProbabilita(c: Ctx): void` in `speciali.ts`.

- [ ] **Step 1: Scrivi i test che falliscono**

`backend/tests/game/effetti/carte-altre.test.ts`:

```ts
import { mosseLegali, vista } from '../../../game/engine';
import { avanza } from '../../../game/engine/round';
import { inverti, ricalcolaTP } from '../../../game/engine/temperatura';
import { carta as nuovaCarta, gioca, inCampo, inMano, mossa, riempiMazzi, statoReale } from '../helpers';
import { StatoPartita } from '../../../game/engine/types';

const domanda = (s: StatoPartita) => (s.decisione as { domanda: { uids?: string[]; opzioni?: string[] } }).domanda;

describe('Materia Oscura', () => {
  test('67 Eco del Punto Zero: opzione scarto, ognuno sceglie la propria carta', () => {
    let s = statoReale();
    inCampo(s, 'A', 67, 'presente');
    inMano(s, 'A', 8);
    inMano(s, 'B', 8);
    inverti(s, null);
    avanza(s);
    expect(domanda(s).opzioni).toEqual(['entrambi i giocatori scartano 1 carta', 'entrambi i giocatori perdono 1 IT']);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: 0 });
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: domanda(s).uids![0] });
    expect(s.decisione).toMatchObject({ giocatore: 'B' });
    s = mossa(s, 'B', { tipo: 'rispondi', risposta: domanda(s).uids![0] });
    expect(s.giocatori.A.orizzonte).toHaveLength(1);
    expect(s.giocatori.B.orizzonte).toHaveLength(1);
  });

  test('67 Eco del Punto Zero: opzione IT, perdita non danno', () => {
    let s = statoReale();
    inCampo(s, 'A', 67, 'presente');
    inverti(s, null);
    avanza(s);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: 1 });
    expect([s.giocatori.A.it, s.giocatori.B.it]).toEqual([19, 19]);
  });

  test('203 Vuoto di Probabilità: un Frammento nel Futuro coperto, il resto in fondo, nomi solo a chi guarda', () => {
    let s = statoReale();
    s.giocatori.A.futuro = [nuovaCarta('A', 8), nuovaCarta('A', 19), nuovaCarta('A', 1)];
    const uid = inMano(s, 'A', 203);
    s = gioca(s, 'A', uid, 'presente');
    expect(domanda(s).opzioni).toEqual(['Sciame Termico', 'Nessuno']);
    expect(vista(s, 'B').decisione).toMatchObject({ domanda: null });
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: 0 });
    const futuro = s.colonne.futuro.filter((x) => x.owner === 'A');
    expect(futuro.map((x) => [x.cardId, x.coperta])).toEqual([[8, true]]);
    expect(s.giocatori.A.futuro.map((c) => c.cardId)).toEqual([1, 19]);
  });
});

describe('Eventi', () => {
  test('19 Shock Termico: solo in Collisione, poi TP +1 o -1', () => {
    let s = statoReale();
    const uid = inMano(s, 'A', 19);
    expect(mosseLegali(s, 'A')).not.toContainEqual({ tipo: 'giocaCarta', uid });
    s.fase = 'collisione';
    s.finestra = { contesto: 'collisione', priorita: 'A', passi: 0, passiNecessari: 2 };
    s = gioca(s, 'A', uid);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: 1 });
    expect(s.tp).toBe(-1);
  });

  test('46 Disintegrazione Istantanea: distrugge il Frammento scelto nel Presente', () => {
    let s = statoReale();
    const bersaglio = inCampo(s, 'B', 8, 'presente');
    const uid = inMano(s, 'A', 46);
    s = gioca(s, 'A', uid);
    expect(domanda(s).uids).toEqual([bersaglio.uid]);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: bersaglio.uid });
    expect(s.giocatori.B.orizzonte.map((c) => c.uid)).toContain(bersaglio.uid);
  });

  test('127 Deviazione Temporale: annulla un Evento in risposta', () => {
    let s = statoReale();
    s.attivo = 'B';
    const vittima = inCampo(s, 'A', 8, 'presente');
    const dis = inMano(s, 'B', 46);
    const dev = inMano(s, 'A', 127);
    s = mossa(s, 'B', { tipo: 'giocaCarta', uid: dis });
    s = mossa(s, 'A', { tipo: 'giocaCarta', uid: dev });
    s = mossa(s, 'B', { tipo: 'passa' });
    expect(domanda(s).uids).toContain(dis);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: dis });
    expect(s.colonne.presente.map((x) => x.uid)).toContain(vittima.uid);
    expect(s.giocatori.B.orizzonte.map((c) => c.uid)).toContain(dis);
  });

  test("127 Deviazione Temporale: un'Anomalia resta senza effetti fino a fine Round", () => {
    let s = statoReale();
    s.anomalia = nuovaCarta('B', 93);
    const dev = inMano(s, 'A', 127);
    s = gioca(s, 'A', dev);
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: s.anomalia!.uid });
    expect(s.silenziate).toEqual([s.anomalia!.uid]);
  });
});

describe('Anomalie', () => {
  test("93 Faglia Temporale: all'inizio della Collisione con TP diversa da 0, Inversione e il controllore perde 1 IT", () => {
    const s = statoReale();
    s.anomalia = nuovaCarta('A', 93);
    inCampo(s, 'B', 8, 'presente');
    ricalcolaTP(s);
    s.giocatori.A.haPassato = true;
    s.giocatori.B.haPassato = true;
    avanza(s);
    expect(s.flusso).toBe('invertito');
    expect(s.giocatori.A.it).toBe(19);
    expect(s.finestra?.contesto).toBe('collisione');
  });

  test('173 Accumulo Critico: controlli il Presente a fine Collisione, +1 ET nel prossimo Round', () => {
    const s = statoReale();
    riempiMazzi(s);
    s.anomalia = nuovaCarta('A', 173);
    inCampo(s, 'A', 1, 'presente');
    s.fase = 'collisione';
    avanza(s);
    expect(s.round).toBe(2);
    expect(s.giocatori.A.et).toBe(s.giocatori.A.etMax + 1);
    expect(s.giocatori.B.et).toBe(s.giocatori.B.etMax);
  });
});

describe('Costruttori', () => {
  test('255 Nyx: il primo Frammento nel Futuro va nel Presente e a fine Collisione è distrutto', () => {
    let s = statoReale();
    s.giocatori.A.costruttore.cardId = 255;
    const primo = inMano(s, 'A', 8);
    const secondo = inMano(s, 'A', 8);
    s = gioca(s, 'A', primo, 'futuro');
    expect(s.colonne.presente.map((x) => x.uid)).toContain(primo);
    expect(s.tp).toBe(2); // Caldo +1 e Sciame Termico +1 all'ingresso
    s = gioca(s, 'A', secondo, 'futuro');
    expect(s.colonne.futuro.map((x) => x.uid)).toContain(secondo);
    s.fase = 'collisione';
    s.finestra = null;
    avanza(s);
    expect(s.giocatori.A.orizzonte.map((c) => c.uid)).toContain(primo);
  });

  test('255 Nyx: Presente pieno, nessuno spostamento e nessun errore', () => {
    let s = statoReale();
    s.giocatori.A.costruttore.cardId = 255;
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'presente');
    const uid = inMano(s, 'A', 103);
    s = gioca(s, 'A', uid, 'futuro');
    expect(s.colonne.futuro.map((x) => x.uid)).toContain(uid);
    expect(s.manuali).toEqual([]);
  });

  test('259 Khepri: 1 IT per spostare un tuo Frammento dal Passato al Futuro, una volta per Round', () => {
    let s = statoReale();
    s.giocatori.A.costruttore.cardId = 259;
    const fc = inCampo(s, 'A', 103, 'passato'); // non il Nucleo di Basalto (1), che non si sposta
    s = mossa(s, 'A', { tipo: 'attivaEffetto', uid: 'A-C', indice: 0 });
    s = mossa(s, 'A', { tipo: 'rispondi', risposta: fc.uid });
    expect(s.colonne.futuro.map((x) => x.uid)).toContain(fc.uid);
    expect(s.giocatori.A.it).toBe(19);
    expect(mosseLegali(s, 'A').some((m) => m.tipo === 'attivaEffetto')).toBe(false);
  });
});
```

`carta` di `helpers` è esportata col nome `carta`: nel test è importata come `nuovaCarta` per non confonderla con il costruttore di dichiarazioni.

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/effetti/carte-altre.test.ts`
Expected: FAIL.

- [ ] **Step 3: Scrivi la via di uscita per Vuoto di Probabilità**

`backend/game/effetti/carte/speciali.ts`:

```ts
// Effetti che il linguaggio non esprime: funzioni scritte a mano, registrate con `azione(...)`.
import { metti } from '../../engine/campo';
import { contaInColonna, def, isFrammento } from '../../engine/carte';
import { log, nomeG } from '../../engine/log';
import { Carta } from '../../engine/types';
import { Ctx, nomeFonte } from '../dsl';

/**
 * 203 Vuoto di Probabilità. "Il tuo mazzo" è il mazzo del Futuro anche a flusso invertito (regolamento v6,
 * note sul flusso invertito: "guardano sempre a destra").
 */
export function vuotoDiProbabilita(c: Ctx): void {
  const g = c.s.giocatori[c.controllore];
  const prime = g.futuro.slice(0, 2);
  if (!prime.length) return;
  log(c.s, `${nomeFonte(c)}: guardi ${prime.map((x) => def(c.s, x.cardId).nome).join(' e ')}`, c.controllore);
  const frammenti = prime.filter((x) => isFrammento(def(c.s, x.cardId).tipo));
  let scelta: Carta | null = null;
  if (frammenti.length && contaInColonna(c.s, 'futuro', c.controllore) < 4) {
    const r = c.chiedi({
      tipo: 'opzione', testo: `${nomeFonte(c)}: metti un Frammento nel tuo Futuro coperto?`,
      opzioni: [...frammenti.map((x) => def(c.s, x.cardId).nome), 'Nessuno'],
    });
    if (typeof r === 'number' && r < frammenti.length) scelta = frammenti[r];
  }
  g.futuro.splice(0, prime.length);
  const resto = prime.filter((x) => x !== scelta);
  g.futuro.push(...resto);
  if (scelta) {
    metti(c.s, scelta, 'futuro', { coperta: true });
    log(c.s, `${nomeG(c.controllore)} mette un Frammento coperto nel Futuro`);
  }
  log(c.s, `${nomeG(c.controllore)} rimette ${resto.length} ${resto.length === 1 ? 'carta' : 'carte'} in fondo al mazzo`);
}
```

- [ ] **Step 4: Scrivi le dichiarazioni**

`backend/game/effetti/carte/materiaOscura.ts`:

```ts
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
```

`backend/game/effetti/carte/eventi.ts`:

```ts
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
```

`backend/game/effetti/carte/anomalie.ts`:

```ts
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
```

`backend/game/effetti/carte/costruttori.ts`:

```ts
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
```

In `registro.ts` aggiungi gli import e completa `fonti`:

```ts
const fonti = (): (() => DichiarazioneCarta[])[] => [SOLIDI, LIQUIDI, GAS, PLASMA, MATERIA_OSCURA, EVENTI, ANOMALIE, COSTRUTTORI];
```

- [ ] **Step 5: Esegui i test**

Run: `cd backend && npx jest tests/game && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/game/effetti backend/tests/game/effetti/carte-altre.test.ts
git commit -m "feat(effetti): carte pilota di Materia Oscura, Eventi, Anomalie e Costruttori (9)"
```

---

### Task 10: Riepilogo per la validazione, versione degli script, simulazione con le carte vere

**Files:**
- Create: `backend/game/effetti/riepilogo.ts`, `backend/scripts/riepilogoEffetti.ts`
- Modify: `backend/package.json` (script), `backend/game/catalogo.ts`
- Delete: `backend/game/cardScripts.json`
- Modify: `backend/tests/game/simulazione.test.ts`
- Test: `backend/tests/game/effetti/riepilogo.test.ts`
- Generated: `docs/effetti-carte.md`

**Interfaces:**
- Produces: `riepilogoEffetti(catalogo: Record<number, DefCarta>): string`; `VERSIONE_SCRIPT` calcolata sul registro; `npm run effetti:riepilogo`.

- [ ] **Step 1: Scrivi i test che falliscono**

`backend/tests/game/effetti/riepilogo.test.ts`:

```ts
import { riepilogoEffetti } from '../../../game/effetti/riepilogo';
import { carteDichiarate, dichiarazioneRegistrata } from '../../../game/effetti/registro';
import { catalogoReale } from '../helpers';

describe('riepilogo degli effetti', () => {
  test('ogni dichiarazione ha il nome esatto del catalogo', () => {
    const cat = catalogoReale();
    for (const id of carteDichiarate()) expect([id, dichiarazioneRegistrata(id)!.nome]).toEqual([id, cat[id]?.nome]);
  });

  test('le 23 carte pilota sono dichiarate', () => {
    expect(carteDichiarate()).toEqual([1, 2, 6, 8, 15, 19, 20, 30, 46, 50, 67, 79, 93, 103, 119, 127, 138, 173, 203, 223, 231, 255, 259]);
  });

  test('una riga per carta, con testo stampato e script o "manuale"', () => {
    const md = riepilogoEffetti(catalogoReale());
    expect(md).toContain('Automatiche: 23 su 120');
    expect(md).toContain('| 8 | Sciame Termico | Gas | Quando entra nel Presente: TP +1. | quando entra nel Presente: TP +1 |');
    expect(md).toMatch(/\| 254 \| Chronos, Custode del Presente \| Costruttore \| .* \| manuale, non ancora tradotta \|/);
    expect(md.split('\n').filter((r) => /^\| \d+ \|/.test(r))).toHaveLength(120);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd backend && npx jest tests/game/effetti/riepilogo.test.ts`
Expected: FAIL, modulo `riepilogo` assente.

- [ ] **Step 3: Scrivi il riepilogo**

`backend/game/effetti/riepilogo.ts`:

```ts
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
```

Se il test sulla riga di Sciame Termico fallisce solo per la punteggiatura del testo stampato nella fixture, correggi l'atteso del test leggendo `effect` di `cardId: 8` in `carte-v6.json`: il test verifica il formato, non il testo.

`backend/scripts/riepilogoEffetti.ts`:

```ts
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
```

In `backend/package.json`, negli `scripts`: `"effetti:riepilogo": "ts-node scripts/riepilogoEffetti.ts"`.

Se `tsconfig.json` del backend esclude `scripts/` o `tests/`, `ts-node` compila comunque il file passato; se `tsc` del build include `scripts/`, verifica che `npm run build` resti verde.

- [ ] **Step 4: Versione degli script sul registro**

In `backend/game/catalogo.ts` sostituisci l'import di `cardScripts.json` e il calcolo di `VERSIONE_SCRIPT` con:

```ts
import { carteDichiarate, dichiarazioneRegistrata } from './effetti/registro';

// Hash delle dichiarazioni degli effetti: cambia a ogni modifica di uno script, finisce nel log della partita.
export const VERSIONE_SCRIPT = createHash('sha256')
  .update(JSON.stringify(carteDichiarate().map((id) => {
    const d = dichiarazioneRegistrata(id)!;
    return [id, d.nome, d.effetti.map((e) => e.testo)];
  })))
  .digest('hex')
  .slice(0, 12);
```

Cancella `backend/game/cardScripts.json` (`git rm`). Verifica con `grep -rn cardScripts backend --include=*.ts --include=*.js --include=*.json -l | grep -v node_modules` che non resti nessun riferimento; se il `Dockerfile` o lo script `build` lo copiano, togli anche quella riga.

- [ ] **Step 5: Simulazione con le carte vere**

In `backend/tests/game/simulazione.test.ts` rendi `partitaCasuale` parametrica:

```ts
function partitaCasuale(
  seed: number,
  o: { catalogo: Record<number, DefCarta>; mazzi: Record<PlayerId, Mazzo> } = { catalogo: catalogoProva(), mazzi: { A: mazzoProva(), B: mazzoProva() } },
): StatoPartita {
  let s = creaPartita({ seed, mazzi: o.mazzi, catalogo: o.catalogo });
  // ... resto invariato
```

e aggiungi in fondo:

```ts
const PILOTA = [93, 46, 67, 138, 231, 1, 2, 20, 50, 6, 103, 223, 8, 30, 79, 15, 119, 203, 19, 127, 173];

function mazzoPilota(cat: Record<number, DefCarta>, ordineCarte: number[], costruttore: number): Mazzo {
  const carte: number[] = [];
  for (const id of ordineCarte) {
    const n = LIMITE_COPIE[cat[id].rarita] ?? 3;
    for (let i = 0; i < n && carte.length < 40; i++) carte.push(id);
  }
  return { carte, costruttore };
}

describe('partite simulate con le carte pilota', () => {
  test('50 partite: nessun blocco, nessuna fuga, nessun effetto in ripiego', () => {
    const catalogo = catalogoReale();
    const mazzi = {
      A: mazzoPilota(catalogo, PILOTA, 255),
      B: mazzoPilota(catalogo, [...PILOTA].reverse(), 259),
    };
    let finite = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const s = partitaCasuale(seed, { catalogo, mazzi });
      expect([seed, s.manuali, s.erroriEffetti]).toEqual([seed, [], []]);
      if (s.esito) finite += 1;
    }
    expect(finite).toBeGreaterThanOrEqual(25);
  }, 300_000);
});
```

Importa `catalogoReale` da `./helpers`, `LIMITE_COPIE` e `Mazzo` da `../../game/engine/carte`, `DefCarta` dai tipi. Attenzione: `partitaCasuale` svuota `s.log` a ogni passo, ma **non** deve svuotare `s.erroriEffetti`.

- [ ] **Step 6: Esegui test e riepilogo**

Run: `cd backend && npx jest && npx tsc --noEmit && npm run effetti:riepilogo && npm run build`
Expected: PASS; `docs/effetti-carte.md` creato con "Automatiche: 23 su 120". Se la simulazione trova un caso che blocca o una fuga, è un bug: correggilo nel task che possiede il codice (dispatcher, carta o vista), aggiungi un test che lo riproduce con il seed trovato, e non abbassare le soglie.

- [ ] **Step 7: Commit**

```bash
git add -A backend/game backend/scripts backend/package.json backend/tests docs/effetti-carte.md
git commit -m "feat(effetti): riepilogo per la validazione, versione degli script dal registro, simulazione con le carte pilota"
```

---

### Task 11: Tavolo, logica delle scelte, attivabili e mano

**Files:**
- Modify: `frontend/src/types/match.ts`, `frontend/src/stores/matchStore.ts`
- Modify: `frontend/src/components/match/{MatchHand,MatchColumn,MatchPile,MatchDecisionPanel,MatchTable}.vue`
- Test: `frontend/src/components/match/{MatchPanels,MatchTable}.spec.ts`, nuovo `MatchHand.spec.ts`

**Interfaces:**
- Consumes: le nuove forme della vista (Task 7) e delle azioni (Task 1).
- Produces (store): `mosseEffetto(uid): Azione[]`, `bersagli: string[]` (computed), `anteprima` (ref, usata dal Task 12), `mostraAnteprima(cardId: number | null, uid?: string | null): void`.

- [ ] **Step 1: Tipi**

In `frontend/src/types/match.ts` aggiungi:

```ts
export type Domanda =
  | { tipo: 'siNo'; testo: string }
  | { tipo: 'bersaglio'; testo: string; uids: string[] }
  | { tipo: 'opzione'; testo: string; opzioni: string[] }
export type Risposta = boolean | string | number
```

nella `Azione`: `| { tipo: 'rispondi'; risposta: Risposta } | { tipo: 'attivaEffetto'; uid: string; indice: number }`; nella `Decisione`: `| { tipo: 'sceltaEffetto'; giocatore: PlayerId; uid: string; cardId: number; domanda: Domanda | null }`; nella `Vista`: `manuali: number[]; silenziate: string[]`.

- [ ] **Step 2: Scrivi i test che falliscono**

`frontend/src/components/match/MatchHand.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const store = reactive( {
  tocca: true, selezionata: null as string | null, bersagli: [] as string[],
  vista: { decisione: null as unknown },
  mosseDi: ( uid: string ) => ( uid === 'A-9' ? [{ tipo: 'giocaCarta', uid: 'A-9' }, { tipo: 'scambio', uid: 'A-9' }] : [] ),
  seleziona: vi.fn(), invia: vi.fn(), mostraAnteprima: vi.fn(),
} )
vi.mock( '../../stores/matchStore', () => ( { useMatchStore: () => store } ) )
vi.mock( '../../stores/cardStore', () => ( { useCardStore: () => ( { getCardById: () => ( { name: 'Evento', effect: '' } ) } ) } ) )

import MatchHand from './MatchHand.vue'

describe( 'MatchHand', () => {
  it( 'il clic su un Evento lo seleziona e non lo gioca: così si può scambiare', async () => {
    const w = mount( MatchHand, { props: { carte: [{ uid: 'A-9', cardId: 46, owner: 'A' }] } } )
    await w.get( '[data-uid="A-9"]' ).trigger( 'click' )
    expect( store.seleziona ).toHaveBeenCalledWith( 'A-9' )
    expect( store.invia ).not.toHaveBeenCalled()
  } )

  it( 'durante una scelta di bersaglio il clic manda la carta al tavolo', async () => {
    store.bersagli = ['A-9']
    store.vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-C', cardId: 67, domanda: { tipo: 'bersaglio', testo: 't', uids: ['A-9'] } }
    const w = mount( MatchHand, { props: { carte: [{ uid: 'A-9', cardId: 46, owner: 'A' }] } } )
    await w.get( '[data-uid="A-9"]' ).trigger( 'click' )
    expect( w.emitted( 'carta' ) ).toEqual( [['A-9']] )
  } )
} )
```

In `MatchPanels.spec.ts`: aggiungi allo store finto `bersagli: [] as string[]`, `mosseEffetto: () => []`; sostituisci il test "fase azioni: passa il turno, scambio della carta selezionata, effetto del Costruttore" con:

```ts
  it( 'fase azioni: passa il turno, gioca e scambia la carta selezionata, niente bottone fisso del Costruttore', async () => {
    store.selezionata = 'A-1'
    store.mosseDi = ( uid: string ) => ( uid === 'A-1' ? [{ tipo: 'giocaCarta', uid: 'A-1' }, { tipo: 'scambio', uid: 'A-1' }] : [] )
    const w = mount( MatchDecisionPanel )
    await w.get( '[data-test="passa-turno"]' ).trigger( 'click' )
    await w.get( '[data-test="gioca"]' ).trigger( 'click' )
    await w.get( '[data-test="scambio"]' ).trigger( 'click' )
    expect( w.find( '[data-test="costruttore"]' ).exists() ).toBe( false )
    expect( invia.mock.calls.map( ( c ) => c[0] ) ).toEqual( [
      { tipo: 'passaTurno' }, { tipo: 'giocaCarta', uid: 'A-1' }, { tipo: 'scambio', uid: 'A-1' },
    ] )
  } )

  it( 'scelta Sì/No e scelta fra opzioni', async () => {
    store.vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-5', cardId: 2, domanda: { tipo: 'siNo', testo: 'Faglia Primaria: vuoi distruggi questa carta?' } }
    const w = mount( MatchDecisionPanel )
    expect( w.text() ).toContain( 'Faglia Primaria: vuoi distruggi questa carta?' )
    await w.get( '[data-test="scelta-si"]' ).trigger( 'click' )
    store.vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-5', cardId: 19, domanda: { tipo: 'opzione', testo: 'scegli', opzioni: ['TP +1', 'TP -1'] } }
    await w.vm.$nextTick()
    await w.get( '[data-test="opzione-1"]' ).trigger( 'click' )
    expect( invia.mock.calls.map( ( c ) => c[0] ) ).toEqual( [
      { tipo: 'rispondi', risposta: true }, { tipo: 'rispondi', risposta: 1 },
    ] )
  } )

  it( "quando sceglie l'avversario si vede solo che sta scegliendo", () => {
    store.tocca = false
    store.vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'B', uid: 'B-5', cardId: 2, domanda: null }
    const w = mount( MatchDecisionPanel )
    expect( w.get( '[data-test="attesa-scelta"]' ).text() ).toContain( 'Carta 1' )
  } )
```

(lo store finto restituisce `name: 'Carta 1'` per ogni id: il testo atteso segue quello.)

In `MatchTable.spec.ts`: aggiungi allo store `bersagli: [] as string[]`, `mosseEffetto: ( uid: string ) => ( uid === 'A-5' ? [{ tipo: 'attivaEffetto', uid: 'A-5', indice: 0 }] : [] )`, `mostraAnteprima: vi.fn()`, `anteprima: null`, e due test:

```ts
  it( 'una carta con effetto attivabile ha il suo bottone', async () => {
    const w = mount( MatchTable )
    await w.get( '[data-test="colonna-presente"] [data-test="azione-carta"]' ).trigger( 'click' )
    expect( store.invia ).toHaveBeenCalledWith( { tipo: 'attivaEffetto', uid: 'A-5', indice: 0 } )
  } )

  it( 'durante una scelta di bersaglio il clic su una carta evidenziata risponde', async () => {
    store.bersagli = ['B-7']
    vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-C', cardId: 46, domanda: { tipo: 'bersaglio', testo: 't', uids: ['B-7'] } }
    const w = mount( MatchTable )
    await w.get( '[data-test="colonna-presente"] [data-uid="B-7"]' ).trigger( 'click' )
    expect( store.invia ).toHaveBeenCalledWith( { tipo: 'rispondi', risposta: 'B-7' } )
    vista.decisione = null
    store.bersagli = []
  } )
```

- [ ] **Step 3: Esegui e verifica il fallimento**

Run: `cd frontend && npx vitest run src/components/match`
Expected: FAIL sui nuovi test.

- [ ] **Step 4: Store**

In `frontend/src/stores/matchStore.ts`:

```ts
  const anteprima = ref<{ cardId: number; uid: string | null } | null>( null )

  function mosseEffetto( uid: string ): Azione[] {
    return ( agg.value?.mosse ?? [] ).filter( ( m ) => ( m.tipo === 'attivaEffetto' || m.tipo === 'usaEffetto' ) && m.uid === uid )
  }

  // Bersagli validi della scelta in corso, solo per chi sceglie.
  const bersagli = computed<string[]>( () => {
    const d = vista.value?.decisione
    return tocca.value && d?.tipo === 'sceltaEffetto' && d.domanda?.tipo === 'bersaglio' ? d.domanda.uids : []
  } )

  function mostraAnteprima( cardId: number | null, uid: string | null = null ) {
    anteprima.value = cardId === null ? null : { cardId, uid }
  }
```

e aggiungi `anteprima, bersagli, mosseEffetto, mostraAnteprima` al `return`.

- [ ] **Step 5: Mano**

`MatchHand.vue`, script:

```ts
// Durante un effetto manuale o una scelta di bersaglio il clic in mano indica una carta, non la gioca.
const inSceltaCarta = () => !!match.tocca && (
  match.vista?.decisione?.tipo === 'effettoManuale' || match.bersagli.length > 0
)

function click( c: Carta ) {
  if ( inSceltaCarta() ) {
    emit( 'carta', c.uid )
    return
  }
  if ( !match.mosseDi( c.uid ).length ) return
  match.seleziona( match.selezionata === c.uid ? null : c.uid )
}
```

e nel template `:attenuata` diventa `inSceltaCarta() ? !match.bersagli.includes(c.uid) && match.bersagli.length > 0 : match.mosseDi(c.uid).length === 0`, più `:evidenziata="match.bersagli.includes(c.uid)"`.

- [ ] **Step 6: Colonne e pile con il bottone dell'effetto**

`MatchColumn.vue`: ogni carta va dentro un contenitore con il suo bottone:

```vue
      <div v-for="c in mie" :key="c.uid" class="slot">
        <MatchCard :data-uid="c.uid" :uid="c.uid" :card-id="c.cardId" :coperta="c.coperta" :segnalino="c.segnalino"
          :evidenziata="match.bersagli.includes(c.uid)" class="mia" @click="emit('carta', c.uid)" />
        <button v-if="match.mosseEffetto(c.uid)[0]" type="button" data-test="azione-carta" class="slot__azione"
          @click="match.invia(match.mosseEffetto(c.uid)[0])">{{ etichetta(c.uid) }}</button>
      </div>
```

stesso schema per `loro` (senza bottone: le mosse dell'avversario non arrivano mai), con `:data-uid` e `:evidenziata`. Nello script:

```ts
const etichetta = ( uid: string ) => ( match.mosseEffetto( uid )[0]?.tipo === 'attivaEffetto' ? 'Attiva' : 'Manuale' )
```

Stile: `.slot { display: flex; flex-direction: column; align-items: center; gap: .15rem; } .slot__azione { font-size: .65rem; padding: .1rem .4rem; }`.

`MatchPile.vue`: nuove props `uid?: string`, `evidenziata?: boolean`; passa `:uid` e `:evidenziata` a `MatchCard`; sotto la carta lo stesso bottone `data-test="azione-carta"` quando `uid && match.mosseEffetto(uid)[0]`. In `MatchTable.vue` passa `:uid="g(io).costruttore.uid"` alle pile Costruttore, e alla pila Anomalia `:uid="v.anomalia?.uid"` `:evidenziata="!!v.anomalia && match.bersagli.includes(v.anomalia.uid)"` con `@click="v.anomalia && cartaCliccata(v.anomalia.uid)"`.

- [ ] **Step 7: Pannello delle decisioni**

`MatchDecisionPanel.vue`, script:

```ts
const cards = useCardStore()
const giocabile = computed( () => ( match.selezionata
  ? match.mosseDi( match.selezionata ).find( ( m ) => m.tipo === 'giocaCarta' && !m.colonna ) : undefined ) )
const nomeCarta = ( id: number ) => cards.getCardById( id )?.name ?? `Carta ${id}`
```

(importa `useCardStore`). Nel template, dentro `<template v-else-if="match.tocca && d">`, aggiungi:

```vue
      <template v-else-if="d.tipo === 'sceltaEffetto' && d.domanda">
        <p data-test="testo-scelta">{{ d.domanda.testo }}</p>
        <template v-if="d.domanda.tipo === 'siNo'">
          <button data-test="scelta-si" @click="match.invia({ tipo: 'rispondi', risposta: true })">Sì</button>
          <button data-test="scelta-no" @click="match.invia({ tipo: 'rispondi', risposta: false })">No</button>
        </template>
        <template v-else-if="d.domanda.tipo === 'opzione'">
          <button v-for="( o, i ) in d.domanda.opzioni" :key="i" :data-test="`opzione-${i}`"
            @click="match.invia({ tipo: 'rispondi', risposta: i })">{{ o }}</button>
        </template>
        <p v-else>Clicca uno dei bersagli evidenziati.</p>
        <p v-if="secondi !== null">{{ secondi }} s</p>
      </template>
```

e prima del blocco `match.tocca && v.finestra`:

```vue
    <p v-else-if="!match.tocca && d?.tipo === 'sceltaEffetto'" data-test="attesa-scelta">
      L'avversario sta scegliendo per {{ nomeCarta(d.cardId) }}
    </p>
```

Nel blocco della finestra e in quello della fase azioni aggiungi, prima del bottone Scambio:

```vue
      <button v-if="giocabile" data-test="gioca" @click="match.invia(giocabile!)">Gioca la carta selezionata</button>
```

e togli il bottone `data-test="costruttore"`.

- [ ] **Step 8: Clic sul tavolo durante una scelta**

`MatchTable.vue`, in `cartaCliccata`, come primo controllo:

```ts
  if ( match.bersagli.includes( uid ) ) {
    match.invia( { tipo: 'rispondi', risposta: uid } )
    return
  }
```

Le carte dello stack ricevono `:evidenziata="match.bersagli.includes(voce.uid)"`.

- [ ] **Step 9: Esegui i test**

Run: `cd frontend && npx vitest run && npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "feat(tavolo): scelte degli effetti, bottoni degli attivabili, mano che seleziona invece di giocare"
```

---

### Task 12: Tavolo, anteprima, larghezza, Supporto, mano visibile, Arrenditi

**Files:**
- Create: `frontend/src/components/match/MatchPreview.vue`
- Modify: `frontend/src/components/match/{MatchCard,MatchTable,MatchStatusBar,MatchDecisionPanel}.vue`, `frontend/src/views/MatchView.vue`, `frontend/src/App.vue`
- Test: `frontend/src/components/match/MatchTable.spec.ts`

**Interfaces:**
- Consumes: `anteprima`, `mostraAnteprima` (Task 11).

- [ ] **Step 1: Scrivi i test che falliscono**

In `MatchTable.spec.ts` (lo store finto ha già `anteprima: null` e `mostraAnteprima`; fai di `anteprima` un campo modificabile del `reactive`):

```ts
  it( "il passaggio del mouse su una carta chiede l'anteprima", async () => {
    const w = mount( MatchTable )
    await w.get( '[data-test="colonna-presente"] [data-uid="A-5"]' ).trigger( 'mouseenter' )
    expect( store.mostraAnteprima ).toHaveBeenCalledWith( 1, 'A-5' )
  } )

  it( "l'anteprima mostra nome, PEP e RP correnti, stato e testo", async () => {
    vista.colonne.presente[0].modifiche = [{ stat: 'pep', delta: 2, durata: 'collisione' }]
    store.anteprima = { cardId: 1, uid: 'A-5' }
    const w = mount( MatchTable )
    const a = w.get( '[data-test="anteprima"]' )
    expect( a.text() ).toContain( 'Carta 1' )
    expect( a.get( '[data-test="anteprima-pep"]' ).text() ).toBe( '3' ) // 1 + 2
    store.anteprima = null
    vista.colonne.presente[0].modifiche = []
  } )

  it( 'la barra mostra il Supporto del Passato di entrambi', () => {
    vista.giocatori.A.supportoPep = 1
    const w = mount( MatchTable )
    expect( w.get( '[data-test="supporto-mio"]' ).text() ).toContain( '+1 PEP' )
    vista.giocatori.A.supportoPep = 0
  } )
```

Nel finto `getCardById` restituisci anche `type: 'Solido', status: 'Freddo', cost_et: 3, pep: 1, rp: 5`.

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `cd frontend && npx vitest run src/components/match/MatchTable.spec.ts`
Expected: FAIL.

- [ ] **Step 3: `MatchCard` chiede l'anteprima**

In `MatchCard.vue`: nuova prop `uid?: string`; importa `useMatchStore`; sul `<button>`:

```vue
    @mouseenter="cardId !== null && match.mostraAnteprima(cardId, uid ?? null)"
    @mouseleave="match.mostraAnteprima(null)"
```

togli la regola `.match-card:hover { transform: scale(1.8); z-index: 20; }` e l'attributo `:title` (lo sostituisce l'anteprima). In `MatchColumn` passa `:uid="c.uid"` (già fatto nel Task 11) e in `MatchHand` `:uid="c.uid"`.

- [ ] **Step 4: `MatchPreview.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import { useCardStore } from '../../stores/cardStore'
import type { VistaCampo } from '../../types/match'

const match = useMatchStore()
const cards = useCardStore()
const a = computed( () => match.anteprima )
const carta = computed( () => ( a.value ? cards.getCardById( a.value.cardId ) ?? null : null ) )
const inCampo = computed<VistaCampo | null>( () => {
  const uid = a.value?.uid
  if ( !uid || !match.vista ) return null
  return Object.values( match.vista.colonne ).flat().find( ( c ) => c.uid === uid ) ?? null
} )
const somma = ( stat: 'pep' | 'rp' ) => ( inCampo.value?.modifiche ?? [] ).filter( ( m ) => m.stat === stat ).reduce( ( t, m ) => t + m.delta, 0 )
const pep = computed( () => Math.max( 0, ( carta.value?.pep ?? 0 ) + somma( 'pep' ) ) )
const rp = computed( () => Math.max( 0, ( carta.value?.rp ?? 0 ) + somma( 'rp' ) ) )
</script>

<template>
  <aside v-if="carta" data-test="anteprima" class="anteprima">
    <img v-if="carta.image_url" :src="carta.image_url" :alt="carta.name" />
    <h3>{{ carta.name }}</h3>
    <p class="anteprima__tipo">
      {{ inCampo?.statoForzato ?? carta.type }} · {{ carta.status }} · {{ carta.cost_et }} ET
      <span v-if="inCampo?.segnalino === 'caldo'">🔴</span><span v-if="inCampo?.segnalino === 'freddo'">🔵</span>
    </p>
    <p class="anteprima__stat">PEP <strong data-test="anteprima-pep">{{ pep }}</strong> · RP <strong data-test="anteprima-rp">{{ rp }}</strong></p>
    <p class="anteprima__testo">{{ carta.effect }}</p>
  </aside>
</template>

<style scoped>
.anteprima { position: fixed; right: 1rem; top: 6rem; z-index: 50; width: 17rem; padding: .7rem; background: #0b0e1af2; border: 1px solid #5c6bff88; border-radius: .6rem; pointer-events: none; }
.anteprima img { width: 100%; border-radius: .4rem; }
.anteprima h3 { margin: .4rem 0 .2rem; font-size: 1rem; }
.anteprima__tipo, .anteprima__stat { margin: .15rem 0; font-size: .85rem; }
.anteprima__testo { margin: .4rem 0 0; font-size: .85rem; line-height: 1.35; }
</style>
```

Se il tipo restituito da `getCardById` non ha `type`, `status`, `cost_et`, `pep`, `rp`, leggi i nomi dei campi in `frontend/src/stores/cardStore.ts` e adatta (i campi del documento Mongo sono quelli della fixture: `type`, `status`, `cost_et`, `pep`, `rp`, `effect`, `image_url`). In `MatchTable.vue` aggiungi `<MatchPreview />` in fondo alla `section`.

- [ ] **Step 5: Supporto nella barra**

In `MatchStatusBar.vue`, dopo le righe di IT ed ET:

```vue
    <span data-test="supporto-mio">Supporto: +{{ io.supportoPep }} PEP · +{{ io.supportoRp }} RP</span>
    <span data-test="supporto-avversario">Avversario: +{{ avv.supportoPep }} PEP · +{{ avv.supportoRp }} RP</span>
```

- [ ] **Step 6: Tavolo a tutta larghezza e mano visibile a 1366x850**

`App.vue`: sul `<main>` aggiungi la classe `'content-wrapper--tavolo': route.path.startsWith('/partita')` e lo stile

```css
.content-wrapper--tavolo {
  padding-left: .5rem;
  padding-right: .5rem;
  align-items: stretch;
}
```

`MatchView.vue`: `<style scoped>.match-view { width: 100%; }</style>`.

`MatchTable.vue`, stile: la sezione occupa l'altezza della finestra meno la barra di navigazione e la griglia si restringe invece di spingere la mano fuori:

```css
.tavolo {
  display: grid; gap: .5rem; padding: .5rem; height: calc(100dvh - 5.5rem); min-height: 36rem;
  grid-template-columns: 1fr 16rem; grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;
  grid-template-areas: 'barra barra' 'manoavv log' 'griglia log' 'stack log' 'pannello log' 'mano log';
  background: radial-gradient(ellipse at center, #10142a, #04050b);
}
.tavolo__griglia { /* invariata, tranne: */ min-height: 0; }
```

(togli `min-height: 32rem` dalla griglia e `min-height: 100vh` dalla sezione). In `MatchColumn.vue` la variabile delle carte diventa `--carta-l: clamp(3rem, 7vh, 4.6rem)`, in `MatchHand.vue` `--carta-l: clamp(4.2rem, 12vh, 6.5rem)`.

- [ ] **Step 7: Arrenditi**

In `MatchDecisionPanel.vue`:

```css
.pannello__resa { margin-left: auto; padding: .45rem 1.1rem; font-size: .95rem; border: 1px solid #ff6b6b; color: #ffb3b3; background: transparent; border-radius: .4rem; }
.pannello { /* aggiungi */ margin-top: .3rem; }
```

- [ ] **Step 8: Esegui test, tipi e build**

Run: `cd frontend && npx vitest run && npx vue-tsc --noEmit && npm run build`
Expected: PASS. La verifica visiva (1366x850, anteprima) la fa il controller nel Task 13: un test unitario non misura il layout.

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git commit -m "feat(tavolo): anteprima delle carte, tavolo a tutta larghezza, Supporto visibile, mano entro lo schermo, Arrenditi più evidente"
```

---

### Task 13: Prova end-to-end e consegna a Simone (controller)

Questo task lo esegue il controller, non un subagent: serve il browser e lo stack Docker.

**Files:**
- Modify (fuori dal repo, ignorati da git): `.superpowers/sdd/2026-10-13-rete-tavolo-1b/e2e/e2e-seed.js`
- Create: `docs/superpowers/plans/2026-10-15-effetti-carte-1c-registro.md`

- [ ] **Step 1: Suite complete**

Run: `cd backend && npx jest && npx tsc --noEmit` e `cd frontend && npx vitest run && npx vue-tsc --noEmit && npm run build`
Expected: tutto verde. Annota i numeri (suite e test) per il registro.

- [ ] **Step 2: Stack di prova**

```bash
docker compose -f docker-compose.yml -f .superpowers/sdd/2026-10-13-rete-tavolo-1b/e2e/compose-e2e.yml up -d --build
```

- [ ] **Step 3: Mazzi pilota per gli utenti di prova**

In `e2e-seed.js` sostituisci la costruzione dei mazzi: `e2e_alice` con le carte pilota nell'ordine `[93, 46, 67, 138, 231, 1, 2, 20, 50, 6, 103, 223, 8, 30, 79, 15, 119, 203, 19, 127, 173]` e Costruttore 255 (Nyx), `e2e_bob` con lo stesso elenco al contrario e Costruttore 259 (Khepri), copie fino al limite di rarità e a 40 carte (come `mazzoPilota` del Task 10). Poi:

```bash
E=.superpowers/sdd/2026-10-13-rete-tavolo-1b/e2e
docker cp $E/e2e-seed.js joule-backend:/app/e2e-seed.js
docker exec joule-backend node e2e-seed.js | grep '^\[{' > $E/accessi-prova.json
```

- [ ] **Step 4: Partita via script**

Esegui `e2e-gioca.js` come nella 1B. Se sceglie le mosse dall'elenco `mosse` del server, gestisce già `rispondi` e `attivaEffetto`; se usa una logica propria, aggiungi: con una `sceltaEffetto` manda la prima mossa `rispondi` dell'elenco. Atteso: esito raggiunto, nessuna riga `effetto in errore` in `docker logs joule-backend`, nessun payload con la `domanda` di una scelta altrui (controllo come Step 3.4 della 1B).

- [ ] **Step 5: Verifica visiva**

Nel browser integrato, a 1366x850 (`resize_window`), entra con un utente di prova e apri una partita:
- la mano è interamente visibile senza scorrere (`document.querySelector('[data-test="mano-mia"]').getBoundingClientRect().bottom <= innerHeight`);
- il tavolo arriva ai bordi della finestra (larghezza della `.tavolo` ≥ `innerWidth - 32`);
- il passaggio del mouse su una carta in campo mostra l'anteprima con PEP e RP;
- uno screenshot per il registro.

- [ ] **Step 6: Registro e consegna**

Scrivi `docs/superpowers/plans/2026-10-15-effetti-carte-1c-registro.md` sul modello del registro 1B: suite, ambiente, partita via script, verifica visiva, problemi trovati con decisione. Committa, fai push del branch, e passa a Simone: link `http://localhost:5174`, utenti di prova, le 23 carte automatiche, cosa provare (Nyx, Khepri, Faglia Primaria, Eco del Punto Zero, Deviazione Temporale), e `docs/effetti-carte.md` da validare a gruppi.

```bash
git add docs/superpowers/plans/2026-10-15-effetti-carte-1c-registro.md
git commit -m "docs(effetti): registro della prova della tappa 1C-a"
git push -u origin feature/effetti-carte-1c
```

---

## Self-Review

- **Copertura della spec:** sezione 3 (componenti) → Task 3, 4, 5, 6, 10; 4.1 innescati → Task 2, 4; 4.2 continui → Task 5; 4.3 attivabili → Task 6; 4.4 ritardati → Task 4; 4.5 contatori → Task 1, 3, 6; 5 stato e ripiego → Task 1, 4; 6 scelte e informazioni nascoste → Task 4, 7, 9, 11; 7 interfaccia → Task 11, 12; 8 validazione e test → Task 8, 9, 10, 13; 9 interpretazioni → applicate nelle carte pilota (I1, I2, I4, I6, I9, I10, I14, I16, I17, I25, I26, I27, I28); 10 divisione → questo piano è 1C-a. Il test "copertura 120 su 120" della spec sezione 8 appartiene al 1C-b: qui il test fissa le 23 pilota.
- **Segnaposto:** nessun TBD; i due punti in cui l'esecutore deve leggere un file prima di scrivere (test del timer nel gestore, campi di `getCardById`) dicono quale file e cosa cercare.
- **Coerenza dei tipi:** `Pendente.dati` è sempre presente (anche `{}`); `dichiarazioni(s, cardId)` prende sempre lo stato; `carta(id, nome, ...)` ovunque con il nome; `mosseEffetti` / `mosseEffetto` sono due cose diverse (backend: mosse legali; store: filtro delle mosse ricevute).

## Definition of Done (Contract)

**Obiettivo misurabile:**
- Le 23 carte pilota (1, 2, 6, 8, 15, 19, 20, 30, 46, 50, 67, 79, 93, 103, 119, 127, 138, 173, 203, 223, 231, 255, 259) si applicano senza pannello manuale, ciascuna con almeno un test che verifica l'effetto sul testo stampato.
- 50 partite simulate con mazzi pilota: zero blocchi, zero fughe di informazione, `manuali` ed `erroriEffetti` vuoti; almeno 25 arrivano a un esito.
- Suite backend e frontend verdi, `tsc`, `vue-tsc` e i due build senza errori.
- A 1366x850 la mano è visibile senza scorrere e il tavolo occupa la larghezza della finestra.

**Vincoli:**
- Quelli della sezione Global Constraints. Nessun merge su `main`.

**Formato output:**
- Dichiarazioni in `backend/game/effetti/carte/*.ts`, una per carta, con nome esatto; `docs/effetti-carte.md` rigenerato; registro della prova in `docs/superpowers/plans/2026-10-15-effetti-carte-1c-registro.md`; branch pushato.

**Condizioni di FALLIMENTO (non è finito se una è vera):**
- [ ] Una carta pilota apre il pannello manuale in una partita senza errori di script.
- [ ] Un effetto con scelta applica due volte le azioni che vengono prima della scelta (test del Task 4).
- [ ] La vista di un giocatore contiene la `domanda` di una scelta dell'altro, o il nome di una carta guardata con Flusso di Innesco o Vuoto di Probabilità.
- [ ] Un test della 1A o della 1B è stato cancellato o indebolito per far passare la 1C senza scriverlo nel commit.
- [ ] Una carta di `catalogoProva` (nomi `Carta N`) esegue una dichiarazione reale.
- [ ] Il clic su un Evento in mano lo gioca invece di selezionarlo.
- [ ] `docs/effetti-carte.md` non dice "Automatiche: 23 su 120".

## Rischi (Premortem)

1. **Ripresa dopo una scelta non deterministica:** se un effetto legge qualcosa che cambia tra la sospensione e la ripresa (rng consumato fuori, log, ordine di un array), la rigiocata delle scelte prende una strada diversa e applica effetti sbagliati senza errori visibili. → **mitigazione:** la sospensione ripristina tutto lo stato (rng compreso) e la ripresa riparte dallo stesso stato; test del Task 4 sulle azioni prima della scelta; simulazione del Task 10 con migliaia di scelte casuali e invarianti a ogni passo.
2. **Ordine tra coda, finestre e stack:** spostare `inizioCollisione`, `fineCollisione` e la risoluzione dello stack dentro la coda può cambiare il ritmo delle finestre della 1B (una finestra che si apre prima che gli effetti finiscano, o un Evento in risposta che vede lo stato a metà). → **mitigazione:** in `avanza` la coda si svuota sempre prima di guardare finestra e stack; test di Faglia Temporale (inizio Collisione prima della finestra) e di Deviazione Temporale (risposta che annulla una risposta); prova via script nel Task 13.
3. **Interpretazioni tradotte male nelle carte pilota:** la dichiarazione compila e i test passano, ma fa una cosa diversa da quella che Simone intende (ad esempio Nyx o Faglia Primaria). → **mitigazione:** ogni test di carta cita il numero di interpretazione che applica; il riepilogo mette testo e script uno accanto all'altro per la validazione di Simone; collaudo a mano sulle carte indicate nel Task 13.

**RISCHIO PIÙ ALTO:** il n. 1, perché un errore di ripresa non produce eccezioni: la partita continua con uno stato sbagliato e lo si scopre solo giocando. Va presidiato per primo, già nel Task 4.
