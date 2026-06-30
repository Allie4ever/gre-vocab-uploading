const CHINESE_CHARACTER = /[\u3400-\u9fff]/u;
const ENGLISH_TERM = /^[A-Za-z][A-Za-z\s'’\-]*$/u;

export function parseVocabulary(text) {
  const words = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine
      .trim()
      .replace(/^[•·●▪◦]\s*/, "")
      .replace(/^\d+[.)、]\s*/, "");

    if (!line) continue;

    const firstChineseIndex = line.search(CHINESE_CHARACTER);
    if (firstChineseIndex < 1) continue;

    // Everything before the first Chinese character is the English term.
    // Remove only the optional delimiter directly in front of the meaning.
    const word = line
      .slice(0, firstChineseIndex)
      .replace(/[\s:：\-–—]+$/u, "")
      .trim()
      .replace(/\s+/g, " ");
    const meaning = line.slice(firstChineseIndex).trim();

    if (!word || !meaning || !ENGLISH_TERM.test(word)) continue;

    words.push({
      id: `${word}-${words.length}`,
      word,
      meaning,
      mastered: false,
    });
  }

  return words;
}
