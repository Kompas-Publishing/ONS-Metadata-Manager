import XLSX from 'xlsx';

const filePath = '/mnt/d/Desktop/Work-Github/drive-download-20260218T204246Z-1-001/Mapping-odarrange_MijnVriend.xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

console.log('Headers:', data[0]);
console.log('Row 1:', data[1]);
console.log('Row 2:', data[2]);
console.log('Row 3:', data[3]);
