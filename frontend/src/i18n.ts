import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  // load translation using http -> see /public/locales (i.e. https://github.com/i18next/react-i18next/tree/master/example/react/public/locales)
  // learn more: https://github.com/i18next/i18next-http-backend
  // want your translations to be loaded from a professional CDN? => https://github.com/locize/react-tutorial#step-2---use-the-locize-cdn
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languagedetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: 'en',
    debug: true,
    
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    
    // We will use local resources for now to avoid async loading issues during development if backend fails or for simplicity
    // But for production with many languages, backend is better. 
    // For this task, I'll inline resources or use a simple backend setup. 
    // Actually, let's use resources directly in init for simplicity and to avoid public folder issues if not configured.
    // Wait, the plan said "Create translation files (JSON)". 
    // Standard vite way is usually public/locales or importing json.
    // Let's stick to importing json for type safety and bundling if not too large, or public/locales if we want dynamic loading.
    // Given the request, I'll use importing for now to ensure it works without server config issues.
    // Re-writing the file content to use imported resources.
  });

export default i18n;
