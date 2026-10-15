# Effetti delle carte

Generato da `npm run effetti:riepilogo` nel backend. Non modificare a mano: una riga sbagliata si corregge nella dichiarazione in `backend/game/effetti/carte/`.

Automatiche: 23 su 120

| ID | Carta | Tipo | Testo stampato | Cosa fa lo script |
|---|---|---|---|---|
| 1 | Nucleo di Basalto | Solido | Questo Frammento non può essere spostato da effetti. | sempre: non può essere spostato da effetti |
| 2 | Faglia Primaria | Solido | Durante la Collisione, quando vengono determinati i danni IT che dovresti subire, puoi distruggere questo Frammento. Se lo fai, riduci quei danni IT fino a 2. | quando sono determinati i danni della Collisione: se stai per subire danni IT: puoi: distruggi questa carta, riduci di 2 i danni IT che subisci in questa Collisione |
| 3 | Residuo Cristallizzato | Solido | Se non subisci danni IT durante la Collisione, questo Frammento non slitta durante il prossimo Slittamento. | manuale, non ancora tradotta |
| 4 | Flusso Ricorrente | Liquido | Alla fine della Collisione, se questo Frammento si trova nel Presente, puoi spostarlo nel Futuro coperto prima dello Slittamento. | manuale, non ancora tradotta |
| 5 | Abisso Termico | Liquido | Quando entra nel Presente, riduci la TP di 1. Se possiede 🔵 durante la Collisione, applica Assorbimento una volta addizionale (max 1). | manuale, non ancora tradotta |
| 6 | Il Mercuriale | Liquido | Una volta per Round, durante la tua Fase Azione, puoi spostare questo Frammento dal Presente al Futuro. | attivabile nel tuo turno di azioni, una volta per Round, se questa carta è nel Presente e c'è posto nel tuo Futuro: sposta questa carta nel Futuro |
| 8 | Sciame Termico | Gas | Quando entra nel Presente: TP +1. | quando entra nel Presente: TP +1 |
| 9 | Soffio di Saturazione | Gas | Se durante la Collisione possiede 🔴 e infligge danni IT ne infligge 1 addizionale. | manuale, non ancora tradotta |
| 11 | Espansione Entropica | Gas | Durante la Collisione, se possiede 🔴, infligge 1 IT addizionale. | manuale, non ancora tradotta |
| 12 | Impulso Ionico | Plasma | Quando entra nel Presente, se la TP è pari o superiore a +1, aumenta di 1 la TP. Poi, alla fine del turno, il suo controllore perde 1 IT. | manuale, non ancora tradotta |
| 13 | Arco di Fusione | Plasma | Quando entra nel Presente: TP +1. Alla fine del Round, se possiede 🔴, pesca 1 carta e subisci 1 danno IT | manuale, non ancora tradotta |
| 15 | Fulmine Residuo | Plasma | Quando entra nel Presente, infligge 1 danno IT al giocatore avversario. Durante la Collisione, questo Frammento ottiene +1 PEP. | quando entra nel Presente: 1 danno IT all'avversario. sempre: durante la Collisione questo Frammento ottiene +1 PEP |
| 17 | Vuoto Reattivo | Materia Oscura | All’inizio della Collisione, se TP uguale a 0, infligge 1 danno IT a entrambi i giocatori. | manuale, non ancora tradotta |
| 18 | Massa Inversa | Materia Oscura | Quando avviene un’Inversione Temporale, distruggi un Frammento nel Presente. | manuale, non ancora tradotta |
| 19 | Shock Termico | Evento | Puoi giocare questa carta solo durante una Collisione. Scegli uno: TP +1 oppure TP -1. | sempre: si gioca solo durante una Collisione. quando si risolve: scegli: TP +1 oppure TP -1 |
| 20 | Pilastro di Contenimento | Solido | Se viene distrutto durante una Collisione, TP -1 all’inizio del prossimo turno.. | quando viene distrutta: se avviene durante la Collisione: all'inizio del prossimo Round «tp giù». «tp giù»: TP -1 |
| 23 | Base di Presidio | Solido | Se non subisci danni IT durante la Collisione, pesca 1 carta. | manuale, non ancora tradotta |
| 24 | Nodo Inamovibile | Solido | Questo Frammento non slitta nel Passato. Se TP maggiore o uguale a +1, perde 1 RP (una volta per Round). | manuale, non ancora tradotta |
| 25 | La Marea Inversa | Liquido | Quando entra nel Presente: TP +1. Se TP maggiore o uguale a +1, puoi spostare questo Frammento nel Passato. | manuale, non ancora tradotta |
| 26 | Corrente di Assestamento | Liquido | Quando entra nel Presente, pesca 1 carta. Poi scarta 1 carta per ridurre di 1 il costo ET del prossimo Frammento che giochi nel Futuro. | manuale, non ancora tradotta |
| 27 | Vortice di Recupero | Liquido | Alla fine della Collisione, puoi riprendere in mano un tuo Frammento dal Passato. | manuale, non ancora tradotta |
| 28 | Fendente Fluido | Liquido | Durante la Collisione, se possiede 🔴, ottiene +1 PEP. | manuale, non ancora tradotta |
| 30 | Espulsione Termica | Gas | Quando entra nel Presente: TP +1. Alla fine della Collisione, distruggilo. | quando entra nel Presente: TP +1. alla fine della Collisione: distruggi questa carta |
| 31 | Compressione Gassosa | Gas | Durante la Collisione, riduci di 1 la RP totale del Presente avversario (una sola volta). | manuale, non ancora tradotta |
| 36 | Scarica a Catena | Plasma | Se infligge danni IT, infligge 1 danno IT anche al suo controllore. | manuale, non ancora tradotta |
| 38 | Plasma Riflesso | Plasma | Se subisci danni IT, infliggi 1 danno IT all'avversario. | manuale, non ancora tradotta |
| 39 | Impulso Elettromagnetico | Plasma | Quando entra nel Presente, puoi distruggerlo. Se lo fai, TP +1 e pesca 1 carta. | manuale, non ancora tradotta |
| 41 | Risonanza del Vuoto | Materia Oscura | Quando TP cambia segno, entrambi i giocatori scartano 1 carta. | manuale, non ancora tradotta |
| 42 | Attrattore Negativo | Materia Oscura | Se entrambi i giocatori hanno subito danni IT in questo round, subiscono entrambi 1 danno IT aggiuntivo. | manuale, non ancora tradotta |
| 46 | Disintegrazione Istantanea | Evento | Distruggi un Frammento nel Presente. | quando si risolve: scegli un Frammento nel Presente, poi distruggi il bersaglio |
| 48 | Strato di Sedimentazione | Solido | Alla fine della Collisione, se non subisci danni IT, TP-1 all’inizio del prossimo Round. | manuale, non ancora tradotta |
| 50 | Blocco Termico | Solido | Finché è nel Presente, la TP non può cambiare di più di 1 per turno. | sempre: la TP non può cambiare di più di 1 per Round |
| 52 | Flusso di Compensazione | Liquido | Ogni volta che avviene un’Inversione Temporale, puoi spostare questo Frammento in un’altra colonna temporale. | manuale, non ancora tradotta |
| 53 | Corrente Riflessa | Liquido | Quando entra nel Presente: TP +1. Alla fine della Collisione se sopravvive, prima dello Slittamento, puoi spostarlo nel Futuro coperto. | manuale, non ancora tradotta |
| 54 | Vortice di Stabilizzazione | Liquido | Ogni volta che uno o più Frammenti acquisiscono/perdono una Proprietà Universale a causa della TP, puoi pescare 1 carta. Se lo fai, scarta 1 carta. | manuale, non ancora tradotta |
| 57 | Furia Termica | Gas | Alla fine della Collisione se possiede 🔴, distruggilo e subisci 1 danno IT. | manuale, non ancora tradotta |
| 58 | Nube Disgregata | Gas | Durante la Collisione, se possiede 🔴, riduci di 1 la RP totale del Presente avversario (una sola volta). | manuale, non ancora tradotta |
| 59 | Nebbia Risonante | Gas | Quando una Inversione Temporale avviene, questo Frammento ottiene +2 PEP fino alla fine del Round. | manuale, non ancora tradotta |
| 63 | Arco di Sovraccarico | Plasma | Quando entra nel Presente: TP +1. Alla fine della Collisione, se possiede 🔴, distruggilo. | manuale, non ancora tradotta |
| 64 | Impulso Critico | Plasma | Se questo Frammento infligge danni IT, distruggilo alla fine della Collisione e pesca 1 carta. | manuale, non ancora tradotta |
| 66 | Vuoto di Bilanciamento | Materia Oscura | Quando una Inversione Temporale avviene, entrambi i giocatori perdono 1 ET nel turno successivo. | manuale, non ancora tradotta |
| 67 | Eco del Punto Zero | Materia Oscura | Quando una Inversione Temporale avviene, scegli: entrambi i giocatori scartano 1 carta oppure entrambi perdono 1 IT. | quando avviene un'Inversione Temporale: scegli: entrambi i giocatori scartano 1 carta oppure entrambi i giocatori perdono 1 IT |
| 74 | Marea di Ridistribuzione | Liquido | Alla fine della Collisione, puoi scambiare la colonna temporale di due tuoi Frammenti (es. una nel Passato e una nel Futuro). | manuale, non ancora tradotta |
| 76 | Mare di Assestamento | Liquido | Quando inneschi un’Inversione Temporale volontaria, puoi scegliere di non pagarne la penalità. | manuale, non ancora tradotta |
| 77 | Flusso di Rivelazione | Liquido | Quando entra nel Presente provenendo dal Futuro, pesca 1 carta. Poi, se la TP è pari a 0, ottiene +2 PEP. | manuale, non ancora tradotta |
| 79 | Vapore di Turbolenza | Gas | Quando un Frammento avversario entra nel Presente, TP +1. | quando un Frammento entra nel Presente: se il Frammento è dell'avversario: TP +1 |
| 89 | Eco di Frattura | Materia Oscura | Quando un Frammento viene distrutto durante la Collisione, puoi spostare un Frammento dal Passato al Presente. | manuale, non ancora tradotta |
| 90 | Stasi Improvvisa | Evento | Durante questo Round, i giocatori non subiscono danni IT dalla Collisione. | manuale, non ancora tradotta |
| 91 | Sfasamento Temporale | Evento | Scegli un Frammento: fino alla fine della Collisione, quel Frammento è considerato nel Futuro. Questa è un’Inversione Temporale. | manuale, non ancora tradotta |
| 92 | Ritorno Anticipato | Evento | Sposta un Frammento dal Futuro al Presente. Questa è un'Inversione Temporale. | manuale, non ancora tradotta |
| 93 | Faglia Temporale | Anomalia | All'inizio di ogni Collisione, se TP diversa da 0, avviene un'Inversione Temporale. Il controllore perde 1 IT. | all'inizio della Collisione: se la TP è diversa da 0: avviene un'Inversione Temporale, perdita di 1 IT per te |
| 103 | Marea di Assorbimento | Liquido | Se TP cambia segno, ottiene +1 RP fino a fine turno. | quando la TP cambia segno: +1 RP fino a fine Round a questa carta |
| 118 | Plasma Speculare | Plasma | Durante la Collisione, se possiede 🔴, puoi causare un’Inversione Temporale. Se lo fai, questo Frammento perde 2 RP. | manuale, non ancora tradotta |
| 119 | Fulmine di Esaurimento | Plasma | Quando viene distrutto pesca 1 carta. | quando viene distrutta: pesca 1 carta per te |
| 124 | Vuoto di Equilibrio | Materia Oscura | All’inizio della Collisione, se la TP è pari o superiore a +2 o pari o inferiore a −2, imposta la TP a 0. Poi entrambi i giocatori perdono 1 IT. | manuale, non ancora tradotta |
| 125 | Stasi Totale | Evento | Per il resto del Round, i cambi di stato dovuti alla TP non si applicano. | manuale, non ancora tradotta |
| 126 | Compressione Reattiva | Evento | Un Frammento ottiene +1 RP e +1 PEP fino alla fine della Collisione. | manuale, non ancora tradotta |
| 127 | Deviazione Temporale | Evento | Annulla gli effetti di una carta o di un’Anomalia fino alla fine del Round. | quando si risolve: scegli un Evento in risposta, una carta scoperta in campo o l'Anomalia, poi annulla il bersaglio: un Evento in risposta non si risolve, una carta in campo o l'Anomalia resta senza effetti fino a fine Round |
| 128 | Zona Entropica | Anomalia | All'inizio di ogni Collisione, TP +1. Il controllore perde 1 IT. | manuale, non ancora tradotta |
| 130 | Instabilità Cronica | Anomalia | Alla fine della Collisione, se controlli il Presente, ottieni +2 ET aggiuntivi nel prossimo Round. | manuale, non ancora tradotta |
| 134 | Lastra di Consolidamento | Solido | Se controlli almeno due Solidi, i tuoi Frammenti nel Presente ottengono +1 RP. | manuale, non ancora tradotta |
| 138 | Monolite di Frenata | Solido | Durante la Collisione, se TP uguale a 0, nessun giocatore può giocare Eventi. | sempre: durante la Collisione, con TP 0, nessun giocatore può giocare Eventi |
| 139 | Ancora di Tempo | Solido | Le Inversioni Temporali (sia spontanee che volontarie) non possono avvenire. Durante la Collisione, previeni il primo danno IT che dovresti subire. | manuale, non ancora tradotta |
| 141 | Corrente di Deriva | Liquido | Alla fine della Collisione, puoi spostare un tuo Frammento dal Passato al Presente. | manuale, non ancora tradotta |
| 145 | Mare di Pianificazione | Liquido | Quando entra nel Presente, puoi scegliere un Frammento nel tuo Futuro e aggiungerlo alla tua mano. Se lo fai, metti un Frammento dalla tua mano nel Futuro coperto. | manuale, non ancora tradotta |
| 150 | Gas di Esaurimento | Gas | Se partecipa alla Collisione, l'avversario perde 1 ET nel Round successivo. | manuale, non ancora tradotta |
| 153 | Espulsione Catastrofica | Gas | Se possiede 🔴 durante la Collisione e non subisci danni IT, infligge 2 danni IT diretti all'avversario. | manuale, non ancora tradotta |
| 156 | Scarica di Sovraesposizione | Plasma | Quando entra nel Presente: TP +1. Alla fine della Collisione, se TP diversa da 0 distruggi questo Frammento. | manuale, non ancora tradotta |
| 160 | Plasma Rifasato | Plasma | Quando una Inversione Temporale avviene, ottiene +1 PEP fino a fine turno. | manuale, non ancora tradotta |
| 162 | Attrattore di Sacrificio | Materia Oscura | Durante la Collisione, puoi distruggere un tuo Frammento. Se lo fai, riduci di 2 il PEP totale avversario. | manuale, non ancora tradotta |
| 165 | Vuoto di Antitesi | Materia Oscura | Durante la Collisione, se TP uguale a 0, nessun giocatore può ottenere bonus PEP o RP dal Passato. | manuale, non ancora tradotta |
| 166 | Massa di Reazione | Materia Oscura | Quando una Inversione Temporale avviene, entrambi i giocatori perdono 1 IT e 1 ET all’inizio del prossimo Round. | manuale, non ancora tradotta |
| 168 | Deviazione di Fase | Evento | Un Frammento scelto non partecipa alla Collisione. | manuale, non ancora tradotta |
| 169 | Rottura Temporanea | Evento | Gioca in qualsiasi momento: aumenta o riduci la TP di 1. | manuale, non ancora tradotta |
| 170 | Compensazione Energetica | Evento | Riduci di 2 il PEP totale avversario. Se la TP è diversa da 0, fino alla fine del turno l’Anomalia attiva non ha effetto. | manuale, non ancora tradotta |
| 171 | Anticipo Violento | Evento | Sposta un Frammento dal Futuro al Presente e infliggi 1 danno IT. Questa è un'Inversione Temporale. | manuale, non ancora tradotta |
| 172 | Riflusso Critico | Evento | Inverti il segno della TP. Questa è un'Inversione Temporale. | manuale, non ancora tradotta |
| 173 | Accumulo Critico | Anomalia | Alla fine della Collisione, se controlli il Presente, ottieni +1 ET all’inizio del prossimo Round. | alla fine della Collisione: se controlli il Presente: nella fase Risorse del prossimo Round «ET in più». «ET in più»: +1 ET per te |
| 175 | Instabilità Crescente | Anomalia | Ogni Inversione Temporale infligge 1 danno IT a entrambi i giocatori. | manuale, non ancora tradotta |
| 180 | Colonna di Coerenza | Solido | La prima volta per turno che TP dovrebbe cambiare segno, annulla quel cambiamento. La TP torna a 0. | manuale, non ancora tradotta |
| 181 | Blocco di Ritenzione | Solido | Quando entra nel Presente, scegli un Frammento: quel Frammento non può essere distrutto durante la prossima Collisione. | manuale, non ancora tradotta |
| 185 | Flusso di Ribilanciamento | Liquido | Se non subisci danni IT durante la Collisione, puoi spostare questo Frammento dal Presente al Futuro invece che nel Passato durante lo Slittamento Temporale. | manuale, non ancora tradotta |
| 190 | Vapore Propulsivo | Gas | Quando entra nel Presente: TP +1. Alla fine della Collisione, se possiede 🔴, distruggilo. | manuale, non ancora tradotta |
| 192 | Nube Pressurizzata | Gas | Quando entra nel Presente: TP +1. Se questo Frammento è entrato nel Presente dal Futuro, pesca 1 carta. | manuale, non ancora tradotta |
| 196 | Nebbia di Esaurimento | Gas | Se viene distrutto durante la Collisione, pesca 1 carta. | manuale, non ancora tradotta |
| 197 | Plasma di Sovraccarico | Plasma | Quando entra nel Presente: TP +1. Durante la Collisione, se possiede 🔴, ottiene +1 PEP e perde 1 RP fino alla fine della Collisione. | manuale, non ancora tradotta |
| 198 | Scarica di Frattura | Plasma | Alla fine della Collisione, puoi distruggere un Frammento nel Presente. Se lo fai perdi 1 IT. | manuale, non ancora tradotta |
| 203 | Vuoto di Probabilità | Materia Oscura | Quando entra nel Presente guarda le prime 2 carte del tuo mazzo: se tra queste c’è un Frammento puoi metterlo nel tuo Futuro e l’altra in fondo al mazzo. (se non ci sono Frammenti metti entrambe le carte in fondo al mazzo) | quando entra nel Presente: guardi le prime 2 carte del tuo mazzo: puoi mettere un Frammento tra queste nel tuo Futuro coperto, le altre vanno in fondo al mazzo |
| 205 | Singolarità di Compressione | Materia Oscura | Alla fine della Collisione, se TP diversa da 0, riduci TP di 1 verso 0 (es. +2→+1, −2→−1). Se TP diventa 0, pesca 1 carta. | manuale, non ancora tradotta |
| 207 | Interruzione Mirata | Evento | Un Frammento a tua scelta nel Presente perde 2 PEP fino alla fine del Round. | manuale, non ancora tradotta |
| 208 | Deviazione di Flusso | Evento | Sposta un tuo Frammento dal Presente al Futuro. | manuale, non ancora tradotta |
| 209 | Rottura di Fase | Evento | Distruggi un Frammento nel Presente con RP minore o uguale a 2. Questa carta causa un’Inversione Temporale. | manuale, non ancora tradotta |
| 210 | Schermo di Compensazione | Evento | Aggiungi +2 alla tua RP totale nel Presente fino alla fine della Collisione. | manuale, non ancora tradotta |
| 211 | Anticipo Calcolato | Evento | Rivela una tua carta coperta nel Futuro e mettila nel Presente. Ottiene +1 PEP fino a fine Round. Questa è una Inversione Temporale. | manuale, non ancora tradotta |
| 213 | Campo di Ritorno | Anomalia | All’inizio di ogni Collisione, se TP maggiore o uguale a +2 o TP minore o uguale a  −2, imposta TP a 0. | manuale, non ancora tradotta |
| 215 | Blocco di Contenimento | Solido | Quando entra nel Presente, riduci la TP di 1. | manuale, non ancora tradotta |
| 218 | Scudo di Tenuta | Solido | Durante la Collisione, se la TP è pari a 0, questo Frammento ottiene +1 RP. | manuale, non ancora tradotta |
| 223 | Flusso di Innesco | Liquido | Quando entra nel Presente, guarda una carta coperta nel Futuro del tuo avversario. La prossima carta che giochi nel Futuro in questo turno costa 1 ET in meno addizionale. | quando entra nel Presente: scegli una carta coperta nel Futuro dell'avversario, poi guardi il bersaglio, la prossima carta che giochi nel Futuro in questo Round costa 1 ET in meno |
| 224 | Vortice di Ripristino | Liquido | Quando entra nel Presente, puoi riprendere in mano un Frammento dal tuo Orizzonte degli Eventi. | manuale, non ancora tradotta |
| 231 | Vapore di Interferenza | Gas | Ogni volta che avviene un’Inversione Temporale, aumenta la TP di 1. | quando avviene un'Inversione Temporale: TP +1 |
| 239 | Tempesta di Collasso | Plasma | Durante la Collisione, se possiede 🔴, riduci la RP totale avversaria della metà (arrotondando per eccesso). Alla fine della Collisione, distruggila. | manuale, non ancora tradotta |
| 243 | Vuoto di Neutralità | Materia Oscura | Durante la Collisione, i Frammenti avversari ignorano le Proprietà Universali acquisite tramite 🔴 o 🔵. | manuale, non ancora tradotta |
| 244 | Massa di Saturazione | Materia Oscura | Ogni volta che avviene un’Inversione Temporale, entrambi i giocatori perdono 1 IT. | manuale, non ancora tradotta |
| 245 | Stasi Minore | Evento | Fino alla fine della Collisione, annulla tutti i bonus  PEP applicati ai Frammenti nel Presente. | manuale, non ancora tradotta |
| 246 | Rottura Controllata | Evento | Distruggi un Frammento nel Presente. Poi innesca un’Inversione Temporale. | manuale, non ancora tradotta |
| 248 | Interferenza | Evento | Scegli un Frammento nel Presente: quel Frammento perde 2 RP. | manuale, non ancora tradotta |
| 250 | Stabilità Forzata | Anomalia | Alla fine della Fase di Slittamento Temporale, imposta immediatamente la TP a 0. All'inizio del prossimo Round, il controllore perde 1 IT. | manuale, non ancora tradotta |
| 251 | Campo di Entropia Finale | Anomalia | Alla fine di ogni Collisione, aumenta la TP di 1 all’inizio del Round successivo. Poi perdi 1 IT. | manuale, non ancora tradotta |
| 252 | Paradosso di Chiusura | Anomalia | Quando avviene un'Inversione Temporale, pesca 1 carta e l'avversario perde 1 IT. | manuale, non ancora tradotta |
| 253 | Nullità Assoluta | Anomalia | Durante la Collisione la TP è considerata pari a 0 e le Inversioni Temporali volontarie non possono essere innescate. I segnalini già presenti sui Frammenti restano attivi. | manuale, non ancora tradotta |
| 254 | Chronos, Custode del Presente | Costruttore | Dopo la Fase di Slittamento, se controlli il Presente, ottieni +1 ET. | manuale, non ancora tradotta |
| 255 | Nyx, Architetta del Futuro | Costruttore | Il primo Frammento che giochi nel Futuro ogni Round slitta immediatamente nel Presente. Alla fine della Collisione, se si trova ancora nel Presente, distruggilo. | quando un giocatore gioca un Frammento: se hai giocato un Frammento nel Futuro: la prima volta per Round: sulla carta appena giocata, sposta il bersaglio nel Presente, alla fine della Collisione «distruggi se resta». «distruggi se resta»: se il bersaglio è ancora nel Presente: distruggi il bersaglio |
| 256 | Vax, Martello Termico | Costruttore | Se controlli almeno un Frammento con 🔴 nel Presente, la prima volta per Collisione che infliggi danno IT, infliggi 1 IT addizionale e perdi 1 IT. | manuale, non ancora tradotta |
| 257 | Ilios, Pilastro di Coerenza | Costruttore | Se controlli almeno un Frammento con 🔵 nel Presente, ogni volta che attivi la Proprietà Universale Assorbimento, infliggi 1 danno IT all'avversario. | manuale, non ancora tradotta |
| 258 | Eris, Distorsione Vivente | Costruttore | La prima Inversione Temporale volontaria che inneschi ogni Round non richiede il pagamento di una penalità. | manuale, non ancora tradotta |
| 259 | Khepri, Ricorsione Fluida | Costruttore | Una volta per Round, puoi sacrificare 1 IT per spostare un tuo Frammento dal Passato al Futuro o viceversa. | attivabile nel tuo turno di azioni, una volta per Round, se esiste un tuo Frammento nel Passato o nel Futuro, con posto nella colonna opposta: scegli un tuo Frammento nel Passato o nel Futuro, con posto nella colonna opposta, poi perdita di 1 IT per te, sposta il bersaglio dal Passato al Futuro o viceversa |
| 260 | Umbra, Voce del Vuoto | Costruttore | La prima volta per Round che avviene un’Inversione Temporale, entrambi i giocatori subiscono 1 danno IT. | manuale, non ancora tradotta |
| 261 | Atlas, Peso del Tempo | Costruttore | Durante la Collisione, se TP è uguale a 0 riduci di 1 i danni IT che subisci. | manuale, non ancora tradotta |
| 262 | Pyros, Punto di Fusione | Costruttore | La prima volta per Round che un Frammento entra nel Presente, aumenta la TP di 1. | manuale, non ancora tradotta |
| 263 | Aion, Punto Zero | Costruttore | Dopo la Fase di Slittamento, se la TP è pari a 0, pesca 1 carta aggiuntiva. | manuale, non ancora tradotta |
