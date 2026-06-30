export const LIBRARY_STORAGE_KEY = "gre-word-libraries-v1";

export function loadLibraries(storage = globalThis.localStorage) {
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(LIBRARY_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (library) =>
          library
          && typeof library.id === "string"
          && typeof library.name === "string"
          && Array.isArray(library.words)
          && typeof library.createdAt === "string"
          && typeof library.updatedAt === "string",
      )
      .map((library) => {
        const wordIds = new Set(library.words.map((word) => word.id));
        return {
          ...library,
          starredWordIds: Array.isArray(library.starredWordIds)
            ? [...new Set(library.starredWordIds)].filter((id) => wordIds.has(id))
            : [],
        };
      });
  } catch {
    return [];
  }
}

export function persistLibraries(libraries, storage = globalThis.localStorage) {
  if (!storage) throw new Error("当前浏览器不支持本地存储。");
  storage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(libraries));
}

export function createLibrary(name, words, now = new Date().toISOString()) {
  const id =
    globalThis.crypto?.randomUUID?.()
    || `library-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    name: name.trim(),
    words,
    starredWordIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateLibrary(library, name, words, now = new Date().toISOString()) {
  const wordIds = new Set(words.map((word) => word.id));

  return {
    ...library,
    name: name.trim(),
    words,
    starredWordIds: (library.starredWordIds || []).filter((id) => wordIds.has(id)),
    updatedAt: now,
  };
}
