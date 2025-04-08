/**
 * @file Internationalization Service
 * @description Service for handling translations and localization
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Internationalization Service
 * Handles language translations and localization
 */
class I18nService {
  constructor() {
    this.translations = {};
    this.defaultLocale = 'en';
    this.supportedLocales = ['en', 'es', 'fr', 'de'];
    this.dateFormatters = {};
    this.numberFormatters = {};
    this.currencyFormatters = {};
  }

  /**
   * Initialize the service by loading all translation files
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.loadAllTranslations();
      this.initializeFormatters();
      logger.info('Internationalization service initialized successfully');
    } catch (error) {
      logger.error('Error initializing internationalization service:', error);
      throw error;
    }
  }

  /**
   * Load translations for all supported locales
   * @returns {Promise<void>}
   */
  async loadAllTranslations() {
    try {
      const loadPromises = this.supportedLocales.map(locale => this.loadTranslation(locale));
      await Promise.all(loadPromises);
    } catch (error) {
      logger.error('Error loading all translations:', error);
      throw error;
    }
  }

  /**
   * Load translations for a specific locale
   * @param {string} locale - Locale code (e.g., 'en', 'es')
   * @returns {Promise<Object>} - Loaded translations
   */
  async loadTranslation(locale) {
    try {
      const filePath = path.join(__dirname, 'locales', `${locale}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const translations = JSON.parse(fileContent);
      
      this.translations[locale] = translations;
      return translations;
    } catch (error) {
      logger.error(`Error loading translations for locale ${locale}:`, error);
      throw error;
    }
  }

  /**
   * Initialize formatters for dates, numbers, and currencies
   */
  initializeFormatters() {
    this.supportedLocales.forEach(locale => {
      // Date formatters
      this.dateFormatters[locale] = {
        short: new Intl.DateTimeFormat(locale, { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }),
        medium: new Intl.DateTimeFormat(locale, { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        long: new Intl.DateTimeFormat(locale, { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          weekday: 'long'
        }),
        time: new Intl.DateTimeFormat(locale, { 
          hour: 'numeric', 
          minute: 'numeric',
          hour12: true
        })
      };
      
      // Number formatters
      this.numberFormatters[locale] = {
        decimal: new Intl.NumberFormat(locale, { 
          style: 'decimal'
        }),
        percent: new Intl.NumberFormat(locale, { 
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 2
        })
      };
      
      // Currency formatters
      this.currencyFormatters[locale] = {
        USD: new Intl.NumberFormat(locale, { 
          style: 'currency', 
          currency: 'USD'
        }),
        EUR: new Intl.NumberFormat(locale, { 
          style: 'currency', 
          currency: 'EUR'
        }),
        GBP: new Intl.NumberFormat(locale, { 
          style: 'currency', 
          currency: 'GBP'
        })
      };
    });
  }

  /**
   * Get a translation by key
   * @param {string} key - Translation key (dot notation supported)
   * @param {string} locale - Locale to use
   * @param {Object} variables - Variables to replace in the translation
   * @returns {string} - Translated text
   */
  translate(key, locale = this.defaultLocale, variables = {}) {
    // Fall back to default locale if the requested one isn't available
    if (!this.translations[locale]) {
      locale = this.defaultLocale;
    }
    
    // Get the translation from the nested object using dot notation
    const translation = key.split('.').reduce((obj, i) => obj && obj[i], this.translations[locale]);
    
    // If translation is not found, return the key and log a warning
    if (!translation) {
      logger.warn(`Translation not found for key: ${key}, locale: ${locale}`);
      return key;
    }
    
    // Replace variables in the translation
    let result = translation;
    Object.entries(variables).forEach(([varName, varValue]) => {
      result = result.replace(new RegExp(`{{${varName}}}`, 'g'), varValue);
    });
    
    return result;
  }

  /**
   * Check if a translation key exists
   * @param {string} key - Translation key
   * @param {string} locale - Locale to check
   * @returns {boolean} - Whether the key exists
   */
  hasTranslation(key, locale = this.defaultLocale) {
    if (!this.translations[locale]) {
      locale = this.defaultLocale;
    }
    
    const translation = key.split('.').reduce((obj, i) => obj && obj[i], this.translations[locale]);
    return !!translation;
  }

  /**
   * Format a date according to locale
   * @param {Date|string|number} date - Date to format
   * @param {string} style - Format style ('short', 'medium', 'long', 'time')
   * @param {string} locale - Locale to use
   * @returns {string} - Formatted date
   */
  formatDate(date, style = 'medium', locale = this.defaultLocale) {
    if (!this.dateFormatters[locale]) {
      locale = this.defaultLocale;
    }
    
    const formatter = this.dateFormatters[locale][style] || this.dateFormatters[locale].medium;
    const dateObj = date instanceof Date ? date : new Date(date);
    
    return formatter.format(dateObj);
  }

  /**
   * Format a number according to locale
   * @param {number} number - Number to format
   * @param {string} style - Format style ('decimal', 'percent')
   * @param {string} locale - Locale to use
   * @returns {string} - Formatted number
   */
  formatNumber(number, style = 'decimal', locale = this.defaultLocale) {
    if (!this.numberFormatters[locale]) {
      locale = this.defaultLocale;
    }
    
    const formatter = this.numberFormatters[locale][style] || this.numberFormatters[locale].decimal;
    return formatter.format(number);
  }

  /**
   * Format a currency amount according to locale
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code (e.g., 'USD', 'EUR')
   * @param {string} locale - Locale to use
   * @returns {string} - Formatted currency amount
   */
  formatCurrency(amount, currency = 'USD', locale = this.defaultLocale) {
    if (!this.currencyFormatters[locale]) {
      locale = this.defaultLocale;
    }
    
    const formatter = this.currencyFormatters[locale][currency] || this.currencyFormatters[locale].USD;
    return formatter.format(amount);
  }

  /**
   * Get available locales
   * @returns {string[]} - List of supported locale codes
   */
  getSupportedLocales() {
    return [...this.supportedLocales];
  }

  /**
   * Set default locale
   * @param {string} locale - Locale code
   */
  setDefaultLocale(locale) {
    if (this.supportedLocales.includes(locale)) {
      this.defaultLocale = locale;
    } else {
      logger.warn(`Attempted to set unsupported locale as default: ${locale}`);
    }
  }

  /**
   * Check if a locale is supported
   * @param {string} locale - Locale code to check
   * @returns {boolean} - Whether the locale is supported
   */
  isLocaleSupported(locale) {
    return this.supportedLocales.includes(locale);
  }

  /**
   * Add a new locale
   * @param {string} locale - Locale code to add
   * @param {Object} translations - Translations for the locale
   */
  addLocale(locale, translations) {
    this.translations[locale] = translations;
    
    if (!this.supportedLocales.includes(locale)) {
      this.supportedLocales.push(locale);
      this.initializeFormatters();
    }
  }

  /**
   * Export translations for client-side use
   * @param {string} locale - Locale to export
   * @returns {Object} - Translations for the locale
   */
  exportTranslationsForClient(locale = this.defaultLocale) {
    if (!this.translations[locale]) {
      locale = this.defaultLocale;
    }
    
    // Create a simplified version for client-side use
    const clientTranslations = {
      locale,
      translations: this.translations[locale]
    };
    
    return clientTranslations;
  }
}

// Create and export a singleton instance
const i18nService = new I18nService();

module.exports = i18nService;