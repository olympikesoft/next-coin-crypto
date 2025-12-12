/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic'; // 1. Import Dynamic
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// 2. DYNAMIC IMPORT FOR CHART
// This prevents "Window is not defined" 500 Errors
const Line = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-50 animate-pulse rounded-md" />
});

// 3. REGISTER CHART (Only on Client)
if (typeof window !== 'undefined') {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
}

// --- CONFIGURATION ---
const AFFILIATE_LINK = "https://www.coinbase.com/join"; 

// --- TYPES ---
interface ExchangeRatesResponse {
  data: { currency: string; rates: { [key: string]: string } };
}

// --- HELPER: FORMAT CURRENCY ---
const safeFormatCurrency = (amount: number, locale: string = 'en-US') => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
  } catch (e) {
    return `€${amount.toFixed(2)}`;
  }
};

// --- HELPER: FETCHER ---
const fetchDirectly = async (): Promise<ExchangeRatesResponse> => {
  const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=EUR');
  if (!response.ok) throw new Error('Failed to fetch from Coinbase');
  return response.json();
};

// --- SUB-COMPONENT: MODAL ---
const SimpleModal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="text-lg font-bold text-gray-800">{title}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export function ExchangeRates() {
  // Safe translation fallback
  const { t, ready } = useTranslation('common');
  const safeT = t || ((key: string, fallback?: string) => fallback || key);
  
  const { locale } = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, error } = useSWR<ExchangeRatesResponse>('coinbase-rates', fetchDirectly, {
    refreshInterval: 6000,
    revalidateOnFocus: false
  });

  const previousData = useRef<ExchangeRatesResponse | null>(null);
  const [ratesChange, setRatesChange] = useState<{ [key: string]: 'up' | 'down' | 'same' }>({});
  const [mostGrowingCrypto, setMostGrowingCrypto] = useState<{ key: string, change: number, percent: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [lastRates, setLastRates] = useState<{ [key: string]: number[] }>({});

  useEffect(() => {
    if (data && previousData.current) {
      const changes: { [key: string]: 'up' | 'down' | 'same' } = {};
      let maxGrowth = -Infinity;
      let mostGrowing = null;

      Object.keys(data.data.rates).forEach((key) => {
        const previousRate = parseFloat(previousData.current!.data.rates[key] || '0');
        const currentRate = parseFloat(data.data.rates[key]);
        const growth = currentRate - previousRate;
        const percentChange = previousRate !== 0 ? (growth / previousRate) * 100 : 0;

        if (percentChange > maxGrowth) {
          maxGrowth = percentChange;
          mostGrowing = { key, change: growth, percent: percentChange };
        }

        if (currentRate > previousRate) changes[key] = 'up';
        else if (currentRate < previousRate) changes[key] = 'down';
        else changes[key] = 'same';

        setLastRates((prev) => {
          const history = prev[key] ? [...prev[key]] : [];
          history.push(currentRate);
          if (history.length > 10) history.shift();
          return { ...prev, [key]: history };
        });
      });

      setRatesChange(changes);
      setMostGrowingCrypto(mostGrowing);
    }

    if (data) previousData.current = data;
  }, [data]);

  const filteredRates = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.data.rates).filter(([key]) => 
      key.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const baseURL = '/icons/';

  const handleTradeClick = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    window.open(`${AFFILIATE_LINK}?coin=${key}`, '_blank');
  };

  const chartData = {
    labels: Array.from({ length: lastRates[selectedCrypto ?? '']?.length || 0 }, (_, i) => i + 1),
    datasets: [
      {
        label: `${selectedCrypto}/EUR`,
        data: lastRates[selectedCrypto ?? ''] || [],
        fill: true,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75,192,192,1)',
        tension: 0.4,
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { display: false }, y: { display: true } },
  };

  // ERROR STATE
  if (error) return (
    <div className="p-10 text-center text-red-500 bg-red-50 rounded-lg border border-red-200">
      <p className="font-bold">Unable to load exchange rates.</p>
    </div>
  );
  
  // LOADING STATE
  if ((!ready && !data) || (!data)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
         <div className="h-8 w-48 bg-gray-200 rounded mb-6"></div>
         <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-md"></div>)}
         </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl font-extrabold text-gray-900">{safeT('crypto_exchange_rates', 'Crypto Rates')}</h1>
        <input
          type="text"
          placeholder="Search..."
          className="border border-gray-300 p-2 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Top Performer Banner */}
      {mostGrowingCrypto && !searchTerm && (
        <div className="mb-8 bg-green-50 border border-green-200 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between shadow-sm">
          <div className="flex items-center mb-4 sm:mb-0">
             <div className="bg-white p-2 rounded-full shadow-sm mr-4">
               <img 
                  src={`${baseURL}${mostGrowingCrypto.key.toLowerCase()}.png`} 
                  onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                  className="h-12 w-12" 
                  alt={mostGrowingCrypto.key} 
                />
             </div>
             <div>
               <p className="text-xs font-bold text-green-800 uppercase tracking-wider">Top Performer (24h)</p>
               <div className="flex items-baseline gap-2">
                 <h2 className="text-2xl font-bold text-gray-900">{mostGrowingCrypto.key}</h2>
                 <span className="text-green-600 font-bold text-lg">
                   +{mostGrowingCrypto.percent.toFixed(2)}%
                 </span>
               </div>
             </div>
          </div>
          <button 
             onClick={(e) => handleTradeClick(e, mostGrowingCrypto?.key || '')}
             className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition"
          >
            Trade {mostGrowingCrypto.key}
          </button>
        </div>
      )}

      {/* Rates Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRates.map(([key, value]) => (
          <div
            key={key}
            onClick={() => { setSelectedCrypto(key); setShowModal(true); }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <img 
                  src={`${baseURL}${key.toLowerCase()}.png`} 
                  onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                  className="h-10 w-10 rounded-full bg-gray-50" 
                  alt={key} 
                />
                <span className="font-bold text-gray-800">{key}</span>
              </div>
              <div className="text-right">
                <div className="font-mono font-medium">{safeFormatCurrency(parseFloat(value), locale || 'en-US')}</div>
                <div className={`text-xs font-bold ${ratesChange[key] === 'up' ? 'text-green-500' : ratesChange[key] === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
                   {ratesChange[key] === 'up' ? '▲' : ratesChange[key] === 'down' ? '▼' : '-'}
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => handleTradeClick(e, key)}
              className="mt-4 w-full text-center text-sm bg-gray-50 hover:bg-blue-600 hover:text-white py-2 rounded transition font-semibold"
            >
              Trade
            </button>
          </div>
        ))}
      </div>

      {/* Chart Modal */}
      {showModal && selectedCrypto && (
        <SimpleModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={
            <div className="flex items-center gap-2">
               <img src={`${baseURL}${selectedCrypto.toLowerCase()}.png`} onError={(e) => e.currentTarget.src = `${baseURL}generic.png`} className="h-6 w-6"/>
               <span>{selectedCrypto} / EUR</span>
            </div>
          }
        >
          <div className="h-64 w-full bg-white relative">
             <Line data={chartData} options={chartOptions} />
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={(e) => handleTradeClick(e, selectedCrypto)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition">
              Buy {selectedCrypto}
            </button>
            <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-lg transition">
              Close
            </button>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}

export default ExchangeRates;