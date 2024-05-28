// pages/index.tsx
import { GetServerSideProps, InferGetServerSidePropsType, NextPageWithLayout } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ExchangeRates from '../components/ExchangeRates';

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  const translationProps = await serverSideTranslations(locale!, ['common']);
  return {
    props: {
      ...translationProps,
    },
  };
};

type PageProps = InferGetServerSidePropsType<typeof getServerSideProps>;

const Home: NextPageWithLayout<PageProps> = () => {
  return <ExchangeRates />;
};

Home.layout = 'default';

export default Home;
