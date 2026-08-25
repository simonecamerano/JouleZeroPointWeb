import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import './style.css'
import App from './App.vue'
import router from './router'

window.addEventListener( 'vite:preloadError', () => {
  const reloadKey = 'joule-chunk-reload-attempted'

  if ( sessionStorage.getItem( reloadKey ) === '1' ) return

  sessionStorage.setItem( reloadKey, '1' )
  window.location.reload()
} )

window.addEventListener( 'load', () => {
  sessionStorage.removeItem( 'joule-chunk-reload-attempted' )
} )

// Pulizia una tantum: il banner cookie e' stato rimosso perche' il sito non
// usa cookie e non scrive nulla nel dispositivo di chi non ha effettuato
// l'accesso. La chiave del consenso resta pero' nei browser di chi ha gia'
// visitato il sito, e non deve restarci.
localStorage.removeItem( 'joule_cookie_consent' )

const app = createApp(App)
const pinia = createPinia()
const head = createHead()

app.use(pinia)
app.use(router)
app.use(head)
app.mount('#app')
