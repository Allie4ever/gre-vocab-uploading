export const SHUFFLE_STORAGE_KEY = "gre-word-shuffle-state-v1";

function loadAllShuffleStates(storage = globalThis.localStorage) {
  if (!storage) return {};

  try {
    const parsed = JSON.parse(storage.getItem(SHUFFLE_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function persistAllShuffleStates(states, storage = globalThis.localStorage) {
  if (!storage) return false;

  try {
    storage.setItem(SHUFFLE_STORAGE_KEY, JSON.stringify(states));
    return true;
  } catch {
    return false;
  }
}

export function fisherYatesShuffle(items, random = Math.random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [
      shuffled[targetIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

export function createShuffleOrder(words, random = Math.random) {
  return fisherYatesShuffle(words.map((word) => word.id), random);
}

export function reconcileShuffleOrder(words, savedOrder = []) {
  const validIds = new Set(words.map((word) => word.id));
  const seenIds = new Set();
  const reconciled = [];

  savedOrder.forEach((id) => {
    if (validIds.has(id) && !seenIds.has(id)) {
      seenIds.add(id);
      reconciled.push(id);
    }
  });

  words.forEach((word) => {
    if (!seenIds.has(word.id)) {
      seenIds.add(word.id);
      reconciled.push(word.id);
    }
  });

  return reconciled;
}

export function loadLibraryShuffleState(
  libraryId,
  words,
  storage = globalThis.localStorage,
) {
  if (!libraryId) {
    return { enabled: false, order: words.map((word) => word.id) };
  }

  const states = loadAllShuffleStates(storage);
  const saved = states[libraryId];
  const savedOrder = Array.isArray(saved?.order) ? saved.order : [];

  return {
    enabled: saved?.enabled === true,
    order: reconcileShuffleOrder(words, savedOrder),
  };
}

export function saveLibraryShuffleState(
  libraryId,
  state,
  storage = globalThis.localStorage,
) {
  if (!libraryId) return false;

  const states = loadAllShuffleStates(storage);
  states[libraryId] = {
    enabled: state.enabled === true,
    order: Array.isArray(state.order) ? state.order : [],
  };
  return persistAllShuffleStates(states, storage);
}

export function removeLibraryShuffleState(
  libraryId,
  storage = globalThis.localStorage,
) {
  if (!libraryId) return false;

  const states = loadAllShuffleStates(storage);
  if (!Object.prototype.hasOwnProperty.call(states, libraryId)) return true;
  delete states[libraryId];
  return persistAllShuffleStates(states, storage);
}
