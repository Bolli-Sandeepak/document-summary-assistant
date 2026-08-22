/**
 * Summarization service.
 * Primary: Google Gemini 2.5 Flash API (requires GEMINI_API_KEY in env).
 * Fallback: Local statistical summarizer (always available, no API needed).
 */

// Approximate token limit for Gemini input (leave room for prompt + output)
const MAX_INPUT_CHARS = 100000;
const CHUNK_SIZE = 15000;

export async function generateDocumentAnalysis(documentText, filename = 'Document') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && !apiKey.includes('your_gemini_api_key')) {
    try {
      const result = await generateWithGemini(documentText, filename, apiKey);
      if (result) return result;
    } catch (err) {
      console.warn('[summarizer] Gemini call failed, using local engine:', err.message);
    }
  } else {
    console.log('[summarizer] No Gemini API key configured, using local fallback engine');
  }

  return generateLocalFallbackAnalysis(documentText, filename);
}

// ────────────────────────────────────────────────────────────────
// Google Gemini API
// ────────────────────────────────────────────────────────────────
async function generateWithGemini(text, filename, apiKey) {
  // Truncate text if it exceeds the maximum input size
  let processText = text;
  if (text.length > MAX_INPUT_CHARS) {
    processText = text.substring(0, MAX_INPUT_CHARS);
    console.log(`[summarizer] Truncated input from ${text.length} to ${MAX_INPUT_CHARS} chars`);
  }

  // If document is large (> 25,000 chars), split into chunks and aggregate
  if (processText.length > 25000) {
    console.log(`[summarizer] Document length is ${processText.length} chars. Applying multi-chunk aggregation.`);
    return summarizeLargeDocumentWithGemini(processText, filename, apiKey);
  }

  const prompt = buildAnalysisPrompt(processText, filename);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.15,
        maxOutputTokens: 4096,
      }
    }),
    signal: AbortSignal.timeout(55000) // 55-second timeout (under Vercel's 60s limit)
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini API ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const rawStr = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawStr) throw new Error('Empty Gemini response');

  const cleanStr = rawStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  return sanitize(JSON.parse(cleanStr));
}

/**
 * Build the analysis prompt optimized for educational/academic documents.
 */
function buildAnalysisPrompt(text, filename) {
  return `You are an expert academic and professional document analysis assistant. Analyze the document below and return ONLY valid JSON matching this schema exactly.

CRITICAL QUALITY RULES:
1. Base ALL summaries, key points, and term explanations STRICTLY on facts in the document. Do NOT invent or hallucinate information.
2. Write in clear, professional language. Avoid generic filler phrases like "This document provides valuable insights..." — state the ACTUAL content.
3. If the document is educational or academic, prioritize:
   - Definitions of key concepts
   - Important formulas and equations (represent in plain text)
   - Relationships between concepts
   - Examples and applications mentioned
   - Main conclusions or takeaways

SUMMARY GUIDELINES:
- "short": 2-3 concise sentences capturing the core topic and main takeaway.
- "medium": 2-3 well-structured paragraphs covering context, core concepts, methodology, and conclusions.
- "long": Comprehensive structured summary (200+ words) covering all major topics, definitions, methodology, key findings, and conclusions. Use clear paragraph breaks.

KEY POINTS GUIDELINES:
- Provide 5-8 distinct key points, each about a DIFFERENT concept or finding.
- Each title should be specific and descriptive (not generic like "Key Finding 1").
- Each description should be 1-3 sentences explaining the specific point with details from the document.

IMPORTANT TERMS GUIDELINES:
- Extract 5-10 key technical terms, acronyms, or domain-specific concepts from the document.
- Each explanation should be a clear 1-2 sentence definition based on how the term is used in the document.

IMPROVEMENT SUGGESTIONS:
- Provide 3-4 specific, actionable recommendations about content depth, structure, evidence, or clarity.

Return pure JSON only — no markdown fence, no text before or after.

JSON Schema:
{
  "summaries": {
    "short": "...",
    "medium": "...",
    "long": "..."
  },
  "keyPoints": [
    { "id": "01", "title": "...", "description": "..." }
  ],
  "importantTerms": [
    { "term": "...", "explanation": "..." }
  ],
  "improvementSuggestions": [
    { "category": "Missing Information | Structural Clarity | Content Depth | Examples & Evidence | Terminology", "title": "...", "detail": "..." }
  ]
}

Document filename: ${filename}
Document content:
${text}`;
}

/**
 * Handle large documents by chunking into ~15,000 char sections,
 * summarizing each section, and synthesizing into a master analysis.
 */
