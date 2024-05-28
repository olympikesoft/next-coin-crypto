import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export async function getTranslations(namespaces: string[], locale: string) {
  return serverSideTranslations(locale, namespaces);
}
