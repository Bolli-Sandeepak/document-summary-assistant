/**
 * Text cleaning service.
 * Removes OCR artifacts, duplicated fragments, slide junk, and normalizes whitespace.
 */

/**
 * Main cleaner — call after combining all extracted/OCR text.
 * @param {string} rawText
 * @returns {string} cleaned text
 */
export function cleanExtractedText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  // 1. Remove inline noise & symbols before line-by-line checks
  let text = removeInlineNoise(rawText);

  // 2. Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Fix multi-column slide OCR artifacts.
  text = text.replace(/(\b\w+\b)\s+\1\b/gi, '$1');

  // 4. Remove inline same-phrase repetitions
  text = text.replace(/\b(.{4,80}?)\s+\1\b/g, '$1');
  text = text.replace(/(\w+)\s+\1\b/g, '$1');

  // 5. Split into lines for per-line cleaning
  const rawLines = text.split('\n');
  const cleanedLines = [];
  const seenLines = new Map();

  for (const line of rawLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      cleanedLines.push('');
      continue;
    }

    if (isGarbageLine(trimmed)) continue;

    const normalized = trimmed.replace(/\s+/g, ' ');

    // Deduplicate slide headers
    const key = normalized.toLowerCase();
    const count = seenLines.get(key) || 0;
    if (count >= 2) continue;
    seenLines.set(key, count + 1);

    cleanedLines.push(normalized);
  }

  // 6. Collapse consecutive blank lines
  const collapsed = [];
  let prevWasBlank = false;
  for (const line of cleanedLines) {
    if (line === '') {
      if (!prevWasBlank) collapsed.push('');
      prevWasBlank = true;
    } else {
      collapsed.push(line);
      prevWasBlank = false;
    }
  }

  // 7. Remove page markers
  let result = collapsed.join('\n');
  result = result.replace(/\n*--- Page \d+ ---\n*/g, '\n\n');

  // 8. Merge isolated fragments
  result = mergeStrayFragments(result);

  // 9. Paragraph deduplication
  result = removeRepeatedParagraphs(result);

  // 10. Clean punctuation spacing issues often introduced by OCR
  result = cleanOcrPunctuation(result);

  return result.trim();
}

/**
 * Remove inline noise sequences (like "=A / < s ors / é 447", "Too = = — a ge s = — id")
 */
function removeInlineNoise(text) {
  // Replace double symbols with space to ease parsing
  let temp = text.replace(/[=<>\/\\|_\~\+\—\-]{2,}/g, ' ');

  const lines = temp.split('\n');
  const processedLines = lines.map(line => {
    // Preserve header formatting if it's markdown
    if (line.trim().startsWith('#')) return line;

    const words = line.split(/\s+/);
    const cleanedWords = [];
    
    let i = 0;
    while (i < words.length) {
      const w = words[i];
      if (!w) {
        i++;
        continue;
      }
      
      const cleanW = w.replace(/[.,;:\?!()\"'“”’]/g, '');

      // 1. Pure symbols/operators -> skip
      if (/^[=\-\—\+\~\<\>\/\\\|_#\*\@\$\%\^&\(\):“’”‘"'\.,;]+$/.test(w)) {
        i++;
        continue;
      }
      
      // 2. Short non-alphanumeric noise -> skip
      if (/^[=\-\—\+\~\<\>\/\\\|_#\*\@\$\%\^]{2,}$/.test(w)) {
        i++;
        continue;
      }

      cleanedWords.push(w);
      i++;
    }
    
    return cleanedWords.join(' ');
  });

  return processedLines.join('\n');
}

/**
 * Clean spacing and formatting around punctuation marks often broken by Tesseract
 */
function cleanOcrPunctuation(text) {
  return text
    // Fix spaces before punctuation (e.g., "word ." -> "word.")
    .replace(/\s+([.,;:!\?])/g, '$1')
    // Fix multiple spacing
    .replace(/[ ]{2,}/g, ' ')
    // Ensure space after punctuation
    .replace(/([.,;:!\?])([a-zA-Z])/g, '$1 $2')
    // Fix quotes spacing
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

/**
 * Merge isolated 1-3 word lines into the nearest paragraph to prevent stray fragments.
 */
function mergeStrayFragments(text) {
  const paragraphs = text.split(/\n\n+/);
  const merged = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    const words = para.split(/\s+/).filter(Boolean).length;

    if (words <= 3 && words > 0 && !/^#+/.test(para)) {
      if (merged.length > 0) {
        merged[merged.length - 1] = merged[merged.length - 1] + ' ' + para;
      } else {
        merged.push(para);
      }
    } else {
      merged.push(para);
    }
  }

  return merged.join('\n\n');
}

/**
 * Detect junk/garbage lines produced by OCR or PDF extraction artifacts.
 */
function isGarbageLine(line) {
  if (line.length <= 2) return true;

  if (/\?{3,}/.test(line)) return true;

  if (/^[\d\s\.\-\|\/\\:]+$/.test(line)) return true;

  if (/^[^a-zA-Z0-9\s]{3,}$/.test(line)) return true;

  const nonSpace = line.replace(/\s/g, '');
  if (nonSpace.length > 5) {
    const alphaCount = (nonSpace.match(/[a-zA-Z]/g) || []).length;
    if (alphaCount / nonSpace.length < 0.3) return true;
  }

  return false;
}

/**
 * Remove exact-match duplicate paragraphs across the full text.
 */
function removeRepeatedParagraphs(text) {
  const paragraphs = text.split(/\n\n+/);
  const seen = new Set();
  const unique = [];

  for (const para of paragraphs) {
    const key = para.trim().toLowerCase().replace(/\s+/g, ' ');
    if (key.length < 15) {
      unique.push(para);
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(para);
    }
  }

  return unique.join('\n\n');
}
