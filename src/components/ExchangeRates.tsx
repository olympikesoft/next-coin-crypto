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

// --- DYNAMIC IMPORT ---
const Line = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-800 animate-pulse rounded-md" />
});

if (typeof window !== 'undefined') {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
}

// --- CONFIG ---
const AFFILIATE_LINK = "https://www.coinbase.com/join"; 

const COIN_NAMES: { [key: string]: string } = {
  BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', BNB: 'BNB', SOL: 'Solana',
  XRP: 'XRP', USDC: 'USDC', ADA: 'Cardano', AVAX: 'Avalanche', DOGE: 'Dogecoin',
  DOT: 'Polkadot', TRX: 'TRON', LINK: 'Chainlink', MATIC: 'Polygon', SHIB: 'Shiba Inu',
  LTC: 'Litecoin', BCH: 'Bitcoin Cash', UNI: 'Uniswap', ATOM: 'Cosmos', XMR: 'Monero'
};

interface ExchangeRatesResponse {
  data: { currency: string; rates: { [key: string]: string }; };
}
type SortOption = 'rank' | 'name' | 'priceHigh' | 'priceLow';

const safeFormatCurrency = (amount: number, locale: string = 'en-US') => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
  } catch (e) {
    return `€${amount.toFixed(2)}`;
  }
};

