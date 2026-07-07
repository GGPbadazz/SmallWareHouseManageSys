import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Hide loading screen after app is mounted
app.mount('#app')

// Remove loading screen
setTimeout(() => {
    const loading = document.getElementById('loading')
    if (loading) {
        loading.style.opacity = '0'
        loading.style.transition = 'opacity 0.3s ease'
        setTimeout(() => {
            loading.remove()
        }, 300)
    }
}, 500)
