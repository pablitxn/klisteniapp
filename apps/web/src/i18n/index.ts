import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enCore from './locales/en/core.json'
import enBody from './locales/en/body.json'
import enYoga from './locales/en/yoga.json'
import enCoreInstance from './locales/en/core-instance.json'
import enAccount from './locales/en/account.json'
import enHealth from './locales/en/health.json'
import enHealthInstance from './locales/en/health-instance.json'
import enSettings from './locales/en/settings.json'
import enForms from './locales/en/forms.json'
import enFormsInstance from './locales/en/forms-instance.json'
import frCore from './locales/fr/core.json'
import frBody from './locales/fr/body.json'
import frYoga from './locales/fr/yoga.json'
import frCoreInstance from './locales/fr/core-instance.json'
import frAccount from './locales/fr/account.json'
import frHealth from './locales/fr/health.json'
import frHealthInstance from './locales/fr/health-instance.json'
import frSettings from './locales/fr/settings.json'
import frForms from './locales/fr/forms.json'
import frFormsInstance from './locales/fr/forms-instance.json'
import { loadDisplayPreferences } from './preferences'

// Spanish UI text is the lookup key and the fallback, keeping missing keys readable.
// Static instance checks let demo builds remove account-only resource imports.
void i18n.use(initReactI18next).init({
  initAsync: false,
  lng: loadDisplayPreferences().language,
  fallbackLng: 'es',
  supportedLngs: ['es', 'en', 'fr'],
  ns: ['core', 'account', 'health', 'settings', 'forms', 'body', 'yoga'],
  defaultNS: 'core',
  keySeparator: false,
  nsSeparator: false,
  returnNull: false,
  interpolation: { escapeValue: false },
  resources: {
    es: { core: {}, account: {}, health: {}, settings: {}, forms: {}, body: {}, yoga: {} },
    en: {
      core: { ...enCore, ...(import.meta.env.VITE_APP_MODE === 'instance' ? enCoreInstance : {}) },
      account: import.meta.env.VITE_APP_MODE === 'instance' ? enAccount : {},
      health: { ...enHealth, ...(import.meta.env.VITE_APP_MODE === 'instance' ? enHealthInstance : {}) },
      settings: enSettings,
      body: enBody,
      yoga: enYoga,
      forms: { ...enForms, ...(import.meta.env.VITE_APP_MODE === 'instance' ? enFormsInstance : {}) },
    },
    fr: {
      core: { ...frCore, ...(import.meta.env.VITE_APP_MODE === 'instance' ? frCoreInstance : {}) },
      account: import.meta.env.VITE_APP_MODE === 'instance' ? frAccount : {},
      health: { ...frHealth, ...(import.meta.env.VITE_APP_MODE === 'instance' ? frHealthInstance : {}) },
      settings: frSettings,
      body: frBody,
      yoga: frYoga,
      forms: { ...frForms, ...(import.meta.env.VITE_APP_MODE === 'instance' ? frFormsInstance : {}) },
    },
  },
})

export default i18n
