import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Import Virtual Scroller logic and mandatory CSS
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const app = createApp(App)

// Global registration so it's available in App.vue
app.component('RecycleScroller', RecycleScroller)

app.use(createPinia())
app.mount('#app')