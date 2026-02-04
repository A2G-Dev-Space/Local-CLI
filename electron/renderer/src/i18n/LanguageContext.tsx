/**
 * Language Context - provides i18n to all components.
 * Persisted via electronAPI.config (key: 'language').
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import translations, { type Language } from './translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'ko',
  setLanguage: () => {},
  t: (key) => key,
});

export const useTranslation = () => useContext(LanguageContext);

interface LanguageProviderProps {
  initialLanguage?: Language;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ initialLanguage = 'ko', children }) => {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // Load saved language from config
  useEffect(() => {
    (async () => {
      try {
        const config = await window.electronAPI?.config?.getAll();
        const configAny = config as unknown as Record<string, unknown>;
        if (configAny?.language && (configAny.language === 'ko' || configAny.language === 'en')) {
          setLanguageState(configAny.language as Language);
        }
      } catch {
        // Use default
      }
    })();
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    window.electronAPI?.config?.set('language', lang).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let str = translations[language]?.[key] ?? translations['en']?.[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          str = str.replace(`{${k}}`, String(v));
        });
      }
      return str;
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
