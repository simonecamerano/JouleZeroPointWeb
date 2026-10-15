# Tappa 1C: effetti delle carte automatici

Data: 2026-10-15. Branch `feature/effetti-carte-1c`, aperto da
`feature/rete-tavolo-1b` (fef860e, non ancora mergiato).

Modifica la spec `2026-10-13-partita-online-design.md`: la sezione 6 (script
in JSON) è sostituita da questa, e l'automazione delle carte passa dalla
tappa 3 alla tappa 1C, prima del worker AI. Regolamento di riferimento: v6.0
(`frontend/public/Regolamento_Joule_Zero_Point_v6.pdf`). Il testo della carta
prevale sul regolamento.

## 1. Perché

Nella prova a mano del 2026-10-14 gli effetti manuali si sono rivelati il
collo di bottiglia: chi gioca deve ricordarsi ogni effetto e applicarlo dal
pannello, alcuni (effetti "a fine turno", Anomalie) non sono applicabili
affatto, e un test di gioco così misura il pannello, non il gioco. Obiettivo
della 1C: **tutte le 120 carte del set attuale automatiche**. Il pannello
manuale resta solo come ripiego quando uno script va in errore.

Criterio di riuscita: due giocatori completano una partita su due browser
senza mai aprire il pannello manuale, e ogni carta giocata fa quello che dice
il suo testo secondo le interpretazioni della sezione 9.

## 2. Approccio: linguaggio dichiarativo in TypeScript

Ogni carta è una dichiarazione breve e tipizzata, nella forma momento,
condizione, effetto:

```ts
carta(12,
  quando('entraPresente', se(tpAlmeno(1)), tp(+1)),
  quando('fineRound', perdiIT('controllore')),
)
```

Scartati: script in JSON (con il 100% di copertura il linguaggio diventa un
mini linguaggio di programmazione senza controllo dei tipi) e un modulo di
codice libero per carta (120 forme diverse, difficili da confrontare con il
testo). Per i casi che il linguaggio non esprime c'è una via di uscita: un
handler scritto a mano, registrato nello stesso registro e con la stessa
descrizione leggibile.

Conseguenza: un ritocco a un effetto richiede un deploy. Costi, PEP e RP
restano sul Google Sheet come oggi.

## 3. Componenti

Nuova cartella `backend/game/effetti/`:

- `dsl.ts`: momenti, condizioni, effetti, scelte, tutti tipizzati. Ogni
  mattone espone anche `descrivi()`, la sua frase in italiano.
- `carte/`: le dichiarazioni, un file per tipo (`solidi.ts`, `liquidi.ts`,
  `gas.ts`, `plasma.ts`, `materiaOscura.ts`, `eventi.ts`, `anomalie.ts`,
  `costruttori.ts`).
- `registro.ts`: mappa `cardId` → dichiarazioni. Un test fallisce se una carta
  del catalogo non ha la sua dichiarazione.
- `dispatcher.ts`: raccoglie gli effetti innescati, li ordina, li esegue.
- `continui.ts`: le interrogazioni del motore ai continui (vedi 4.2).

`backend/game/cardScripts.json` e il campo `versioneScript` del documento
`matches` restano: l'hash si calcola sul registro invece che sul JSON.

## 4. I quattro tipi di effetto

### 4.1 Innescati

Il motore emette un evento nei punti in cui oggi cambia lo stato; il
dispatcher raccoglie le carte attive che ascoltano quell'evento.

Momenti: `entraPresente`, `entraPassato`, `entraFuturo`, `esceDalPresente`,
`distrutta` (con il contesto: in Collisione o da effetto), `frammentoEntra`
(qualunque Frammento, con il controllore come parametro), `inizioRound`
(dopo lo Slittamento, prima delle Risorse), `inizioCollisione` (prima
dell'apertura della finestra di Collisione), `dannoIT` (subito o inflitto,
con l'importo), `fineCollisione` (dopo danni e distruzioni, prima della fase
Fine), `fineRound`, `inversione`, `cambioSegnoTP`, `segnalinoCambiato`,
`immediato` (Eventi).

