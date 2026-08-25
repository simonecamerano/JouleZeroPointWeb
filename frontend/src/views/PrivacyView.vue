<script setup lang="ts">
// Static view for the GDPR Privacy Policy
</script>

<template>
  <div class="legal-view fade-in">
    <h1 class="glitch-text" data-text="PRIVACY POLICY">INFORMATIVA PRIVACY</h1>
    <div class="glass-panel legal-content">
      <p class="last-updated">Ultimo aggiornamento: 24 Agosto 2026</p>

      <div class="controller-info">
        <strong>Titolare del Trattamento:</strong> Simone Camerano, Gradara
        (PU), Italia. <br />
        <strong>Email di Contatto:</strong> info@joulezeropoint.com <br />
        <strong>Responsabile della Protezione dei Dati (DPO):</strong> Non nominato in quanto non obbligatorio ai sensi dell'Art. 37 GDPR.
      </div>

      <h2>1. Origine e Natura dei Dati Raccolti</h2>
      <p>
        Ai fini dell'erogazione dei servizi primari e secondari riguardanti
        Joule: Zero Point, il Sistema raccoglie solo l'essenziale per il
        mantenimento dell'identità del Costruttore: indirizzo e-mail, pseudonimo
        utente (username), password (inequivocabilmente cifrata) e la metrica di
        gioco (mazzi creati, cronologia esportazione in TTS o PDF).
        <strong>Il servizio non è destinato a minori di 18 anni e non raccogliamo
          consapevolmente dati da tali soggetti.</strong> La soglia è fissata a 18
        anni perché il Terminale usa un modello linguistico il cui fornitore
        richiede la maggiore età per l'utilizzo del servizio.
      </p>

      <h2>2. Finalità di Computazione e Trattamento</h2>
      <p>
        L'indirizzo e-mail e la password servono unicamente ad autenticare
        l'accesso all'account: non raccogliamo dati biometrici e non usiamo
        alcuna forma di riconoscimento fisico. Nessun dato è raccolto al di
        fuori di quelli che inserisci tu. Registriamo log di errore limitati al
        solo scopo di individuare i malfunzionamenti.
      </p>
      <p>
        Se usi il <strong>Terminale Punto Zero</strong>, il testo che scrivi e le
        risposte ricevute vengono conservati nel tuo profilo, per dare al
        Terminale il contesto delle domande precedenti, e inviati al fornitore
        del modello linguistico indicato al punto 7. La base giuridica di questo
        trattamento è l'esecuzione del servizio che hai richiesto.
      </p>

      <h2>3. Sicurezza, Cifratura e Archiviazione</h2>
      <p>
        Implementiamo protocolli di sicurezza standard per proteggere le
        comunicazioni verso i nostri nodi cloud. Le credenziali non sono
        visibili in chiaro e tutte le connessioni da e per Joule: Zero Point
        viaggiano crittografate sotto standard HTTPS.
      </p>

      <h2>4. Conservazione Temporale (Retention)</h2>
      <p>
        L'account e i dati associati restano finché l'account esiste, e in ogni
        caso non oltre <strong>24 mesi dall'ultimo accesso</strong>: superato
        quel termine, account, conversazioni del Terminale e mazzi creati
        vengono cancellati automaticamente. Su richiesta di eliminazione
        (Diritto all'Oblio) la cancellazione è immediata e comprende anche le
        conversazioni del Terminale. Alcune
        creazioni originariamente impostate su "Pubbliche", qualora clonate da
        altri giocatori, potrebbero perdere l'ancoraggio al nome utente
        originale ma restare sotto forma algoritmica anonimizzata in base alla
        persistenza del network.
      </p>

      <h2>5. Condivisione e Divieti con Terzi Soggetti</h2>
      <p>
        Il Team di Sviluppo non commercializzerà, scambierà, tantomeno cederà
        segretamente a terze corporazioni i frammenti della tua identità.
        Condivisioni tecniche avvengono unicamente con l'infrastruttura di
        hosting e database sottostante strettamente necessaria a erogare l'app
        in server protetti. Quanto scrivi nel Terminale viene inviato al
        fornitore del modello linguistico così come lo scrivi, insieme al tuo
        pseudonimo: non è anonimizzato, ed è la ragione per cui ti chiediamo di
        non inserirvi dati personali.
      </p>

      <h2>6. I tuoi Diritti da Costruttore (Protocollo GDPR)</h2>
      <p>
        Nel pieno rispetto del GDPR, hai totale accesso ai sensori di controllo.
        Puoi rettificare, richiedere l'estrazione (tramite la funzione <strong>Data Export</strong> nel tuo profilo) e far disintegrare
        definitivamente i tuoi dati attivi dai nostri sistemi direttamente dalla Dashboard o scrivendo al
        reparto Amministrazione.
      </p>

      <h2>7. Nodi di Esecuzione Terzi (Data Processors)</h2>
      <p>
        Per mantenere stabile la Matrice di Joule: Zero Point, ci avvaliamo di
        infrastrutture tecnologiche esterne certificate (Art. 28 GDPR):
      </p>
      <ul class="data-nodes-list">
        <li>
          <strong>Anthropic PBC</strong> (Stati Uniti): modello linguistico del
          Terminale Punto Zero. Riceve il testo che scrivi nel Terminale e il tuo
          pseudonimo. Il trasferimento fuori dall'Unione Europea si regge sulle
          clausole contrattuali standard approvate dalla Commissione Europea
          (Art. 46 GDPR).
        </li>
        <li>
          <strong>Hetzner Online GmbH</strong> (Germania): server che consegna le
          pagine che stai leggendo e fa funzionare l'API del gioco.
        </li>
        <li>
          <strong>MongoDB Atlas</strong> (cluster a Francoforte): database che
          contiene account, mazzi e conversazioni del Terminale. MongoDB, Inc. è
          società statunitense: i dati restano nell'Unione Europea, ed eventuali
          trasferimenti si reggono sulle clausole contrattuali standard.
        </li>
        <li>
          <strong>Cloudinary</strong>: archivio delle immagini delle news.
        </li>
        <li>
          <strong>Brevo (Sendinblue)</strong>: invio delle email di attivazione
          dell'account e dei messaggi inviati dal modulo contatti.
        </li>
        <li>
          <strong>IONOS</strong>: casella di posta del dominio, dove restano
          conservate le email che ci scrivi, comprese quelle del modulo contatti,
          e le eventuali risposte.
        </li>
        <li>
          <strong>Google</strong>: il catalogo delle carte è mantenuto su un
          foglio di calcolo condiviso. Contiene solo dati di gioco, nessun dato
          personale degli utenti.
        </li>
      </ul>

      <h2>8. Intelligenza Artificiale e Trasparenza (EU AI Act)</h2>
      <p>
        In conformità con il Regolamento UE 2024/1689 (AI Act), ti informiamo
        che il <strong>Terminale Punto Zero</strong> è un sistema di intelligenza
        artificiale generativa: quando lo usi stai interagendo con un modello
        linguistico, non con una persona, e questo è indicato nell'interfaccia
        del Terminale stesso. Le interazioni servono all'assistenza di gioco e
        alla narrazione. Le risposte possono contenere errori e non vanno
        considerate informazioni verificate. Nessuna persona legge le tue
        conversazioni per sorvegliarle: sono conservate per dare contesto alle
        risposte successive e sottoposte a controlli automatici contro gli abusi.
        Ti chiediamo comunque di non inserire dati personali nei comandi, perché
        il testo viene inviato al fornitore del modello.
      </p>

      <h2>9. Cookie e memoria locale del browser</h2>
      <p>
        <strong>Joule: Zero Point non usa cookie.</strong> Nessuno: né tecnici,
        né di statistica, né di profilazione o pubblicitari. Se apri il sito e
        non effettui l'accesso, nel tuo dispositivo non viene scritto nulla, e
        per questo non troverai nessun banner di consenso: non c'è niente da
        consentire.
      </p>
      <p>
        Quando invece effettui l'accesso, il sito usa la memoria locale del tuo
        browser per farti restare collegato tra una pagina e l'altra. Vi
        conserva quattro informazioni:
      </p>
      <ul>
        <li><strong>token</strong>: il contrassegno che dimostra al server che sei tu, senza rimandare la password a ogni richiesta.</li>
        <li><strong>username</strong> ed <strong>email</strong>: i dati del tuo profilo, per mostrarli nell'interfaccia senza richiederli di nuovo al server.</li>
        <li><strong>isAdmin</strong>: se il tuo profilo ha funzioni di amministrazione, per decidere quali voci di menu mostrarti.</li>
      </ul>
      <p>
        Sono tutte informazioni strettamente necessarie a fornirti il servizio
        che hai richiesto accedendo, quindi non richiedono un consenso separato.
        Nessuna serve a seguirti, e nessuna viene condivisa con terzi. Puoi
        cancellarle in qualsiasi momento uscendo dal tuo profilo o svuotando i
        dati del sito dalle impostazioni del browser.
      </p>
      <p>
        C'è infine un contrassegno tecnico temporaneo, che dura fino alla
        chiusura della scheda, usato per ricaricare la pagina una sola volta
        quando il sito viene aggiornato mentre lo stai usando. Non contiene
        niente di te.
      </p>
      <p>
        Il sito è inoltre installabile come applicazione e continua a funzionare
        con una connessione instabile. Per riuscirci, già alla prima visita
        salva nella memoria del tuo browser una copia dei propri file: pagine,
        fogli di stile, immagini delle carte e notizie che hai già aperto. È una
        copia del sito, non un dato su di te: non contiene informazioni
        personali, non permette di riconoscerti e non viene trasmessa a nessuno.
        Serve a farlo funzionare e per questo non richiede un consenso, ma puoi
        rimuoverla in ogni momento svuotando i dati del sito dalle impostazioni
        del browser.
      </p>

      <h2>10. Basi Giuridiche del Trattamento (Art. 6 GDPR)</h2>
      <p>
        Il trattamento dei tuoi dati avviene sulla base delle seguenti condizioni:
      </p>
      <ul>
        <li><strong>Esecuzione del Contratto (Art. 6.1.b)</strong>: Per la creazione e gestione dell'account di gioco.</li>
        <li><strong>Legittimo Interesse (Art. 6.1.f)</strong>: Per il monitoraggio dei log di errore e la sicurezza del sistema.</li>
        <li><strong>Consenso dell'Interessato (Art. 6.1.a)</strong>: Per l'utilizzo delle funzionalità basate su Intelligenza Artificiale.</li>
      </ul>

      <h2>11. Trasferimento Dati Extra-UE</h2>
      <p>
        Alcuni fornitori indicati al punto 7 sono società statunitensi: Anthropic,
        che elabora il testo del Terminale, MongoDB, Inc., che gestisce il
        database, e Google, che ospita il foglio con i dati delle carte. Questi
        trasferimenti si reggono sulle <strong>clausole contrattuali standard</strong>
        approvate dalla Commissione Europea (Art. 46 GDPR). Il server che consegna
        il sito e fa funzionare il gioco è in Germania, e il cluster del database
        è a Francoforte: i dati del tuo account restano quindi nell'Unione Europea.
      </p>
    </div>
  </div>
</template>

<style scoped>
.legal-view {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 2rem);
  padding-bottom: clamp(3rem, 6vw, 5rem);
  min-height: calc(100vh - 120px);
  text-align: left;
}
.legal-view h1 {
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  font-family: var(--font-display);
  letter-spacing: clamp(0.18rem, 1vw, 0.5rem);
  background: linear-gradient(135deg, #fff 0%, var(--accent-gold) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: clamp(2rem, 5vw, 3.5rem) !important;
  text-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
  text-align: center;
}
.legal-content {
  padding: clamp(1.5rem, 4vw, 3rem);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: rgba(10, 15, 25, 0.85);
}
.last-updated {
  font-style: italic;
  color: var(--accent-gold);
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(254, 220, 104, 0.2);
  padding-bottom: 1rem;
  margin-bottom: 0.5rem;
}
.legal-content h2 {
  color: var(--text-light);
  font-family: var(--font-display);
  font-size: 1.3rem;
  margin-top: 1rem;
  letter-spacing: 1px;
}
.legal-content p {
  color: var(--text-muted);
  line-height: 1.7;
  font-size: 1rem;
}
.controller-info {
  margin-bottom: 2rem;
  padding: 1rem 1.5rem;
  background: rgba(254, 220, 104, 0.05);
  border-left: 3px solid var(--accent-gold);
  border-radius: 0 4px 4px 0;
  color: var(--text-light);
  line-height: 1.6;
}
.legal-content ul {
  list-style: none;
  padding-left: 0.5rem;
  margin-top: 1rem;
}
.legal-content li {
  color: var(--text-muted);
  margin-bottom: 0.8rem;
  padding-left: 1.5rem;
  position: relative;
}
.legal-content li::before {
  content: "»";
  position: absolute;
  left: 0;
  color: var(--accent-gold);
  font-weight: bold;
}
.legal-content strong {
  color: var(--accent-gold);
  font-weight: 600;
}
</style>
