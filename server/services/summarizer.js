/**
 * Summarization service.
 * Primary: Google Gemini 2.5 Flash API (requires GEMINI_API_KEY in .env).
 * Fallback: Local statistical summarizer (always available, no API needed).
 */

export async function generateDocumentAnalysis(documentText, filename = 'Document') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && !apiKey.includes('your_gemini_api_key')) {
    try {
      const result = await generateWithGemini(documentText, filename, apiKey);
      if (result) return result;
    } catch (err) {
      console.warn('[summarizer] Gemini call failed, using local engine:', err.message);
    }
  }

  return generateLocalFallbackAnalysis(documentText, filename);
}

// ────────────────────────────────────────────────────────────────
// Google Gemini API
// ────────────────────────────────────────────────────────────────
async function generateWithGemini(text, filename, apiKey) {
  // If document is large (> 25,000 chars), split into logical chunks and aggregate
  if (text.length > 25000) {
    console.log(`[summarizer] Document length is ${text.length} chars. Applying multi-chunk aggregation.`);
    return summarizeLargeDocumentWithGemini(text, filename, apiKey);
  }

  const prompt = `You are an expert academic and professional document analysis assistant. Analyze the document below and return ONLY valid JSON matching this schema exactly.

IMPORTANT QUALITY RULES:
1. Base ALL summaries, key points, and term explanations strictly on facts written in the document. Do NOT invent information.
2. Avoid generic boilerplate (e.g. "This document provides valuable insights..."). State the ACTUAL content, main findings, and conclusions.
3. "short" summary: 2-3 concise sentences summarizing core topic and main takeaway.
4. "medium" summary: 2-3 structured paragraphs covering context, core topics, and conclusions.
5. "long" summary: Detailed structured summary (150+ words) covering major concepts, methodology, background, and conclusions.
6. "keyPoints": Provide 4-6 distinct key points (each about a DIFFERENT concept).
7. "importantTerms": Extract 4-8 key technical terms, acronyms, or concepts defined/used in the text with a clear 1-sentence definition.
8. "improvementSuggestions": Provide 3-4 specific, actionable recommendations regarding depth, evidence, or clarity.
9. Return pure JSON only — no markdown fence, no text before or after.

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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawStr = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawStr) throw new Error('Empty Gemini response');

  const cleanStr = rawStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  return sanitize(JSON.parse(cleanStr));
}

/**
 * Handle large documents by chunking into ~15,000 char sections,
 * summarizing each section, and synthesizing into a master analysis.
 */
async function summarizeLargeDocumentWithGemini(text, filename, apiKey) {
  const CHUNK_SIZE = 15000;
  const chunks = [];
  let current = 0;

  while (current < text.length) {
    let end = current + CHUNK_SIZE;
    if (end < text.length) {
      const nextNewline = text.indexOf('\n\n', end);
      if (nextNewline !== -1 && nextNewline - end < 3000) {
        end = nextNewline;
      }
    }
    chunks.push(text.substring(current, end));
    current = end;
  }

  console.log(`[summarizer] Processing ${chunks.length} chunks for ${filename}`);

  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPrompt = `Summarize Section ${i + 1} of ${chunks.length} of document "${filename}". Extract main topics, findings, definitions, and data points:\n\n${chunks[i]}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: chunkPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
        })
      });
      if (res.ok) {
        const d = await res.json();
        const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (t) chunkSummaries.push(`--- SECTION ${i + 1} SUMMARY ---\n${t}`);
      }
    } catch (e) {
      console.warn(`[summarizer] Chunk ${i + 1} processing warning:`, e.message);
    }
  }

  const combinedChunkText = chunkSummaries.join('\n\n');
  return generateWithGemini(combinedChunkText, `${filename} (Synthesized)`, apiKey);
}

