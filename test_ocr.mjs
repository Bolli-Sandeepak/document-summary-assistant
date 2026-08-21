import { readFileSync } from 'fs';
import { extractTextFromImage } from './server/services/imageOcr.js';
import { cleanExtractedText } from './server/services/textCleaner.js';

const filePath = 'C:/Users/sande/Downloads/ChatGPT Image Aug 20, 2026, 11_08_20 PM.png';
try {
  const buf = readFileSync(filePath);
  console.log('Extracting text from:', filePath);
  const result = await extractTextFromImage(buf);
  console.log('\n--- RAW EXTRACTED TEXT ---');
  console.log(result.text);

  console.log('\n--- CLEANED EXTRACTED TEXT ---');
  console.log(cleanExtractedText(result.text));
} catch (e) {
  console.error('Error:', e.message);
}
