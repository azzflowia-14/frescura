const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('data/precios.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Columns:', Object.keys(rows[0]));
console.log('Total rows:', rows.length);

// Find the price column name (may have extra spaces)
const cols = Object.keys(rows[0]);
const priceCol = cols.find(c => c.toLowerCase().includes('precio'));
console.log('Price column found:', JSON.stringify(priceCol));

const precios = {};
for (const r of rows) {
  const cod = String(r['Cod Producto'] || '').trim();
  let priceStr = String(r[priceCol] || '').trim();
  if (cod === '' || priceStr === '' || priceStr === '-') continue;
  priceStr = priceStr.replace(/,/g, '');
  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) continue;
  precios[cod] = price;
}

console.log('Unique SKUs with price:', Object.keys(precios).length);
fs.writeFileSync('data/precios.json', JSON.stringify(precios, null, 2));
console.log('Saved to data/precios.json');
