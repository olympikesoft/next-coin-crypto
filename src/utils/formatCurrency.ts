export function formatCurrency(value: number | bigint, locale: string = 'en-US') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }
  