export const APP_SESSION_STORAGE_KEY = "gre-word-app-session-v1";

const REVIEW_MODES = new Set(["all", "starred", "unmastered", "mastered"]);

export function loadAppSession(storage = globalThis.localStorage) {
  if (!storage) return { screen: "home" };

  try {
    const value = JSON.parse(storage.getItem(APP_SESSION_STORAGE_KEY) || "null");
    if (value?.screen === "home") return { screen: "home" };
    if (
      value?.screen !== "review"
      || typeof value.listId !== "string"
      || !REVIEW_MODES.has(value.mode)
      || !Number.isInteger(value.index)
      || value.index < 0
      || typeof value.showMeaning !== "boolean"
    ) {
      return { screen: "home" };
    }
    return {
      screen: "review",
      listId: value.listId,
      mode: value.mode,
      index: value.index,
      showMeaning: value.showMeaning,
    };
  } catch {
    return { screen: "home" };
  }
}

export function saveAppSession(value, storage = globalThis.localStorage) {
  if (!storage) return false;

  try {
    storage.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveHomeSession(storage = globalThis.localStorage) {
  return saveAppSession({ screen: "home" }, storage);
}
