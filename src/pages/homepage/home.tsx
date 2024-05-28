import dynamic from 'next/dynamic';
import Layout from '@/layouts/Layout';

const ExchangeRates = dynamic(() => import('@/components/ExchangeRates'), { ssr: false });
const LanguageSwitcher = dynamic(() => import('@/components/LanguageSwitcher'), { ssr: false });

const Homepage: React.FC = () => {
  return (
    <Layout>
      <LanguageSwitcher />
      <ExchangeRates />
    </Layout>
  );
};

export default Homepage;
