import { ui, defaultLang } from './ui';

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/');
  if (lang in ui) return lang as keyof typeof ui;
  return defaultLang;
}

export function useTranslations(lang: keyof typeof ui) {
  return function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang][key] || ui[defaultLang][key];
  }
}

export function getRouteFromUrl(url: URL): string | undefined {
  const pathname = new URL(url).pathname;
  const parts = pathname.split('/');
  
  if (parts.length > 1 && parts[1] in ui) {
    // If the first part is a language, return the rest of the path
    return parts.slice(2).join('/') || undefined;
  }
  
  // Otherwise, return the path as is (excluding the leading slash)
  return parts.slice(1).join('/') || undefined;
}

export function getLocalizedUrl(url: URL, lang: string): string {
  const route = getRouteFromUrl(url);
  const base = url.origin;
  
  if (lang === defaultLang) {
    return route ? `${base}/${route}` : `${base}/`;
  }
  
  return route ? `${base}/${lang}/${route}` : `${base}/${lang}/`;
}
