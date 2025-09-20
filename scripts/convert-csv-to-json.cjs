const fs = require('fs');
const path = require('path');

// Simple CSV parser
function parseCSV(text) {
  const lines = text.split('\n');
  const headers = lines[0].split(',');
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',');
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      data.push(obj);
    }
  }

  return data;
}

console.log('Reading CSV file...');
const csvData = fs.readFileSync(path.join(__dirname, '../US/zipcodes.us.csv'), 'utf-8');
const records = parseCSV(csvData);

console.log(`Parsed ${records.length} records`);

// Create a lightweight JSON structure for the frontend
const zipData = records.map(r => ({
  z: r.zipcode,
  c: r.place,
  s: r.state_code,
  lat: parseFloat(r.latitude),
  lng: parseFloat(r.longitude),
  co: r.county
}));

// Write compressed JSON
const outputPath = path.join(__dirname, '../public/zipdata.json');
fs.writeFileSync(outputPath, JSON.stringify(zipData));

const size = fs.statSync(outputPath).size / 1024 / 1024;
console.log(`Created zipdata.json (${size.toFixed(2)} MB)`);
console.log('File saved to public/zipdata.json');