// pages/_app.tsx
import { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { appWithTranslation } from 'next-i18next';

config.autoAddCss = false;

function App({ Component, pageProps }: AppProps) {
  const { locale } = useRouter();

  useEffect(() => {
    document.documentElement.lang = locale!;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  return (
    <>
      <Head>
        <title>Crypto Exchange</title>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
        <meta name="description" content="Your Exchange Rates" key="desc" />
      </Head>
      <main>
        <Component {...pageProps} />
      </main>
    </>
  );
}

export default appWithTranslation(App);
