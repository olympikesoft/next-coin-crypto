const path = require('path');

module.exports = {
  i18n: {
    defaultLocale: 'en',
    // I added 'ar' because I saw the folder in your screenshot
    locales: ['en', 'ar'], 
  },
  // THIS IS THE FIX:
  localePath: path.resolve('./public/locales'),
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};