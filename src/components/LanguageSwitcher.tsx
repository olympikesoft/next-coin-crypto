import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale } = router;
  const { t } = useTranslation('common');

  const changeLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locale = e.target.value;
    router.push(router.pathname, router.asPath, { locale });
  };

  return (
    <div className="flex justify-center mt-4">
      <select
        onChange={changeLanguage}
        value={locale}
        className="bg-discordAccent text-white p-2 rounded"
      >
        <option value="en">{t('english')}</option>
        <option value="ar">{t('arabic')}</option>
      </select>
    </div>
  );
}

export default LanguageSwitcher;
