/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'next-i18next';
import { fetchExchangeRates } from '../lib/api';
import { ExchangeRatesResponse } from '../types/apiTypes';
import { formatCurrency } from '../utils/formatCurrency';
import { useRouter } from 'next/router';

export function ExchangeRates() {
  const { t, ready } = useTranslation('common');
  const { data, error } = useSWR<ExchangeRatesResponse>('/api/exchange-rates', fetchExchangeRates, {
    refreshInterval: 60000 // Refresh every minute
  });
  const { locale } = useRouter();

  const previousData = useRef<ExchangeRatesResponse | null>(null);
  const [ratesChange, setRatesChange] = useState<{ [key: string]: 'up' | 'down' | 'same' }>({});
  const [mostGrowingCrypto, setMostGrowingCrypto] = useState<{ key: string, change: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [lastRates, setLastRates] = useState<{ [key: string]: number[] }>({});

  useEffect(() => {
    if (data && previousData.current) {
      const changes: { [key: string]: 'up' | 'down' | 'same' } = {};
      let maxGrowth = 0;
      let mostGrowing = null;

      Object.keys(data.data.rates).forEach((key) => {
        const previousRate = parseFloat(previousData.current!.data.rates[key] || '0');
        const currentRate = parseFloat(data.data.rates[key]);
        const growth = currentRate - previousRate;

        if (growth > maxGrowth) {
          maxGrowth = growth;
          mostGrowing = { key, change: growth };
        }

        if (currentRate > previousRate) {
          changes[key] = 'up';
        } else if (currentRate < previousRate) {
          changes[key] = 'down';
        } else {
          changes[key] = 'same';
        }

        // Update lastRates
        setLastRates((prevLastRates) => {
          const updatedRates = { ...prevLastRates };
          if (!updatedRates[key]) {
            updatedRates[key] = [];
          }
          updatedRates[key].push(currentRate);
          if (updatedRates[key].length > 5) {
            updatedRates[key].shift(); // Keep only the last 5 rates
          }
          return updatedRates;
        });
      });

      setRatesChange(changes);
      setMostGrowingCrypto(mostGrowing);
    }

    if (data) {
      previousData.current = data;
    }
  }, [data]);

  if (!ready || !data) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-discordAccent"></div>
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (error) return <div className="text-discordError p-5">{t('failed_to_load_data')}</div>;

  const baseURL = '/icons/';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl font-bold text-center text-discordAccent">{t('crypto_exchange_rates')}</h1>
      {mostGrowingCrypto && (
        <div className="mt-6 p-4 bg-green-100 rounded-md text-center">
          <p className="text-lg font-bold text-green-700">{t('most_growing_crypto')}</p>
          <div className="flex items-center justify-center">
            <img 
              src={`${baseURL}${mostGrowingCrypto.key.toLowerCase()}.png`} 
              onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
              alt={mostGrowingCrypto.key} 
              className="h-8 w-8 mr-2"
            />
            <p className="text-lg text-green-700">
              {mostGrowingCrypto.key}/EUR: {formatCurrency(parseFloat(data.data.rates[mostGrowingCrypto.key]), locale)}
            </p>
          </div>
          <p className="text-green-700">{t('rate_change')}: {formatCurrency(mostGrowingCrypto.change, locale)}</p>
        </div>
      )}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(data.data.rates).map(([key, value]) => (
          <div
            key={key}
            className={`col-span-1 flex shadow-sm rounded-md ${mostGrowingCrypto && key === mostGrowingCrypto.key ? 'bg-green-100' : ''}`}
            onClick={() => {
              setSelectedCrypto(key);
              setShowModal(true);
            }}
          >
            <div className="flex-shrink-0 flex items-center justify-center w-16 bg-discordAccent text-white text-lg font-medium rounded-l-md">
              <img 
                src={`${baseURL}${key.toLowerCase()}.png`} 
                onError={(e) => { e.currentTarget.src = `${baseURL}generic.png`; }} 
                alt={key} 
                className="h-8 w-8"
              />
            </div>
            <div className="flex-1 flex items-center justify-between border-t border-r border-b border-gray-200 bg-white rounded-r-md truncate">
              <div className="flex-1 px-4 py-2 text-sm truncate">
                <a href="#" className="text-gray-900 font-medium hover:text-gray-600">{key}/EUR</a>
                <p className="text-gray-500">
                  {formatCurrency(parseFloat(value), locale)}
                  {ratesChange[key] === 'up' && <span className="text-green-500 ml-2">{t('rate_up')}</span>}
                  {ratesChange[key] === 'down' && <span className="text-red-500 ml-2">{t('rate_down')}</span>}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showModal && selectedCrypto && (
        <div className="fixed inset-0 flex items-center justify-center text-gray-500 z-50 bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">{selectedCrypto}/EUR - {t('last_5_rates')}</h2>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="border-b py-2">{t('rate')}</th>
                </tr>
              </thead>
              <tbody>
                {lastRates[selectedCrypto]?.slice(-5).map((rate, index) => (
                  <tr key={index}>
                    <td className="border-b py-2">{formatCurrency(rate, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="mt-4 bg-discordAccent text-white py-2 px-4 rounded"
              onClick={() => setShowModal(false)}
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExchangeRates;
