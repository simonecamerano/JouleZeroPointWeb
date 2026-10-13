# Motore di regole (tappa 1A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un motore di regole puro in TypeScript che gioca una partita completa di Joule Zero Point v6.0 tra due giocatori, con tutti gli effetti delle carte applicati a mano tramite azioni base.

**Architecture:** Funzioni pure in `backend/game/engine/`, nessuna dipendenza da rete, database o orologio. Lo stato è un oggetto serializzabile (`StatoPartita`); `applica(stato, giocatore, azione)` restituisce un nuovo stato o un errore, e dopo ogni azione `avanza` esegue da sola le fasi automatiche fino alla prossima decisione umana. Il caso è un generatore con seed salvato nello stato, quindi ogni partita è riproducibile.

**Tech Stack:** TypeScript 5.9 (strict, CommonJS), Jest 30 + ts-jest, Node 22 (`structuredClone`).

**Spec:** `docs/superpowers/specs/2026-10-13-partita-online-design.md`

## Global Constraints

- Tutto il codice del motore sta in `backend/game/engine/`; i test in `backend/tests/game/`.
- Nessun import da `express`, `mongoose`, `socket.io`, `config/`, `models/` dentro `backend/game/engine/`.
- Nessun uso di `Math.random`, `Date.now` o `new Date` dentro `backend/game/engine/`: il caso passa solo da `rng.ts`.
- Identificatori, messaggi d'errore e voci di log in italiano, come nella spec.
- Valori del regolamento 6.0: IT iniziale 20, TP iniziale 0, ET iniziale 3, ET massima 10, TP tra -4 e +4, mazzo 40 carte + 1 Costruttore, Futuro 30 / Memoria 10, mano iniziale 5, mulligan a 4.
- Capienza: **massimo 4 Frammenti per colonna per ciascun giocatore** (deciso da Simone il 2026-10-13).
- Copie massime per rarità: Stabile 3, Instabile 2, Critica 1.
- In questa tappa **nessun effetto di carta è automatico**: ogni testo si applica con le azioni base.
- Comando test: da `backend/`, `npx jest tests/game` (tutto il motore) o `npx jest tests/game/<file>.test.ts`.

## Interpretazioni del regolamento

Punti che il PDF v6 lascia aperti, decisi qui. Simone li rivede insieme al piano; ognuno è isolato in una sola funzione, quindi cambiarlo dopo costa poco.

1. **TP derivata**: TP = somma dei Caldi (+1) e Freddi (-1) nel Presente + uno spostamento dovuto agli effetti, limitata a -4 / +4. Lo spostamento si azzera a ogni Slittamento ("la TP si ricalcola").
2. **Inversione spontanea**: scatta quando la TP *arriva* a +4 o -4 da un valore diverso, non a ogni ricalcolo in cui resta lì.
3. **Supporto Istantaneo**: il bonus va al totale del giocatore nella Collisione del round in corso (non alla singola carta, che nel Passato non combatte). Scatta solo per carte giocate nel Passato o arrivate per Slittamento, non per spostamenti da effetto. Neutro non dà bonus.
4. **ET**: a ogni fase Risorse l'ET si ricarica al massimo del round (`min(10, 2 + round)`); l'ET non spesa non si accumula.
5. **Proprietà degli stati in Collisione**: Plasma +1 danno per ogni Plasma (max 2) se il giocatore infligge danno; Solido -1 al danno subito per ogni Solido (max 2); Gas: se nessuno dei due ha inflitto danno, 1 danno elusivo per ogni Gas (max 2), non riducibile dal Solido; Liquido: fino a 2 Liquidi distrutti tornano nel Passato, sempre (il "puoi" è sempre conveniente), senza Supporto Istantaneo.
6. **Segnalini termici**: 🔴 aggiunge le proprietà dello stato superiore, 🔵 di quello inferiore, mantenendo le proprie (regolamento strutturato: "concede anche"). Plasma con 🔴 e Solido con 🔵 non guadagnano nulla.
7. **Carte coperte nel Futuro**: si rivelano entrando nel Presente. Una carta che slitta nel Futuro in flusso invertito resta scoperta. Una carta coperta non apre l'effetto manuale finché è coperta.
8. **Fine partita**: IT ≤ 0 e Collasso Entropico si controllano dopo ogni azione; la Sincronia a fine round. Due sconfitte o due Sincronie nello stesso momento = pareggio.
9. **Finestre di risposta**: dopo ogni carta giocata l'avversario ha la priorità; se passa la finestra si chiude, se risponde con un Evento la priorità torna all'altro, e così via. Alla Collisione la finestra parte da chi ha l'iniziativa e si chiude con due "passa" di fila. Lo stack si risolve dall'ultima carta alla prima.
10. **Costruttore**: non entra nel conteggio delle 40 carte, non è mai in mano né in campo. Il suo testo si applica a mano con `usaEffetto`.

## Review Focus

1. **Evento in risposta durante la Collisione**: dopo che lo stack si è svuotato la Collisione deve risolversi comunque, senza riaprire la finestra né bloccare la partita. Test in Task 7.
2. **Carta coperta nel Futuro**: il suo `cardId` non deve mai arrivare all'avversario, né dal campo, né dallo stack, né dal log. Test in Task 8.
3. **Pesca da effetto manuale con mazzo attivo vuoto**: la partita deve finire subito per Collasso Entropico, anche se c'è una decisione aperta. Test in Task 7.
4. **Inversione spontanea durante lo Slittamento**: la fase Risorse dello stesso round deve pescare dal mazzo opposto. Test in Task 7.
5. **Azione malformata** (tipo sconosciuto, delta non intero, bersaglio inesistente): errore leggibile e stato di partenza non modificato. Test in Task 7.

## File Structure

| File | Responsabilità |
|---|---|
| `backend/game/engine/types.ts` | Tipi di stato, carte, azioni, decisioni |
| `backend/game/engine/rng.ts` | Generatore con seed, mescolamento |
| `backend/game/engine/log.ts` | Voci di log, nomi leggibili |
| `backend/game/engine/carte.ts` | Catalogo, validazione mazzo, valori effettivi di una carta |
| `backend/game/engine/campo.ts` | Mettere, togliere, distruggere carte; Supporto Istantaneo |
| `backend/game/engine/temperatura.ts` | TP, segnalini, Inversioni |
| `backend/game/engine/slittamento.ts` | Fase 1 |
| `backend/game/engine/risorse.ts` | Fase 2, pesca, mazzo attivo |
| `backend/game/engine/collisione.ts` | Fase 5 |
| `backend/game/engine/vittoria.ts` | Condizioni di fine partita, fine round |
| `backend/game/engine/azioni.ts` | Giocare carte, finestre, passare, Scambio |
| `backend/game/engine/manuale.ts` | Effetti manuali e azioni base |
| `backend/game/engine/setup.ts` | Creazione partita, iniziativa, mulligan |
| `backend/game/engine/round.ts` | `avanza`: macchina a stati delle fasi e risoluzione dello stack |
| `backend/game/engine/legali.ts` | `chiDeveAgire`, `mosseLegali` |
| `backend/game/engine/vista.ts` | Vista filtrata per giocatore |
| `backend/game/engine/invarianti.ts` | Controlli di coerenza per i test |
| `backend/game/engine/index.ts` | `applica`, `arrendi`, export pubblici |
| `backend/tests/game/helpers.ts` | Catalogo e stati di prova |

## Definition of Done (Contract)

**Obiettivo misurabile:**
- `npx jest tests/game` verde su tutti gli 8 file di test del motore.
- 100 partite simulate con seed 1-100 senza nessuna mossa di `mosseLegali` rifiutata da `applica`, senza nessuno stato in cui la partita non è finita e `chiDeveAgire` restituisce `null`, e con `verificaInvarianti` vuoto dopo ogni passo; almeno 50 su 100 arrivano a un esito entro 3000 passi.
- Stesso seed e stessa sequenza di azioni producono lo stesso stato (`toEqual`).

**Vincoli:**
- Quelli di "Global Constraints": codice solo in `backend/game/engine/`, nessuna dipendenza da rete, database, orologio o `Math.random`; capienza 4 Frammenti per colonna per giocatore; valori del regolamento 6.0.

**Formato output:**
- Modulo `backend/game/engine/index.ts` che esporta `creaPartita`, `applica`, `arrendi`, `chiDeveAgire`, `mosseLegali`, `vista`, `verificaInvarianti`, `validaMazzo`, `daCardDb` e i tipi, con le firme della sezione Interfaces dei task.
- Un commit per task, 8 commit in tutto.

