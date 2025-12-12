/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { Line } from 'react-chartjs-2';
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
import { formatCurrency } from '../utils/formatCurrency';
import Modal from './Modal';
import { ExchangeRatesResponse } from '../types/apiTypes';

// Register ChartJS components safely
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// DIRECT FETCHER: Defined here to prevent Import/API 500 errors
const fetchDirectly = async (): Promise<ExchangeRatesResponse> => {
  const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=EUR');
  if (!response.ok) throw new Error('Failed to fetch from Coinbase');
  return response.json();
};

const AFFILIATE_LINK = "https://www.coinbase.com/join/YOUR_CODE";

export function ExchangeRates() {
  const { t, ready } = useTranslation('common');
  const { locale } = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  // Use the direct fetcher
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
    // FIX: Ensure null-safety for indexing
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
    plugins: { legend: { display: false } },
    scales: { x: { display: false }, y: { display: true } },
  };

  if (error) return <div className="p-10 text-center text-red-500">Error loading rates. Check console.</div>;
  
  // Render loading state if not ready OR if data is missing
  if (!ready || !data) {
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
        <h1 className="text-2xl font-extrabold text-gray-900">{t('crypto_exchange_rates', 'Crypto Rates')}</h1>
        <input
          type="text"
          placeholder="Search..."
          className="border p-2 rounded-lg w-full md:w-64"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

         {/* ---------------- INSERT THIS BLOCK ---------------- */}
      {/* MOST GROWING CRYPTO BANNER */}
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
             onClick={(e) => handleTradeClick(e, mostGrowingCrypto.key)}
             className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition"
          >
            Trade {mostGrowingCrypto.key}
          </button>
        </div>
      )}
      {/* ---------------- END INSERT BLOCK ---------------- */}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRates.map(([key, value]) => (
          <div
            key={key}
            onClick={() => { setSelectedCrypto(key); setShowModal(true); }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <img 
                  src={`${baseURL}${key.toLowerCase()}.png`} 
                  onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                  className="h-10 w-10" alt={key} 
                />
                <span className="font-bold">{key}</span>
              </div>
              <div className="text-right">
                <div className="font-mono">{formatCurrency(parseFloat(value), locale || 'en-US')}</div>
                <div className={`text-xs font-bold ${ratesChange[key] === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                   {ratesChange[key] === 'up' ? '▲' : '▼'}
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => handleTradeClick(e, key)}
              className="mt-4 w-full text-center text-sm bg-gray-50 hover:bg-discordAccent hover:text-white py-2 rounded transition"
            >
              Trade
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && selectedCrypto && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={`${selectedCrypto} / EUR`}
        >
          <div className="p-2">
             <div className="h-64 w-full">
               <Line data={chartData} options={chartOptions} />
             </div>
             <div className="mt-4 flex gap-2">
               <button onClick={(e) => handleTradeClick(e, selectedCrypto)} className="flex-1 bg-green-600 text-white py-2 rounded-lg">Buy Now</button>
               <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">Close</button>
             </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ExchangeRates;