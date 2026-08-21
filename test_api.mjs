/**
 * End-to-end HTTP API test.
 * Uploads the real DL PDF and streams the SSE response.
 */
import { createReadStream, readFileSync } from 'fs';
import { basename } from 'path';

const filePath = 'C:/Users/sande/Downloads/1.Introduction to DL.pdf';
const fileName = basename(filePath);

// Build multipart form data manually
const boundary = '----FormBoundary' + Date.now();
const fileBuffer = readFileSync(filePath);

const bodyParts = [
  `--${boundary}\r\n`,
  `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
  `Content-Type: application/pdf\r\n\r\n`,
];

const prelude = Buffer.from(bodyParts.join(''));
const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
const body = Buffer.concat([prelude, fileBuffer, epilogue]);

console.log('Sending PDF to API...');
const response = await fetch('http://localhost:5000/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
  body,
  duplex: 'half'
});

if (!response.ok) {
  console.error('HTTP Error:', response.status);
  process.exit(1);
}

// Read SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buf = '';
let result = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buf += decoder.decode(value, { stream: true });
  const parts = buf.split('\n\n');
  buf = parts.pop();

  for (const part of parts) {
    const dataLine = part.split('\n').find(l => l.startsWith('data: '));
    if (!dataLine) continue;
    try {
      const event = JSON.parse(dataLine.slice(6));
      if (event.type === 'progress') {
        const pg = event.current ? ` [${event.current}/${event.total}]` : '';
        console.log(`  → ${event.message}${pg}`);
      } else if (event.type === 'complete') {
        result = event;
        console.log('\n=== ANALYSIS COMPLETE ===');
        console.log('Document:', result.document?.filename);
        console.log('Words:', result.document?.wordCount);
        console.log('Method:', result.document?.extractionMethod);
        console.log('\n--- SHORT SUMMARY ---');
        console.log(result.summaries?.short);
        console.log('\n--- MEDIUM SUMMARY ---');
        console.log(result.summaries?.medium);
        console.log('\n--- KEY POINTS ---');
        result.keyPoints?.forEach(kp => console.log(`  [${kp.id}] ${kp.title}: ${kp.description}`));
        console.log('\n--- IMPROVEMENT SUGGESTIONS ---');
        result.improvementSuggestions?.forEach(s => console.log(`  [${s.category}] ${s.title}: ${s.detail}`));
      } else if (event.type === 'error') {
        console.error('ERROR:', event.message);
      }
    } catch {}
  }
}

if (!result) console.log('Stream ended without a complete event.');
