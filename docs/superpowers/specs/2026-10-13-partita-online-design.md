# Partita online di Joule Zero Point: design

Data: 2026-10-13
Stato: bozza da approvare
Regolamento di riferimento: v6.0 (`backend/config/rulebook.json`)

## 1. Scopo

Rendere Joule Zero Point giocabile online su joulezeropoint.com.

Obiettivi, in ordine:

1. **Playtest del regolamento**: partite 1 contro 1 tra persone a distanza, con
   un registro completo che permetta di capire quali carte dominano.
2. **Partita contro l'AI**: inizialmente riservata a Simone, alimentata dal suo
   abbonamento Claude tramite un worker locale.
3. **Community** (fase successiva, fuori da questa spec): matchmaking,
   persistenza delle partite in corso, AI aperta ad altri tramite API.

Criterio di riuscita della prima tappa: due utenti loggati completano una
partita intera dal setup a una condizione di vittoria, con tutte le regole
strutturali applicate dal server e gli effetti non automatizzati applicati a
mano dal pannello.

## 2. Approccio scelto: motore ibrido

- La **struttura del round** (fasi, slittamento, temperatura, risorse,
  collisione, vittoria) è codice, applicato dal server.
- Gli **effetti delle carte** sono dati: un campo `script` in un piccolo
  linguaggio a momento, condizione, effetto. Le carte senza `script` si
  giocano con un pannello di azioni base applicate da chi gioca la carta.
- Le carte si automatizzano progressivamente; un cambio di bilanciamento è una
  modifica a un dato, non al codice.

Scartati: tavolo virtuale senza regole (non regge un avversario AI e duplica
l'export per Tabletop Simulator) e motore completo prima di giocare (mesi di
lavoro, e ogni ritocco di playtest diventerebbe codice).

## 3. Architettura

### 3.1 Collocazione

Tutto dentro l'app esistente, nessun servizio nuovo sul server.

| Parte | Dove |
|---|---|
| Motore di regole | `backend/game/engine/` (funzioni pure) |
| Gestione partite e socket | `backend/game/` (Socket.IO sullo stesso server HTTP di Express) |
| Script delle carte | `backend/game/cardScripts.json`, versionato, indicizzato per `cardId` |
| Modello partita | `backend/models/Match.ts` |
| Vista di gioco | `frontend/src/views/MatchView.vue` + componenti in `frontend/src/components/match/` |
| Stato client | `frontend/src/stores/matchStore.ts` |
| Worker AI | `ai-worker/` nella radice del repo, eseguito sul PC di Simone |
| Proxy | `frontend/nginx.conf`: upgrade WebSocket su `/socket.io/` |

Un solo container backend: non serve Redis né un adattatore Socket.IO
distribuito.

### 3.2 Server autorevole

Lo stato vero della partita esiste solo sul server. Il client invia
**intenzioni** (`giocaCarta`, `rispondi`, `passa`, `applicaAzioneBase`,
`scegli`...). Il motore le valida, le applica e invia a ciascun giocatore la
**propria vista**: mano propria visibile, mano avversaria come conteggio,
carte coperte nel Futuro e mazzo Futuro nascosti.

### 3.3 Motore come funzione pura

```
applica(stato, azione) -> { stato, eventi } | { errore }
mosseLegali(stato, giocatore) -> Azione[]
vista(stato, giocatore) -> VistaGiocatore
```

Nessuna dipendenza da socket, database o rete. Il generatore di numeri casuali
è iniettato con un seed, così ogni partita è riproducibile dal seed e dal log
delle azioni.

### 3.4 Autenticazione

Socket.IO usa lo stesso JWT delle API (handshake `auth.token`, verificato con
la logica di `middleware/authMiddleware.ts`). Solo utenti loggati.

## 4. Flusso di una partita

1. Un utente crea la partita, sceglie uno dei suoi mazzi validi (40 carte + 1
   Costruttore) e ottiene un **link d'invito** con un codice monouso.
2. Il secondo utente apre il link, si logga e sceglie il proprio mazzo.
   In alternativa il creatore sceglie "contro AI" (vedi sezione 8).
3. Setup automatico: scissione casuale 30 Futuro / 10 Memoria, mano di 5 dal
   Futuro, mulligan unico (rimescola e pesca 4), dado per l'iniziativa,
   IT 20, TP 0, ET 3, flusso Normale.
