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

// --- DYNAMIC IMPORT FOR CHART ---
const Line = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-800 animate-pulse rounded-md" />
});

if (typeof window !== 'undefined') {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
}

// --- CONFIG ---
const AFFILIATE_LINK = "https://www.coinbase.com/join"; 

// --- STATIC DATA: COIN NAMES (For better UX) ---
const COIN_NAMES: { [key: string]: string } = {
  BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', BNB: 'BNB', SOL: 'Solana',
  XRP: 'XRP', USDC: 'USDC', ADA: 'Cardano', AVAX: 'Avalanche', DOGE: 'Dogecoin',
  DOT: 'Polkadot', TRX: 'TRON', LINK: 'Chainlink', MATIC: 'Polygon', SHIB: 'Shiba Inu',
  LTC: 'Litecoin', BCH: 'Bitcoin Cash', UNI: 'Uniswap', ATOM: 'Cosmos', XMR: 'Monero'
};

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 shrink-0">
          <div className="text-xl font-bold text-white">{title}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition bg-gray-800 p-2 rounded-full hover:bg-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 text-white overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export function ExchangeRates() {
  const { t, ready } = useTranslation('common');
  const safeT = t || ((key: string, fallback?: string) => fallback || key);
  const { locale } = useRouter();
  
  // STATE
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  
  // Calculator State
  const [calcAmount, setCalcAmount] = useState<string>('100');

  const { data, error } = useSWR<ExchangeRatesResponse>('coinbase-rates', fetchDirectly, {
    refreshInterval: 6000,
    revalidateOnFocus: false
  });

  const previousData = useRef<ExchangeRatesResponse | null>(null);
  const [ratesChange, setRatesChange] = useState<{ [key: string]: 'up' | 'down' | 'same' }>({});
  const [mostGrowingCrypto, setMostGrowingCrypto] = useState<{ key: string, change: number, percent: number } | null>(null);
  const [lastRates, setLastRates] = useState<{ [key: string]: number[] }>({});

  // --- EFFECT: LOAD FAVORITES ---
  useEffect(() => {
    const saved = localStorage.getItem('cryptoFavorites');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  // --- FUNCTION: TOGGLE FAVORITE ---
  const toggleFavorite = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    let newFavs;
    if (favorites.includes(key)) {
      newFavs = favorites.filter(k => k !== key);
    } else {
      newFavs = [...favorites, key];
    }
    setFavorites(newFavs);
    localStorage.setItem('cryptoFavorites', JSON.stringify(newFavs));
  };

  // --- EFFECT: DATA PROCESSING ---
  useEffect(() => {
    if (data && previousData.current) {
      const changes: { [key: string]: 'up' | 'down' | 'same' } = {};
      let maxGrowth = -Infinity;
      let mostGrowing = null;

      Object.keys(data.data.rates).forEach((key) => {
        const prevRates = previousData.current?.data.rates || {};
        const previousRate = parseFloat(prevRates[key] || '0');
        const currentRate = parseFloat(data.data.rates[key]);
        const growth = currentRate - previousRate;
        const percentChange = previousRate !== 0 ? (growth / previousRate) * 100 : 0;

        if (percentChange > maxGrowth && currentRate > 0.01) { 
          maxGrowth = percentChange;
          mostGrowing = { key, change: growth, percent: percentChange };
        }

        if (currentRate > previousRate) changes[key] = 'up';
        else if (currentRate < previousRate) changes[key] = 'down';
        else changes[key] = 'same';

        setLastRates((prev) => {
          const history = prev[key] ? [...prev[key]] : [];
          history.push(currentRate);
          if (history.length > 20) history.shift();
          return { ...prev, [key]: history };
        });
      });

      setRatesChange(changes);
      if (mostGrowing) setMostGrowingCrypto(mostGrowing);
    }

    if (data) previousData.current = data;
  }, [data]);

  // --- FILTER LOGIC ---
  const filteredRates = useMemo(() => {
    if (!data) return [];
    
    let entries = Object.entries(data.data.rates);
    
    // 1. Filter by Tab
    if (activeTab === 'favorites') {
      entries = entries.filter(([key]) => favorites.includes(key));
    }

    // 2. Filter by Search
    if (searchTerm) {
      entries = entries.filter(([key]) => 
        key.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (COIN_NAMES[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return entries;
  }, [data, searchTerm, activeTab, favorites]);

  const handleTradeClick = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    window.open(`${AFFILIATE_LINK}?coin=${key}`, '_blank');
  };

  const baseURL = '/icons/';

  // --- CHART CONFIG ---
  const chartData = {
    labels: Array.from({ length: lastRates[selectedCrypto ?? '']?.length || 0 }, (_, i) => i + 1),
    datasets: [
      {
        label: `${selectedCrypto}/EUR`,
        data: lastRates[selectedCrypto ?? ''] || [],
        fill: true,
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
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
      y: { display: true, grid: { color: '#374151' }, ticks: { color: '#9CA3AF' } } 
    },
  };

  // --- ERROR STATE ---
  if (error) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
       <div className="text-center p-6 bg-gray-900 rounded-xl border border-gray-800">
         <p className="text-red-400 mb-2">⚠ Unable to connect to market data.</p>
         <button onClick={() => window.location.reload()} className="text-sm bg-gray-800 px-3 py-1 rounded">Retry</button>
       </div>
    </div>
  );

  // --- LOADING STATE ---
  if ((!ready && !data) || (!data)) {
    return (
      <div className="min-h-screen bg-black max-w-7xl mx-auto px-4 py-8">
         <div className="h-12 w-full md:w-1/2 bg-gray-900 rounded mb-8 animate-pulse"></div>
         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(9)].map((_, i) => <div key={i} className="h-32 bg-gray-900 rounded-xl animate-pulse"></div>)}
         </div>
      </div>
    );
  }

  // --- CALCULATOR LOGIC ---
  const selectedRate = selectedCrypto ? parseFloat(data.data.rates[selectedCrypto]) : 0;
  const cryptoAmount = selectedRate > 0 && calcAmount ? (parseFloat(calcAmount) / selectedRate).toFixed(6) : '0';

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-green-500 selection:text-black pb-20">
      
      {/* HEADER */}
      <div className="sticky top-0 z-40 backdrop-blur-md bg-black/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-green-400 to-blue-500 rounded-lg shadow-lg shadow-green-500/20"></div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white hidden sm:block">
              Crypto<span className="text-green-400">Market</span>
            </h1>
          </div>
          
          <div className="flex gap-4">
            <input
              type="text"
              placeholder={safeT('search_crypto', 'Search...')}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent block w-32 md:w-64 pl-4 p-2.5 transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* TOP PERFORMER BANNER */}
        {mostGrowingCrypto && !searchTerm && activeTab === 'all' && (
          <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 group cursor-pointer" onClick={() => { setSelectedCrypto(mostGrowingCrypto?.key || null); setShowModal(true); }}>
             <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-green-500 opacity-10 blur-[80px] rounded-full"></div>
             <div className="relative z-10 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <img src={`${baseURL}${mostGrowingCrypto.key.toLowerCase()}.png`} onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} className="h-14 w-14 rounded-full bg-gray-800 border-2 border-green-500/30" alt={mostGrowingCrypto.key} />
                   <div>
                     <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-900/50 text-green-300 border border-green-800 uppercase tracking-wide">Top Gainer 24h</span>
                     <h2 className="text-2xl font-bold text-white mt-1">{COIN_NAMES[mostGrowingCrypto.key] || mostGrowingCrypto.key}</h2>
                     <p className="text-green-400 font-mono font-bold">+{mostGrowingCrypto.percent.toFixed(2)}%</p>
                   </div>
                </div>
                <div className="hidden sm:block">
                  <span className="text-gray-400 text-sm mr-2">Market Price</span>
                  <span className="text-xl font-mono font-bold">{safeFormatCurrency(parseFloat(data.data.rates[mostGrowingCrypto.key]), locale!)}</span>
                </div>
             </div>
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-1">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'all' ? 'text-green-400 border-b-2 border-green-400 bg-gray-900/50' : 'text-gray-500 hover:text-gray-300'}`}
          >
            All Assets
          </button>
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'favorites' ? 'text-green-400 border-b-2 border-green-400 bg-gray-900/50' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            Watchlist ({favorites.length})
          </button>
        </div>

        {/* EMPTY STATE FOR FAVORITES */}
        {activeTab === 'favorites' && favorites.length === 0 && (
          <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-dashed border-gray-800">
            <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            <h3 className="text-xl font-bold text-gray-400">Your Watchlist is empty</h3>
            <p className="text-gray-500">Star coins to track them here.</p>
            <button onClick={() => setActiveTab('all')} className="mt-4 text-green-500 hover:text-green-400 font-bold">Browse Coins</button>
          </div>
        )}

        {/* GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRates.map(([key, value]) => (
            <div
              key={key}
              onClick={() => { setSelectedCrypto(key); setShowModal(true); }}
              className="group bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-xl hover:bg-gray-800 relative"
            >
              {/* Star Button */}
              <button 
                onClick={(e) => toggleFavorite(e, key)}
                className={`absolute top-3 right-3 p-1.5 rounded-full z-20 transition-all ${favorites.includes(key) ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-700 hover:text-gray-400 bg-gray-800'}`}
              >
                <svg className="w-5 h-5" fill={favorites.includes(key) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              </button>

              <div className="flex items-center gap-3 mb-3">
                <img 
                  src={`${baseURL}${key.toLowerCase()}.png`} 
                  onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                  className="h-10 w-10 rounded-full bg-gray-800 p-1 border border-gray-700" 
                  alt={key} 
                />
                <div className="overflow-hidden">
                  <h3 className="font-bold text-white leading-none truncate pr-6">{COIN_NAMES[key] || key}</h3>
                  <span className="text-xs text-gray-500 font-mono">{key}</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="text-lg font-mono font-medium text-gray-200 group-hover:text-white">
                  {safeFormatCurrency(parseFloat(value), locale!)}
                </div>
                <div className={`text-xs font-bold flex items-center px-1.5 py-0.5 rounded ${
                  ratesChange[key] === 'up' ? 'text-green-400 bg-green-900/20' : 
                  ratesChange[key] === 'down' ? 'text-red-400 bg-red-900/20' : 'text-gray-500'
                }`}>
                   {ratesChange[key] === 'up' && '▲'}
                   {ratesChange[key] === 'down' && '▼'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL & CALCULATOR */}
      {showModal && selectedCrypto && (
        <DarkModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={
            <div className="flex items-center gap-3">
               <img src={`${baseURL}${selectedCrypto.toLowerCase()}.png`} onError={(e) => e.currentTarget.src = `${baseURL}generic.png`} className="h-8 w-8" alt=""/>
               <div>
                  <div className="font-bold">{COIN_NAMES[selectedCrypto] || selectedCrypto}</div>
                  <div className="text-xs text-gray-400 font-normal">Current Price: {safeFormatCurrency(selectedRate, locale!)}</div>
               </div>
            </div>
          }
        >
          {/* CHART */}
          <div className="h-64 w-full bg-gray-900 rounded-lg p-2 border border-gray-800 mb-6">
             <Line data={chartData} options={chartOptions} />
          </div>

          {/* CALCULATOR */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700">
             <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
               Instant Converter
             </h4>
             <div className="flex items-center gap-4">
               <div className="flex-1">
                 <label className="text-xs text-gray-500 block mb-1">Amount (EUR)</label>
                 <input 
                    type="number" 
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white font-mono focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                 />
               </div>
               <div className="text-gray-500 mt-5">→</div>
               <div className="flex-1">
                 <label className="text-xs text-gray-500 block mb-1">You Get ({selectedCrypto})</label>
                 <div className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-green-400 font-mono font-bold">
                   {cryptoAmount}
                 </div>
               </div>
             </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={(e) => handleTradeClick(e, selectedCrypto)} 
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg transition active:scale-95"
            >
              Buy {selectedCrypto}
            </button>
            <button 
              onClick={() => setShowModal(false)} 
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition"
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