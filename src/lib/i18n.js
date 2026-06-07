import { writable, derived } from 'svelte/store';
import id from '../locales/id.json';
import en from '../locales/en.json';

const translations = {
  id,
  en
};

export const locale = writable('id'); // Default language is Indonesian

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
