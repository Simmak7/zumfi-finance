// Zumi reaction i18n helper.
//
// Reaction generators are pure JS functions — they don't have access to React
// hooks like `useTranslation`. This module exposes a tiny mutable language
// state so reactions can pick the right language variant without hook
// plumbing. `ZumfiMascot` calls `setZumiLanguage(settings.language)` in a
// useEffect and the module-level variable follows along.

let currentLang = 'en';

export function setZumiLanguage(lang) {
    if (typeof lang === 'string' && lang.length > 0) {
        currentLang = lang;
    }
}

export function getZumiLanguage() {
    return currentLang;
}

/**
 * Return a language-specific string.
 *
 *   text: tr('English version', 'Czech verze')
 *
 * If the current language is Czech (`cs`), returns `cs` (or `en` if `cs` is
 * empty/undefined). Otherwise returns `en`. Easily extensible to more
 * languages later by accepting an object: tr({ en, cs, uk }).
 */
export function tr(en, cs) {
    if (currentLang === 'cs' && cs != null && cs !== '') return cs;
    return en;
}
