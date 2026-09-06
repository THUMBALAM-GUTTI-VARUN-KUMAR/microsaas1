const fs = require('fs');
let content = fs.readFileSync('./src/i18n/ui.ts', 'utf8');

const pricing = {
  "en": { "price": "$9", "priceYearly": "$79", "period": "/ month", "periodYearly": "/ year" },
  "es": { "price": "9€", "priceYearly": "79€", "period": "/ mes", "periodYearly": "/ año" },
  "ja": { "price": "¥1,200", "priceYearly": "¥9,800", "period": "/ 月", "periodYearly": "/ 年" },
  "fr": { "price": "9€", "priceYearly": "79€", "period": "/ mois", "periodYearly": "/ an" },
  "de": { "price": "9€", "priceYearly": "79€", "period": "/ Monat", "periodYearly": "/ Jahr" },
  "pt": { "price": "R$45", "priceYearly": "R$395", "period": "/ mês", "periodYearly": "/ ano" },
  "ko": { "price": "₩12,000", "priceYearly": "₩99,000", "period": "/ 월", "periodYearly": "/ 년" },
  "it": { "price": "9€", "priceYearly": "79€", "period": "/ mese", "periodYearly": "/ anno" }
};

// First, we need to update the existing 'price.pro.price' and 'price.pro.period'
// And add 'price.pro.price.yearly' and 'price.pro.period.yearly'

for (const [lang, prices] of Object.entries(pricing)) {
  const priceRegex = new RegExp(`(\\b${lang}: \\{.*?)\\n\\s*'price.pro.price':\\s*'.*?',`, 's');
  content = content.replace(priceRegex, `$1\n    'price.pro.price': '${prices.price}',\n    'price.pro.price.yearly': '${prices.priceYearly}',`);
  
  const periodRegex = new RegExp(`(\\b${lang}: \\{.*?)\\n\\s*'price.pro.period':\\s*'.*?',`, 's');
  content = content.replace(periodRegex, `$1\n    'price.pro.period': '${prices.period}',\n    'price.pro.period.yearly': '${prices.periodYearly}',`);
}

fs.writeFileSync('./src/i18n/ui.ts', content);
console.log("Updated ui.ts with correct localized pricing strings.");