**Carte attive**: i Frammenti scoperti nel Presente (regola v6: il testo vale
solo nel Presente, salvo che citi un'altra colonna), l'Anomalia attiva, i due
Costruttori, l'Evento in risoluzione. Le dichiarazioni possono indicare una
colonna diversa (`attivaIn: 'passato'`) per i testi che la citano.

**Ordine**: effetti simultanei del giocatore con Iniziativa prima, poi
dell'altro; dentro lo stesso giocatore, nell'ordine di posizione in colonna.
Un effetto che ne innesca altri li accoda in fondo (coda, non ricorsione),
con un limite di 200 passi per evento come guardia contro i cicli.

### 4.2 Continui

Non scattano: il motore li interroga quando calcola un valore o controlla una
mossa. Punti di interrogazione:

- totali della Collisione (PEP, RP, numero di proprietà per stato, riduzione
  e aumento dei danni);
- costo effettivo di una carta;
- legalità di una mossa (giocare Eventi, Inversione volontaria, spostare un
  Frammento, distruggere un Frammento);
- variazione della TP (limiti come Blocco Termico, annullamenti come Colonna
  di Coerenza);
- Slittamento (un Frammento che non slitta);
- segnalini (Stasi Totale, Vuoto di Neutralità).

### 4.3 Attivabili

I "puoi, una volta per Round..." diventano la mossa legale
`attivaEffetto { uid, indice }`, presente in `mosseLegali` solo quando
momento, condizione e contatore lo consentono. Sostituisce `usaEffetto`, che
oggi è esposto solo sul Costruttore.

### 4.4 Ritardati

"Alla fine del turno distruggila", "TP −1 all'inizio del prossimo Round",
"+2 ET nel prossimo Round": l'effetto registra una voce in `s.ritardati`
(`{ momento, cardId, indice, sorgente, controllore, scadenza }`) che scatta al
momento indicato. Le voci dirette a "inizio del prossimo Round" si applicano
dopo lo Slittamento, così non vengono azzerate dal ricalcolo della TP; quelle
sull'ET si applicano nella fase Risorse, dopo la ricarica.

### 4.5 Contatori

"Una volta per Round", "la prima volta per Round", "una sola volta": la
mappa `s.usi` con chiave `uid:indice`, azzerata a fine Round (o a fine
Collisione per i contatori di Collisione).

## 5. Stato e ripresa

Lo stato resta JSON puro (`structuredClone`, salvataggio nel log di partita).
Un effetto sospeso su una scelta si salva in `s.effettiPendenti` come
`{ cardId, indice, passo, sorgente, controllore, contesto, scelte }`; la
risposta del giocatore riprende l'esecuzione dal passo giusto cercando la
dichiarazione nel registro per `cardId`. Nuovi campi di `StatoPartita`:
`effettiPendenti`, `ritardati`, `usi`, `silenziate` (carte con effetto
annullato fino a fine Round), `manuali` (carte in ripiego).

**Ripiego**: se l'esecuzione di un effetto lancia un errore, lo stato torna
a prima di quell'effetto, la carta entra in `manuali` per il resto della
partita, si apre il pannello manuale su quella carta e l'errore va nel log
del server.

## 6. Scelte del giocatore

Nuova decisione `sceltaEffetto`, in tre forme:

- **Sì/No** per i "puoi...";
- **Bersaglio**: il motore calcola i bersagli validi, il tavolo li evidenzia,
  il giocatore ne clicca uno;
- **Opzione** fra testi ("TP +1 oppure TP −1").

Timeout di 20 secondi come le finestre, poi default sicuro: "No" per i
facoltativi, primo bersaglio valido o prima opzione per gli obbligatori.
Senza bersagli validi, un effetto obbligatorio si salta e lo dice il log.
L'avversario vede che è in corso una scelta e di quale carta, non le opzioni
che rivelerebbero carte coperte.

**Informazioni nascoste**: gli effetti che fanno guardare carte (Flusso di
Innesco, Vuoto di Probabilità, Mare di Pianificazione) le mostrano solo a chi
ne ha il diritto, tramite `soloPer` del log e un campo dedicato della vista.

## 7. Interfaccia del tavolo

- **Clic sulla carta in mano**: la seleziona e basta, poi Gioca o Scambio
  (e la colonna per i Frammenti). Corregge lo Scambio impossibile sulle carte
  non Frammento.
- **Attivabili**: un bottone sulla carta, sul Costruttore o sull'Anomalia,
  solo quando l'effetto è usabile.
- **Scelte**: pannello con Sì/No o le opzioni, bersagli evidenziati sul
  tavolo, conto alla rovescia.
- **Log**: ogni effetto automatico con il nome della carta ("Sciame Termico:
  TP +1").
- **Supporto del Passato**: i bonus PEP e RP del round accanto ai totali.
- **Ingrandimento al passaggio del mouse**: per ogni carta in campo, in mano,
  Costruttori e Anomalia, con nome, PEP e RP correnti (modifiche comprese),
  stato, segnalino e testo. Non per le carte coperte avversarie.
- **Tavolo a tutta larghezza**: il tavolo usa tutto il viewport, le colonne
  si allargano.
- **Dal registro 1B**: la mano visibile senza scorrere a 1366x850, il bottone
  Arrenditi più grande e staccato dal tavolo.
- **Pannello manuale**: compare solo per le carte in `manuali`.

## 8. Validazione e test

- **Riepilogo per Simone**: `npm run effetti:riepilogo` genera
  `docs/effetti-carte.md`, una riga per carta con testo stampato e
  `descrivi()` della dichiarazione. Simone lo valida a gruppi per tipo; una
  riga sbagliata si corregge nella dichiarazione.
- **Un test per carta**: scenario minimo che verifica l'effetto (120 test).
- **Copertura**: test che fallisce se manca una dichiarazione.
- **Simulazioni**: migliaia di partite casuali con effetti automatici e scelte
  casuali, con `verificaInvarianti` dopo ogni mossa; nessun blocco, nessun
  ciclo, nessuna carta in `manuali`.
- **Non-fuga**: il controllo della vista del 1B esteso a scelte, carte
  guardate e bersagli.
- **Collaudo**: partita a mano di Simone su due browser.

## 9. Interpretazioni proposte (da confermare)

Ogni riga: la lettura proposta e il perché. Simone conferma o corregge prima
del piano.

| # | Carte | Testo ambiguo | Lettura proposta | Perché |
|---|---|---|---|---|
| I1 | 12, 50, 103, 160, 170, 223 | "turno" | Vale **Round** ovunque | Il gioco non ha turni separati per giocatore oltre la fase Azioni; "+1 RP fino a fine turno" ha senso solo se arriva alla Collisione |
| I2 | tutte con "Quando entra nel Presente" | quali ingressi contano | Giocata nel Presente, Slittamento, spostamento da effetto, Nyx; **non** l'Inversione | Regolamento v6, sezione Inversione: "non è un movimento" |
| I3 | 9, 11, 15, 28, 31, 58, 197, 218, 239 | "Durante la Collisione" con bonus | Continuo applicato ai totali al confronto PEP contro RP | È l'unico momento in cui PEP e RP contano |
| I4 | 4, 27, 30, 53, 57, 63, 74, 130, 141, 156, 173, 190, 198, 205, 239 | "Alla fine della Collisione" | Dopo danni e distruzioni, solo per le carte ancora nel Presente | Una carta distrutta non è più attiva |
| I5 | 150, 168 | "partecipa alla Collisione" | È nel Presente al momento del confronto | Unica lettura misurabile |
| I6 | 12, 93, 124, 128, 198, 244, 250, 251, 259 | "perde IT" contro "subisce danni IT" | Perdere IT **non** è un danno: non lo riduce il Solido né Atlas né Ancora di Tempo, e non innesca "se subisci danni IT" | Il testo usa due verbi diversi; il regolamento chiama la penalità dell'Inversione "danno" ma le carte no |
| I7 | 3, 23, 48, 153, 185 | "Se non subisci danni IT durante la Collisione" | Conta solo il danno del calcolo di Collisione, Gas compreso | Gli effetti di carta fuori dal calcolo non sono "della Collisione" |
| I8 | 5, 8, 12, 13, 25, 30, 53, 63, 79, 156, 190, 192, 197, 215, 231, 262 | "TP +1" da effetto | Si somma allo spostamento della TP, che si azzera allo Slittamento | Interpretazione 1 della tappa 1A |
| I9 | 41, 103, 180 | "TP cambia segno" | Da positiva a negativa o viceversa, anche passando per 0; lo 0 non ha segno | "Da +1 a 0" non cambia segno, "da +1 a −1" sì |
| I10 | 2 | "riduci quei danni IT fino a 2" | Riduci **di** 2, minimo 0 | "Fino a" come tetto della riduzione |
| I11 | 3, 24, 185 | "non slitta" | Resta nella sua colonna durante lo Slittamento | Lettura letterale |
| I12 | 18, 46, 246 | "distruggi un Frammento nel Presente" | Scelta del controllore tra tutti i Frammenti nel Presente, anche i propri | Il testo non limita |
| I13 | 91 | "considerato nel Futuro" | Resta nel Presente ma esce da totali, proprietà e Collasso fino a fine Collisione | Simula l'assenza senza spostarlo |
| I14 | 127 | "Annulla gli effetti di una carta o di un'Anomalia" | Bersaglio: un Evento in risoluzione (annullato) oppure una carta in campo o l'Anomalia (senza effetti fino a fine Round) | Copre entrambe le letture del testo |
| I15 | 93, 128, 250, 251 | "il controllore perde 1 IT" sulle Anomalie | Ogni volta che l'effetto dell'Anomalia scatta | Il costo accompagna l'effetto |
| I16 | 20, 48, 251 | "all'inizio del prossimo turno/Round" | Dopo lo Slittamento del Round successivo | Altrimenti lo Slittamento azzererebbe la variazione |
| I17 | 66, 130, 150, 166, 173 | ET "nel prossimo Round" | Applicata nella fase Risorse dopo la ricarica | Altrimenti la ricarica la cancellerebbe |
| I18 | 26 | "Poi scarta 1 carta per ridurre..." | Facoltativo (Sì/No) | Lo scarto è il prezzo di un vantaggio |
| I19 | 5, 54, 257 | "Proprietà Universale", "Assorbimento" | Le proprietà degli stati in Collisione; Assorbimento è quella del Solido; 5 aggiunge una riduzione oltre il massimo di 2 | Terminologia del regolamento v6 |
| I20 | 54 | "acquisiscono/perdono a causa della TP" | Quando i segnalini vengono assegnati o rimossi | Unico modo in cui la TP cambia le proprietà |
| I21 | 165 | "bonus PEP o RP dal Passato" | Il Supporto Istantaneo del round non vale in Collisione | Unico bonus dal Passato del v6 |
| I22 | 253 | "TP considerata pari a 0" | In Collisione le condizioni su TP leggono 0; i segnalini restano | Il testo lo dice per i segnalini |
| I23 | 139 | Inversioni impossibili e TP a ±4 | La TP resta a ±4 senza Inversione | Il divieto vale anche per le spontanee |
| I24 | 239 | "riduci della metà (per eccesso)" | La riduzione è metà della RP, arrotondata per eccesso | Lettura letterale |
| I25 | 255 (Nyx) | ingresso nel Presente | Pagato al costo del Futuro, entra scoperto e innesca "entra nel Presente"; distrutto a fine Collisione se ancora lì | Il testo dice "slitta immediatamente" |
| I26 | 259 (Khepri) | "sacrificare 1 IT" | Perdita di IT (I6) | Stesso verbo di costo |
| I27 | 19 | "solo durante una Collisione" | Solo nella finestra di Collisione | Unico momento di gioco in Collisione |
| I28 | 17, 93, 124, 128, 213 | più effetti "all'inizio della Collisione" | Ordine di Iniziativa, Anomalia per ultima | L'Anomalia è condivisa, il resto segue la regola v6 |
| I29 | 42 | "hanno subito danni IT in questo round" | Verificato a fine Collisione, una volta per Round | Primo momento in cui la condizione è nota |
| I30 | 31, 58 | "una sola volta" | Una volta per Collisione, anche con più copie in campo | Il testo limita l'effetto, non la carta |

## 10. Divisione del lavoro

Una spec, due piani:

- **1C-a, infrastruttura**: dispatcher, i quattro tipi di effetto, scelte,
  ritardati, contatori, ripiego, riepilogo, tutte le modifiche del tavolo
  della sezione 7, e circa 20 carte pilota scelte per coprire ogni meccanismo
  (fra cui Nyx, Sciame Termico, Faglia Primaria, Disintegrazione Istantanea,
  Shock Termico, Deviazione Temporale, Il Mercuriale, Khepri, Faglia
  Temporale, Blocco Termico, Vuoto di Probabilità). Alla fine si gioca con le
  pilota automatiche e il resto in manuale.
- **1C-b, le altre 100 carte**, a gruppi per tipo, ciascuno con la
  validazione di Simone sul riepilogo.

## 11. Fuori perimetro

Nuove carte o testi riscritti sul Google Sheet, worker AI (tappa 2), il
cambio dell'immagine Mongo nel `docker-compose.yml` e l'healthcheck del
frontend (restano nel registro 1B), interfaccia da telefono.
