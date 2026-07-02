function createWordId(index) {
  return (
    globalThis.crypto?.randomUUID?.()
    || `manual-word-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
  );
}

export function createManualWords(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error("请至少添加一个单词。");
  }

  return entries.map((entry, index) => {
    const word = entry?.word?.trim() || "";
    const meaning = entry?.meaning?.trim() || "";

    if (!word || !meaning) {
      throw new Error(`第 ${index + 1} 行的英文单词和中文释义都必须填写。`);
    }

    return {
      id: createWordId(index),
      word,
      meaning,
      mastered: false,
    };
  });
}