4. I round scorrono nelle fasi del regolamento. Slittamento, Risorse e
   Collisione si risolvono da sole salvo scelte richieste ai giocatori; la fase
   Azioni attende le mosse.
5. A fine partita si salva il documento `Match` con il log completo.

**Disconnessione**: lo stato resta in memoria e chi rientra riprende la
partita. Dopo 10 minuti di assenza la partita va in pausa; dopo 24 ore viene
chiusa senza esito. Un riavvio del server perde le partite in corso
(accettato per il playtest).

## 5. Regole automatizzate dal motore

Tutte quelle del regolamento tecnico 6.0:

- **Setup**: come al punto 3 della sezione 4.
- **Slittamento**: scorrimento secondo il flusso (Normale Futuro → Presente →
  Passato, Invertito al contrario); la carta che esce illesa si salva in cima
  al mazzo corrispondente; ingresso simultaneo nel Presente; rimozione dei
  segnalini termici e ricalcolo della TP. Capienza 4 Frammenti per colonna:
  se lo slittamento porta un quinto Frammento, il motore chiede al controllore
  quale distruggere.
- **Risorse**: ET +1 fino a 10; pesca dal mazzo attivo (Futuro in flusso
  Normale, Memoria in flusso Invertito); Bonus Controllo per chi ha più
  Frammenti nel Presente; Scambio una volta per round (scarta 1, +1 ET).
- **Azioni**: costo per colonna (Presente normale, Futuro -1 ET coperta,
  Passato -1 ET scoperta); Supporto Istantaneo all'ingresso nel Passato
  (+1 PEP se Calda, +1 RP se Fredda, massimo 2 per round per giocatore);
  una sola Anomalia attiva alla volta.
- **Temperatura**: +1 per Frammento Caldo e -1 per Freddo nel Presente,
  limite -4 / +4; segnalini 🔴 a TP ≥ +2 e 🔵 a TP ≤ -2, rimossi tra -1 e +1;
  🔴 concede le proprietà dello stato superiore, 🔵 di quello inferiore;
  Materia Oscura immune.
- **Inversioni**: spontanea e gratuita a TP ±4; volontaria da carta con 1 danno
  IT al controllore; dopo l'inversione la pesca passa al mazzo opposto.
- **Collisione**: PEP totale contro RP totale avversaria; Collasso del Presente
  avversario se PEP > RP con distruzione a fine Collisione; danno IT = PEP - RP;
  proprietà degli stati (Solido, Liquido, Gas, Plasma) massimo 2 volte per tipo.
- **Vittoria**: Collasso (IT ≤ 0), Sincronia (un Frammento in ognuna delle tre
  colonne e tutti e 5 gli stati, una Materia Oscura come jolly per un solo
  stato), Collasso Entropico (pesca da mazzo attivo vuoto).
- **Orizzonte degli Eventi**: Frammenti distrutti, Eventi risolti, carte
  scartate.

Gerarchia: il testo della carta prevale sul regolamento. Negli script si
esprime con effetti che sovrascrivono un valore di regola (per esempio un
costo o un limite) per la durata indicata.

### 5.1 Finestre di risposta

Il "giocabile in qualsiasi momento" degli Eventi diventa un insieme di
**finestre fisse**, in cui l'avversario del giocatore attivo può giocare un
Evento oppure passare:

- dopo ogni carta giocata, prima che i suoi effetti di ingresso si risolvano;
- all'inizio della Collisione, prima del confronto PEP contro RP.

Una risposta apre a sua volta una finestra per l'altro giocatore (catena),
risolta dall'ultima giocata alla prima. Timeout della finestra: 20 secondi,
poi "passa" automatico; configurabile.

## 6. Linguaggio degli script delle carte

Il testo `effect` resta la fonte leggibile; lo `script` ne è la traduzione
eseguibile. Gli script stanno in `backend/game/cardScripts.json`, chiave
`cardId`, così la sincronizzazione delle carte da Google Sheet
(`services/cardSyncService.ts`) non li tocca e ogni modifica resta nella
storia git.

Forma:

```json
{
  "42": [
    {
      "on": "entraPresente",
      "if": { "tp": { "gte": 1 } },
      "do": [
        { "tp": 1 },
        { "dannoIT": { "a": "avversario", "valore": 1 } }
      ]
    },
    { "on": "dopoCollisione", "do": [{ "distruggi": "questa" }] }
  ]
}
```