async function summarizeLargeDocumentWithGemini(text, filename, apiKey) {
  const chunks = splitIntoChunks(text, CHUNK_SIZE);
  console.log(`[summarizer] Processing ${chunks.length} chunks for ${filename}`);

  const chunkSummaries = [];
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  for (let i = 0; i < chunks.length; i++) {
    const chunkPrompt = `You are analyzing Section ${i + 1} of ${chunks.length} of document "${filename}".

Extract and summarize the main content of this section. Focus on:
- Key topics, concepts, and definitions
- Important data points, formulas, or findings
- Relationships between ideas
- Conclusions or takeaways

Write a clear, detailed summary (150-300 words). Do NOT invent information.

Section content:
${chunks[i]}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: chunkPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (res.ok) {
        const d = await res.json();
        const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (t) chunkSummaries.push(`--- SECTION ${i + 1} OF ${chunks.length} ---\n${t}`);
      }
    } catch (e) {
      console.warn(`[summarizer] Chunk ${i + 1} processing warning:`, e.message);
    }
  }

  if (chunkSummaries.length === 0) {
    // All chunk requests failed — fall back to local
    console.warn('[summarizer] All Gemini chunk requests failed, using local fallback');
    return generateLocalFallbackAnalysis(text, filename);
  }

  // Synthesize chunk summaries into final analysis
  const combinedChunkText = chunkSummaries.join('\n\n');
  return generateWithGemini(combinedChunkText, `${filename} (Synthesized from ${chunks.length} sections)`, apiKey);
}

/**
 * Split text into chunks at paragraph boundaries.
 */
function splitIntoChunks(text, chunkSize) {
  const chunks = [];
  let current = 0;

  while (current < text.length) {
    let end = current + chunkSize;
    if (end < text.length) {
      // Try to break at a paragraph boundary
      const nextParagraph = text.indexOf('\n\n', end);
      if (nextParagraph !== -1 && nextParagraph - end < 3000) {
        end = nextParagraph;
      } else {
        // Try to break at a sentence boundary
        const nextSentence = text.indexOf('. ', end);
        if (nextSentence !== -1 && nextSentence - end < 1000) {
          end = nextSentence + 1;
        }
      }
    } else {
      end = text.length;
    }
    chunks.push(text.substring(current, end));
    current = end;
  }

  return chunks;
}

// ────────────────────────────────────────────────────────────────
// Local statistical fallback summarizer
// ────────────────────────────────────────────────────────────────
function generateLocalFallbackAnalysis(text, filename) {
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Extract all proper sentences
  const rawSentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => {
      const words = s.split(/\s+/);
      return (
        words.length >= 6 &&
        /^[A-Z]/.test(s) &&
        !/^\d/.test(s) &&
        !/^[•\-*]/.test(s) &&
        s.split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length / words.length > 0.5
      );
    });

  if (rawSentences.length === 0) {
    // Try with relaxed filters
    const loose = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 4);
    if (loose.length === 0) return minimalResult(filename);
    rawSentences.push(...loose.slice(0, 12));
  }

  // Stop words for frequency analysis
  const STOP = new Set(['the','and','to','of','a','in','is','that','for','it','as','was','with','be','by','on','at','this','an','are','or','from','which','but','not','have','has','had','been','their','we','they','you','can','will','would','our','all','one','any','so','if','more','also','about','its','than','into','other','these','then','some','what','when','how','each','such','just','like','into','through','used','using','based','called','known','both','very','most','many','part','where','there','here','does','did','been','being','those','may','must','should','could','new','first','last','only','same','after','before','between','over','under','during','while','because','since','until','above','below','every','own','few','much','still','again','further','once','upon']);

  // Word frequency analysis
  const freq = {};
  cleanText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).forEach(w => {
    if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  });

  // Score sentences by term frequency
  const scoreSentence = (s) => {
    const words = s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const total = words.reduce((acc, w) => acc + (freq[w] || 0), 0);
    return total / Math.sqrt(Math.max(words.length, 1));
  };

  const scored = rawSentences.map((s, idx) => ({ s, score: scoreSentence(s), idx }));

  // Select unique sentences (avoid overlap)
  const selectUnique = (pool, maxCount) => {
    const selected = [];
    const usedKeywords = [];

    for (const item of pool) {
      const kw = new Set(
        item.s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => !STOP.has(w) && w.length > 3)
      );
      const isDup = usedKeywords.some(existing => {
        const inter = [...kw].filter(w => existing.has(w)).length;
        return inter / Math.max(kw.size, 1) > 0.5;
      });
      if (!isDup) {
        selected.push(item);
        usedKeywords.push(kw);
      }
      if (selected.length >= maxCount) break;
    }
    return selected;
  };

  const sortedByScore = [...scored].sort((a, b) => b.score - a.score);
  const uniqueTop = selectUnique(sortedByScore, 10);
  const byOrder = (arr) => [...arr].sort((a, b) => a.idx - b.idx);

  const shortItems = byOrder(uniqueTop.slice(0, 2));
  const mediumItems = byOrder(uniqueTop.slice(0, 5));
  const longItems = byOrder(uniqueTop.slice(0, 8));

  const short = shortItems.map(i => i.s).join(' ');
  const medium = mediumItems.map(i => i.s).join(' ');
  const longArr = longItems.map(i => i.s);
  const long = longArr.length > 3
    ? longArr.slice(0, Math.ceil(longArr.length / 2)).join(' ') +
      '\n\n' +
      longArr.slice(Math.ceil(longArr.length / 2)).join(' ')
    : longArr.join(' ');

  // Top keywords for key point titles
  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

  // Key points
  const keyPointSentences = selectUnique([...sortedByScore], 5);
  const keyPoints = byOrder(keyPointSentences).map((item, idx) => ({
    id: String(idx + 1).padStart(2, '0'),
    title: topKeywords[idx] || `Key Concept ${idx + 1}`,
    description: item.s
  }));

  // Important terms
  const importantTerms = topKeywords.slice(0, 6).map((term) => {
    const match = rawSentences.find(s => s.toLowerCase().includes(term.toLowerCase()));
    return {
      term,
      explanation: match
        ? match.substring(0, 150) + (match.length > 150 ? '...' : '')
        : `Key subject discussed in ${filename}.`
    };
  });

  // Improvement suggestions
  const suggestions = [];
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  if (wordCount < 400) {
    suggestions.push({ category: 'Content Depth', title: 'Expand Topic Coverage', detail: 'The document covers fundamentals but would benefit from deeper exploration of each concept with practical examples.' });
  }
  suggestions.push({ category: 'Examples & Evidence', title: 'Include Supporting Examples', detail: 'Adding concrete examples, case studies, or practical applications would strengthen the content and improve understanding.' });
  suggestions.push({ category: 'Structural Clarity', title: 'Improve Organization', detail: 'Consider organizing content with clear section headings and logical flow from introductory concepts to advanced topics.' });
  suggestions.push({ category: 'Terminology', title: 'Define Technical Terms', detail: 'Key technical terms should be formally defined at first use to ensure accessibility for all readers.' });

  return {
    summaries: {
      short: short || rawSentences[0] || 'Summary could not be generated from the extracted text.',
      medium: medium || short || 'Summary could not be generated from the extracted text.',
      long: long || medium || 'Summary could not be generated from the extracted text.'
    },
    keyPoints: keyPoints.length > 0 ? keyPoints : [{ id: '01', title: 'Core Content', description: rawSentences[0] || 'Limited text was available for analysis.' }],
    importantTerms: importantTerms.length > 0 ? importantTerms : [{ term: 'Document Content', explanation: `Main subject matter analyzed from ${filename}.` }],
    improvementSuggestions: suggestions
  };
}

function minimalResult(filename = 'Document') {
  return {
    summaries: {
      short: 'The document contains minimal extractable text. The content could not be adequately summarized.',
      medium: 'The document contains minimal extractable text. This may be a scanned document, an image-based PDF, or a document with very limited text content. Try uploading a text-based PDF for better results.',
      long: 'The document contains minimal extractable text, which prevented a comprehensive analysis. This typically occurs with scanned documents, image-heavy PDFs, or files where text is embedded as images rather than selectable text. For the best results, upload a PDF where you can select and copy text, or use a higher resolution scan.'
    },
    keyPoints: [{ id: '01', title: 'Limited Extractable Content', description: 'Very little readable text could be extracted from this document. The file may be scanned or image-based.' }],
    importantTerms: [{ term: 'Text Extraction', explanation: 'The process of converting document content into machine-readable text. This document had insufficient extractable text for full analysis.' }],
    improvementSuggestions: [{ category: 'Content Depth', title: 'Upload a Text-Based Document', detail: `The document "${filename}" had very little readable content. A text-based PDF or a higher-resolution scan would produce significantly better analysis results.` }]
  };
}

function sanitize(data) {
  return {
    summaries: {
      short: data?.summaries?.short || '',
      medium: data?.summaries?.medium || '',
      long: data?.summaries?.long || ''
    },
    keyPoints: Array.isArray(data?.keyPoints) ? data.keyPoints.map((kp, i) => ({
      id: kp.id || String(i + 1).padStart(2, '0'),
      title: kp.title || `Key Point ${i + 1}`,
      description: kp.description || ''
    })) : [],
    importantTerms: Array.isArray(data?.importantTerms) ? data.importantTerms.map((t) => ({
      term: t.term || 'Term',
      explanation: t.explanation || ''
    })) : [],
    improvementSuggestions: Array.isArray(data?.improvementSuggestions) ? data.improvementSuggestions.map(s => ({
      category: s.category || 'General',
      title: s.title || 'Suggestion',
      detail: s.detail || ''
    })) : []
  };
}