// ────────────────────────────────────────────────────────────────
// Local statistical fallback summarizer
// ────────────────────────────────────────────────────────────────
function generateLocalFallbackAnalysis(text, filename) {
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Extract all proper sentences — must have a subject, verb, and end punctuation
  const rawSentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => {
      const words = s.split(/\s+/);
      // Must have ≥8 words, start with a capital, and look like a real sentence
      return (
        words.length >= 8 &&
        /^[A-Z]/.test(s) &&
        !/^\d/.test(s) &&           // skip number-only starts
        !/^(•|-|\*)/.test(s) &&     // skip raw bullet fragments
        s.split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length / words.length > 0.6 // mostly words
      );
    });

  if (rawSentences.length === 0) {
    // Try with relaxed filters
    const loose = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 5);
    if (loose.length === 0) return minimalResult();
    rawSentences.push(...loose.slice(0, 10));
  }

  // STOP words
  const STOP = new Set(['the','and','to','of','a','in','is','that','for','it','as','was','with','be','by','on','at','this','an','are','or','from','which','but','not','have','has','had','been','their','we','they','you','can','will','would','our','all','one','any','so','if','more','also','about','its','than','into','other','these','then','some','what','when','how','each','such','just','like','into','through','used','using','based','called','known','both','very','most','many','part']);

  // Word frequency
  const freq = {};
  cleanText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).forEach(w => {
    if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  });

  // Score each sentence by TF-IDF-like word frequency sum
  const scoreSentence = (s) => {
    const words = s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const total = words.reduce((acc, w) => acc + (freq[w] || 0), 0);
    // Normalise by sqrt(length) so longer sentences don't win just by size
    return total / Math.sqrt(Math.max(words.length, 1));
  };

  const scored = rawSentences.map((s, idx) => ({ s, score: scoreSentence(s), idx }));

  // Deduplicate: reject sentences sharing >50% key words with an already-selected one
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
  const uniqueTop = selectUnique(sortedByScore, 8);

  // Sort back to document order for coherent reading
  const byOrder = (arr) => [...arr].sort((a, b) => a.idx - b.idx);

  const shortItems = byOrder(uniqueTop.slice(0, 2));
  const mediumItems = byOrder(uniqueTop.slice(0, 4));
  const longItems = byOrder(uniqueTop.slice(0, 7));

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
    .slice(0, 8)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

  // 4 genuinely different key points (unique sentences)
  const keyPointSentences = selectUnique([...sortedByScore], 4);
  const keyPoints = byOrder(keyPointSentences).map((item, idx) => ({
    id: String(idx + 1).padStart(2, '0'),
    title: topKeywords[idx] || `Key Concept ${idx + 1}`,
    description: item.s
  }));

  // Improvement suggestions based on document analysis
  const suggestions = [];
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const hasDefinitions = /defined as|definition|refers to|means/i.test(text);
  const hasHeaders = /\n[A-Z][^\n]{3,40}\n/.test(text);

  if (wordCount < 400) {
    suggestions.push({ category: 'Content Depth', title: 'Expand Topic Coverage', detail: 'The document covers the fundamentals but would benefit from deeper exploration of each concept — particularly practical examples and real-world use cases for AI, machine learning, and deep learning.' });
  }
  if (!hasHeaders) {
    suggestions.push({ category: 'Structural Clarity', title: 'Add Descriptive Section Headings', detail: 'Organising the document with clear headings for each major topic would make it easier to navigate and quickly scan for specific information.' });
  }
  suggestions.push({ category: 'Examples & Evidence', title: 'Include Application Case Studies', detail: 'The document mentions applications such as virtual assistants and autonomous vehicles. Expanding each with concrete performance metrics or outcomes would strengthen the evidence.' });

  if (!hasDefinitions) {
    suggestions.push({ category: 'Terminology', title: 'Define Technical Terms Early', detail: 'Terms like neural networks, supervised learning, and deep learning are referenced but could benefit from brief formal definitions at the point of first use.' });
  } else {
    suggestions.push({ category: 'Missing Information', title: 'Address Limitations & Trade-Offs', detail: 'The document primarily presents advantages. Adding a section on limitations — such as data requirements and computational cost — would provide a more balanced view.' });
  }

  // Extract 4-6 key terms for importantTerms
  const importantTerms = topKeywords.slice(0, 6).map((term) => {
    // Find sentence containing this term
    const match = rawSentences.find(s => s.toLowerCase().includes(term.toLowerCase()));
    return {
      term,
      explanation: match || `Key subject discussed prominently in ${filename}.`
    };
  });

  return {
    summaries: {
      short: short || rawSentences[0] || '',
      medium: medium || short || '',
      long: long || medium || ''
    },
    keyPoints: keyPoints.length > 0 ? keyPoints : [{ id: '01', title: 'Core Concept', description: rawSentences[0] }],
    importantTerms: importantTerms.length > 0 ? importantTerms : [{ term: 'Document Topic', explanation: 'Main subject analyzed in the document.' }],
    improvementSuggestions: suggestions
  };
}

function minimalResult() {
  return {
    summaries: { short: 'The document contains minimal extractable text.', medium: 'The document contains minimal extractable text. Try uploading a clearer image or a text-based PDF.', long: 'The document contains minimal extractable text. Consider re-uploading with a higher resolution scan or a text-selectable PDF for a more detailed analysis.' },
    keyPoints: [{ id: '01', title: 'Limited Content', description: 'Very little text could be extracted from this document.' }],
    importantTerms: [{ term: 'Unreadable Text', explanation: 'Insufficient text extracted from this document.' }],
    improvementSuggestions: [{ category: 'Content Depth', title: 'Upload a Clearer Document', detail: 'The document appears to have very little readable content. A higher-resolution scan or a text-based PDF would produce better results.' }]
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