**Momenti (`on`)**: `entraPresente`, `entraPassato`, `entraFuturo`,
`inizioCollisione`, `durataCollisione`, `dopoCollisione`, `distrutta`,
`finchePresente` (effetto continuo), `immediato` (Eventi), `permanente`
(Anomalie), `cambioSegnoTP`, `inversione`.

**Condizioni (`if`)**: valore di TP, conteggi di Frammenti per stato,
controllore o colonna, presenza di carte avversarie di un dato stato,
flusso attuale. Combinabili con `tutte` / `almenoUna`.

**Effetti (`do`)**: `tp`, `modificaPEP`, `modificaRP` (con `durata`:
`finoFineCollisione`, `finoFineTurno`, `permanente`), `dannoIT`,
`perditaIT` (entrambi i giocatori), `distruggi`, `sposta`,
`impedisciSlittamento`, `annullaEffetto`, `inversione`, `pesca`, `scarta`,
`modificaCosto`, `immune`.

**Scelte**: un effetto con `"opzionale": true` ("puoi...") chiede Sì/No al
controllore; un `bersaglio` con `"scegli"` chiede di selezionare la carta
valida tra quelle che il motore evidenzia.

**Copertura**: obiettivo iniziale le carte dei mazzi starter, poi le altre per
frequenza d'uso. Stima di copertura totale con questo linguaggio: 60-70% delle
160 carte. Gli script li scrive l'agente a partire dal testo; Simone li valida
a gruppi prima del rilascio.

**Script in errore**: se l'esecuzione di uno script fallisce, quella carta
ricade sull'effetto manuale per il resto della partita e l'errore va nel log.

### 6.1 Effetti manuali

Una carta senza script, o con script in errore, apre il **pannello azioni
base** per chi l'ha giocata: testo dell'effetto e azioni `modificaPEP`,
`modificaRP`, `cambiaStato`, `sposta`, `segnalino`, `tp`, `dannoIT`,
`distruggi`, `pesca`, più "fatto". Ogni azione passa dal motore, che ne
controlla la forma (bersagli esistenti, limiti di TP e IT) ma non la
pertinenza rispetto al testo. Tutte compaiono nel registro visibile ad
entrambi.

## 7. Interfaccia

**Tavolo**: `tabellone6.0.png` come sfondo, con zone cliccabili posizionate in
percentuale.

- Tre colonne centrali (Passato, Presente, Futuro), massimo 4 Frammenti
  ciascuna, carte dell'avversario nella metà alta e proprie nella metà bassa,
  con bordo del colore del giocatore.
- Termometro a sinistra con indicatore su TP da -4 a +4; animazione
  all'Inversione.
- Slot laterali per mazzo Futuro e Memoria di ciascun giocatore, con retro
  ufficiale (`Retro_Ufficiale.png`) e conteggio.

**Attorno al tavolo**: mano propria in basso a ventaglio; mano avversaria in
alto come retro con conteggio; barra di stato con IT, ET, fase, flusso e
segnalino iniziativa; segnalini `riscaldato`, `raffreddato` e `selezionato`
sulle carte; registro testuale delle azioni a lato.

**Interazione**: click sulla carta, poi click sulla destinazione. Sono
evidenziate solo le mosse legali calcolate dal motore; le carte non
giocabili sono attenuate. Niente trascinamento nella prima versione.

**Immagini delle carte**: quelle già servite dal sito (`image_url`).

**Dispositivi**: desktop e tablet in orizzontale. Su telefono in verticale
compare l'invito a ruotare il dispositivo.

**Trasparenza AI**: nelle partite contro l'AI, avviso fisso come quello del
Terminale (AI Act art. 50).

## 8. Avversario AI

### 8.1 Worker locale

Inizialmente solo Simone gioca contro l'AI, usando il proprio abbonamento
Claude. Le credenziali dell'abbonamento non vanno mai sul server.

- `ai-worker/` è un processo Node che gira sul PC di Simone.
- Si connette al server di gioco via Socket.IO con un account dedicato
  ("AI di Simone"), come un qualunque secondo giocatore.
- Quando tocca a lui riceve la propria vista (con le stesse informazioni
  nascoste di un umano) e la lista delle mosse legali numerate.
