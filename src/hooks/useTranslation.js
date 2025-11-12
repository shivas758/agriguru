import { getTranslation } from '../config/translations';

/**
 * Simple translation hook
 * @param {string} language - Language code (en, hi, ta, te, etc.)
 * @returns {function} t - Translation function
 */
export const useTranslation = (language) => {
  const t = (key) => getTranslation(language, key);
  return { t };
};
