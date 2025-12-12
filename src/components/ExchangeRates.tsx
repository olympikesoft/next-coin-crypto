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
  Filler // Added Filler for nicer charts
} from 'chart.js';
import { fetchExchangeRates } from '../lib/api';
import { ExchangeRatesResponse } from '../types/apiTypes';
import { formatCurrency } from '../utils/formatCurrency';
import Modal from './Modal';

// 1. REGISTER CHART COMPONENTS
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// 2. MONETIZATION CONFIGURATION
// Replace this with your actual affiliate link (e.g., Coinbase, Binance, Kraken)
const AFFILIATE_LINK = "https://www.coinbase.com/join/YOUR_CODE";

export function ExchangeRates() {
  const { t, ready } = useTranslation('common');
  const { locale } = useRouter();
  
  // 3. UX: FILTERING STATE
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data, error } = useSWR<ExchangeRatesResponse>('/api/exchange-rates', fetchExchangeRates, {
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

        // Logic to find the top gainer
        if (percentChange > maxGrowth) {
          maxGrowth = percentChange;
          mostGrowing = { key, change: growth, percent: percentChange };
        }

        if (currentRate > previousRate) changes[key] = 'up';
        else if (currentRate < previousRate) changes[key] = 'down';
        else changes[key] = 'same';

        // Update history for charts
        setLastRates((prev) => {
          const history = prev[key] ? [...prev[key]] : [];
          history.push(currentRate);
          if (history.length > 10) history.shift(); // Keep last 10 points for better charts
          return { ...prev, [key]: history };
        });
      });

      setRatesChange(changes);
      setMostGrowingCrypto(mostGrowing);
    }

    if (data) {
      previousData.current = data;
    }
  }, [data]);

  // 4. UX: SEARCH FILTER LOGIC
  const filteredRates = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.data.rates).filter(([key]) => 
      key.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // 5. UX: SKELETON LOADING
  if (!ready || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
         <div className="h-8 w-48 bg-gray-200 rounded mb-6 animate-pulse"></div>
         <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-md shadow-sm animate-pulse"></div>
            ))}
         </div>
      </div>
    );
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      <div className="text-red-500 font-bold mb-2">{t('failed_to_load_data')}</div>
      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
        {t('retry')}
      </button>
    </div>
  );

  const baseURL = '/icons/';

  const handleCryptoClick = (key: string) => {
    setSelectedCrypto(key);
    setShowModal(true);
  };

  const handleTradeClick = (e: React.MouseEvent, key: string) => {
    e.stopPropagation(); // Prevent modal from opening
    window.open(`${AFFILIATE_LINK}?coin=${key}`, '_blank');
  };

  // 6. CHART CONFIGURATION
  const chartData = {
    labels: Array.from({ length: lastRates[selectedCrypto ?? '']?.length || 0 }, (_, i) => i + 1),
    datasets: [
      {
        label: `${selectedCrypto}/EUR`,
        data: lastRates[selectedCrypto ?? ''] || [],
        fill: true, // Fill area under chart
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(75, 192, 192, 0.5)');
          gradient.addColorStop(1, 'rgba(75, 192, 192, 0.0)');
          return gradient;
        },
        borderColor: 'rgba(75,192,192,1)',
        tension: 0.4, // Smooth curves
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: { display: false }, // Hide X axis labels for cleaner look
      y: {
        display: true,
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{t('crypto_exchange_rates')}</h1>
          <p className="text-sm text-gray-500 mt-1">Live updates every 6 seconds</p>
        </div>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder={t('search_crypto') || "Search coins..."}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-discordAccent focus:border-transparent outline-none transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      {/* HIGHLIGHT: MOST GROWING */}
      {mostGrowingCrypto && !searchTerm && (
        <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-100 border border-green-200 rounded-xl p-6 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-32 h-32 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 8.586 15.586 4H12z" clipRule="evenodd"></path></svg>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between">
            <div className="flex items-center mb-4 sm:mb-0">
              <div className="p-3 bg-white rounded-full shadow-md mr-4">
                 <img 
                  src={`${baseURL}${mostGrowingCrypto.key.toLowerCase()}.png`} 
                  onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                  alt={mostGrowingCrypto.key} 
                  className="h-10 w-10"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800 uppercase tracking-wide">{t('top_performer_24h')}</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">{mostGrowingCrypto.key}</h2>
                  <span className="text-green-600 font-bold text-lg">
                    +{formatCurrency(mostGrowingCrypto.change, locale!)} 
                    <span className="text-sm ml-1">({mostGrowingCrypto.percent.toFixed(2)}%)</span>
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => handleTradeClick(e, mostGrowingCrypto!.key)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold shadow-lg transition transform hover:-translate-y-0.5"
            >
              {t('trade_now') || "Trade Now"}
            </button>
          </div>
        </div>
      )}

      {/* GRID LIST */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRates.map(([key, value]) => (
          <div
            key={key}
            onClick={() => handleCryptoClick(key)}
            className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 transition duration-200 cursor-pointer overflow-hidden flex flex-col"
          >
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src={`${baseURL}${key.toLowerCase()}.png`} 
                  onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                  alt={key} 
                  className="h-10 w-10 rounded-full bg-gray-50 p-1"
                />
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">{key}</h3>
                  <span className="text-xs text-gray-500">Euro Market</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-mono font-medium text-gray-900">
                  {formatCurrency(parseFloat(value), locale!)}
                </p>
                <div className={`text-xs font-bold flex items-center justify-end ${
                  ratesChange[key] === 'up' ? 'text-green-500' : 
                  ratesChange[key] === 'down' ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {ratesChange[key] === 'up' && (
                    <><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg> Up</>
                  )}
                  {ratesChange[key] === 'down' && (
                     <><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg> Down</>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION BAR (Appears on Hover/Always visible on mobile) */}
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex justify-between items-center mt-auto">
              <span className="text-xs text-gray-400 font-medium">View Chart</span>
              <button 
                onClick={(e) => handleTradeClick(e, key)}
                className="text-sm bg-white border border-gray-300 hover:border-discordAccent hover:text-discordAccent text-gray-700 px-3 py-1 rounded-md font-medium transition shadow-sm"
              >
                Trade
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* EMPTY STATE */}
      {filteredRates.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No cryptocurrencies found matching "{searchTerm}"</p>
        </div>
      )}

      {showModal && selectedCrypto && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={`${selectedCrypto} / EUR`} // <--- Keep this as a simple string
        >
          {/* Add the header visuals here inside the body instead */}
          <div className="flex items-center gap-3 mb-4 border-b pb-4">
             <img 
                src={`${baseURL}${selectedCrypto.toLowerCase()}.png`} 
                onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                className="h-10 w-10"
                alt=""
              />
             <span className="text-xl font-bold">{selectedCrypto} Market Data</span>
          </div>

          <div className="p-1">
            <div className="h-64 w-full">
              <Line data={chartData} options={chartOptions} />
            </div>
            
            <div className="mt-6 flex gap-3">
               <button 
                 onClick={(e) => handleTradeClick(e, selectedCrypto)}
                 className="flex-1 bg-discordAccent hover:bg-opacity-90 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition"
               >
                 Buy {selectedCrypto}
               </button>
               <button 
                 onClick={() => setShowModal(false)}
                 className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-lg transition"
               >
                 Close
               </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ExchangeRates;