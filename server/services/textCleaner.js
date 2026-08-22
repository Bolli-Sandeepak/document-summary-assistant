/**
 * Text cleaning service.
 * Fixes common PDF extraction artifacts: joined words, broken spacing,
 * duplicate lines, OCR noise, and normalizes whitespace.
 */

/**
 * Main cleaner — call after extracting text from PDF or OCR.
 * @param {string} rawText
 * @returns {string} cleaned text
 */
export function cleanExtractedText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Fix common PDF extraction artifacts
  text = fixJoinedWords(text);

  // 3. Fix broken hyphenation (word-\n continuation)
  text = text.replace(/(\w)-\n(\w)/g, '$1$2');

  // 4. Process line by line
  const rawLines = text.split('\n');
  const cleanedLines = [];
  const seenLines = new Map();

  for (const line of rawLines) {
    const trimmed = line.trim();

    // Keep blank lines as paragraph separators
    if (!trimmed) {
      cleanedLines.push('');
      continue;
    }

    // Skip garbage/noise lines
    if (isGarbageLine(trimmed)) continue;

    // Normalize internal whitespace (but preserve the line)
    const normalized = trimmed.replace(/\s+/g, ' ');

    // Deduplicate: allow up to 2 occurrences (headers may repeat across pages)
    const key = normalized.toLowerCase().replace(/\s+/g, ' ');
    if (key.length > 10) {
      const count = seenLines.get(key) || 0;
      if (count >= 2) continue;
      seenLines.set(key, count + 1);
    }

    cleanedLines.push(normalized);
  }

  // 5. Collapse consecutive blank lines (max 1 blank line between paragraphs)
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

  let result = collapsed.join('\n');

  // 6. Remove page markers/numbers
  result = result.replace(/\n*---\s*Page\s*\d+\s*---\n*/g, '\n\n');
  result = result.replace(/^\s*\d+\s*$/gm, ''); // Standalone page numbers

  // 7. Clean punctuation spacing (OCR artifacts)
  result = cleanPunctuation(result);

  // 8. Remove repeated paragraphs (exact match across full text)
  result = removeRepeatedParagraphs(result);

  // 9. Final whitespace cleanup
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Fix words that were joined together during PDF extraction.
 * Common patterns:
 * - "TensorCont'd" → "Tensor Cont'd"
 * - "1DTensor/Vector" → "1D Tensor / Vector"
 * - "ForExample" → "For Example" (camelCase in non-code context)
 * - "Selva Kumar S(SCOPE)" → "Selva Kumar S (SCOPE)"
 */
function fixJoinedWords(text) {
  // Add space before opening parentheses that follow a word character directly
  text = text.replace(/(\w)\(([A-Z])/g, '$1 ($2');

  // Fix "word/word" where the slash has no spaces (but preserve URLs and paths)
  text = text.replace(/([a-zA-Z])\/([a-zA-Z])/g, (match, before, after) => {
    // Don't break URL-like patterns
    if (/https?/.test(before)) return match;
    return `${before} / ${after}`;
  });

  // Fix camelCase-like joins in non-code text
  // "ForExample" → "For Example", "TensorCont" → "Tensor Cont"
  // Only split at lowercase→uppercase boundaries where both parts are ≥2 chars
  text = text.replace(/([a-z])([A-Z][a-z])/g, (match, before, after) => {
    return `${before} ${after}`;
  });

  // Fix number-letter joins: "1DTensor" → "1D Tensor", "2DMatrix" → "2D Matrix"
  text = text.replace(/(\d)([A-Z][a-z]{2,})/g, '$1 $2');

  // Fix "word•word" or "word·word" (bullet joins)
  text = text.replace(/(\w)[•·](\w)/g, '$1 • $2');

  // Fix missing space after periods in mid-sentence
  // "sentence.Next" → "sentence. Next" (but not "Dr.Smith" or "e.g.")
  text = text.replace(/([a-z])\.([A-Z][a-z]{2,})/g, '$1. $2');

  // Fix missing space after commas
  text = text.replace(/,([A-Za-z])/g, ', $1');

  return text;
}

/**
 * Clean spacing around punctuation marks.
 */
function cleanPunctuation(text) {
  return text
    // Fix spaces before punctuation ("word ." → "word.")
    .replace(/\s+([.,;:!?])/g, '$1')
    // Fix multiple spaces
    .replace(/ {2,}/g, ' ')
    // Ensure space after punctuation when followed by a letter
    .replace(/([.,;:!?])([a-zA-Z])/g, '$1 $2')
    // Fix parentheses spacing
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

/**
 * Detect junk/garbage lines produced by PDF extraction or OCR.
 */
function isGarbageLine(line) {
  // Very short lines with no alphabetic content
  if (line.length <= 2) return true;

  // Lines full of question marks (OCR noise)
  if (/\?{3,}/.test(line)) return true;

  // Lines that are just numbers, dots, dashes, pipes
  if (/^[\d\s.\-|/\\:_,]+$/.test(line) && line.length < 20) return true;

  // Lines of pure symbols/non-alphabetic characters
  if (/^[^a-zA-Z0-9\s]{3,}$/.test(line)) return true;

  // Lines with very low alphabetic ratio (likely OCR noise)
  const nonSpace = line.replace(/\s/g, '');
  if (nonSpace.length > 8) {
    const alphaCount = (nonSpace.match(/[a-zA-Z]/g) || []).length;
    if (alphaCount / nonSpace.length < 0.25) return true;
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
    // Don't deduplicate very short paragraphs (could be bullet items)
    if (key.length < 20) {
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
