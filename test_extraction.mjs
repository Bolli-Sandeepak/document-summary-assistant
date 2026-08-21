import { readFileSync } from 'fs';
import { extractTextFromPDF } from './server/services/pdfExtractor.js';

const buf = readFileSync('C:/Users/sande/Downloads/1.Introduction to DL.pdf');
const result = await extractTextFromPDF(buf, () => {});

console.log('=== FULL EXTRACTED TEXT ===\n');
console.log(result.text);
console.log('\n=== END ===');
console.log('\nWords:', result.text.split(/\s+/).filter(Boolean).length);
