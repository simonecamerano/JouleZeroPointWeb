<script setup lang="ts">
// Static view for the Terms of Use
</script>

<template>
  <div class="legal-view fade-in">
    <h1 class="glitch-text" data-text="TERMINI DI UTILIZZO">TERMINI DI UTILIZZO</h1>
    <div class="glass-panel legal-content">
      <p class="last-updated">Ultimo aggiornamento: 31 Marzo 2026</p>
      
      <h2>1. Accettazione dei Termini</h2>
      <p>Accedendo e utilizzando la piattaforma "Joule: Zero Point" (di seguito "il Sistema" o "la Matrice"), l'utente (il "Costruttore") accetta di essere vincolato dai presenti Termini di Utilizzo. Se non si accettano questi termini, si prega di disconnettersi immediatamente dal Punto Zero.</p>

      <h2>2. Descrizione del Servizio</h2>
      <p>Joule: Zero Point offre un simulatore di conflitti temporali e un database per la costruzione di mazzi. Il servizio è fornito "as is" (così com'è) senza garanzie esplicite sulla stabilità del server o l'incolumità delle linee temporali salvate.</p>

      <h2>3. Account e Sicurezza</h2>
      <p>L'accesso alla Matrice è riservato esclusivamente a utenti di età pari o superiore ai 18 anni. La soglia è fissata a 18 anni perché il Terminale Punto Zero si appoggia a un fornitore di intelligenza artificiale che richiede la maggiore età per l'utilizzo del proprio servizio. Registrandosi, il Costruttore dichiara di avere almeno 18 anni. L'utente è l'unico responsabile della riservatezza delle proprie credenziali. Qualsiasi tentativo di hacking, iniezione di codice malevolo o furto di frammenti di altri account comporterà la terminazione immediata dell'accesso e il ban permanente.</p>

      <h2>4. Proprietà Intellettuale</h2>
      <p>Tutti i contenuti, i testi, la lore, la grafica, le illustrazioni, i loghi e il codice di Joule: Zero Point sono proprietà esclusiva di Simone Camerano e dei suoi creatori. L'opera originale è regolarmente depositata presso l'ente Patamu con codice identificativo n. 289903. È severamente vietata la copia, la distribuzione o la modifica non autorizzata al di fuori dell'utilizzo previsto dal gioco (es. tornei, Tabletop Simulator).</p>

      <h2>5. Limitazione di Responsabilità</h2>
      <p>Gli sviluppatori di Joule non sono responsabili per eventuali danni diretti, indiretti o "paradossi temporali" derivanti dall'uso del servizio, né per la perdita dei mazzi salvati a causa di manutenzione dei server o aggiornamenti della Matrice.</p>

      <h2>6. Modifiche ai Termini</h2>
      <p>La Direzione si riserva il diritto di modificare questi Termini in qualsiasi momento. L'utilizzo continuato del Sistema in seguito a tali modifiche costituisce l'accettazione formale dei Termini aggiornati.</p>
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
</style>
