import { ExchangeRatesResponse } from '../types/apiTypes';

export async function fetchExchangeRates(): Promise<ExchangeRatesResponse> {
  const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=EUR');
  
  if (!response.ok) {
    throw new Error('Failed to fetch exchange rates');
  }

  const data = await response.json();
  return data;
}
