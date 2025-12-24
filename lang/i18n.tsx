
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { en } from './en';
import { zh } from './zh';

export type Language = 'en' | 'zh';
const translations = { en, zh };

type TFunction = (path: string, params?: Record<string, any>) => string;

interface I18nContextType {
  t: TFunction;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t: TFunction = useCallback((path, params) => {
    const keys = path.split('.');
    let value: any = translations[language];
    
    for (const key of keys) {
      value = value?.[key];
    }

    if (typeof value !== 'string') return path;

    if (params) {
      return Object.entries(params).reduce((acc, [prevKey, prevValue]) => {
        return acc.replace(new RegExp(`{{${prevKey}}}`, 'g'), String(prevValue));
      }, value);
    }

    return value;
  }, [language]);

  return (
    <I18nContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
};
