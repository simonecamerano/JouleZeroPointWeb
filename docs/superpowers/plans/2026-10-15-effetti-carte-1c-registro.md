# Registro della tappa 1C-a (effetti delle carte)

Data della prova: 2026-10-15. Branch `feature/effetti-carte-1c`, HEAD della prova `873b803`, aperto da `feature/rete-tavolo-1b` (`fef860e`).

## Suite

- Backend: 32 suite, 329 test verdi, `tsc --noEmit` ok, `npm run build` ok.
- Frontend: 18 file, 114 test verdi, `vue-tsc --noEmit` ok, `npm run build` ok.
- `docs/effetti-carte.md` rigenerato: "Automatiche: 23 su 120".

## Simulazione

- 100 partite casuali con le carte di prova della 1A: verdi.
- 50 partite casuali con i mazzi pilota (Nyx contro Khepri): nessun blocco, nessuna fuga di informazioni, `manuali` ed `erroriEffetti` vuoti a ogni seed.
- Conteggio a mano sulle stesse 50 partite: 205 attivazioni di effetti, 275 risposte a scelte, effetti di 13 carte visibili nel log. La simulazione esercita davvero gli effetti, non passa a vuoto.

## Ambiente

- Stesso override della 1B: Mongo locale `joule_e2e` con `mongo:8.2.1`.
- Utenti di prova rigenerati con `e2e-seed.js` aggiornato: `e2e_alice` con le carte pilota e Nyx, `e2e_bob` con le stesse al contrario e Khepri.

## Partita via script

Socket.IO passando da nginx sulla porta 5174, entrambi i giocatori su `websocket`:

- 132 mosse, esito "B vince per collasso", visto uguale da entrambi.
- 269 payload controllati: nessun `rng`, nessun catalogo, nessun `cardId` di carte coperte avversarie, mano avversaria sempre nascosta, nessuna `domanda` di una scelta altrui (20 scelte viste).
- Mosse giocate: carte, Scambi, risposte a scelte, effetti attivabili, Bonus Controllo.
- Timeout di una finestra e rientro dopo la chiusura della scheda: riusciti.
- `docker logs joule-backend`: nessuna riga "effetto in errore".

## Verifica visiva a 1366x850

Screenshot: `docs/screenshots/2026-10-15-tavolo-1c-1366x850.jpg`.

- Tavolo largo 1335 px su 1366 (gutter laterali di 0,5rem).
- Mano visibile senza scorrere: bordo inferiore a 825 px su 850. Alla prima misura era a 897: il `padding-top` di 5rem del contenitore della pagina si sommava alla barra di navigazione. Corretto in `873b803`.
- Anteprima al passaggio del mouse: nome, stato, termica, costo, PEP e RP correnti, testo.

## Correzioni dalla review finale

- Vuoto di Probabilità: chiedeva la scelta solo se tra le prime due carte c'era un Frammento, quindi l'avversario lo deduceva, e allo scadere del timer sceglieva il Frammento. Ora chiede sempre, con "Nessuno" come prima opzione e come scelta di default.
- Khepri: il selettore esclude le carte con divieto di spostamento attivo. Con le carte di oggi non cambia nulla: il divieto del Nucleo di Basalto vale solo nel Presente, e Khepri agisce su Passato e Futuro.

## Problemi trovati

| Problema | Decisione |
|---|---|
| L'anteprima, fissa in alto a destra, copre la colonna del log e il badge "Tocca a te" | da valutare con Simone giocando |
| Una carta guardata con un effetto resta riconoscibile solo dal log del giocatore che guarda: nessuna fuga, ma il log non ha un pannello dedicato | rinviato |
| Eventi propri di carte coperte (`distrutta`, `frammentoGiocato`) senza guardia `coperta`: oggi nessuna carta pilota lo innesca | 1C-b |
| Un effetto attivabile nella finestra di Collisione non azzera i passaggi della finestra | 1C-b |
| Gli effetti ritardati di una carta silenziata scattano lo stesso | 1C-b, è una scelta di regolamento |

Dal registro 1B, risolti in questo branch: Scambio impossibile sulle carte non Frammento, Anomalie e Costruttori non attivabili, effetti "a fine turno" e "entra nel Presente" manuali, Supporto del Passato non visibile, mano sotto il bordo a 1366x850, bottone Arrenditi piccolo. Restano: healthcheck del container frontend, immagine Mongo nel `docker-compose.yml`, rilettura di Simone del paragrafo "Partite online" dell'informativa.

## Da fare

- Collaudo a mano di Simone su due browser con le carte pilota, soprattutto Nyx, Khepri, Faglia Primaria, Eco del Punto Zero e Deviazione Temporale.
- Validazione di `docs/effetti-carte.md` a gruppi, prima del piano 1C-b.
