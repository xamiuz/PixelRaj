import './app.css'
import App from './App.svelte'

const app = new App({
  target: document.getElementById('app'),
})

// Unregister service worker in development to prevent caching issues
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

export default app


