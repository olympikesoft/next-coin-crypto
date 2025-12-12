/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScriptableContext
} from 'chart.js';

// --- DYNAMIC IMPORT FOR CHART (Prevents 500 Error) ---
const Line = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-800 animate-pulse rounded-md" />
});

// --- REGISTER CHART (Client Side Only) ---
if (typeof window !== 'undefined') {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
}

// --- CONFIG ---
const AFFILIATE_LINK = "https://www.coinbase.com/join"; 

// --- TYPES ---
interface ExchangeRatesResponse {
  data: { 
    currency: string; 
    rates: { [key: string]: string };
  };
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
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};

// --- SUB-COMPONENT: DARK MODAL ---
const DarkModal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-sm transition-opacity">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <div className="text-xl font-bold text-white">{title}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition bg-gray-800 p-2 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 text-white">{children}</div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export function ExchangeRates() {
  const { t, ready } = useTranslation('common');
  const safeT = t || ((key: string, fallback?: string) => fallback || key);
  const { locale } = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, error } = useSWR<ExchangeRatesResponse>('coinbase-rates', fetchDirectly, {
    refreshInterval: 6000,
    revalidateOnFocus: false
  });

  // FIX 1: Typed useRef explicitly to avoid "Unexpected any"
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
        // Ensure strictly string access to avoid TS issues
        const prevRates = previousData.current?.data.rates || {};
        const previousRate = parseFloat(prevRates[key] || '0');
        const currentRate = parseFloat(data.data.rates[key]);
        const growth = currentRate - previousRate;
        const percentChange = previousRate !== 0 ? (growth / previousRate) * 100 : 0;

        if (percentChange > maxGrowth && currentRate > 0.01) { // Filter out dust
          maxGrowth = percentChange;
          mostGrowing = { key, change: growth, percent: percentChange };
        }

        if (currentRate > previousRate) changes[key] = 'up';
        else if (currentRate < previousRate) changes[key] = 'down';
        else changes[key] = 'same';

        setLastRates((prev) => {
          const history = prev[key] ? [...prev[key]] : [];
          history.push(currentRate);
          if (history.length > 15) history.shift();
          return { ...prev, [key]: history };
        });
      });

      setRatesChange(changes);
      if (mostGrowing) setMostGrowingCrypto(mostGrowing);
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

  // Chart Configuration (Dark Mode)
  const chartData = {
    labels: Array.from({ length: lastRates[selectedCrypto ?? '']?.length || 0 }, (_, i) => i + 1),
    datasets: [
      {
        label: `${selectedCrypto}/EUR`,
        data: lastRates[selectedCrypto ?? ''] || [],
        fill: true,
        // FIX 2: Typed context correctly to avoid "Unexpected any"
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)'); // Green
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          return gradient;
        },
        borderColor: '#10B981',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { 
      x: { display: false }, 
      y: { 
        display: true, 
        grid: { color: '#374151' }, // Dark grid lines
        ticks: { color: '#9CA3AF' } // Gray text
      } 
    },
  };

  // FIX 3: Handled 'error' state to satisfy "assigned but never used"
  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center p-6 bg-gray-900 rounded-xl border border-red-900">
           <h2 className="text-xl font-bold text-red-500 mb-2">Connection Error</h2>
           <p className="text-gray-400">Failed to load live exchange rates.</p>
           <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm">Retry</button>
        </div>
      </div>
    );
  }

  // LOADING SKELETON
  if ((!ready && !data) || (!data)) {
    return (
      <div className="min-h-screen bg-black max-w-7xl mx-auto px-4 py-8">
         <div className="h-12 w-64 bg-gray-800 rounded mb-8 animate-pulse"></div>
         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(9)].map((_, i) => <div key={i} className="h-32 bg-gray-800 rounded-xl animate-pulse"></div>)}
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-green-500 selection:text-black pb-20">
      
      {/* 1. STICKY GLASS HEADER */}
      <div className="sticky top-0 z-40 backdrop-blur-md bg-black/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Logo/Icon Placeholder */}
            <div className="w-8 h-8 bg-gradient-to-tr from-green-400 to-blue-500 rounded-full"></div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Crypto<span className="text-green-400">Market</span>
            </h1>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 group-focus-within:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <input
              type="text"
              placeholder={safeT('search_crypto', 'Search Coin...')}
              className="bg-gray-900 border border-gray-700 text-white sm:text-sm rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent block w-48 md:w-64 pl-10 p-2.5 transition-all outline-none hover:bg-gray-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* 2. HERO BANNER (Top Performer) */}
        {mostGrowingCrypto && !searchTerm && (
          <div className="mb-10 relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 shadow-2xl group">
             {/* Glowing effect behind */}
             <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-green-500 opacity-20 blur-[100px] rounded-full group-hover:opacity-30 transition duration-500"></div>
             
             <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                   <div className="relative">
                     <div className="absolute inset-0 bg-green-400 blur-md opacity-40 rounded-full"></div>
                     <img 
                        src={`${baseURL}${mostGrowingCrypto.key.toLowerCase()}.png`} 
                        onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                        className="relative h-16 w-16 rounded-full border-2 border-gray-700 bg-gray-800 p-1" 
                        alt={mostGrowingCrypto.key} 
                      />
                   </div>
                   <div className="text-center sm:text-left">
                     <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900 text-green-300 border border-green-700 uppercase tracking-wide">Top Gainer 24h</span>
                     </div>
                     <h2 className="text-3xl font-extrabold text-white mt-1">{mostGrowingCrypto.key}</h2>
                     <p className="text-green-400 font-mono text-lg font-bold flex items-center gap-1">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                       +{mostGrowingCrypto.percent.toFixed(2)}%
                     </p>
                   </div>
                </div>
                <button 
                   onClick={(e) => handleTradeClick(e, mostGrowingCrypto?.key || '')}
                   className="w-full sm:w-auto px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-900/50 transition-all transform hover:-translate-y-1 hover:shadow-green-500/30"
                >
                  Trade {mostGrowingCrypto.key} Now
                </button>
             </div>
          </div>
        )}

        {/* 3. RATES GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredRates.map(([key, value]) => (
            <div
              key={key}
              onClick={() => { setSelectedCrypto(key); setShowModal(true); }}
              className="group bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:bg-gray-800 relative overflow-hidden"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={`${baseURL}${key.toLowerCase()}.png`} 
                    onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                    className="h-10 w-10 rounded-full bg-gray-800 p-1 border border-gray-700" 
                    alt={key} 
                  />
                  <div>
                    <h3 className="font-bold text-white text-lg leading-none">{key}</h3>
                    <span className="text-xs text-gray-500 font-medium">EUR</span>
                  </div>
                </div>
                {/* Sparkline / Change Indicator */}
                <div className={`text-sm font-bold flex items-center px-2 py-1 rounded-md ${
                  ratesChange[key] === 'up' ? 'bg-green-900/30 text-green-400' : 
                  ratesChange[key] === 'down' ? 'bg-red-900/30 text-red-400' : 'text-gray-500'
                }`}>
                   {ratesChange[key] === 'up' && '▲'}
                   {ratesChange[key] === 'down' && '▼'}
                   {ratesChange[key] === 'same' && '-'}
                </div>
              </div>

              {/* Price Area */}
              <div className="mb-4">
                <div className="text-2xl font-mono font-medium text-gray-200 group-hover:text-white transition-colors">
                  {safeFormatCurrency(parseFloat(value), locale || 'en-US')}
                </div>
              </div>

              {/* Action Button (Visible on Hover or Touch) */}
              <button 
                onClick={(e) => handleTradeClick(e, key)}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200
                bg-gray-800 text-gray-300 hover:bg-blue-600 hover:text-white border border-gray-700 hover:border-blue-500"
              >
                Trade
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. CHART MODAL */}
      {showModal && selectedCrypto && (
        <DarkModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={
            <div className="flex items-center gap-3">
               {/* FIX 4: Added Alt Tag */}
               <img 
                 src={`${baseURL}${selectedCrypto.toLowerCase()}.png`} 
                 onError={(e) => e.currentTarget.src = `${baseURL}generic.png`} 
                 className="h-8 w-8"
                 alt={`${selectedCrypto} icon`}
                />
               <span>{selectedCrypto} <span className="text-gray-500 text-base font-normal">/ EUR</span></span>
            </div>
          }
        >
          <div className="h-72 w-full bg-gray-900 rounded-lg p-2 border border-gray-800">
             <Line data={chartData} options={chartOptions} />
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={(e) => handleTradeClick(e, selectedCrypto)} 
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition transform active:scale-95"
            >
              Buy {selectedCrypto}
            </button>
            <button 
              onClick={() => setShowModal(false)} 
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </DarkModal>
      )}
    </div>
  );
}

export default ExchangeRates;