import { writable, derived } from 'svelte/store';
import id from '../locales/id.json';
import en from '../locales/en.json';

const translations = {
  id,
  en
};

let defaultLocale = 'id';
if (typeof navigator !== 'undefined' && navigator.language) {
  if (navigator.language.toLowerCase().startsWith('en')) {
    defaultLocale = 'en';
  }
}
const savedLocale = typeof localStorage !== 'undefined' ? localStorage.getItem('pixellab_locale') || defaultLocale : defaultLocale;
export const locale = writable(savedLocale);

locale.subscribe(val => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('pixellab_locale', val);
  }
});

export const t = derived(locale, ($locale) => (key) => {
  let result = translations[$locale];
  const keys = key.split('.');
  
  for (const k of keys) {
    if (result && result.hasOwnProperty(k)) {
      result = result[k];
    } else {
      return key; // Fallback to key string if translation not found
    }
  }
  
  return result;
});