- Chiama `claude -p` (Claude Code non interattivo, login dell'abbonamento)
  con vista, mosse legali e testo delle carte coinvolte; si aspetta in uscita
  un JSON `{ "mossa": n, "motivo": "..." }`.
- Invia la mossa al server. Il `motivo` finisce nel registro della partita.

La creazione di una partita "contro AI" è ammessa solo per l'utente di Simone
(controllo per ID utente in configurazione); il server avvisa il worker, che
accetta l'invito.

**Effetti manuali giocati dall'AI**: per una carta senza script il worker
chiede a Claude di tradurre il testo in una sequenza di azioni base, che il
motore valida e applica come per un umano.

**Motori intercambiabili**: il worker ha un'interfaccia `decidi(vista, mosse)`
con due implementazioni, `claudeCli` (abbonamento) e `anthropicApi` (chiave
API). Il modello è configurabile (Haiku 5.5 o Sonnet 5.5). Il passaggio
futuro alle API sposta lo stesso worker sul server, senza riscritture.

**Da verificare prima dell'implementazione**: che l'uso di `claude -p` da uno
script personale rientri nei termini d'uso dell'abbonamento in vigore.

### 8.2 Bot di riserva

Un bot a regole fisse nel backend (gioca la carta più forte che si può
permettere, risponde solo se perderebbe la Collisione). Interviene se il
worker non risponde entro 60 secondi, e serve per le partite simulate nei
test.

### 8.3 Privacy

Nello stato inviato a Claude non ci sono username né email: i giocatori sono
"Giocatore A" e "Giocatore B". Va aggiunta all'informativa del sito una riga
sull'uso dell'AI come avversario.

## 9. Dati

**`Match`** (MongoDB): `giocatori` (userId, deckId, ruolo), `seed`,
`versioneRegolamento`, `versioneScript` (hash di `cardScripts.json`),
`esito` (vincitore, condizione di vittoria), `durata`, `round`, `log`
(sequenza di azioni con timestamp), `controAI`. Dal seed e dal log la partita
si rigioca passo per passo.

**Ritenzione**: i log sono dati di gioco legati a un account. Vanno inclusi
nell'export e nella cancellazione GDPR già esistenti e nel task di ritenzione
`tasks/retentionTask.ts`.

## 10. Test

- **Motore**: Jest su ogni regola della sezione 5, con stati costruiti a mano.
- **Partite simulate**: centinaia di partite bot contro bot con mazzi casuali
  e seed fissi. Nessuna deve bloccarsi, superare un numero massimo di round o
  violare un invariante (le 40 carte di ogni giocatore sempre presenti in
  esattamente una zona, Costruttore escluso, TP entro -4 / +4, al massimo 4 Frammenti per colonna).
- **Script**: un test per carta automatizzata ("dato questo stato, giocare X
  produce Y").
- **Socket**: test di integrazione su creazione, invito, azione illegale
  rifiutata, riconnessione.
- **Frontend**: Vitest su `matchStore`; prova manuale su due browser prima di
  ogni rilascio.

## 11. Errori

| Caso | Comportamento |
|---|---|
| Azione illegale dal client | Rifiutata, il server invia di nuovo la vista corretta |
| Worker AI muto oltre 60 s | Subentra il bot di riserva per quella decisione |
| Script di carta in errore | Carta in modalità manuale per il resto della partita, errore nel log |
| Finestra di risposta scaduta | "Passa" automatico |
| Giocatore assente 10 min | Partita in pausa |

## 12. Tappe

1. **Motore e partita 1 contro 1 tra persone**, tutti gli effetti manuali.
2. **Worker AI locale** con `claude -p` e bot di riserva.
3. **Automazione delle carte** a gruppi, partendo dai mazzi starter.
4. *(Fuori da questa spec)* community: matchmaking, persistenza delle partite
   in corso, AI tramite API.

Ogni tappa ha il proprio piano di implementazione.

## 13. Fuori perimetro

Matchmaking, classifiche, spettatori, timer per turno, trascinamento delle
carte, interfaccia per telefono in verticale, persistenza delle partite in
corso al riavvio del server.

## 14. Punti aperti

- Assegnazione degli slot laterali del tabellone ai mazzi di ciascun
  giocatore: da confermare sul regolamento.
- Terminologia del testo carte: il CSV v4 parla di "Molecola" e "Collisione
  Molecolare", il regolamento 6.0 di "Frammento" e "Collisione". Verificare
  quale versione è nel database prima di scrivere gli script.
- Ruolo del Costruttore in partita: il regolamento tecnico strutturato non lo
  descrive. Ricavarlo dal PDF v6 e dagli effetti delle 10 carte Costruttore
  prima del piano della tappa 1.
- Termini d'uso dell'abbonamento per `claude -p` da script (sezione 8.1).
