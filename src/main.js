import './app.css'
import App from './App.svelte'
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import "mobile-drag-drop/default.css";

// Polyfill HTML5 drag and drop untuk perangkat sentuh (seperti iPad)
polyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
    holdToDrag: 300 // Tekan 300ms untuk mulai drag (memungkinkan scroll normal)
});

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