**Condizioni di FALLIMENTO (l'agente NON può dichiararsi finito se una è vera):**
- [ ] `cd backend && npx jest tests/game` ha almeno un test rosso o saltato (`skip`, `todo`, `only`).
- [ ] `cd backend && npx tsc --noEmit` riporta errori.
- [ ] `cd backend && npm test` ha test rossi che erano verdi prima del lavoro.
- [ ] Il grep dello Step 8 del Task 8 trova `Math.random`, `Date.now`, `new Date` o import da `express`, `mongoose`, `socket.io`, `config/`, `models/` dentro `backend/game/engine/`.
- [ ] Un test è stato modificato per farlo passare (cambio di seed, di valori attesi o di soglie) senza che il cambio sia motivato nel messaggio di commit.
- [ ] `vista(s, p)` contiene il `cardId` di una carta coperta dell'avversario, in campo o nello stack, o una voce di log `soloPer` dell'avversario.
- [ ] `applica` modifica l'oggetto `stato` ricevuto (il test "rifiuta chi non deve agire e non modifica lo stato" è rosso).

## Rischi (Premortem)

Le 3 cause di fallimento più probabili, previste prima di scrivere codice:

1. **Il motore codifica un'interpretazione delle regole diversa da come Simone gioca davvero al tavolo**, e il playtest online produce risultati che lui non riconosce. → **mitigazione:** le 10 interpretazioni sono elencate in testa al piano e Simone le rivede prima dell'esecuzione; ognuna vive in una sola funzione, quindi correggerla dopo tocca un file e il suo test.
2. **La macchina delle fasi si blocca in un caso raro** (finestra mai chiusa, decisione senza mosse, ciclo in `avanza`), che i test scritti a mano non coprono e che in partita vera blocca due persone. → **mitigazione:** le partite simulate falliscono se nessuno deve agire a partita aperta o se una mossa legale viene rifiutata, e `avanza` lancia un errore dopo 1000 passi senza decisione (condizioni di fallimento 1 e 5).
3. **Informazione nascosta che trapela** dal campo, dallo stack o dal log, scoperta solo quando qualcuno guarda il traffico del socket nella tappa 1B. → **mitigazione:** test dedicato in Task 8 su carta coperta in campo, stack e log; condizione di fallimento 6.

**RISCHIO PIÙ ALTO:** il #1. Gli altri due li prende la suite di test; un'interpretazione sbagliata invece passa tutti i test, perché i test la confermano, e si scopre solo giocando.

---

### Task 1: Tipi, generatore casuale, catalogo carte

**Files:**
- Create: `backend/game/engine/types.ts`
- Create: `backend/game/engine/rng.ts`
- Create: `backend/game/engine/log.ts`
- Create: `backend/game/engine/carte.ts`
- Create: `backend/tests/game/helpers.ts`
- Test: `backend/tests/game/carte.test.ts`

**Interfaces:**
- Consumes: nulla.
- Produces: tutti i tipi di `types.ts`; `prossimo(s: { rng: number }): number`, `intero(s: { rng: number }, n: number): number`, `mescola<T>(s: { rng: number }, arr: T[]): void`; `log(s: StatoPartita, testo: string, soloPer?: PlayerId): void`, `nomeG(p: PlayerId): string`, `NOMI_COLONNA`; da `carte.ts`: `ORDINE_STATI`, `LIMITE_COPIE`, `isFrammento`, `def`, `statoDi`, `proprieta`, `pepDi`, `rpDi`, `Mazzo`, `validaMazzo`, `daCardDb`, `cercaInCampo`, `contaInColonna`, `costoEffettivo`. Helpers di test: `catalogoProva()`, `mazzoProva()`, `statoVuoto()`, `carta(p, cardId)`, `inCampo(s, p, cardId, colonna, extra?)`.

- [ ] **Step 1: Scrivere i tipi**

`backend/game/engine/types.ts`:

```ts
export type PlayerId = 'A' | 'B';
export const GIOCATORI: PlayerId[] = ['A', 'B'];
export const altro = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');

export type Colonna = 'passato' | 'presente' | 'futuro';
export const COLONNE: Colonna[] = ['passato', 'presente', 'futuro'];

export type Flusso = 'normale' | 'invertito';
export type Fase = 'setup' | 'slittamento' | 'risorse' | 'azioni' | 'collisione' | 'fine' | 'terminata';

export type StatoMateria = 'Solido' | 'Liquido' | 'Gas' | 'Plasma' | 'Materia Oscura';
export const STATI: StatoMateria[] = ['Solido', 'Liquido', 'Gas', 'Plasma', 'Materia Oscura'];
export type TipoCarta = StatoMateria | 'Evento' | 'Anomalia' | 'Costruttore';
export type Termica = 'Caldo' | 'Freddo' | 'Neutro';
export type Rarita = 'Stabile' | 'Instabile' | 'Critica' | '';

export interface DefCarta {
  cardId: number;
  nome: string;
  tipo: TipoCarta;
  termica: Termica;
  costo: number;
  pep: number;
  rp: number;
  rarita: Rarita;
  effetto: string;
}

export interface Carta {
  uid: string;
  cardId: number;
  owner: PlayerId;
}

export type Durata = 'collisione' | 'round' | 'permanente';
export interface Modifica {
  stat: 'pep' | 'rp';
  delta: number;
  durata: Durata;
}

export interface CartaCampo extends Carta {
  coperta: boolean;
  segnalino: 'caldo' | 'freddo' | null;
  statoForzato: StatoMateria | null;
  modifiche: Modifica[];
}

export interface Giocatore {
  id: PlayerId;
  futuro: Carta[];
  memoria: Carta[];
  mano: Carta[];
  orizzonte: Carta[];
  costruttore: Carta;
  it: number;
  et: number;
  etMax: number;
  mulliganFatto: boolean;
  scambioUsato: boolean;
  supportoUsati: number;
  supportoPep: number;
  supportoRp: number;
  haPassato: boolean;
}

export interface VoceStack {
  carta: Carta;
  controllore: PlayerId;
  annullata: boolean;
  risolta: boolean;
}

export interface Finestra {
  contesto: 'giocata' | 'collisione';
  priorita: PlayerId;
  passi: number;
  passiNecessari: number;
}

export type Decisione =
  | { tipo: 'sceltaIniziativa'; giocatore: PlayerId }
  | { tipo: 'mulligan'; giocatore: PlayerId }
  | { tipo: 'bonusControllo'; giocatore: PlayerId }
  | { tipo: 'capienza'; giocatore: PlayerId; colonna: Colonna }
  | { tipo: 'effettoManuale'; giocatore: PlayerId; uid: string; origine: 'stack' | 'libero' };

export type MotivoFine = 'collasso' | 'sincronia' | 'collassoEntropico' | 'pareggio' | 'abbandono';
export interface Esito {
  vincitore: PlayerId | null;
  motivo: MotivoFine;
}

export interface VoceLog {
  round: number;
  testo: string;
  soloPer?: PlayerId;
}

export interface StatoPartita {
  rng: number;
  round: number;
  fase: Fase;
  flusso: Flusso;
  tp: number;
  tpSpostamento: number;
  iniziativa: PlayerId;
  attivo: PlayerId;
  colonne: Record<Colonna, CartaCampo[]>;
  anomalia: Carta | null;
  giocatori: Record<PlayerId, Giocatore>;
  stack: VoceStack[];
  finestra: Finestra | null;
  decisione: Decisione | null;
  sconfitte: { giocatore: PlayerId; motivo: MotivoFine }[];
  esito: Esito | null;
  carte: Record<number, DefCarta>;
  log: VoceLog[];
}

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

export type Risultato = { ok: true; stato: StatoPartita } | { ok: false; errore: string };
```

- [ ] **Step 2: Scrivere rng e log**

`backend/game/engine/rng.ts`:

```ts
/** Mulberry32: deterministico, stato in un solo intero salvato nella partita. */
export function prossimo(s: { rng: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function intero(s: { rng: number }, n: number): number {
  return Math.floor(prossimo(s) * n);
}

export function mescola<T>(s: { rng: number }, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = intero(s, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
```

`backend/game/engine/log.ts`:

```ts
import { Colonna, PlayerId, StatoPartita } from './types';

export const NOMI_COLONNA: Record<Colonna, string> = {
  passato: 'Passato',
  presente: 'Presente',
  futuro: 'Futuro',
};

export const nomeG = (p: PlayerId): string => `Giocatore ${p}`;

export function log(s: StatoPartita, testo: string, soloPer?: PlayerId): void {
  s.log.push(soloPer ? { round: s.round, testo, soloPer } : { round: s.round, testo });
}
```

- [ ] **Step 3: Scrivere gli helper di test**

`backend/tests/game/helpers.ts`:

```ts
import {
  Carta, CartaCampo, Colonna, DefCarta, Giocatore, PlayerId, StatoPartita, TipoCarta,
} from '../../game/engine/types';
import { Mazzo } from '../../game/engine/carte';

export function catalogoProva(): Record<number, DefCarta> {
  const c: Record<number, DefCarta> = {};
  const add = (d: Partial<DefCarta> & { cardId: number; tipo: TipoCarta }) => {
    c[d.cardId] = {
      nome: `Carta ${d.cardId}`, termica: 'Neutro', costo: 1, pep: 1, rp: 1,
      rarita: 'Stabile', effetto: '', ...d,
    };
  };
  add({ cardId: 1, tipo: 'Solido', termica: 'Freddo', costo: 3, pep: 1, rp: 5 });
  add({ cardId: 2, tipo: 'Liquido', termica: 'Neutro', costo: 3, pep: 2, rp: 3 });
  add({ cardId: 3, tipo: 'Gas', termica: 'Caldo', costo: 3, pep: 2, rp: 2 });
  add({ cardId: 4, tipo: 'Plasma', termica: 'Caldo', costo: 3, pep: 3, rp: 1 });
  add({ cardId: 5, tipo: 'Materia Oscura', termica: 'Neutro', costo: 4, pep: 2, rp: 3 });
  add({ cardId: 6, tipo: 'Evento', costo: 2, pep: 0, rp: 0, effetto: 'Riduci la TP di 1.' });
  add({ cardId: 7, tipo: 'Anomalia', costo: 2, pep: 0, rp: 0, effetto: 'Regola permanente di prova.' });
  add({ cardId: 8, tipo: 'Evento', costo: 1, pep: 0, rp: 0, effetto: '' });
  add({ cardId: 9, tipo: 'Solido', termica: 'Freddo', costo: 2, pep: 0, rp: 4, effetto: 'Effetto di prova.' });
  for (let id = 10; id <= 19; id++) {
    add({ cardId: id, tipo: id % 2 ? 'Gas' : 'Liquido', termica: id % 2 ? 'Caldo' : 'Freddo', costo: 2, pep: 2, rp: 2 });
  }
  add({ cardId: 20, tipo: 'Plasma', termica: 'Caldo', rarita: 'Critica' });
  add({ cardId: 100, tipo: 'Costruttore', costo: 0, pep: 0, rp: 0, rarita: '', effetto: 'Effetto del Costruttore.' });
  return c;
}

/** 13 carte x 3 copie + 1 = 40. */
export function mazzoProva(): Mazzo {
  const carte: number[] = [];
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) carte.push(id, id, id);
  carte.push(14);
  return { carte, costruttore: 100 };
}

let contatore = 0;
export function carta(p: PlayerId, cardId: number): Carta {
  contatore += 1;
  return { uid: `${p}-T${contatore}`, cardId, owner: p };
}

export function inCampo(
  s: StatoPartita, p: PlayerId, cardId: number, colonna: Colonna, extra: Partial<CartaCampo> = {},
): CartaCampo {
  const fc: CartaCampo = {
    ...carta(p, cardId), coperta: false, segnalino: null, statoForzato: null, modifiche: [], ...extra,
  };
  s.colonne[colonna].push(fc);
  return fc;
}

export function statoVuoto(): StatoPartita {
  const g = (id: PlayerId): Giocatore => ({
    id, futuro: [], memoria: [], mano: [], orizzonte: [],
    costruttore: { uid: `${id}-C`, cardId: 100, owner: id },
    it: 20, et: 3, etMax: 3, mulliganFatto: true, scambioUsato: false,
    supportoUsati: 0, supportoPep: 0, supportoRp: 0, haPassato: false,
  });
  return {
    rng: 1, round: 1, fase: 'azioni', flusso: 'normale', tp: 0, tpSpostamento: 0,
    iniziativa: 'A', attivo: 'A',
    colonne: { passato: [], presente: [], futuro: [] },
    anomalia: null, giocatori: { A: g('A'), B: g('B') },
    stack: [], finestra: null, decisione: null, sconfitte: [], esito: null,
    carte: catalogoProva(), log: [],
  };
}
```

- [ ] **Step 4: Scrivere il test che fallisce**

`backend/tests/game/carte.test.ts`:

```ts
import { intero, mescola } from '../../game/engine/rng';
import {
  costoEffettivo, contaInColonna, daCardDb, pepDi, proprieta, rpDi, validaMazzo,
} from '../../game/engine/carte';
import { catalogoProva, inCampo, mazzoProva, statoVuoto } from './helpers';

describe('rng', () => {
  test('stesso seed, stessa sequenza', () => {
    const a = { rng: 42 }; const b = { rng: 42 };
    const sa = [1, 2, 3, 4, 5, 6, 7, 8]; const sb = [...sa];
    mescola(a, sa); mescola(b, sb);
    expect(sa).toEqual(sb);
    expect(intero(a, 6)).toBe(intero(b, 6));
  });
  test('intero resta nell\'intervallo', () => {
    const r = { rng: 7 };
    for (let i = 0; i < 1000; i++) {
      const n = intero(r, 6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });
});

describe('validaMazzo', () => {
  const cat = catalogoProva();
  test('accetta 40 carte + Costruttore', () => {
    expect(validaMazzo(mazzoProva(), cat)).toBeNull();
  });
  test('rifiuta un mazzo di 39 carte', () => {
    const m = mazzoProva(); m.carte.pop();
    expect(validaMazzo(m, cat)).toMatch(/40 carte/);
  });
  test('rifiuta un Costruttore che non è un Costruttore', () => {
    expect(validaMazzo({ ...mazzoProva(), costruttore: 1 }, cat)).toMatch(/Costruttore/);
  });
  test('rifiuta il Costruttore dentro le 40', () => {
    const m = mazzoProva(); m.carte[39] = 100;
    expect(validaMazzo(m, cat)).toMatch(/Costruttore/);
  });
  test('rifiuta la quarta copia di una Stabile e la seconda di una Critica', () => {
    const m = mazzoProva(); m.carte[39] = 1;
    expect(validaMazzo(m, cat)).toMatch(/massimo 3/);
    const m2 = mazzoProva(); m2.carte[38] = 20; m2.carte[39] = 20;
    expect(validaMazzo(m2, cat)).toMatch(/massimo 1/);
  });
  test('rifiuta una carta sconosciuta', () => {
    const m = mazzoProva(); m.carte[39] = 999;
    expect(validaMazzo(m, cat)).toMatch(/999/);
  });
});

describe('valori di una carta in campo', () => {
  test('modifiche sommate, mai sotto zero', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 4, 'presente', {
      modifiche: [{ stat: 'pep', delta: 2, durata: 'round' }, { stat: 'rp', delta: -5, durata: 'round' }],
    });
    expect(pepDi(s, fc)).toBe(5);
    expect(rpDi(s, fc)).toBe(0);
  });
  test('🔴 aggiunge lo stato superiore, 🔵 quello inferiore, Materia Oscura immune', () => {
    const s = statoVuoto();
    expect(proprieta(s, inCampo(s, 'A', 1, 'presente', { segnalino: 'caldo' }))).toEqual(['Solido', 'Liquido']);
    expect(proprieta(s, inCampo(s, 'A', 1, 'presente', { segnalino: 'freddo' }))).toEqual(['Solido']);
    expect(proprieta(s, inCampo(s, 'A', 4, 'presente', { segnalino: 'freddo' }))).toEqual(['Plasma', 'Gas']);
    expect(proprieta(s, inCampo(s, 'A', 5, 'presente', { segnalino: 'caldo' }))).toEqual(['Materia Oscura']);
    expect(proprieta(s, inCampo(s, 'A', 1, 'presente', { statoForzato: 'Gas' }))).toEqual(['Gas']);
  });
  test('costo ridotto di 1 fuori dal Presente, mai sotto zero, solo per i Frammenti', () => {
    const cat = catalogoProva();
    expect(costoEffettivo(cat[1], 'presente')).toBe(3);
    expect(costoEffettivo(cat[1], 'futuro')).toBe(2);
    expect(costoEffettivo(cat[1], 'passato')).toBe(2);
    expect(costoEffettivo({ ...cat[1], costo: 0 }, 'passato')).toBe(0);
    expect(costoEffettivo(cat[6])).toBe(2);
  });
  test('contaInColonna conta per giocatore', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 1, 'presente'); inCampo(s, 'A', 2, 'presente'); inCampo(s, 'B', 3, 'presente');
    expect(contaInColonna(s, 'presente', 'A')).toBe(2);
    expect(contaInColonna(s, 'presente', 'B')).toBe(1);
  });
});

describe('daCardDb', () => {
  test('converte una carta del database', () => {
    expect(daCardDb({
      cardId: 1, name: 'Nucleo di Basalto', type: 'Solido', status: 'Freddo',
      cost_et: 4, pep: 1, rp: 5, rarity: 'Stabile', effect: 'Testo.',
    })).toEqual({
      cardId: 1, nome: 'Nucleo di Basalto', tipo: 'Solido', termica: 'Freddo',
      costo: 4, pep: 1, rp: 5, rarita: 'Stabile', effetto: 'Testo.',
    });
  });
  test('scarta un tipo sconosciuto e normalizza i campi mancanti', () => {
    expect(daCardDb({ cardId: 2, name: 'X', type: 'Boh' })).toBeNull();
    expect(daCardDb({ cardId: 3, name: 'Y', type: 'Costruttore', rarity: '' })).toEqual({
      cardId: 3, nome: 'Y', tipo: 'Costruttore', termica: 'Neutro',
      costo: 0, pep: 0, rp: 0, rarita: '', effetto: '',
    });
  });
});
```

- [ ] **Step 5: Eseguire il test e verificare che fallisca**

Run: `cd backend && npx jest tests/game/carte.test.ts`
Expected: FAIL, `Cannot find module '../../game/engine/carte'`.

- [ ] **Step 6: Implementare `carte.ts`**

`backend/game/engine/carte.ts`:

```ts
import {
  CartaCampo, Colonna, DefCarta, PlayerId, Rarita, STATI, StatoMateria, StatoPartita, Termica, TipoCarta,
} from './types';

export const ORDINE_STATI: StatoMateria[] = ['Solido', 'Liquido', 'Gas', 'Plasma'];
export const LIMITE_COPIE: Record<string, number> = { Stabile: 3, Instabile: 2, Critica: 1 };

export function isFrammento(tipo: TipoCarta): tipo is StatoMateria {
  return (STATI as string[]).includes(tipo);
}

export function def(s: StatoPartita, cardId: number): DefCarta {
  const d = s.carte[cardId];
  if (!d) throw new Error(`Carta ${cardId} assente dal catalogo della partita`);
  return d;
}

export function statoDi(s: StatoPartita, fc: CartaCampo): StatoMateria {
  return fc.statoForzato ?? (def(s, fc.cardId).tipo as StatoMateria);
}

/** Stati di cui la carta ha le proprietà in Collisione, tenendo conto dei segnalini termici. */
export function proprieta(s: StatoPartita, fc: CartaCampo): StatoMateria[] {
  const base = statoDi(s, fc);
  if (base === 'Materia Oscura') return [base];
  const i = ORDINE_STATI.indexOf(base);
  const out: StatoMateria[] = [base];
  if (fc.segnalino === 'caldo' && i < ORDINE_STATI.length - 1) out.push(ORDINE_STATI[i + 1]);
  if (fc.segnalino === 'freddo' && i > 0) out.push(ORDINE_STATI[i - 1]);
  return out;
}

function sommaModifiche(fc: CartaCampo, stat: 'pep' | 'rp'): number {
  return fc.modifiche.filter((m) => m.stat === stat).reduce((t, m) => t + m.delta, 0);
}

export function pepDi(s: StatoPartita, fc: CartaCampo): number {
  return Math.max(0, def(s, fc.cardId).pep + sommaModifiche(fc, 'pep'));
}

export function rpDi(s: StatoPartita, fc: CartaCampo): number {
  return Math.max(0, def(s, fc.cardId).rp + sommaModifiche(fc, 'rp'));
}

export function costoEffettivo(d: DefCarta, colonna?: Colonna): number {
  if (!isFrammento(d.tipo)) return d.costo;
  return Math.max(0, d.costo - (colonna && colonna !== 'presente' ? 1 : 0));
}

export interface Mazzo {
  carte: number[];
  costruttore: number;
}

export function validaMazzo(m: Mazzo, catalogo: Record<number, DefCarta>): string | null {
  if (m.carte.length !== 40) return `Il mazzo deve avere 40 carte, ne ha ${m.carte.length}`;
  const c = catalogo[m.costruttore];
  if (!c || c.tipo !== 'Costruttore') return 'Costruttore non valido';
  const conteggi = new Map<number, number>();
  for (const id of m.carte) {
    const d = catalogo[id];
    if (!d) return `Carta ${id} sconosciuta`;
    if (d.tipo === 'Costruttore') return 'Il Costruttore non va tra le 40 carte';
    conteggi.set(id, (conteggi.get(id) ?? 0) + 1);
  }
  for (const [id, n] of conteggi) {
    const limite = LIMITE_COPIE[catalogo[id].rarita] ?? 3;
    if (n > limite) return `${catalogo[id].nome}: massimo ${limite} copie, ne hai ${n}`;
  }
  return null;
}

const TIPI: TipoCarta[] = [...STATI, 'Evento', 'Anomalia', 'Costruttore'];

/** Converte un documento `Card` di MongoDB nella definizione usata dal motore. */
export function daCardDb(c: {
  cardId: number; name: string; type?: string; status?: string; cost_et?: number;
  pep?: number; rp?: number; rarity?: string; effect?: string;
}): DefCarta | null {
  if (!c.type || !TIPI.includes(c.type as TipoCarta)) return null;
  const termica: Termica = c.status === 'Caldo' || c.status === 'Freddo' ? c.status : 'Neutro';
  const rarita: Rarita = c.rarity === 'Stabile' || c.rarity === 'Instabile' || c.rarity === 'Critica' ? c.rarity : '';
  return {
    cardId: c.cardId, nome: c.name, tipo: c.type as TipoCarta, termica,
    costo: c.cost_et ?? 0, pep: c.pep ?? 0, rp: c.rp ?? 0, rarita, effetto: c.effect ?? '',
  };
}

export function cercaInCampo(s: StatoPartita, uid: string): { colonna: Colonna; carta: CartaCampo } | null {
  for (const colonna of ['passato', 'presente', 'futuro'] as Colonna[]) {
    const carta = s.colonne[colonna].find((c) => c.uid === uid);
    if (carta) return { colonna, carta };
  }
  return null;
}

export function contaInColonna(s: StatoPartita, colonna: Colonna, owner: PlayerId): number {
  return s.colonne[colonna].filter((c) => c.owner === owner).length;
}
```

- [ ] **Step 7: Eseguire il test e verificare che passi**

Run: `cd backend && npx jest tests/game/carte.test.ts`
Expected: PASS, tutti i test verdi.

- [ ] **Step 8: Commit**

```bash
git add backend/game/engine/types.ts backend/game/engine/rng.ts backend/game/engine/log.ts backend/game/engine/carte.ts backend/tests/game/helpers.ts backend/tests/game/carte.test.ts
git commit -m "feat(game): tipi del motore, rng con seed, catalogo e validazione mazzo"
```

---

### Task 2: Campo e temperatura

**Files:**
- Create: `backend/game/engine/campo.ts`
- Create: `backend/game/engine/temperatura.ts`
- Test: `backend/tests/game/temperatura.test.ts`

**Interfaces:**
- Consumes: Task 1 (`def`, `statoDi`, `cercaInCampo`, `log`, `nomeG`, `NOMI_COLONNA`).
- Produces: `aCarta(fc: CartaCampo): Carta`; `supportoIstantaneo(s, fc): void`; `metti(s, carta: Carta, colonna: Colonna, opz?: { coperta?: boolean; supporto?: boolean }): CartaCampo`; `togli(s, uid): CartaCampo | null`; `distruggi(s, uid): boolean`; `sposta(s, uid, colonna, opz?: { supporto?: boolean }): CartaCampo | null`; `ricalcolaTP(s): void`; `inverti(s, controllore: PlayerId | null): void`.

- [ ] **Step 1: Scrivere il test che fallisce**

`backend/tests/game/temperatura.test.ts`:

```ts
import { distruggi, metti, sposta } from '../../game/engine/campo';
import { inverti, ricalcolaTP } from '../../game/engine/temperatura';
import { carta, inCampo, statoVuoto } from './helpers';

describe('temperatura', () => {
  test('Caldi +1, Freddi -1, Neutri 0, solo nel Presente', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente'); // Gas Caldo
    inCampo(s, 'B', 4, 'presente'); // Plasma Caldo
    inCampo(s, 'B', 1, 'presente'); // Solido Freddo
    inCampo(s, 'A', 2, 'presente'); // Liquido Neutro
    inCampo(s, 'A', 3, 'passato');  // fuori dal Presente
    ricalcolaTP(s);
    expect(s.tp).toBe(1);
  });

  test('limitata a -4 / +4, spostamento da effetti incluso', () => {
    const s = statoVuoto();
    for (let i = 0; i < 3; i++) inCampo(s, 'A', 3, 'presente');
    s.tpSpostamento = 5;
    ricalcolaTP(s);
    expect(s.tp).toBe(4);
  });

  test('segnalini a +2 e -2, rimossi in mezzo, Materia Oscura immune', () => {
    const s = statoVuoto();
    const gas = inCampo(s, 'A', 3, 'presente');
    const mo = inCampo(s, 'A', 5, 'presente');
    s.tpSpostamento = 1;
    ricalcolaTP(s);
    expect(s.tp).toBe(2);
    expect(gas.segnalino).toBe('caldo');
    expect(mo.segnalino).toBeNull();
    s.tpSpostamento = -4;
    ricalcolaTP(s);
    expect(gas.segnalino).toBe('freddo');
    s.tpSpostamento = 0;
    ricalcolaTP(s);
    expect(gas.segnalino).toBeNull();
  });

  test('Inversione spontanea quando la TP arriva a ±4, una volta sola', () => {
    const s = statoVuoto();
    s.tpSpostamento = 4;
    ricalcolaTP(s);
    expect(s.flusso).toBe('invertito');
    ricalcolaTP(s);
    expect(s.flusso).toBe('invertito');
    s.tpSpostamento = -4;
    ricalcolaTP(s);
    expect(s.flusso).toBe('normale');
  });

  test('Inversione volontaria costa 1 IT al controllore', () => {
    const s = statoVuoto();
    inverti(s, 'B');
    expect(s.flusso).toBe('invertito');
    expect(s.giocatori.B.it).toBe(19);
    expect(s.giocatori.A.it).toBe(20);
  });
});

describe('campo', () => {
  test('mettere nel Presente ricalcola la TP', () => {
    const s = statoVuoto();
    metti(s, carta('A', 3), 'presente');
    expect(s.tp).toBe(1);
  });

  test('Supporto Istantaneo: +PEP se Calda, +RP se Fredda, Neutra nulla, massimo 2 per round', () => {
    const s = statoVuoto();
    metti(s, carta('A', 3), 'passato');
    metti(s, carta('A', 2), 'passato');
    metti(s, carta('A', 1), 'passato');
    metti(s, carta('A', 4), 'passato');
    const g = s.giocatori.A;
    expect(g.supportoPep).toBe(1);
    expect(g.supportoRp).toBe(1);
    expect(g.supportoUsati).toBe(2);
  });

  test('nessun Supporto se richiesto', () => {
    const s = statoVuoto();
    metti(s, carta('A', 3), 'passato', { supporto: false });
    expect(s.giocatori.A.supportoPep).toBe(0);
  });

  test('distruggere manda la carta nell\'Orizzonte del proprietario e aggiorna la TP', () => {
    const s = statoVuoto();
    const fc = metti(s, carta('B', 3), 'presente');
    expect(distruggi(s, fc.uid)).toBe(true);
    expect(s.colonne.presente).toHaveLength(0);
    expect(s.giocatori.B.orizzonte.map((c) => c.uid)).toEqual([fc.uid]);
    expect(s.tp).toBe(0);
    expect(distruggi(s, 'inesistente')).toBe(false);
  });

  test('spostare conserva le modifiche e toglie il segnalino', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 3, 'presente', {
      segnalino: 'caldo', modifiche: [{ stat: 'pep', delta: 1, durata: 'permanente' }],
    });
    const n = sposta(s, fc.uid, 'futuro');
    expect(n?.modifiche).toEqual([{ stat: 'pep', delta: 1, durata: 'permanente' }]);
    expect(n?.segnalino).toBeNull();
    expect(s.colonne.futuro).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `cd backend && npx jest tests/game/temperatura.test.ts`
Expected: FAIL, `Cannot find module '../../game/engine/campo'`.

- [ ] **Step 3: Implementare `temperatura.ts`**

`backend/game/engine/temperatura.ts`:

```ts
import { def, statoDi } from './carte';
import { log, nomeG } from './log';
import { PlayerId, StatoPartita } from './types';

/** TP = Caldi - Freddi nel Presente + spostamento da effetti, limitata a -4 / +4. */
export function ricalcolaTP(s: StatoPartita): void {
  const prima = s.tp;
  let base = 0;
  for (const fc of s.colonne.presente) {
    const t = def(s, fc.cardId).termica;
    if (t === 'Caldo') base += 1;
    else if (t === 'Freddo') base -= 1;
  }
  s.tp = Math.max(-4, Math.min(4, base + s.tpSpostamento));
  const segnalino = s.tp >= 2 ? 'caldo' : s.tp <= -2 ? 'freddo' : null;
  for (const fc of s.colonne.presente) {
    fc.segnalino = statoDi(s, fc) === 'Materia Oscura' ? null : segnalino;
  }
  if (s.tp !== prima) log(s, `TP ${s.tp > 0 ? '+' : ''}${s.tp}`);
  if (Math.abs(s.tp) === 4 && s.tp !== prima) inverti(s, null);
}

/** Inverte il flusso. Con un controllore è volontaria e gli costa 1 IT. */
export function inverti(s: StatoPartita, controllore: PlayerId | null): void {
  s.flusso = s.flusso === 'normale' ? 'invertito' : 'normale';
  if (controllore) {
    s.giocatori[controllore].it -= 1;
    log(s, `${nomeG(controllore)} provoca un'Inversione Temporale e perde 1 IT. Flusso ${s.flusso}`);
  } else {
    log(s, `Inversione Temporale spontanea. Flusso ${s.flusso}`);
  }
}
```

- [ ] **Step 4: Implementare `campo.ts`**

`backend/game/engine/campo.ts`:

```ts
import { cercaInCampo, def } from './carte';
import { log, nomeG, NOMI_COLONNA } from './log';
import { ricalcolaTP } from './temperatura';
import { Carta, CartaCampo, Colonna, StatoPartita } from './types';

export function aCarta(fc: CartaCampo): Carta {
  return { uid: fc.uid, cardId: fc.cardId, owner: fc.owner };
}

/** +1 PEP se Calda, +1 RP se Fredda, al totale del giocatore per la Collisione del round. Max 2 per round. */
export function supportoIstantaneo(s: StatoPartita, fc: CartaCampo): void {
  const g = s.giocatori[fc.owner];
  if (g.supportoUsati >= 2) return;
  const t = def(s, fc.cardId).termica;
  if (t === 'Caldo') {
    g.supportoPep += 1;
    g.supportoUsati += 1;
    log(s, `Supporto Istantaneo: ${nomeG(fc.owner)} +1 PEP`);
  } else if (t === 'Freddo') {
    g.supportoRp += 1;
    g.supportoUsati += 1;
    log(s, `Supporto Istantaneo: ${nomeG(fc.owner)} +1 RP`);
  }
}

export function metti(
  s: StatoPartita, carta: Carta, colonna: Colonna, opz: { coperta?: boolean; supporto?: boolean } = {},
): CartaCampo {
  const fc: CartaCampo = {
    uid: carta.uid, cardId: carta.cardId, owner: carta.owner,
    coperta: opz.coperta ?? false, segnalino: null, statoForzato: null, modifiche: [],
  };
  s.colonne[colonna].push(fc);
  if (colonna === 'passato' && opz.supporto !== false) supportoIstantaneo(s, fc);
  if (colonna === 'presente') ricalcolaTP(s);
  return fc;
}

export function togli(s: StatoPartita, uid: string): CartaCampo | null {
  const t = cercaInCampo(s, uid);
  if (!t) return null;
  s.colonne[t.colonna] = s.colonne[t.colonna].filter((c) => c.uid !== uid);
  if (t.colonna === 'presente') ricalcolaTP(s);
  return t.carta;
}

export function distruggi(s: StatoPartita, uid: string): boolean {
  const fc = togli(s, uid);
  if (!fc) return false;
  s.giocatori[fc.owner].orizzonte.push(aCarta(fc));
  log(s, `${def(s, fc.cardId).nome} finisce nell'Orizzonte degli Eventi`);
  return true;
}

/** Sposta per effetto: conserva modifiche e stato forzato, non dà Supporto Istantaneo salvo richiesta. */
export function sposta(
  s: StatoPartita, uid: string, colonna: Colonna, opz: { supporto?: boolean } = {},
): CartaCampo | null {
  const fc = togli(s, uid);
  if (!fc) return null;
  const coperta = fc.coperta && colonna === 'futuro';
  const n = metti(s, aCarta(fc), colonna, { supporto: opz.supporto ?? false, coperta });
  n.modifiche = fc.modifiche;
  n.statoForzato = fc.statoForzato;
  if (colonna === 'presente') ricalcolaTP(s);
  log(s, `${coperta ? 'Un Frammento coperto' : def(s, fc.cardId).nome} si sposta nel ${NOMI_COLONNA[colonna]}`);
  return n;
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `cd backend && npx jest tests/game/temperatura.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/game/engine/campo.ts backend/game/engine/temperatura.ts backend/tests/game/temperatura.test.ts
git commit -m "feat(game): temperatura, inversioni, campo e Supporto Istantaneo"
```

---

### Task 3: Slittamento e Risorse

**Files:**
- Create: `backend/game/engine/slittamento.ts`
- Create: `backend/game/engine/risorse.ts`
- Test: `backend/tests/game/slittamento-risorse.test.ts`

**Interfaces:**
- Consumes: Task 1-2 (`aCarta`, `supportoIstantaneo`, `ricalcolaTP`, `contaInColonna`, `def`, `log`).
- Produces: `eseguiSlittamento(s): void`; `ordine(s): PlayerId[]` (iniziativa prima); `mazzoAttivo(s, p): Carta[]`; `pesca(s, p): boolean`; `eseguiRisorse(s): void` (imposta eventualmente `s.decisione = { tipo: 'bonusControllo', ... }`).

- [ ] **Step 1: Scrivere il test che fallisce**

`backend/tests/game/slittamento-risorse.test.ts`:

```ts
import { eseguiSlittamento } from '../../game/engine/slittamento';
import { eseguiRisorse, mazzoAttivo, pesca } from '../../game/engine/risorse';
import { carta, inCampo, statoVuoto } from './helpers';

describe('Slittamento', () => {
  test('flusso normale: Futuro → Presente → Passato → Memoria', () => {
    const s = statoVuoto();
    const vecchia = inCampo(s, 'A', 2, 'passato');
    const pres = inCampo(s, 'B', 3, 'presente');
    const fut = inCampo(s, 'A', 4, 'futuro', { coperta: true });
    eseguiSlittamento(s);
    expect(s.giocatori.A.memoria[0].uid).toBe(vecchia.uid);
    expect(s.colonne.passato.map((c) => c.uid)).toEqual([pres.uid]);
    expect(s.colonne.presente.map((c) => c.uid)).toEqual([fut.uid]);
    expect(s.colonne.presente[0].coperta).toBe(false);
    expect(s.colonne.futuro).toHaveLength(0);
    // Gas Caldo entrato nel Passato: Supporto Istantaneo per B
    expect(s.giocatori.B.supportoPep).toBe(1);
    // Plasma Caldo ora nel Presente
    expect(s.tp).toBe(1);
  });

  test('flusso invertito: Passato → Presente → Futuro → mazzo Futuro', () => {
    const s = statoVuoto();
    s.flusso = 'invertito';
    const pas = inCampo(s, 'A', 1, 'passato');
    const pres = inCampo(s, 'A', 2, 'presente');
    const fut = inCampo(s, 'B', 3, 'futuro');
    eseguiSlittamento(s);
    expect(s.giocatori.B.futuro[0].uid).toBe(fut.uid);
    expect(s.colonne.futuro.map((c) => c.uid)).toEqual([pres.uid]);
    expect(s.colonne.presente.map((c) => c.uid)).toEqual([pas.uid]);
    expect(s.colonne.passato).toHaveLength(0);
  });

  test('azzera lo spostamento di TP e i segnalini', () => {
    const s = statoVuoto();
    s.tpSpostamento = 3;
    const fc = inCampo(s, 'A', 2, 'futuro', { segnalino: 'caldo' });
    eseguiSlittamento(s);
    expect(s.tpSpostamento).toBe(0);
    expect(s.tp).toBe(0);
    expect(fc.segnalino).toBeNull();
  });
});

describe('Risorse', () => {
  test('ET al massimo del round, fino a 10', () => {
    const s = statoVuoto();
    s.giocatori.A.futuro = [carta('A', 1)];
    s.giocatori.B.futuro = [carta('B', 1)];
    s.round = 3;
    eseguiRisorse(s);
    expect(s.giocatori.A.etMax).toBe(5);
    expect(s.giocatori.A.et).toBe(5);
    s.round = 20;
    s.giocatori.A.futuro = [carta('A', 1)];
    s.giocatori.B.futuro = [carta('B', 1)];
    eseguiRisorse(s);
    expect(s.giocatori.B.etMax).toBe(10);
  });

  test('pesca dal Futuro in flusso normale, dalla Memoria in flusso invertito', () => {
    const s = statoVuoto();
    const f = carta('A', 1); const m = carta('A', 2);
    s.giocatori.A.futuro = [f]; s.giocatori.A.memoria = [m];
    expect(mazzoAttivo(s, 'A')).toBe(s.giocatori.A.futuro);
    expect(pesca(s, 'A')).toBe(true);
    expect(s.giocatori.A.mano.map((c) => c.uid)).toEqual([f.uid]);
    s.flusso = 'invertito';
    expect(pesca(s, 'A')).toBe(true);
    expect(s.giocatori.A.mano.map((c) => c.uid)).toEqual([f.uid, m.uid]);
  });

  test('pescare da un mazzo attivo vuoto registra il Collasso Entropico', () => {
    const s = statoVuoto();
    expect(pesca(s, 'B')).toBe(false);
    expect(s.sconfitte).toEqual([{ giocatore: 'B', motivo: 'collassoEntropico' }]);
  });

  test('Bonus Controllo a chi ha più Frammenti nel Presente, nessuno in parità', () => {
    const s = statoVuoto();
    s.giocatori.A.futuro = [carta('A', 1), carta('A', 1)];
    s.giocatori.B.futuro = [carta('B', 1), carta('B', 1)];
    inCampo(s, 'B', 1, 'presente');
    eseguiRisorse(s);
    expect(s.decisione).toEqual({ tipo: 'bonusControllo', giocatore: 'B' });
    s.decisione = null;
    inCampo(s, 'A', 1, 'presente');
    eseguiRisorse(s);
    expect(s.decisione).toBeNull();
  });

  test('azzera lo Scambio del round', () => {
    const s = statoVuoto();
    s.giocatori.A.futuro = [carta('A', 1)];
    s.giocatori.B.futuro = [carta('B', 1)];
    s.giocatori.A.scambioUsato = true;
    eseguiRisorse(s);
    expect(s.giocatori.A.scambioUsato).toBe(false);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `cd backend && npx jest tests/game/slittamento-risorse.test.ts`
Expected: FAIL, `Cannot find module '../../game/engine/slittamento'`.

- [ ] **Step 3: Implementare `slittamento.ts`**

`backend/game/engine/slittamento.ts`:

```ts
import { aCarta, supportoIstantaneo } from './campo';
import { log } from './log';
import { ricalcolaTP } from './temperatura';
import { CartaCampo, StatoPartita } from './types';

export function eseguiSlittamento(s: StatoPartita): void {
  const { passato, presente, futuro } = s.colonne;
  s.colonne = { passato: [], presente: [], futuro: [] };
  const pulisci = (fc: CartaCampo): CartaCampo => {
    fc.segnalino = null;
    return fc;
  };

  if (s.flusso === 'normale') {
    for (const fc of passato) s.giocatori[fc.owner].memoria.unshift(aCarta(fc));
    for (const fc of presente) {
      s.colonne.passato.push(pulisci(fc));
      supportoIstantaneo(s, fc);
    }
    for (const fc of futuro) {
      fc.coperta = false;
      s.colonne.presente.push(pulisci(fc));
    }
  } else {
    for (const fc of futuro) s.giocatori[fc.owner].futuro.unshift(aCarta(fc));
    for (const fc of presente) s.colonne.futuro.push(pulisci(fc));
    for (const fc of passato) s.colonne.presente.push(pulisci(fc));
  }

  log(s, `Slittamento (flusso ${s.flusso})`);
  s.tpSpostamento = 0;
  ricalcolaTP(s);
}
```

- [ ] **Step 4: Implementare `risorse.ts`**

`backend/game/engine/risorse.ts`:

```ts
import { contaInColonna, def } from './carte';
import { log, nomeG } from './log';
import { altro, Carta, PlayerId, StatoPartita } from './types';

/** Chi ha l'iniziativa per primo. */
export function ordine(s: StatoPartita): PlayerId[] {
  return [s.iniziativa, altro(s.iniziativa)];
}

export function mazzoAttivo(s: StatoPartita, p: PlayerId): Carta[] {
  return s.flusso === 'normale' ? s.giocatori[p].futuro : s.giocatori[p].memoria;
}

/** Pesca dalla cima del mazzo attivo. Se è vuoto registra il Collasso Entropico. */
export function pesca(s: StatoPartita, p: PlayerId): boolean {
  const c = mazzoAttivo(s, p).shift();
  if (!c) {
    s.sconfitte.push({ giocatore: p, motivo: 'collassoEntropico' });
    log(s, `${nomeG(p)} deve pescare ma il mazzo attivo è vuoto: Collasso Entropico`);
    return false;
  }
  s.giocatori[p].mano.push(c);
  if (s.flusso === 'normale') {
    log(s, `${nomeG(p)} pesca una carta dal Futuro`);
    log(s, `Hai pescato ${def(s, c.cardId).nome}`, p);
  } else {
    log(s, `${nomeG(p)} pesca ${def(s, c.cardId).nome} dalla Memoria`);
  }
  return true;
}

export function eseguiRisorse(s: StatoPartita): void {
  for (const p of ordine(s)) {
    const g = s.giocatori[p];
    g.etMax = Math.min(10, 2 + s.round);
    g.et = g.etMax;
    g.scambioUsato = false;
    pesca(s, p);
  }
  const a = contaInColonna(s, 'presente', 'A');
  const b = contaInColonna(s, 'presente', 'B');
  if (a !== b) s.decisione = { tipo: 'bonusControllo', giocatore: a > b ? 'A' : 'B' };
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `cd backend && npx jest tests/game/slittamento-risorse.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/game/engine/slittamento.ts backend/game/engine/risorse.ts backend/tests/game/slittamento-risorse.test.ts
git commit -m "feat(game): Slittamento e fase Risorse"
```

---

### Task 4: Collisione

**Files:**
- Create: `backend/game/engine/collisione.ts`
- Test: `backend/tests/game/collisione.test.ts`

**Interfaces:**
- Consumes: `pepDi`, `rpDi`, `proprieta`, `distruggi`, `sposta`, `ricalcolaTP`, `log`, `nomeG`.
- Produces: `risolviCollisione(s): void`.

- [ ] **Step 1: Scrivere il test che fallisce**

`backend/tests/game/collisione.test.ts`:

```ts
import { risolviCollisione } from '../../game/engine/collisione';
import { inCampo, statoVuoto } from './helpers';

describe('Collisione', () => {
  test('PEP > RP: Collasso del Presente avversario e danno pari alla differenza', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente'); // Plasma 3/1
    const b = inCampo(s, 'B', 2, 'presente'); // Liquido 2/3... PEP 2 vs RP A 1
    // A: PEP 3 vs RP B 3 → nessun collasso. B: PEP 2 vs RP A 1 → collasso di A, danno 1
    risolviCollisione(s);
    expect(s.giocatori.A.it).toBe(19);
    expect(s.giocatori.B.it).toBe(20);
    expect(s.colonne.presente.map((c) => c.uid)).toEqual([b.uid]);
    expect(s.giocatori.A.orizzonte).toHaveLength(1);
  });

  test('PEP uguale a RP: lo scudo regge', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente'); // 2/2
    inCampo(s, 'B', 3, 'presente'); // 2/2
    risolviCollisione(s);
    expect(s.giocatori.A.it).toBe(20);
    expect(s.giocatori.B.it).toBe(20);
    expect(s.colonne.presente).toHaveLength(2);
  });

  test('Plasma +1 danno per Plasma, massimo 2', () => {
    const s = statoVuoto();
    for (let i = 0; i < 3; i++) inCampo(s, 'A', 4, 'presente'); // 9 PEP, 3 Plasma
    risolviCollisione(s);
    expect(s.giocatori.B.it).toBe(20 - 9 - 2);
  });

  test('Solido -1 danno subito per Solido, massimo 2, mai sotto zero', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente', { modifiche: [{ stat: 'pep', delta: 5, durata: 'round' }] }); // 8 PEP
    for (let i = 0; i < 3; i++) inCampo(s, 'B', 9, 'presente', { modifiche: [{ stat: 'rp', delta: -4, durata: 'round' }] }); // RP 0
    risolviCollisione(s);
    // danno 8 + 1 Plasma - 2 Solido
    expect(s.giocatori.B.it).toBe(20 - 7);
  });

  test('Gas: 1 danno elusivo per Gas se nessuno infligge danni', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente'); // Gas 2/2
    inCampo(s, 'B', 1, 'presente'); // Solido 1/5
    risolviCollisione(s);
    expect(s.giocatori.B.it).toBe(19);
    expect(s.giocatori.A.it).toBe(20);
  });

  test('Liquido distrutto torna nel Passato, massimo 2, senza Supporto', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente', { modifiche: [{ stat: 'pep', delta: 20, durata: 'round' }] });
    for (let i = 0; i < 3; i++) inCampo(s, 'B', 12, 'presente'); // Liquido Freddo
    risolviCollisione(s);
    expect(s.colonne.passato.filter((c) => c.owner === 'B')).toHaveLength(2);
    expect(s.giocatori.B.orizzonte).toHaveLength(1);
    expect(s.giocatori.B.supportoRp).toBe(0);
  });

  test('Solido con 🔴 ha la Persistenza del Liquido', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente', { modifiche: [{ stat: 'pep', delta: 20, durata: 'round' }] });
    inCampo(s, 'B', 1, 'presente', { segnalino: 'caldo' });
    risolviCollisione(s);
    expect(s.colonne.passato.filter((c) => c.owner === 'B')).toHaveLength(1);
  });

  test('i segnalini valgono come all\'inizio della Collisione, anche dopo le prime distruzioni', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 4, 'presente', { modifiche: [{ stat: 'pep', delta: 30, durata: 'round' }] });
    // B: due Gas Caldi (TP alta) e un Solido con 🔴 messo per ultimo
    inCampo(s, 'B', 3, 'presente', { segnalino: 'caldo' });
    inCampo(s, 'B', 3, 'presente', { segnalino: 'caldo' });
    const solido = inCampo(s, 'B', 1, 'presente', { segnalino: 'caldo' });
    risolviCollisione(s);
    expect(s.colonne.passato.map((c) => c.uid)).toEqual([solido.uid]);
  });

  test('Supporto Istantaneo conta nei totali', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 3, 'presente'); // 2 PEP
    inCampo(s, 'B', 3, 'presente'); // 2 RP
    s.giocatori.A.supportoPep = 1;
    risolviCollisione(s);
    expect(s.giocatori.B.it).toBe(19);
  });

  test('le modifiche "collisione" scadono, le altre restano', () => {
    const s = statoVuoto();
    const fc = inCampo(s, 'A', 1, 'passato', {
      modifiche: [{ stat: 'pep', delta: 1, durata: 'collisione' }, { stat: 'rp', delta: 1, durata: 'round' }],
    });
    risolviCollisione(s);
    expect(fc.modifiche).toEqual([{ stat: 'rp', delta: 1, durata: 'round' }]);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `cd backend && npx jest tests/game/collisione.test.ts`
Expected: FAIL, `Cannot find module '../../game/engine/collisione'`.

- [ ] **Step 3: Implementare `collisione.ts`**

`backend/game/engine/collisione.ts`:

```ts
import { distruggi, sposta } from './campo';
import { pepDi, proprieta, rpDi } from './carte';
import { log, nomeG } from './log';
import { ricalcolaTP } from './temperatura';
import { altro, GIOCATORI, PlayerId, StatoMateria, StatoPartita } from './types';

interface Totali {
  pep: number;
  rp: number;
  n: Record<StatoMateria, number>;
}

function totali(s: StatoPartita, p: PlayerId): Totali {
  const g = s.giocatori[p];
  const t: Totali = {
    pep: g.supportoPep, rp: g.supportoRp,
    n: { Solido: 0, Liquido: 0, Gas: 0, Plasma: 0, 'Materia Oscura': 0 },
  };
  for (const fc of s.colonne.presente.filter((c) => c.owner === p)) {
    t.pep += pepDi(s, fc);
    t.rp += rpDi(s, fc);
    for (const st of proprieta(s, fc)) t.n[st] += 1;
  }
  return t;
}

export function risolviCollisione(s: StatoPartita): void {
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

  for (const p of GIOCATORI) {
    if (danno[p] > 0) {
      s.giocatori[p].it -= danno[p];
      log(s, `${nomeG(p)} subisce ${danno[p]} danni IT (IT ${s.giocatori[p].it})`);
    }
  }

  // Chi si salva va deciso prima di toccare il campo: ogni distruzione ricalcola la TP
  // e quindi i segnalini, che cambierebbero le proprietà delle carte ancora da valutare.
  const condannate: { uid: string; salva: boolean }[] = [];
  for (const p of GIOCATORI) {
    if (!collasso[p]) continue;
    log(s, `Collasso del Presente di ${nomeG(p)}`);
    let salvati = 0;
    for (const fc of s.colonne.presente.filter((c) => c.owner === p)) {
      const salva = salvati < 2 && proprieta(s, fc).includes('Liquido');
      if (salva) salvati += 1;
      condannate.push({ uid: fc.uid, salva });
    }
  }
  for (const c of condannate) {
    if (c.salva) sposta(s, c.uid, 'passato');
    else distruggi(s, c.uid);
  }

  for (const col of Object.values(s.colonne)) {
    for (const fc of col) fc.modifiche = fc.modifiche.filter((m) => m.durata !== 'collisione');
  }
  ricalcolaTP(s);
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `cd backend && npx jest tests/game/collisione.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/game/engine/collisione.ts backend/tests/game/collisione.test.ts
git commit -m "feat(game): Collisione con proprietà degli stati"
```

---

### Task 5: Fine partita e fine round

**Files:**
- Create: `backend/game/engine/vittoria.ts`
- Test: `backend/tests/game/vittoria.test.ts`

**Interfaces:**
- Consumes: `statoDi`, `log`, `nomeG`.
- Produces: `verificaFine(s): void` (imposta `s.esito` se qualcuno ha IT ≤ 0 o è in `s.sconfitte`); `verificaSincronia(s): void` (imposta `s.esito` se qualcuno è in Sincronia); `haSincronia(s, p): boolean`; `fineRound(s): void`.

- [ ] **Step 1: Scrivere il test che fallisce**

`backend/tests/game/vittoria.test.ts`:

```ts
import { fineRound, haSincronia, verificaFine, verificaSincronia } from '../../game/engine/vittoria';
import { inCampo, statoVuoto } from './helpers';

describe('fine partita', () => {
  test('IT a 0 fa vincere l\'avversario per Collasso', () => {
    const s = statoVuoto();
    s.giocatori.B.it = 0;
    verificaFine(s);
    expect(s.esito).toEqual({ vincitore: 'A', motivo: 'collasso' });
  });

  test('IT ≤ 0 per entrambi è pareggio', () => {
    const s = statoVuoto();
    s.giocatori.A.it = -1; s.giocatori.B.it = 0;
    verificaFine(s);
    expect(s.esito).toEqual({ vincitore: null, motivo: 'pareggio' });
  });

  test('Collasso Entropico registrato fa perdere', () => {
    const s = statoVuoto();
    s.sconfitte.push({ giocatore: 'A', motivo: 'collassoEntropico' });
    verificaFine(s);
    expect(s.esito).toEqual({ vincitore: 'B', motivo: 'collassoEntropico' });
  });

  test('nessuna condizione: nessun esito', () => {
    const s = statoVuoto();
    verificaFine(s);
    expect(s.esito).toBeNull();
  });
});

describe('Sincronia', () => {
  const tuttiGliStati = (s: ReturnType<typeof statoVuoto>) => {
    inCampo(s, 'A', 1, 'passato');   // Solido
    inCampo(s, 'A', 2, 'presente');  // Liquido
    inCampo(s, 'A', 3, 'futuro');    // Gas
    inCampo(s, 'A', 4, 'futuro');    // Plasma
  };

  test('un Frammento per colonna e tutti e 5 gli stati', () => {
    const s = statoVuoto();
    tuttiGliStati(s);
    expect(haSincronia(s, 'A')).toBe(false);
    inCampo(s, 'A', 5, 'presente');
    expect(haSincronia(s, 'A')).toBe(true);
    verificaSincronia(s);
    expect(s.esito).toEqual({ vincitore: 'A', motivo: 'sincronia' });
  });

  test('serve almeno un Frammento in ogni colonna', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 1, 'presente'); inCampo(s, 'A', 2, 'presente'); inCampo(s, 'A', 3, 'futuro');
    inCampo(s, 'A', 4, 'futuro'); inCampo(s, 'A', 5, 'futuro');
    expect(haSincronia(s, 'A')).toBe(false);
  });

  test('una seconda Materia Oscura fa da jolly per un solo stato mancante', () => {
    const s = statoVuoto();
    inCampo(s, 'A', 1, 'passato'); inCampo(s, 'A', 2, 'presente'); inCampo(s, 'A', 3, 'futuro');
    inCampo(s, 'A', 5, 'futuro');
    expect(haSincronia(s, 'A')).toBe(false); // manca Plasma, una sola MO
    inCampo(s, 'A', 5, 'futuro');
    expect(haSincronia(s, 'A')).toBe(true);
  });

  test('le carte dell\'avversario non contano', () => {
    const s = statoVuoto();
    tuttiGliStati(s);
    inCampo(s, 'B', 5, 'presente');
    expect(haSincronia(s, 'A')).toBe(false);
  });
});

describe('fineRound', () => {
  test('azzera i contatori del round, toglie le modifiche "round", passa l\'iniziativa', () => {
    const s = statoVuoto();
    const g = s.giocatori.A;
    g.supportoUsati = 2; g.supportoPep = 1; g.supportoRp = 1; g.haPassato = true;
    const fc = inCampo(s, 'A', 1, 'passato', {
      modifiche: [{ stat: 'pep', delta: 1, durata: 'round' }, { stat: 'rp', delta: 2, durata: 'permanente' }],
    });
    fineRound(s);
    expect([g.supportoUsati, g.supportoPep, g.supportoRp, g.haPassato]).toEqual([0, 0, 0, false]);
    expect(fc.modifiche).toEqual([{ stat: 'rp', delta: 2, durata: 'permanente' }]);
    expect(s.iniziativa).toBe('B');
    expect(s.round).toBe(2);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `cd backend && npx jest tests/game/vittoria.test.ts`
Expected: FAIL, `Cannot find module '../../game/engine/vittoria'`.

- [ ] **Step 3: Implementare `vittoria.ts`**

`backend/game/engine/vittoria.ts`:

```ts
import { statoDi } from './carte';
import { log, nomeG } from './log';
import { altro, COLONNE, GIOCATORI, MotivoFine, PlayerId, STATI, StatoPartita } from './types';

/** Collasso (IT ≤ 0) e Collasso Entropico. Due sconfitti nello stesso momento = pareggio. */
export function verificaFine(s: StatoPartita): void {
  if (s.esito) return;
  const perdenti = new Map<PlayerId, MotivoFine>();
  for (const p of GIOCATORI) if (s.giocatori[p].it <= 0) perdenti.set(p, 'collasso');
  for (const sc of s.sconfitte) if (!perdenti.has(sc.giocatore)) perdenti.set(sc.giocatore, sc.motivo);
  if (perdenti.size === 0) return;
  if (perdenti.size === 2) {
    s.esito = { vincitore: null, motivo: 'pareggio' };
    log(s, 'Partita terminata: pareggio');
    return;
  }
  const [[perdente, motivo]] = [...perdenti];
  s.esito = { vincitore: altro(perdente), motivo };
  log(s, `Partita terminata: vince ${nomeG(altro(perdente))} (${motivo})`);
}

export function haSincronia(s: StatoPartita, p: PlayerId): boolean {
  const mie = (col: (typeof COLONNE)[number]) => s.colonne[col].filter((c) => c.owner === p);
  if (COLONNE.some((col) => mie(col).length === 0)) return false;
  const tutte = COLONNE.flatMap(mie);
  const stati = new Set(tutte.map((fc) => statoDi(s, fc)));
  const mancanti = STATI.filter((st) => !stati.has(st));
  if (mancanti.length === 0) return true;
  const oscure = tutte.filter((fc) => statoDi(s, fc) === 'Materia Oscura').length;
  return mancanti.length === 1 && mancanti[0] !== 'Materia Oscura' && oscure >= 2;
}

export function verificaSincronia(s: StatoPartita): void {
  if (s.esito) return;
  const vincitori = GIOCATORI.filter((p) => haSincronia(s, p));
  if (vincitori.length === 2) {
    s.esito = { vincitore: null, motivo: 'pareggio' };
    log(s, 'Sincronia simultanea: pareggio');
  } else if (vincitori.length === 1) {
    s.esito = { vincitore: vincitori[0], motivo: 'sincronia' };
    log(s, `Sincronia: vince ${nomeG(vincitori[0])}`);
  }
}

export function fineRound(s: StatoPartita): void {
  for (const p of GIOCATORI) {
    const g = s.giocatori[p];
    g.supportoUsati = 0;
    g.supportoPep = 0;
    g.supportoRp = 0;
    g.haPassato = false;
  }
  for (const col of COLONNE) {
    for (const fc of s.colonne[col]) fc.modifiche = fc.modifiche.filter((m) => m.durata === 'permanente');
  }
  s.iniziativa = altro(s.iniziativa);
  s.round += 1;
  log(s, `Inizia il round ${s.round}. Iniziativa a ${nomeG(s.iniziativa)}`);
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `cd backend && npx jest tests/game/vittoria.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/game/engine/vittoria.ts backend/tests/game/vittoria.test.ts
git commit -m "feat(game): condizioni di vittoria e fine round"
```

---

### Task 6: Azioni, finestre di risposta, effetti manuali

**Files:**
- Create: `backend/game/engine/azioni.ts`
- Create: `backend/game/engine/manuale.ts`
- Test: `backend/tests/game/azioni.test.ts`

**Interfaces:**
- Consumes: `def`, `isFrammento`, `costoEffettivo`, `contaInColonna`, `cercaInCampo`, `metti`, `distruggi`, `sposta`, `ricalcolaTP`, `inverti`, `pesca`, `log`.
- Produces: in `azioni.ts`: `giocaCarta(s, p, uid, colonna?): string | null`, `passa(s, p): string | null`, `passaTurno(s, p): string | null`, `scambio(s, p, uid): string | null`. In `manuale.ts`: `usaEffetto(s, p, uid): string | null`, `applicaBase(s, p, base: AzioneBase): string | null`. Tutte restituiscono `null` se l'azione è applicata, altrimenti il messaggio d'errore, e non toccano lo stato in caso d'errore.

- [ ] **Step 1: Scrivere il test che fallisce**

`backend/tests/game/azioni.test.ts`:

```ts
import { giocaCarta, passa, passaTurno, scambio } from '../../game/engine/azioni';
import { applicaBase, usaEffetto } from '../../game/engine/manuale';
import { carta, inCampo, statoVuoto } from './helpers';

const inMano = (s: ReturnType<typeof statoVuoto>, p: 'A' | 'B', cardId: number) => {
  const c = carta(p, cardId);
  s.giocatori[p].mano.push(c);
  return c;
};

describe('giocaCarta', () => {
  test('Frammento nel Presente a costo pieno, apre la finestra all\'avversario', () => {
    const s = statoVuoto();
    s.giocatori.A.et = 3;
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'presente')).toBeNull();
    expect(s.giocatori.A.et).toBe(0);
    expect(s.colonne.presente.map((x) => x.uid)).toEqual([c.uid]);
    expect(s.stack).toHaveLength(1);
    expect(s.finestra).toEqual({ contesto: 'giocata', priorita: 'B', passi: 0, passiNecessari: 1 });
  });

  test('nel Futuro costa 1 in meno ed entra coperta', () => {
    const s = statoVuoto();
    s.giocatori.A.et = 2;
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'futuro')).toBeNull();
    expect(s.colonne.futuro[0].coperta).toBe(true);
    expect(s.giocatori.A.et).toBe(0);
  });

  test('nel Passato costa 1 in meno e dà Supporto Istantaneo', () => {
    const s = statoVuoto();
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'passato')).toBeNull();
    expect(s.giocatori.A.supportoRp).toBe(1);
  });

  test('rifiuta ET insufficienti senza toccare lo stato', () => {
    const s = statoVuoto();
    s.giocatori.A.et = 2;
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid, 'presente')).toMatch(/ET insufficienti/);
    expect(s.giocatori.A.mano).toHaveLength(1);
    expect(s.giocatori.A.et).toBe(2);
  });

  test('capienza: 4 Frammenti propri per colonna, quelli avversari non contano', () => {
    const s = statoVuoto();
    s.giocatori.A.et = 10;
    for (let i = 0; i < 4; i++) inCampo(s, 'B', 1, 'presente');
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'passato');
    const c = inMano(s, 'A', 3);
    expect(giocaCarta(s, 'A', c.uid, 'passato')).toMatch(/Colonna piena/);
    expect(giocaCarta(s, 'A', c.uid, 'presente')).toBeNull();
  });

  test('Frammento senza colonna rifiutato', () => {
    const s = statoVuoto();
    const c = inMano(s, 'A', 1);
    expect(giocaCarta(s, 'A', c.uid)).toMatch(/colonna/);
  });

  test('fuori turno rifiutato', () => {
    const s = statoVuoto();
    const c = inMano(s, 'B', 8);
    expect(giocaCarta(s, 'B', c.uid)).toMatch(/turno/);
  });

  test('Anomalia: sostituisce quella attiva, che va nell\'Orizzonte del suo proprietario', () => {
    const s = statoVuoto();
    const vecchia = carta('B', 7);
    s.anomalia = vecchia;
    const c = inMano(s, 'A', 7);
    expect(giocaCarta(s, 'A', c.uid)).toBeNull();
    expect(s.anomalia?.uid).toBe(c.uid);
    expect(s.giocatori.B.orizzonte.map((x) => x.uid)).toEqual([vecchia.uid]);
  });
});

describe('finestre di risposta', () => {
  test('in risposta solo Eventi, solo chi ha la priorità', () => {
    const s = statoVuoto();
    s.giocatori.B.et = 5;
    s.finestra = { contesto: 'giocata', priorita: 'B', passi: 0, passiNecessari: 1 };
    const fr = inMano(s, 'B', 1);
    const ev = inMano(s, 'B', 8);
    expect(giocaCarta(s, 'A', inMano(s, 'A', 8).uid)).toMatch(/priorità/);
    expect(giocaCarta(s, 'B', fr.uid, 'presente')).toMatch(/solo Eventi/);
    expect(giocaCarta(s, 'B', ev.uid)).toBeNull();
    expect(s.finestra).toEqual({ contesto: 'giocata', priorita: 'A', passi: 0, passiNecessari: 1 });
  });

  test('passa chiude una finestra di giocata; alla Collisione servono due passa', () => {
    const s = statoVuoto();
    s.finestra = { contesto: 'giocata', priorita: 'B', passi: 0, passiNecessari: 1 };
    expect(passa(s, 'A')).toMatch(/priorità/);
    expect(passa(s, 'B')).toBeNull();
    expect(s.finestra).toBeNull();
    s.finestra = { contesto: 'collisione', priorita: 'A', passi: 0, passiNecessari: 2 };
    expect(passa(s, 'A')).toBeNull();
    expect(s.finestra?.priorita).toBe('B');
    expect(passa(s, 'B')).toBeNull();
    expect(s.finestra).toBeNull();
  });

  test('un Evento giocato durante la finestra di Collisione mantiene il contesto', () => {
    const s = statoVuoto();
    s.fase = 'collisione';
    s.finestra = { contesto: 'collisione', priorita: 'A', passi: 0, passiNecessari: 2 };
    const ev = inMano(s, 'A', 8);
    expect(giocaCarta(s, 'A', ev.uid)).toBeNull();
    expect(s.finestra).toEqual({ contesto: 'collisione', priorita: 'B', passi: 0, passiNecessari: 1 });
  });
});

describe('passaTurno e Scambio', () => {
  test('passaTurno passa il turno all\'altro', () => {
    const s = statoVuoto();
    expect(passaTurno(s, 'A')).toBeNull();
    expect(s.attivo).toBe('B');
    expect(passaTurno(s, 'B')).toBeNull();
    expect(s.giocatori.A.haPassato && s.giocatori.B.haPassato).toBe(true);
  });

  test('Scambio una volta per round: scarta una carta, +1 ET', () => {
    const s = statoVuoto();
    const c1 = inMano(s, 'A', 1); const c2 = inMano(s, 'A', 2);
    expect(scambio(s, 'A', c1.uid)).toBeNull();
    expect(s.giocatori.A.et).toBe(4);
    expect(s.giocatori.A.orizzonte.map((c) => c.uid)).toEqual([c1.uid]);
    expect(scambio(s, 'A', c2.uid)).toMatch(/una volta/);
  });
});

describe('effetti manuali', () => {
  test('usaEffetto apre la decisione sul proprio Costruttore', () => {
    const s = statoVuoto();
    expect(usaEffetto(s, 'A', 'A-C')).toBeNull();
    expect(s.decisione).toEqual({ tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' });
  });

  test('usaEffetto rifiuta il Costruttore avversario', () => {
    const s = statoVuoto();
    expect(usaEffetto(s, 'A', 'B-C')).toMatch(/Costruttore/);
  });

  test('azioni base: modifica, tp, danno, distruggi, sposta, segnalino, cambiaStato', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    const b = inCampo(s, 'B', 3, 'presente');
    const a = inCampo(s, 'A', 1, 'passato');
    expect(applicaBase(s, 'A', { op: 'modifica', uid: b.uid, stat: 'pep', delta: -2, durata: 'collisione' })).toBeNull();
    expect(b.modifiche).toEqual([{ stat: 'pep', delta: -2, durata: 'collisione' }]);
    expect(applicaBase(s, 'A', { op: 'tp', delta: -1 })).toBeNull();
    expect(s.tp).toBe(0);
    expect(applicaBase(s, 'A', { op: 'dannoIT', bersaglio: 'B', valore: 2 })).toBeNull();
    expect(s.giocatori.B.it).toBe(18);
    expect(applicaBase(s, 'A', { op: 'cambiaStato', uid: a.uid, stato: 'Gas' })).toBeNull();
    expect(applicaBase(s, 'A', { op: 'segnalino', uid: b.uid, segnalino: 'freddo' })).toBeNull();
    expect(b.segnalino).toBe('freddo');
    expect(applicaBase(s, 'A', { op: 'sposta', uid: a.uid, colonna: 'futuro' })).toBeNull();
    expect(s.colonne.futuro.map((c) => c.uid)).toEqual([a.uid]);
    expect(s.colonne.futuro[0].statoForzato).toBe('Gas');
    expect(applicaBase(s, 'A', { op: 'distruggi', uid: b.uid })).toBeNull();
    expect(s.giocatori.B.orizzonte).toHaveLength(1);
  });

  test('azioni base: valori non validi rifiutati', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    expect(applicaBase(s, 'A', { op: 'tp', delta: 1.5 })).toMatch(/intero/);
    expect(applicaBase(s, 'A', { op: 'tp', delta: 0 })).toMatch(/intero/);
    expect(applicaBase(s, 'A', { op: 'dannoIT', bersaglio: 'C' as 'A', valore: 1 })).toMatch(/Bersaglio/);
    expect(applicaBase(s, 'A', { op: 'distruggi', uid: 'nessuno' })).toMatch(/non è in campo/);
  });

  test('sposta rispetta la capienza', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    for (let i = 0; i < 4; i++) inCampo(s, 'A', 1, 'futuro');
    const a = inCampo(s, 'A', 1, 'passato');
    expect(applicaBase(s, 'A', { op: 'sposta', uid: a.uid, colonna: 'futuro' })).toMatch(/Colonna piena/);
  });

  test('annulla marca una voce dello stack non ancora risolta', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    const ev = carta('B', 6);
    s.stack.push({ carta: ev, controllore: 'B', annullata: false, risolta: false });
    expect(applicaBase(s, 'A', { op: 'annulla', uid: ev.uid })).toBeNull();
    expect(s.stack[0].annullata).toBe(true);
  });

  test('inversione volontaria via azione base', () => {
    const s = statoVuoto();
    s.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-C', origine: 'libero' };
    expect(applicaBase(s, 'A', { op: 'inversione', volontaria: true })).toBeNull();
    expect(s.flusso).toBe('invertito');
    expect(s.giocatori.A.it).toBe(19);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `cd backend && npx jest tests/game/azioni.test.ts`
Expected: FAIL, `Cannot find module '../../game/engine/azioni'`.

- [ ] **Step 3: Implementare `azioni.ts`**

`backend/game/engine/azioni.ts`:

```ts
import { metti } from './campo';
import { contaInColonna, costoEffettivo, def, isFrammento } from './carte';
import { log, nomeG, NOMI_COLONNA } from './log';
import { altro, Colonna, PlayerId, StatoPartita } from './types';

export function giocaCarta(s: StatoPartita, p: PlayerId, uid: string, colonna?: Colonna): string | null {
  const g = s.giocatori[p];
  const carta = g.mano.find((c) => c.uid === uid);
  if (!carta) return 'La carta non è nella tua mano';
  const d = def(s, carta.cardId);

  if (s.finestra) {
    if (s.finestra.priorita !== p) return 'Non hai la priorità';
    if (d.tipo !== 'Evento') return 'In risposta puoi giocare solo Eventi';
  } else if (s.fase !== 'azioni' || s.attivo !== p || g.haPassato) {
    return 'Non è il tuo turno di azioni';
  }

  if (isFrammento(d.tipo)) {
    if (!colonna) return 'Scegli la colonna in cui giocare il Frammento';
    if (contaInColonna(s, colonna, p) >= 4) return 'Colonna piena: massimo 4 tuoi Frammenti';
  }
  const costo = costoEffettivo(d, colonna);
  if (costo > g.et) return `ET insufficienti: servono ${costo}, ne hai ${g.et}`;

  g.et -= costo;
  g.mano = g.mano.filter((c) => c.uid !== uid);

  if (isFrammento(d.tipo)) {
    const coperta = colonna === 'futuro';
    metti(s, carta, colonna!, { coperta });
    if (coperta) {
      log(s, `${nomeG(p)} gioca un Frammento coperto nel Futuro`);
      log(s, `Hai giocato ${d.nome} coperto nel Futuro`, p);
    } else {
      log(s, `${nomeG(p)} gioca ${d.nome} nel ${NOMI_COLONNA[colonna!]}`);
    }
  } else if (d.tipo === 'Anomalia') {
    if (s.anomalia) {
      s.giocatori[s.anomalia.owner].orizzonte.push(s.anomalia);
      log(s, `${def(s, s.anomalia.cardId).nome} viene sostituita`);
    }
    s.anomalia = carta;
    log(s, `${nomeG(p)} attiva l'Anomalia ${d.nome}`);
  } else {
    log(s, `${nomeG(p)} gioca l'Evento ${d.nome}`);
  }

  s.stack.push({ carta, controllore: p, annullata: false, risolta: false });
  s.finestra = {
    contesto: s.fase === 'collisione' ? 'collisione' : 'giocata',
    priorita: altro(p), passi: 0, passiNecessari: 1,
  };
  return null;
}

export function passa(s: StatoPartita, p: PlayerId): string | null {
  const f = s.finestra;
  if (!f) return 'Nessuna finestra di risposta aperta';
  if (f.priorita !== p) return 'Non hai la priorità';
  f.passi += 1;
  log(s, `${nomeG(p)} passa`);
  if (f.passi >= f.passiNecessari) s.finestra = null;
  else f.priorita = altro(p);
  return null;
}

export function passaTurno(s: StatoPartita, p: PlayerId): string | null {
  if (s.fase !== 'azioni' || s.finestra) return 'Non puoi passare il turno adesso';
  if (s.attivo !== p) return 'Non è il tuo turno di azioni';
  s.giocatori[p].haPassato = true;
  log(s, `${nomeG(p)} termina le sue azioni`);
  if (!s.giocatori[altro(p)].haPassato) s.attivo = altro(p);
  return null;
}

export function scambio(s: StatoPartita, p: PlayerId, uid: string): string | null {
  const g = s.giocatori[p];
  if (s.fase !== 'azioni' || s.finestra || s.attivo !== p || g.haPassato) return 'Non è il tuo turno di azioni';
  if (g.scambioUsato) return 'Lo Scambio si fa una volta per round';
  const c = g.mano.find((x) => x.uid === uid);
  if (!c) return 'La carta non è nella tua mano';
  g.mano = g.mano.filter((x) => x.uid !== uid);
  g.orizzonte.push(c);
  g.et += 1;
  g.scambioUsato = true;
  log(s, `${nomeG(p)} scarta ${def(s, c.cardId).nome} per +1 ET`);
  return null;
}
```

- [ ] **Step 4: Implementare `manuale.ts`**

`backend/game/engine/manuale.ts`:

```ts
import { distruggi, sposta } from './campo';
import { cercaInCampo, contaInColonna, def } from './carte';
import { log, nomeG } from './log';
import { pesca } from './risorse';
import { inverti, ricalcolaTP } from './temperatura';
import { AzioneBase, COLONNE, GIOCATORI, PlayerId, STATI, StatoPartita } from './types';

const intero = (n: unknown, max: number): boolean =>
  typeof n === 'number' && Number.isInteger(n) && n !== 0 && Math.abs(n) <= max;

/** Apre il pannello degli effetti manuali su una fonte che il giocatore controlla. */
export function usaEffetto(s: StatoPartita, p: PlayerId, uid: string): string | null {
  const g = s.giocatori[p];
  const haPriorita = s.finestra
    ? s.finestra.priorita === p
    : s.fase === 'azioni' && s.attivo === p && !g.haPassato;
  if (!haPriorita) return 'Non hai la priorità';
  let cardId: number | null = null;
  if (g.costruttore.uid === uid) cardId = g.costruttore.cardId;
  else if (s.anomalia?.uid === uid) cardId = s.anomalia.cardId;
  else {
    const t = cercaInCampo(s, uid);
    if (t && t.carta.owner === p) cardId = t.carta.cardId;
  }
  if (cardId === null) return 'Puoi usare solo il tuo Costruttore, l\'Anomalia attiva o un tuo Frammento in campo';
  s.decisione = { tipo: 'effettoManuale', giocatore: p, uid, origine: 'libero' };
  log(s, `${nomeG(p)} applica l'effetto di ${def(s, cardId).nome}`);
  return null;
}

export function applicaBase(s: StatoPartita, p: PlayerId, b: AzioneBase): string | null {
  const inCampo = (uid: string) => cercaInCampo(s, uid);
  switch (b.op) {
    case 'modifica': {
      const t = inCampo(b.uid);
      if (!t) return 'La carta non è in campo';
      if (b.stat !== 'pep' && b.stat !== 'rp') return 'Valore da modificare non valido';
      if (!intero(b.delta, 10)) return 'La modifica deve essere un intero tra -10 e 10, diverso da 0';
      if (!['collisione', 'round', 'permanente'].includes(b.durata)) return 'Durata non valida';
      t.carta.modifiche.push({ stat: b.stat, delta: b.delta, durata: b.durata });
      log(s, `${def(s, t.carta.cardId).nome}: ${b.delta > 0 ? '+' : ''}${b.delta} ${b.stat.toUpperCase()} (${b.durata})`);
      return null;
    }
    case 'cambiaStato': {
      const t = inCampo(b.uid);
      if (!t) return 'La carta non è in campo';
      if (b.stato !== null && !STATI.includes(b.stato)) return 'Stato non valido';
      t.carta.statoForzato = b.stato;
      ricalcolaTP(s);
      log(s, `${def(s, t.carta.cardId).nome} diventa ${b.stato ?? 'il suo stato originale'}`);
      return null;
    }
    case 'sposta': {
      const t = inCampo(b.uid);
      if (!t) return 'La carta non è in campo';
      if (!COLONNE.includes(b.colonna) || b.colonna === t.colonna) return 'Colonna di destinazione non valida';
      if (contaInColonna(s, b.colonna, t.carta.owner) >= 4) return 'Colonna piena: massimo 4 Frammenti per giocatore';
      sposta(s, b.uid, b.colonna);
      return null;
    }
    case 'segnalino': {
      const t = inCampo(b.uid);
      if (!t) return 'La carta non è in campo';
      if (![null, 'caldo', 'freddo'].includes(b.segnalino)) return 'Segnalino non valido';
      t.carta.segnalino = b.segnalino;
      log(s, `${def(s, t.carta.cardId).nome}: segnalino ${b.segnalino ?? 'rimosso'}`);
      return null;
    }
    case 'tp':
      if (!intero(b.delta, 8)) return 'La variazione di TP deve essere un intero tra -8 e 8, diverso da 0';
      s.tpSpostamento += b.delta;
      ricalcolaTP(s);
      return null;
    case 'inversione':
      inverti(s, b.volontaria ? p : null);
      return null;
    case 'dannoIT':
      if (!GIOCATORI.includes(b.bersaglio)) return 'Bersaglio non valido';
      if (!intero(b.valore, 20)) return 'Il danno deve essere un intero tra -20 e 20, diverso da 0';
      s.giocatori[b.bersaglio].it -= b.valore;
      log(s, `${nomeG(b.bersaglio)} ${b.valore > 0 ? 'perde' : 'recupera'} ${Math.abs(b.valore)} IT`);
      return null;
    case 'distruggi':
      return distruggi(s, b.uid) ? null : 'La carta non è in campo';
    case 'pesca':
      pesca(s, p);
      return null;
    case 'scarta': {
      const g = s.giocatori[p];
      const c = g.mano.find((x) => x.uid === b.uid);
      if (!c) return 'La carta non è nella tua mano';
      g.mano = g.mano.filter((x) => x.uid !== b.uid);
      g.orizzonte.push(c);
      log(s, `${nomeG(p)} scarta ${def(s, c.cardId).nome}`);
      return null;
    }
    case 'annulla': {
      const v = s.stack.find((x) => x.carta.uid === b.uid && !x.risolta);
      if (!v) return 'Nessun effetto da annullare con quella carta';
      v.annullata = true;
      log(s, `L'effetto di ${def(s, v.carta.cardId).nome} viene annullato`);
      return null;
    }
    default:
      return 'Azione base sconosciuta';
  }
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `cd backend && npx jest tests/game/azioni.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/game/engine/azioni.ts backend/game/engine/manuale.ts backend/tests/game/azioni.test.ts
git commit -m "feat(game): giocare carte, finestre di risposta, Scambio, effetti manuali"
```

---

### Task 7: Setup, macchina delle fasi, `applica`, mosse legali

**Files:**
- Create: `backend/game/engine/setup.ts`
- Create: `backend/game/engine/round.ts`
- Create: `backend/game/engine/legali.ts`
- Create: `backend/game/engine/index.ts`
- Test: `backend/tests/game/partita.test.ts`

**Interfaces:**
- Consumes: tutto quanto sopra.
- Produces: `creaPartita(o: { seed: number; mazzi: Record<PlayerId, Mazzo>; catalogo: Record<number, DefCarta> }): StatoPartita` (lancia `Error` se un mazzo non è valido); `avanza(s): void`; `chiDeveAgire(s): PlayerId | null`; `mosseLegali(s, p): Azione[]`; `applica(stato, p, azione): Risultato` (non modifica `stato`); `arrendi(stato, p): StatoPartita`. `index.ts` riesporta `creaPartita`, `applica`, `arrendi`, `chiDeveAgire`, `mosseLegali`, `validaMazzo`, `daCardDb`, `Mazzo` e tutti i tipi.

- [ ] **Step 1: Scrivere il test che fallisce**

`backend/tests/game/partita.test.ts`:

```ts
import { applica, arrendi, chiDeveAgire, creaPartita, mosseLegali } from '../../game/engine';
import { Azione, PlayerId, StatoPartita } from '../../game/engine/types';
import { catalogoProva, mazzoProva } from './helpers';

const nuova = (seed = 1) =>
  creaPartita({ seed, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });

function ok(s: StatoPartita, p: PlayerId, a: Azione): StatoPartita {
  const r = applica(s, p, a);
  if (!r.ok) throw new Error(`${JSON.stringify(a)}: ${r.errore}`);
  return r.stato;
}

/** Porta la partita al round 1, fase Azioni, senza mulligan. */
function pronta(seed = 1): StatoPartita {
  let s = nuova(seed);
  const w = chiDeveAgire(s)!;
  s = ok(s, w, { tipo: 'sceltaIniziativa', tieni: true });
  s = ok(s, w, { tipo: 'mulligan', esegui: false });
  s = ok(s, w === 'A' ? 'B' : 'A', { tipo: 'mulligan', esegui: false });
  return s;
}

describe('setup', () => {
  test('scissione 30/10, mano di 5, decisione d\'iniziativa al vincitore del dado', () => {
    const s = nuova();
    for (const p of ['A', 'B'] as PlayerId[]) {
      const g = s.giocatori[p];
      expect(g.futuro).toHaveLength(25);
      expect(g.memoria).toHaveLength(10);
      expect(g.mano).toHaveLength(5);
      expect(g.it).toBe(20);
    }
    expect(s.decisione?.tipo).toBe('sceltaIniziativa');
    expect(s.tp).toBe(0);
    expect(s.flusso).toBe('normale');
  });

  test('stesso seed, stessa partita', () => {
    expect(nuova(9)).toEqual(nuova(9));
  });

  test('mazzo non valido: errore', () => {
    const m = mazzoProva(); m.carte.pop();
    expect(() => creaPartita({ seed: 1, mazzi: { A: m, B: mazzoProva() }, catalogo: catalogoProva() }))
      .toThrow(/Mazzo A/);
  });

  test('cedere l\'iniziativa e fare mulligan', () => {
    let s = nuova(3);
    const w = chiDeveAgire(s)!;
    const o: PlayerId = w === 'A' ? 'B' : 'A';
    s = ok(s, w, { tipo: 'sceltaIniziativa', tieni: false });
    expect(s.iniziativa).toBe(o);
    expect(s.decisione).toEqual({ tipo: 'mulligan', giocatore: o });
    s = ok(s, o, { tipo: 'mulligan', esegui: true });
    expect(s.giocatori[o].mano).toHaveLength(4);
    expect(s.giocatori[o].futuro).toHaveLength(26);
    s = ok(s, w, { tipo: 'mulligan', esegui: false });
    // round 1: niente Slittamento, Risorse pesca 1
    expect(s.fase).toBe('azioni');
    expect(s.round).toBe(1);
    expect(s.giocatori[o].mano).toHaveLength(5);
    expect(s.giocatori[w].mano).toHaveLength(6);
    expect(s.giocatori[o].et).toBe(3);
    expect(s.attivo).toBe(o);
  });
});

describe('applica', () => {
  test('rifiuta chi non deve agire e non modifica lo stato', () => {
    const s = pronta();
    const copia = structuredClone(s);
    const altro: PlayerId = s.attivo === 'A' ? 'B' : 'A';
    const r = applica(s, altro, { tipo: 'passaTurno' });
    expect(r.ok).toBe(false);
    expect(s).toEqual(copia);
  });

  test('azione malformata: errore leggibile, stato invariato', () => {
    const s = pronta();
    const copia = structuredClone(s);
    const r1 = applica(s, s.attivo, { tipo: 'boh' } as unknown as Azione);
    expect(r1).toEqual({ ok: false, errore: 'Azione sconosciuta' });
    expect(applica(s, s.attivo, null as unknown as Azione)).toEqual({ ok: false, errore: 'Azione sconosciuta' });
    const r2 = applica(s, s.attivo, { tipo: 'giocaCarta', uid: 'inesistente', colonna: 'presente' });
    expect(r2.ok).toBe(false);
    const r3 = applica(s, s.attivo, { tipo: 'base', base: { op: 'tp', delta: 0.5 } });
    expect(r3.ok).toBe(false);
    expect(s).toEqual(copia);
  });

  test('un round completo: giocata, finestra, effetto manuale, Collisione, round 2', () => {
    let s = pronta(5);
    const a = s.attivo;
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    // dà ad A una carta con effetto, giocabile con 3 ET
    s.giocatori[a].mano.push({ uid: 'X1', cardId: 9, owner: a });
    s = ok(s, a, { tipo: 'giocaCarta', uid: 'X1', colonna: 'presente' });
    expect(chiDeveAgire(s)).toBe(b);
    s = ok(s, b, { tipo: 'passa' });
    expect(s.decisione).toEqual({ tipo: 'effettoManuale', giocatore: a, uid: 'X1', origine: 'stack' });
    s = ok(s, a, { tipo: 'base', base: { op: 'tp', delta: -1 } });
    s = ok(s, a, { tipo: 'fatto' });
    expect(s.stack).toHaveLength(0);
    expect(chiDeveAgire(s)).toBe(a);
    s = ok(s, a, { tipo: 'passaTurno' });
    s = ok(s, b, { tipo: 'passaTurno' });
    expect(s.fase).toBe('collisione');
    expect(s.finestra?.contesto).toBe('collisione');
    s = ok(s, s.iniziativa, { tipo: 'passa' });
    s = ok(s, b === s.iniziativa ? a : b, { tipo: 'passa' });
    expect(s.round).toBe(2);
    expect(s.fase).toBe('azioni');
    expect(s.iniziativa).toBe(b);
    expect(s.attivo).toBe(b);
    // la carta di A è slittata nel Passato
    expect(s.colonne.passato.map((c) => c.uid)).toContain('X1');
  });

  test('Evento in risposta durante la Collisione: la Collisione si risolve comunque', () => {
    let s = pronta(6);
    const a = s.attivo; // pronta() tiene l'iniziativa: a ha l'iniziativa
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    s.giocatori[b].mano.push({ uid: 'EV', cardId: 6, owner: b });
    s = ok(s, a, { tipo: 'passaTurno' });
    s = ok(s, b, { tipo: 'passaTurno' });
    expect(s.finestra).toEqual({ contesto: 'collisione', priorita: a, passi: 0, passiNecessari: 2 });
    s = ok(s, a, { tipo: 'passa' });
    s = ok(s, b, { tipo: 'giocaCarta', uid: 'EV' });
    expect(s.finestra).toEqual({ contesto: 'collisione', priorita: a, passi: 0, passiNecessari: 1 });
    s = ok(s, a, { tipo: 'passa' });
    expect(s.decisione).toEqual({ tipo: 'effettoManuale', giocatore: b, uid: 'EV', origine: 'stack' });
    s = ok(s, b, { tipo: 'fatto' });
    expect(s.giocatori[b].orizzonte.map((c) => c.uid)).toContain('EV');
    expect(s.round).toBe(2);
    expect(s.fase).toBe('azioni');
    expect(s.finestra).toBeNull();
  });

  test('pesca da effetto manuale con mazzo attivo vuoto: la partita finisce subito', () => {
    let s = pronta(7);
    const a = s.attivo;
    s.giocatori[a].futuro = [];
    s = ok(s, a, { tipo: 'usaEffetto', uid: s.giocatori[a].costruttore.uid });
    s = ok(s, a, { tipo: 'base', base: { op: 'pesca' } });
    expect(s.esito).toEqual({ vincitore: a === 'A' ? 'B' : 'A', motivo: 'collassoEntropico' });
    expect(s.fase).toBe('terminata');
    expect(s.decisione).toBeNull();
    expect(chiDeveAgire(s)).toBeNull();
  });

  test('Inversione spontanea allo Slittamento: le Risorse pescano dalla Memoria', () => {
    let s = pronta(8);
    const a = s.attivo;
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    // 4 Caldi nel Futuro di A: allo Slittamento entrano nel Presente, TP +4
    for (let i = 0; i < 4; i++) {
      s.colonne.futuro.push({ uid: `H${i}`, cardId: 3, owner: a, coperta: true, segnalino: null, statoForzato: null, modifiche: [] });
    }
    const memoriaPrima = { A: s.giocatori.A.memoria.length, B: s.giocatori.B.memoria.length };
    s = ok(s, a, { tipo: 'passaTurno' });
    s = ok(s, b, { tipo: 'passaTurno' });
    s = ok(s, s.iniziativa, { tipo: 'passa' });
    s = ok(s, s.iniziativa === a ? b : a, { tipo: 'passa' });
    expect(s.flusso).toBe('invertito');
    expect(s.giocatori.A.memoria.length).toBe(memoriaPrima.A - 1);
    expect(s.giocatori.B.memoria.length).toBe(memoriaPrima.B - 1);
  });

  test('arrendersi fa vincere l\'altro', () => {
    const s = arrendi(pronta(), 'A');
    expect(s.esito).toEqual({ vincitore: 'B', motivo: 'abbandono' });
    expect(chiDeveAgire(s)).toBeNull();
  });
});

describe('mosseLegali', () => {
  test('solo per chi deve agire, e ogni mossa proposta è accettata', () => {
    const s = pronta(11);
    const altro: PlayerId = s.attivo === 'A' ? 'B' : 'A';
    expect(mosseLegali(s, altro)).toEqual([]);
    const mosse = mosseLegali(s, s.attivo);
    expect(mosse).toContainEqual({ tipo: 'passaTurno' });
    for (const m of mosse) expect(applica(s, s.attivo, m).ok).toBe(true);
  });

  test('in una finestra: passa e gli Eventi pagabili', () => {
    let s = pronta(12);
    const a = s.attivo;
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    s.giocatori[b].mano = [{ uid: 'E1', cardId: 8, owner: b }, { uid: 'F1', cardId: 1, owner: b }];
    s.giocatori[a].mano.push({ uid: 'Y', cardId: 2, owner: a });
    s = ok(s, a, { tipo: 'giocaCarta', uid: 'Y', colonna: 'presente' });
    expect(mosseLegali(s, b)).toEqual([{ tipo: 'passa' }, { tipo: 'giocaCarta', uid: 'E1' }]);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `cd backend && npx jest tests/game/partita.test.ts`
Expected: FAIL, `Cannot find module '../../game/engine'`.

- [ ] **Step 3: Implementare `setup.ts`**

`backend/game/engine/setup.ts`:

```ts
import { Mazzo, validaMazzo } from './carte';
import { log, nomeG } from './log';
import { intero, mescola } from './rng';
import { altro, DefCarta, Giocatore, GIOCATORI, PlayerId, StatoPartita } from './types';

export function creaPartita(o: {
  seed: number; mazzi: Record<PlayerId, Mazzo>; catalogo: Record<number, DefCarta>;
}): StatoPartita {
  for (const p of GIOCATORI) {
    const e = validaMazzo(o.mazzi[p], o.catalogo);
    if (e) throw new Error(`Mazzo ${p}: ${e}`);
  }
  const carte: Record<number, DefCarta> = {};
  for (const p of GIOCATORI) {
    for (const id of [...o.mazzi[p].carte, o.mazzi[p].costruttore]) carte[id] = o.catalogo[id];
  }
  const giocatore = (p: PlayerId): Giocatore => ({
    id: p,
    futuro: o.mazzi[p].carte.map((cardId, i) => ({ uid: `${p}${i}`, cardId, owner: p })),
    memoria: [], mano: [], orizzonte: [],
    costruttore: { uid: `${p}-C`, cardId: o.mazzi[p].costruttore, owner: p },
    it: 20, et: 3, etMax: 3, mulliganFatto: false, scambioUsato: false,
    supportoUsati: 0, supportoPep: 0, supportoRp: 0, haPassato: false,
  });
  const s: StatoPartita = {
    rng: o.seed >>> 0 || 1, round: 1, fase: 'setup', flusso: 'normale', tp: 0, tpSpostamento: 0,
    iniziativa: 'A', attivo: 'A',
    colonne: { passato: [], presente: [], futuro: [] },
    anomalia: null, giocatori: { A: giocatore('A'), B: giocatore('B') },
    stack: [], finestra: null, decisione: null, sconfitte: [], esito: null, carte, log: [],
  };
  for (const p of GIOCATORI) {
    const g = s.giocatori[p];
    mescola(s, g.futuro);
    g.memoria = g.futuro.splice(30);
    g.mano = g.futuro.splice(0, 5);
  }
  let a = 0;
  let b = 0;
  while (a === b) {
    a = intero(s, 6) + 1;
    b = intero(s, 6) + 1;
  }
  const w: PlayerId = a > b ? 'A' : 'B';
  log(s, `Dado per l'iniziativa: A ${a}, B ${b}. Sceglie ${nomeG(w)}`);
  s.iniziativa = w;
  s.attivo = w;
  s.decisione = { tipo: 'sceltaIniziativa', giocatore: w };
  return s;
}

export function sceltaIniziativa(s: StatoPartita, p: PlayerId, tieni: boolean): string | null {
  s.iniziativa = tieni ? p : altro(p);
  s.attivo = s.iniziativa;
  log(s, `Iniziativa a ${nomeG(s.iniziativa)}`);
  s.decisione = { tipo: 'mulligan', giocatore: s.iniziativa };
  return null;
}

export function mulligan(s: StatoPartita, p: PlayerId, esegui: boolean): string | null {
  const g = s.giocatori[p];
  if (esegui) {
    g.futuro.push(...g.mano);
    g.mano = [];
    mescola(s, g.futuro);
    g.mano = g.futuro.splice(0, 4);
    log(s, `${nomeG(p)} fa mulligan`);
  }
  g.mulliganFatto = true;
  const o = altro(p);
  if (!s.giocatori[o].mulliganFatto) {
    s.decisione = { tipo: 'mulligan', giocatore: o };
  } else {
    s.decisione = null;
    s.fase = 'slittamento';
  }
  return null;
}
```

- [ ] **Step 4: Implementare `round.ts`**

`backend/game/engine/round.ts`:

```ts
import { risolviCollisione } from './collisione';
import { cercaInCampo, contaInColonna, def } from './carte';
import { log } from './log';
import { eseguiRisorse, ordine } from './risorse';
import { eseguiSlittamento } from './slittamento';
import { COLONNE, Colonna, GIOCATORI, PlayerId, StatoPartita } from './types';
import { fineRound, verificaFine, verificaSincronia } from './vittoria';

function trovaEccesso(s: StatoPartita): { giocatore: PlayerId; colonna: Colonna } | null {
  for (const p of ordine(s)) {
    for (const colonna of COLONNE) if (contaInColonna(s, colonna, p) > 4) return { giocatore: p, colonna };
  }
  return null;
}

/** Risolve la voce in cima allo stack: apre l'effetto manuale una volta, poi la toglie. */
function risolviCimaStack(s: StatoPartita): void {
  const v = s.stack[s.stack.length - 1];
  const d = def(s, v.carta.cardId);
  const coperta = cercaInCampo(s, v.carta.uid)?.carta.coperta ?? false;
  if (!v.annullata && !v.risolta && !coperta && d.effetto.trim()) {
    v.risolta = true;
    s.decisione = { tipo: 'effettoManuale', giocatore: v.controllore, uid: v.carta.uid, origine: 'stack' };
    log(s, `Effetto di ${d.nome} da applicare: ${d.effetto}`);
    return;
  }
  s.stack.pop();
  if (d.tipo === 'Evento') s.giocatori[v.carta.owner].orizzonte.push(v.carta);
}

/** Esegue le fasi automatiche finché serve una decisione umana o la partita finisce. */
export function avanza(s: StatoPartita): void {
  for (let guardia = 0; guardia < 1000; guardia++) {
    verificaFine(s);
    if (s.esito) {
      s.fase = 'terminata';
      s.decisione = null;
      s.finestra = null;
      return;
    }
    if (s.decisione || s.finestra) return;
    const eccesso = trovaEccesso(s);
    if (eccesso) {
      s.decisione = { tipo: 'capienza', ...eccesso };
      return;
    }
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
        continue;
      case 'risorse':
        s.fase = 'azioni';
        for (const p of GIOCATORI) s.giocatori[p].haPassato = false;
        s.attivo = s.iniziativa;
        eseguiRisorse(s);
        continue;
      case 'azioni':
        if (s.giocatori.A.haPassato && s.giocatori.B.haPassato) {
          s.fase = 'collisione';
          s.finestra = { contesto: 'collisione', priorita: s.iniziativa, passi: 0, passiNecessari: 2 };
        }
        return;
      case 'collisione':
        risolviCollisione(s);
        s.fase = 'fine';
        continue;
      case 'fine':
        verificaSincronia(s);
        if (s.esito) continue;
        fineRound(s);
        s.fase = 'slittamento';
        continue;
    }
  }
  throw new Error('avanza: troppi passi senza una decisione');
}
```

- [ ] **Step 5: Implementare `legali.ts`**

`backend/game/engine/legali.ts`:

```ts
import { contaInColonna, costoEffettivo, def, isFrammento } from './carte';
import { Azione, COLONNE, PlayerId, StatoPartita } from './types';

export function chiDeveAgire(s: StatoPartita): PlayerId | null {
  if (s.esito) return null;
  if (s.decisione) return s.decisione.giocatore;
  if (s.finestra) return s.finestra.priorita;
  if (s.fase === 'azioni') return s.attivo;
  return null;
}

/**
 * Mosse disponibili per `p`. Le azioni base del pannello manuale non sono elencate:
 * hanno parametri liberi e le valida `applica`. `usaEffetto` non è elencata.
 */
export function mosseLegali(s: StatoPartita, p: PlayerId): Azione[] {
  if (chiDeveAgire(s) !== p) return [];
  const d = s.decisione;
  if (d) {
    switch (d.tipo) {
      case 'sceltaIniziativa':
        return [{ tipo: 'sceltaIniziativa', tieni: true }, { tipo: 'sceltaIniziativa', tieni: false }];
      case 'mulligan':
        return [{ tipo: 'mulligan', esegui: false }, { tipo: 'mulligan', esegui: true }];
      case 'bonusControllo':
        return [{ tipo: 'bonusControllo', pesca: true }, { tipo: 'bonusControllo', pesca: false }];
      case 'capienza':
        return s.colonne[d.colonna]
          .filter((c) => c.owner === p)
          .map((c) => ({ tipo: 'capienza', distruggi: c.uid }) as Azione);
      case 'effettoManuale':
        return [{ tipo: 'fatto' }];
    }
  }
  const g = s.giocatori[p];
  const out: Azione[] = [];
  if (s.finestra) {
    out.push({ tipo: 'passa' });
    for (const c of g.mano) {
      const dc = def(s, c.cardId);
      if (dc.tipo === 'Evento' && dc.costo <= g.et) out.push({ tipo: 'giocaCarta', uid: c.uid });
    }
    return out;
  }
  out.push({ tipo: 'passaTurno' });
  for (const c of g.mano) {
    const dc = def(s, c.cardId);
    if (isFrammento(dc.tipo)) {
      for (const colonna of COLONNE) {
        if (contaInColonna(s, colonna, p) < 4 && costoEffettivo(dc, colonna) <= g.et) {
          out.push({ tipo: 'giocaCarta', uid: c.uid, colonna });
        }
      }
    } else if (dc.costo <= g.et) {
      out.push({ tipo: 'giocaCarta', uid: c.uid });
    }
  }
  if (!g.scambioUsato) for (const c of g.mano) out.push({ tipo: 'scambio', uid: c.uid });
  return out;
}
```

- [ ] **Step 6: Implementare `index.ts`**

`backend/game/engine/index.ts`:

```ts
import { distruggi } from './campo';
import { cercaInCampo } from './carte';
import { giocaCarta, passa, passaTurno, scambio } from './azioni';
import { chiDeveAgire } from './legali';
import { log, nomeG } from './log';
import { applicaBase, usaEffetto } from './manuale';
import { pesca } from './risorse';
import { avanza } from './round';
import { mulligan, sceltaIniziativa } from './setup';
import { altro, Azione, PlayerId, Risultato, StatoPartita } from './types';

export * from './types';
export { creaPartita } from './setup';
export { chiDeveAgire, mosseLegali } from './legali';
export { validaMazzo, daCardDb } from './carte';
export type { Mazzo } from './carte';

function esegui(s: StatoPartita, p: PlayerId, a: Azione): string | null {
  if (!a || typeof a !== 'object') return 'Azione sconosciuta';
  const d = s.decisione;
  const libero = (): string | null => (d ? 'Prima risolvi la decisione in corso' : null);
  switch (a.tipo) {
    case 'sceltaIniziativa':
      return d?.tipo === 'sceltaIniziativa' ? sceltaIniziativa(s, p, !!a.tieni) : 'Nessuna scelta di iniziativa in corso';
    case 'mulligan':
      return d?.tipo === 'mulligan' ? mulligan(s, p, !!a.esegui) : 'Nessun mulligan in corso';
    case 'bonusControllo':
      if (d?.tipo !== 'bonusControllo') return 'Nessun Bonus Controllo in corso';
      s.decisione = null;
      if (a.pesca) pesca(s, p);
      else log(s, `${nomeG(p)} rinuncia al Bonus Controllo`);
      return null;
    case 'capienza': {
      if (d?.tipo !== 'capienza') return 'Nessuna scelta di capienza in corso';
      const t = cercaInCampo(s, a.distruggi);
      if (!t || t.colonna !== d.colonna || t.carta.owner !== p) return 'Scegli un tuo Frammento in quella colonna';
      distruggi(s, a.distruggi);
      s.decisione = null;
      return null;
    }
    case 'giocaCarta':
      return libero() ?? giocaCarta(s, p, a.uid, a.colonna);
    case 'scambio':
      return libero() ?? scambio(s, p, a.uid);
    case 'passaTurno':
      return libero() ?? passaTurno(s, p);
    case 'passa':
      return libero() ?? passa(s, p);
    case 'usaEffetto':
      return libero() ?? usaEffetto(s, p, a.uid);
    case 'base':
      if (d?.tipo !== 'effettoManuale') return 'Nessun effetto in corso';
      if (!a.base || typeof a.base !== 'object') return 'Azione base mancante';
      return applicaBase(s, p, a.base);
    case 'fatto':
      if (d?.tipo !== 'effettoManuale') return 'Nessun effetto in corso';
      s.decisione = null;
      return null;
    default:
      return 'Azione sconosciuta';
  }
}

/** Applica un'azione su una copia dello stato. Lo stato ricevuto non viene mai modificato. */
export function applica(stato: StatoPartita, p: PlayerId, azione: Azione): Risultato {
  if (stato.esito) return { ok: false, errore: 'La partita è terminata' };
  if (chiDeveAgire(stato) !== p) return { ok: false, errore: 'Non tocca a te' };
  const s = structuredClone(stato);
  const errore = esegui(s, p, azione);
  if (errore) return { ok: false, errore };
  avanza(s);
  return { ok: true, stato: s };
}

export function arrendi(stato: StatoPartita, p: PlayerId): StatoPartita {
  const s = structuredClone(stato);
  if (s.esito) return s;
  s.esito = { vincitore: altro(p), motivo: 'abbandono' };
  s.fase = 'terminata';
  s.decisione = null;
  s.finestra = null;
  log(s, `${nomeG(p)} abbandona la partita`);
  return s;
}
```

Nota per chi implementa: in `esegui`, un errore restituito da `applicaBase` o da `giocaCarta` lascia la copia `s` in uno stato già validato prima di ogni scrittura (quelle funzioni controllano tutto prima di modificare), e comunque `applica` scarta `s` in caso d'errore.

- [ ] **Step 7: Eseguire il test e verificare che passi**

Run: `cd backend && npx jest tests/game/partita.test.ts`
Expected: PASS. Se il test "Evento in risposta durante la Collisione" o "Inversione spontanea" falliscono per il seed scelto (per esempio perché il mazzo di prova non ha carte sufficienti nella Memoria), correggere il codice, non il seed: sono i casi della Review Focus.

- [ ] **Step 8: Eseguire tutta la suite del motore**

Run: `cd backend && npx jest tests/game`
Expected: PASS su tutti i file.

- [ ] **Step 9: Commit**

```bash
git add backend/game/engine/setup.ts backend/game/engine/round.ts backend/game/engine/legali.ts backend/game/engine/index.ts backend/tests/game/partita.test.ts
git commit -m "feat(game): setup, macchina delle fasi, applica e mosse legali"
```

---

### Task 8: Vista per giocatore, invarianti, partite simulate

**Files:**
- Create: `backend/game/engine/vista.ts`
- Create: `backend/game/engine/invarianti.ts`
- Modify: `backend/game/engine/index.ts` (aggiungere gli export)
- Test: `backend/tests/game/vista.test.ts`
- Test: `backend/tests/game/simulazione.test.ts`

**Interfaces:**
- Consumes: `applica`, `creaPartita`, `chiDeveAgire`, `mosseLegali`, `cercaInCampo`, `def`, `intero`.
- Produces: `vista(s, io: PlayerId): Vista` con i tipi `Vista`, `VistaGiocatore`, `VistaCampo`, `VistaStack`; `verificaInvarianti(s): string[]`. `index.ts` riesporta `vista`, i tipi `Vista*` e `verificaInvarianti`.

- [ ] **Step 1: Scrivere i test che falliscono**

`backend/tests/game/vista.test.ts`:

```ts
import { applica, chiDeveAgire, creaPartita, vista } from '../../game/engine';
import { Azione, PlayerId, StatoPartita } from '../../game/engine/types';
import { catalogoProva, mazzoProva } from './helpers';

function pronta(): StatoPartita {
  let s = creaPartita({ seed: 4, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
  const passo = (a: Azione) => {
    const r = applica(s, chiDeveAgire(s)!, a);
    if (!r.ok) throw new Error(r.errore);
    s = r.stato;
  };
  passo({ tipo: 'sceltaIniziativa', tieni: true });
  passo({ tipo: 'mulligan', esegui: false });
  passo({ tipo: 'mulligan', esegui: false });
  return s;
}

describe('vista', () => {
  test('la mano avversaria e i mazzi Futuro sono nascosti, la Memoria no', () => {
    const s = pronta();
    const v = vista(s, 'A');
    expect(v.giocatori.A.mano).toHaveLength(s.giocatori.A.mano.length);
    expect(v.giocatori.B.mano).toBeNull();
    expect(v.giocatori.B.carteInMano).toBe(s.giocatori.B.mano.length);
    expect(v.giocatori.A.carteFuturo).toBe(s.giocatori.A.futuro.length);
    expect(v.giocatori.B.memoria).toEqual(s.giocatori.B.memoria);
    expect(JSON.stringify(v)).not.toContain('"rng"');
  });

  test('una carta coperta nel Futuro non rivela il cardId all\'avversario: campo, stack, log', () => {
    let s = pronta();
    const a = s.attivo;
    const b: PlayerId = a === 'A' ? 'B' : 'A';
    s.giocatori[a].mano.push({ uid: 'SEGRETA', cardId: 4, owner: a });
    const r = applica(s, a, { tipo: 'giocaCarta', uid: 'SEGRETA', colonna: 'futuro' });
    if (!r.ok) throw new Error(r.errore);
    s = r.stato;
    const vb = vista(s, b);
    const campo = vb.colonne.futuro.find((c) => c.uid === 'SEGRETA')!;
    expect(campo.coperta).toBe(true);
    expect(campo.cardId).toBeNull();
    const voce = vb.stack.find((x) => x.uid === 'SEGRETA')!;
    expect(voce.cardId).toBeNull();
    const nome = s.carte[4].nome;
    expect(vb.log.map((l) => l.testo).join('\n')).not.toContain(nome);
    // il proprietario la vede
    const va = vista(s, a);
    expect(va.colonne.futuro.find((c) => c.uid === 'SEGRETA')!.cardId).toBe(4);
  });

  test('le voci di log private arrivano solo al destinatario', () => {
    const s = pronta();
    const privateA = vista(s, 'A').log.filter((l) => l.testo.startsWith('Hai pescato'));
    const privateBvisteDaA = s.log.filter((l) => l.soloPer === 'B');
    expect(privateA.length).toBeGreaterThan(0);
    for (const l of privateBvisteDaA) expect(vista(s, 'A').log).not.toContainEqual(l);
  });
});
```

`backend/tests/game/simulazione.test.ts`:

```ts
import { applica, chiDeveAgire, creaPartita, mosseLegali, verificaInvarianti } from '../../game/engine';
import { intero } from '../../game/engine/rng';
import { StatoPartita } from '../../game/engine/types';
import { catalogoProva, mazzoProva } from './helpers';

function partitaCasuale(seed: number): StatoPartita {
  let s = creaPartita({ seed, mazzi: { A: mazzoProva(), B: mazzoProva() }, catalogo: catalogoProva() });
  const r = { rng: seed * 7919 };
  for (let passo = 0; passo < 3000 && !s.esito; passo++) {
    const p = chiDeveAgire(s);
    if (!p) throw new Error(`seed ${seed} passo ${passo}: nessuno deve agire ma la partita non è finita`);
    const mosse = mosseLegali(s, p);
    if (!mosse.length) throw new Error(`seed ${seed} passo ${passo}: nessuna mossa legale per ${p}`);
    const m = mosse[intero(r, mosse.length)];
    const res = applica(s, p, m);
    if (!res.ok) throw new Error(`seed ${seed} passo ${passo}: ${JSON.stringify(m)} rifiutata: ${res.errore}`);
    s = res.stato;
    // Il log non entra nelle regole: svuotarlo evita che ogni structuredClone diventi più lento a ogni passo.
    s.log = [];
    const inv = verificaInvarianti(s);
    if (inv.length) throw new Error(`seed ${seed} passo ${passo}: ${inv.join('; ')}`);
  }
  return s;
}

describe('partite simulate', () => {
  test('100 partite casuali: nessun blocco, nessuna mossa legale rifiutata, invarianti sempre veri', () => {
    let finite = 0;
    for (let seed = 1; seed <= 100; seed++) if (partitaCasuale(seed).esito) finite += 1;
    // Il gioco casuale non garantisce la fine entro 3000 passi, ma la maggior parte deve finire.
    expect(finite).toBeGreaterThanOrEqual(50);
  }, 120_000);

  test('la stessa sequenza di seed produce la stessa partita', () => {
    expect(partitaCasuale(42)).toEqual(partitaCasuale(42));
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `cd backend && npx jest tests/game/vista.test.ts tests/game/simulazione.test.ts`
Expected: FAIL, `vista` e `verificaInvarianti` non esportate da `../../game/engine`.

- [ ] **Step 3: Implementare `vista.ts`**

`backend/game/engine/vista.ts`:

```ts
import { cercaInCampo } from './carte';
import { chiDeveAgire } from './legali';
import {
  Carta, Colonna, COLONNE, Decisione, Esito, Fase, Finestra, Flusso, Modifica, PlayerId, StatoMateria,
  StatoPartita, VoceLog,
} from './types';

export interface VistaCampo {
  uid: string;
  owner: PlayerId;
  coperta: boolean;
  cardId: number | null;
  segnalino: 'caldo' | 'freddo' | null;
  statoForzato: StatoMateria | null;
  modifiche: Modifica[];
}

export interface VistaStack {
  uid: string;
  cardId: number | null;
  controllore: PlayerId;
  annullata: boolean;
}

export interface VistaGiocatore {
  id: PlayerId;
  it: number;
  et: number;
  etMax: number;
  mano: Carta[] | null;
  carteInMano: number;
  carteFuturo: number;
  memoria: Carta[];
  orizzonte: Carta[];
  costruttore: Carta;
  supportoPep: number;
  supportoRp: number;
  scambioUsato: boolean;
  haPassato: boolean;
}

export interface Vista {
  io: PlayerId;
  round: number;
  fase: Fase;
  flusso: Flusso;
  tp: number;
  iniziativa: PlayerId;
  attivo: PlayerId;
  tocca: PlayerId | null;
  anomalia: Carta | null;
  colonne: Record<Colonna, VistaCampo[]>;
  giocatori: Record<PlayerId, VistaGiocatore>;
  stack: VistaStack[];
  finestra: Finestra | null;
  decisione: Decisione | null;
  esito: Esito | null;
  log: VoceLog[];
}

export function vista(s: StatoPartita, io: PlayerId): Vista {
  const nascosta = (uid: string): boolean => {
    const t = cercaInCampo(s, uid);
    return !!t && t.carta.coperta && t.carta.owner !== io;
  };
  const colonne = {} as Record<Colonna, VistaCampo[]>;
  for (const col of COLONNE) {
    colonne[col] = s.colonne[col].map((fc) => (fc.coperta && fc.owner !== io
      ? { uid: fc.uid, owner: fc.owner, coperta: true, cardId: null, segnalino: null, statoForzato: null, modifiche: [] }
      : {
        uid: fc.uid, owner: fc.owner, coperta: fc.coperta, cardId: fc.cardId,
        segnalino: fc.segnalino, statoForzato: fc.statoForzato, modifiche: fc.modifiche,
      }));
  }
  const giocatore = (p: PlayerId): VistaGiocatore => {
    const g = s.giocatori[p];
    return {
      id: p, it: g.it, et: g.et, etMax: g.etMax,
      mano: p === io ? g.mano : null, carteInMano: g.mano.length, carteFuturo: g.futuro.length,
      memoria: g.memoria, orizzonte: g.orizzonte, costruttore: g.costruttore,
      supportoPep: g.supportoPep, supportoRp: g.supportoRp, scambioUsato: g.scambioUsato, haPassato: g.haPassato,
    };
  };
  return structuredClone({
    io, round: s.round, fase: s.fase, flusso: s.flusso, tp: s.tp,
    iniziativa: s.iniziativa, attivo: s.attivo, tocca: chiDeveAgire(s),
    anomalia: s.anomalia, colonne,
    giocatori: { A: giocatore('A'), B: giocatore('B') },
    stack: s.stack.map((v) => ({
      uid: v.carta.uid, cardId: nascosta(v.carta.uid) ? null : v.carta.cardId,
      controllore: v.controllore, annullata: v.annullata,
    })),
    finestra: s.finestra, decisione: s.decisione, esito: s.esito,
    log: s.log.filter((l) => !l.soloPer || l.soloPer === io),
  });
}
```

Nota: il log pubblico di una giocata coperta dice solo "gioca un Frammento coperto nel Futuro" (Task 6), il nome sta in una voce `soloPer`. Quando la carta coperta viene annunciata da `risolviCimaStack` non succede, perché le carte coperte non aprono l'effetto manuale (Task 7).

- [ ] **Step 4: Implementare `invarianti.ts`**

`backend/game/engine/invarianti.ts`:

```ts
import { contaInColonna, def } from './carte';
import { COLONNE, GIOCATORI, StatoPartita } from './types';

/** Controlli di coerenza usati dai test e dalle partite simulate. Lista vuota = tutto a posto. */
export function verificaInvarianti(s: StatoPartita): string[] {
  const err: string[] = [];
  const uids = new Set<string>();
  const registra = (uid: string) => {
    if (uids.has(uid)) err.push(`uid duplicato ${uid}`);
    uids.add(uid);
  };
  for (const p of GIOCATORI) {
    const g = s.giocatori[p];
    const zone = [g.futuro, g.memoria, g.mano, g.orizzonte];
    let n = zone.reduce((t, z) => t + z.length, 0);
    zone.flat().forEach((c) => registra(c.uid));
    for (const col of COLONNE) {
      for (const fc of s.colonne[col]) if (fc.owner === p) { n += 1; registra(fc.uid); }
    }
    if (s.anomalia?.owner === p) { n += 1; registra(s.anomalia.uid); }
    for (const v of s.stack) {
      if (v.carta.owner === p && def(s, v.carta.cardId).tipo === 'Evento') { n += 1; registra(v.carta.uid); }
    }
    if (n !== 40) err.push(`${p} ha ${n} carte invece di 40`);
    if (g.et < 0) err.push(`${p} ha ET negativa`);
    if (g.etMax > 10) err.push(`${p} ha ET massima oltre 10`);
    if (g.supportoUsati > 2) err.push(`${p} ha più di 2 Supporti nel round`);
    if (!s.esito && s.decisione?.tipo !== 'capienza') {
      for (const col of COLONNE) if (contaInColonna(s, col, p) > 4) err.push(`${p} ha più di 4 Frammenti nel ${col}`);
    }
  }
  if (s.tp < -4 || s.tp > 4) err.push(`TP fuori limite: ${s.tp}`);
  if (s.esito && s.fase !== 'terminata') err.push('esito presente ma fase non terminata');
  return err;
}
```

- [ ] **Step 5: Aggiungere gli export a `index.ts`**

In `backend/game/engine/index.ts`, sotto le altre righe `export`:

```ts
export { vista } from './vista';
export type { Vista, VistaCampo, VistaGiocatore, VistaStack } from './vista';
export { verificaInvarianti } from './invarianti';
```

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `cd backend && npx jest tests/game/vista.test.ts tests/game/simulazione.test.ts`
Expected: PASS. Se la simulazione segnala una violazione, il messaggio indica seed e passo: riprodurre con `partitaCasuale(<seed>)` e correggere il motore, non il test.

- [ ] **Step 7: Eseguire tutta la suite del backend**

Run: `cd backend && npx jest tests/game && npx tsc --noEmit`
Expected: test del motore verdi, nessun errore di tipo. Poi `cd backend && npm test` per verificare di non aver rotto i test esistenti.

- [ ] **Step 8: Verificare i vincoli globali**

Run: `cd backend && grep -rnE "Math\.random|Date\.now|new Date|from '(express|mongoose|socket\.io)'|from '\.\./(config|models)" game/engine/`
Expected: nessun risultato.

- [ ] **Step 9: Commit**

```bash
git add backend/game/engine/vista.ts backend/game/engine/invarianti.ts backend/game/engine/index.ts backend/tests/game/vista.test.ts backend/tests/game/simulazione.test.ts
git commit -m "feat(game): vista per giocatore, invarianti e partite simulate"
```
