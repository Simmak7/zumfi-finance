import React, { createContext, useContext, useCallback } from 'react';
import en from './en';
import cs from './cs';
import uk from './uk';

const translations = { en, cs, uk };

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: 'GB' },
  { code: 'cs', name: 'Čeština', flag: 'CZ' },
  { code: 'uk', name: 'Ukrainska', flag: 'UA' },
];

const I18nContext = createContext(null);

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function I18nProvider({ language = 'en', children }) {
  const t = useCallback((key, params) => {
    const lang = translations[language] || translations.en;
    let value = getNestedValue(lang, key);

    // Fallback to English if key not found
    if (value === undefined) {
      value = getNestedValue(translations.en, key);
    }

    // If still not found, return the key
    if (value === undefined) return key;

    // Replace {param} placeholders
    if (params && typeof value === 'string') {
      return value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
    }

    return value;
  }, [language]);

  return (
    <I18nContext.Provider value={{ t, language }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for components outside provider (e.g., LoginPage)
    return {
      t: (key) => {
        const value = getNestedValue(translations.en, key);
        return value !== undefined ? value : key;
      },
      language: 'en',
    };
  }
  return ctx;
}
