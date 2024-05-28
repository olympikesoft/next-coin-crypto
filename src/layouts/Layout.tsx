import React from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-discordBg text-discordText rounded-lg shadow-lg">
      <h1 className="text-xl font-bold text-center text-discordAccent">Crypto Exchange Rates</h1>
      {children}
    </div>
  );
}
