# Registro della tappa 1B (rete e tavolo)

Data della prova: 2026-10-14. Branch `feature/rete-tavolo-1b`, HEAD della prova `efbfbe5`.

## Suite

- `git diff feature/motore-regole-1a -- backend/game/engine`: vuoto.
- Backend: `tsc --noEmit` ok, 24 suite, 248 test verdi.
- Frontend: 17 file, 105 test verdi, `vue-tsc --noEmit` ok, `npm run build` ok.

## Ambiente

- Stack `docker compose` con un override fuori dal repo: Mongo locale `joule_e2e` invece del cluster indicato in `backend/.env`, così nessun dato di prova finisce nel database reale.
- `mongo:latest` (9.0.2) non parte su kernel Linux 6.19 o superiori (SERVER-121912). Per la prova si è usato `mongo:8.2.1`. Il `docker-compose.yml` del repo non è stato cambiato: rinviato.
- 120 carte caricate con `scripts/seedCards.js`. Due utenti di prova creati direttamente nel database locale, con un mazzo valido ciascuno.

## Partite di prova

Due partite intere via script Socket.IO, passando da nginx sulla porta 5174:

- Prima partita: 141 mosse, esito "B vince per collasso", visto uguale da entrambi i giocatori.
- Seconda partita, sul build con le correzioni della review finale: 61 mosse, esito raggiunto.
- Le partite hanno toccato iniziativa, mulligan, carte giocate, finestre di risposta, Scambio, passa del turno e Bonus Controllo.
- Timeout di 20 secondi di una finestra: scattato.
- Rientro dopo la chiusura della scheda: riuscito.
- Token non valido: connessione rifiutata.

Partita a mano su due browser, giocata da Simone: interrotta prima di un esito, per i problemi di gioco elencati sotto.

## Controlli dello Step 3.4 e 3.5

- 287 payload `partita:aggiornamento` controllati uno per uno: nessun `rng`, nessun catalogo (`carte`), nessun `cardId` su 33 carte coperte avversarie, mano avversaria sempre `null`.
- Documento `matches` in Mongo con `log` (141 voci), `seed`, `mazzi` A e B, `carte` (62 voci, una per ogni cardId distinto dei due mazzi, Costruttori compresi), `esito` e `versioneScript`.

## Proxy nginx (Step 4)

- `nginx -t` nel container: sintassi ok.
- `curl "http://localhost:5174/socket.io/?EIO=4&transport=polling"`: 200.
- `/partita`: 200.
- Il client Socket.IO arriva a `websocket` passando da nginx.

## Problemi trovati

| Problema | Decisione |
|---|---|
| Effetti da attivare a mano poco pratici dal pannello manuale | rinviato, altri test di Simone |
| Le Anomalie non si attivano: `usaEffetto` è esposto solo sul Costruttore, anche se il motore lo accetta anche su Anomalia attiva e Frammenti propri scoperti (nota C15 del preflight) | rinviato |
| Manca il Supporto dal Passato al tavolo | rinviato, da verificare se manca nel motore o solo nell'interfaccia |
| Effetti che valgono in Collisione: la finestra per attivarli si apre solo quando la carta viene giocata | rinviato, da verificare contro il regolamento 6.0 e il motore 1A |
| A 1366x850 la mano resta sotto il bordo dello schermo: per vederla bisogna scorrere | rinviato |
| Il bottone "Arrenditi" è piccolo e sta a filo del tavolo | rinviato |
| Healthcheck del container frontend in errore (`wget localhost:80` rifiutato): problema preesistente | rinviato |
| Errore di registrazione del service worker solo nel browser integrato di Claude (`sw.js` risponde 200 via nginx) | nessuna azione |

Corretti in questo branch durante la review finale: errori e connessione persa visibili al tavolo, elenco delle proprie partite aperte, "Annulla invito", resa disponibile per tutta la partita, sezione Conservazione dell'informativa.

Da fare dopo il deploy: `curl https://joulezeropoint.com/socket.io/?EIO=4&transport=polling` deve rispondere 200; Simone rilegge il paragrafo 'Partite online' dell'informativa prima del merge.