const fetchDirectly = async (): Promise<ExchangeRatesResponse> => {
  const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=EUR');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};

// --- MODAL ---
const DarkModal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
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
  const [holdings, setHoldings] = useState<{ [key: string]: number }>({});
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'portfolio' | 'compare'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('rank');
  
  // Compare State
  const [compareA, setCompareA] = useState<string>('BTC');
  const [compareB, setCompareB] = useState<string>('ETH');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [calcAmount, setCalcAmount] = useState<string>('100');
  const [holdingInput, setHoldingInput] = useState<string>('');

  const { data, error } = useSWR<ExchangeRatesResponse>('coinbase-rates', fetchDirectly, {
    refreshInterval: 6000,
    revalidateOnFocus: false
  });

  const previousData = useRef<ExchangeRatesResponse | null>(null);
  const [ratesChange, setRatesChange] = useState<{ [key: string]: 'up' | 'down' | 'same' }>({});
  const [mostGrowingCrypto, setMostGrowingCrypto] = useState<{ key: string, change: number, percent: number } | null>(null);
  const [lastRates, setLastRates] = useState<{ [key: string]: number[] }>({});
  const [marketHealth, setMarketHealth] = useState({ up: 0, down: 0, total: 0 });

  useEffect(() => {
    const savedFavs = localStorage.getItem('cryptoFavorites');
    const savedHoldings = localStorage.getItem('cryptoHoldings');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
    if (savedHoldings) setHoldings(JSON.parse(savedHoldings));
  }, []);

  const updateHolding = (amount: string) => {
    if (!selectedCrypto) return;
    const val = parseFloat(amount);
    const newHoldings = { ...holdings };
    if (isNaN(val) || val <= 0) delete newHoldings[selectedCrypto];
    else newHoldings[selectedCrypto] = val;
    setHoldings(newHoldings);
    localStorage.setItem('cryptoHoldings', JSON.stringify(newHoldings));
    setHoldingInput(amount);
  };

  const toggleFavorite = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    const newFavs = favorites.includes(key) ? favorites.filter(k => k !== key) : [...favorites, key];
    setFavorites(newFavs);
    localStorage.setItem('cryptoFavorites', JSON.stringify(newFavs));
  };

  useEffect(() => {
    if (data && previousData.current) {
      const changes: { [key: string]: 'up' | 'down' | 'same' } = {};
      let maxGrowth = -Infinity;
      let mostGrowing = null;
      let upCount = 0;
      let downCount = 0;

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

        if (currentRate > previousRate) { changes[key] = 'up'; upCount++; }
        else if (currentRate < previousRate) { changes[key] = 'down'; downCount++; }
        else { changes[key] = 'same'; }

        setLastRates((prev) => {
          const history = prev[key] ? [...prev[key]] : [];
          history.push(currentRate);
          if (history.length > 30) history.shift();
          return { ...prev, [key]: history };
        });
      });

      setRatesChange(changes);
      setMarketHealth({ up: upCount, down: downCount, total: upCount + downCount });
      if (mostGrowing) setMostGrowingCrypto(mostGrowing);
    }
    if (data) previousData.current = data;
  }, [data]);

  const totalPortfolioValue = useMemo(() => {
    if (!data) return 0;
    return Object.entries(holdings).reduce((total, [key, amount]) => {
      const rate = parseFloat(data.data.rates[key] || '0');
      return total + (amount * rate);
    }, 0);
  }, [holdings, data]);

  const filteredRates = useMemo(() => {
    if (!data) return [];
    let entries = Object.entries(data.data.rates);
    
    if (activeTab === 'favorites') entries = entries.filter(([key]) => favorites.includes(key));
    if (activeTab === 'portfolio') entries = entries.filter(([key]) => holdings[key] && holdings[key] > 0);

    if (searchTerm) {
      entries = entries.filter(([key]) => 
        key.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (COIN_NAMES[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    entries.sort((a, b) => {
      const rateA = parseFloat(a[1]);
      const rateB = parseFloat(b[1]);
      switch (sortBy) {
        case 'priceHigh': return rateB - rateA;
        case 'priceLow': return rateA - rateB;
        case 'name': return a[0].localeCompare(b[0]);
        default: return 0;
      }
    });

    return entries;
  }, [data, searchTerm, activeTab, favorites, sortBy, holdings]);

  const handleTradeClick = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    window.open(`${AFFILIATE_LINK}?coin=${key}`, '_blank');
  };

  const baseURL = '/icons/';

  // --- CHART LOGIC ---
  const getChartData = (keys: string[]) => {
     return {
        labels: Array.from({ length: lastRates[keys[0]]?.length || 0 }, (_, i) => i + 1),
        datasets: keys.map((key, index) => {
           const rawData = lastRates[key] || [];
           const startValue = rawData[0] || 1;
           const normalizedData = rawData.map(val => ((val - startValue) / startValue) * 100);

           const color = index === 0 ? '#10B981' : '#3B82F6'; // Green vs Blue

           return {
             label: key,
             data: normalizedData,
             borderColor: color,
             backgroundColor: color,
             borderWidth: 2,
             tension: 0.4,
             pointRadius: 0,
           };
        })
     };
  };

  // Fixed: Correctly using ScriptableContext to avoid "unused var" error
  const modalChartData = {
    labels: Array.from({ length: lastRates[selectedCrypto ?? '']?.length || 0 }, (_, i) => i + 1),
    datasets: [{
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
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { display: false }, y: { display: true, grid: { color: '#374151' }, ticks: { color: '#9CA3AF' } } },
  };

  if (error) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Error loading data.</div>;
  if ((!ready && !data) || (!data)) return <div className="min-h-screen bg-black text-white p-10">Loading...</div>;

  const openModal = (key: string) => {
    setSelectedCrypto(key);
    setHoldingInput(holdings[key] ? holdings[key].toString() : '');
    setShowModal(true);
  };

  const selectedRate = selectedCrypto ? parseFloat(data.data.rates[selectedCrypto]) : 0;
  const cryptoAmount = selectedRate > 0 && calcAmount ? (parseFloat(calcAmount) / selectedRate).toFixed(6) : '0';

  // Compare Logic
  const rateA = parseFloat(data.data.rates[compareA] || '0');
  const rateB = parseFloat(data.data.rates[compareB] || '0');
  const crossRate = rateB > 0 ? (rateA / rateB).toFixed(6) : '0';

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-green-500 selection:text-black pb-20">
      
      {/* HEADER */}
      <div className="sticky top-0 z-40 backdrop-blur-md bg-black/80 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-green-400 to-blue-500 rounded-lg shadow-lg"></div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">Crypto<span className="text-green-400">Market</span></h1>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Total Portfolio</span>
            <div className={`font-mono font-bold text-xl ${totalPortfolioValue > 0 ? 'text-green-400' : 'text-gray-500'}`}>
              {safeFormatCurrency(totalPortfolioValue, locale!)}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* MARKET HEALTH BAR */}
        <div className="mb-8 bg-gray-900 rounded-full h-2 overflow-hidden flex w-full">
           <div style={{ width: `${(marketHealth.up / marketHealth.total) * 100}%` }} className="bg-green-500 h-full transition-all duration-1000"></div>
           <div style={{ width: `${(marketHealth.down / marketHealth.total) * 100}%` }} className="bg-red-500 h-full transition-all duration-1000"></div>
        </div>

        {/* TOP PERFORMER BANNER (Re-added to fix unused variable error) */}
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
        
        {/* TABS & CONTROLS */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6 justify-between items-end lg:items-center border-b border-gray-800 pb-4">
          <div className="flex bg-gray-900 p-1 rounded-lg overflow-x-auto">
            {(['all', 'favorites', 'portfolio', 'compare'] as const).map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors capitalize whitespace-nowrap ${activeTab === tab ? 'bg-gray-800 text-white shadow ring-1 ring-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {tab === 'compare' ? '⚔️ Compare' : tab}
              </button>
            ))}
          </div>

          {activeTab !== 'compare' && (
             <div className="flex gap-2 w-full lg:w-auto">
               <select 
                 className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg p-2.5 outline-none focus:border-green-500"
                 value={sortBy}
                 onChange={(e) => setSortBy(e.target.value as SortOption)}
               >
                 <option value="rank">Rank</option>
                 <option value="priceHigh">Price: High</option>
                 <option value="priceLow">Price: Low</option>
                 <option value="name">A-Z</option>
               </select>
               <input
                type="text"
                placeholder={safeT('search_crypto', 'Search...')}
                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg p-2.5 w-full md:w-48 outline-none focus:border-green-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* === COMPARE VIEW === */}
        {activeTab === 'compare' ? (
          <div className="animate-in fade-in zoom-in duration-300">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 items-center">
                {/* SELECTOR A */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl relative">
                   <div className="absolute -top-3 left-6 px-2 bg-black text-xs font-bold text-green-500 uppercase tracking-widest">Coin A</div>
                   <select 
                      value={compareA} 
                      onChange={(e) => setCompareA(e.target.value)}
                      className="w-full bg-black border border-gray-700 rounded-xl p-4 text-xl font-bold text-white outline-none focus:border-green-500 mb-4"
                   >
                      {Object.keys(data.data.rates).sort().map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   <div className="flex items-center gap-3">
                      <img src={`${baseURL}${compareA.toLowerCase()}.png`} onError={(e) => e.currentTarget.src = `${baseURL}generic.png`} className="h-12 w-12 rounded-full" alt={compareA}/>
                      <div>
                         <div className="text-2xl font-mono font-bold">{safeFormatCurrency(rateA, locale!)}</div>
                         <div className="text-xs text-gray-500">{COIN_NAMES[compareA] || compareA}</div>
                      </div>
                   </div>
                </div>

                {/* VS BADGE (Mobile: Center / Desktop: Center) */}
                <div className="hidden md:flex justify-center absolute left-1/2 transform -translate-x-1/2 z-10">
                   <div className="bg-black border-4 border-gray-800 rounded-full w-16 h-16 flex items-center justify-center font-black text-xl italic text-gray-600 shadow-xl">VS</div>
                </div>

                {/* SELECTOR B */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl relative">
                   <div className="absolute -top-3 left-6 px-2 bg-black text-xs font-bold text-blue-500 uppercase tracking-widest">Coin B</div>
                   <select 
                      value={compareB} 
                      onChange={(e) => setCompareB(e.target.value)}
                      className="w-full bg-black border border-gray-700 rounded-xl p-4 text-xl font-bold text-white outline-none focus:border-blue-500 mb-4"
                   >
                      {Object.keys(data.data.rates).sort().map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   <div className="flex items-center gap-3">
                      <img src={`${baseURL}${compareB.toLowerCase()}.png`} onError={(e) => e.currentTarget.src = `${baseURL}generic.png`} className="h-12 w-12 rounded-full" alt={compareB}/>
                      <div>
                         <div className="text-2xl font-mono font-bold">{safeFormatCurrency(rateB, locale!)}</div>
                         <div className="text-xs text-gray-500">{COIN_NAMES[compareB] || compareB}</div>
                      </div>
                   </div>
                </div>
             </div>

             {/* CROSS RATE CARD */}
             <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 mb-8 text-center">
                <p className="text-gray-400 text-sm uppercase tracking-wide mb-2">Exchange Ratio</p>
                <div className="text-3xl sm:text-4xl font-black text-white">
                   1 <span className="text-green-500">{compareA}</span> = {crossRate} <span className="text-blue-500">{compareB}</span>
                </div>
             </div>

             {/* COMPARE CHART */}
             <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold text-gray-300">Performance Comparison (Session)</h3>
                   <div className="flex gap-4 text-xs font-bold">
                      <span className="text-green-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {compareA}</span>
                      <span className="text-blue-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {compareB}</span>
                   </div>
                </div>
                <div className="h-64 w-full">
                   <Line data={getChartData([compareA, compareB])} options={chartOptions} />
                </div>
                <p className="text-center text-xs text-gray-600 mt-4 italic">Chart normalizes growth to 0% at start of session to compare trends.</p>
             </div>
          </div>
        ) : (
          /* === STANDARD GRID VIEW === */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRates.length === 0 ? <div className="col-span-full text-center py-20 text-gray-500">No coins found.</div> : 
             filteredRates.map(([key, value]) => (
              <div
                key={key}
                onClick={() => openModal(key)}
                className={`group bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-xl hover:bg-gray-800 relative ${holdings[key] ? 'border-green-500/30 bg-green-900/5' : 'border-gray-800 hover:border-gray-600'}`}
              >
                <button 
                  onClick={(e) => toggleFavorite(e, key)}
                  className={`absolute top-3 right-3 p-1.5 rounded-full z-20 ${favorites.includes(key) ? 'text-yellow-400' : 'text-gray-700 hover:text-white'}`}
                >
                  <svg className="w-5 h-5" fill={favorites.includes(key) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <img src={`${baseURL}${key.toLowerCase()}.png`} onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} className="h-10 w-10 rounded-full bg-gray-800 border border-gray-700" alt={key} />
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-white leading-none truncate pr-6">{COIN_NAMES[key] || key}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 font-mono">{key}</span>
                      {holdings[key] && <span className="text-[10px] bg-green-900 text-green-300 px-1.5 rounded border border-green-700">OWNED</span>}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-lg font-mono font-medium text-gray-200">
                      {safeFormatCurrency(parseFloat(value), locale!)}
                    </div>
                    {holdings[key] && (
                       <div className="text-xs text-green-400 font-mono mt-1">
                         Value: {safeFormatCurrency(parseFloat(value) * holdings[key], locale!)}
                       </div>
                    )}
                  </div>
                  <div className={`text-xs font-bold flex items-center px-1.5 py-0.5 rounded ${ratesChange[key] === 'up' ? 'text-green-400' : ratesChange[key] === 'down' ? 'text-red-400' : 'text-gray-500'}`}>
                     {ratesChange[key] === 'up' && '▲'}
                     {ratesChange[key] === 'down' && '▼'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && selectedCrypto && (
        <DarkModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={
            <div className="flex items-center gap-3">
               <img src={`${baseURL}${selectedCrypto.toLowerCase()}.png`} onError={(e) => e.currentTarget.src = `${baseURL}generic.png`} className="h-8 w-8" alt=""/>
               <div>
                  <div className="font-bold">{COIN_NAMES[selectedCrypto] || selectedCrypto}</div>
                  <div className="text-xs text-gray-400 font-normal">Price: {safeFormatCurrency(selectedRate, locale!)}</div>
               </div>
            </div>
          }
        >
          <div className="h-64 w-full bg-gray-900 rounded-lg p-2 border border-gray-800 mb-6 relative">
             <Line data={modalChartData} options={chartOptions} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
             <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Instant Converter</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Amount (EUR)</label>
                    <input type="number" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white font-mono focus:border-green-500 outline-none" />
                  </div>
                  <div className="text-center text-gray-600">↓</div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">You Get ({selectedCrypto})</label>
                    <div className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-green-400 font-mono font-bold">{cryptoAmount}</div>
                  </div>
                </div>
             </div>

             <div className="bg-green-900/10 rounded-xl p-4 border border-green-500/20">
                <h4 className="text-xs font-bold text-green-400 uppercase mb-3">Your Portfolio</h4>
                <p className="text-xs text-gray-400 mb-2">How much {selectedCrypto} do you own?</p>
                <div className="flex gap-2">
                   <input 
                      type="number" 
                      placeholder="0.00" 
                      value={holdingInput}
                      onChange={(e) => setHoldingInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white font-mono focus:border-green-500 outline-none" 
                   />
                   <button onClick={() => updateHolding(holdingInput)} className="bg-green-600 hover:bg-green-500 text-white px-3 rounded font-bold">Save</button>
                </div>
                {holdings[selectedCrypto] && (
                   <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex justify-between text-sm">
                         <span className="text-gray-400">Value:</span>
                         <span className="font-mono font-bold text-white">{safeFormatCurrency(holdings[selectedCrypto] * selectedRate, locale!)}</span>
                      </div>
                   </div>
                )}
             </div>
          </div>

          <div className="flex gap-3">
            <button onClick={(e) => handleTradeClick(e, selectedCrypto)} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg transition active:scale-95">Buy on Coinbase</button>
            <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition">Close</button>
          </div>
        </DarkModal>
      )}
    </div>
  );
}

export default ExchangeRates;