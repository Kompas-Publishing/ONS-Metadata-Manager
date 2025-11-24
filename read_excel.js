const XLSX = require('xlsx');

const workbook = XLSX.readFile('attached_assets/Mapping-odarrange Kommissar Rex Seizoen 9_1763329381057.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

console.log('=== EXCEL FILE ANALYSIS ===\n');
console.log(`Sheet Name: ${sheetName}\n`);
console.log('Column Headers:');
if (data[0]) {
  data[0].forEach((header, index) => {
    if (header) console.log(`  ${index + 1}. ${header}`);
  });
}

console.log('\n=== Sample Data (First Row) ===');
if (data[1]) {
  console.log('\nRow 1 (with values):');
  data[0].forEach((header, j) => {
    if (header && data[1][j] !== '') {
      console.log(`  ${header}: ${data[1][j]}`);
    }
  });
}

console.log('\n=== ALL FIELDS SUMMARY ===');
const headers = (data[0] || []).filter(h => h);
console.log(`Total Fields: ${headers.length}\n`);
headers.forEach((h, i) => console.log(`${(i + 1).toString().padStart(2, ' ')}. ${h}`));
