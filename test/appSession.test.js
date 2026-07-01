import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_SESSION_STORAGE_KEY,
  loadAppSession,
  saveAppSession,
  saveHomeSession,
} from "../src/appSession.js";

function makeStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: (key) => {
      assert.equal(key, APP_SESSION_STORAGE_KEY);
      return value;
    },
    setItem: (key, nextValue) => {
      assert.equal(key, APP_SESSION_STORAGE_KEY);
      value = nextValue;
    },
  };
}

test("saves and restores a review session", () => {
  const storage = makeStorage();
  const session = {
    screen: "review",
    listId: "library-1",
    mode: "starred",
    index: 12,
    showMeaning: false,
  };

  assert.equal(saveAppSession(session, storage), true);
  assert.deepEqual(loadAppSession(storage), session);
});

test("falls back to home for invalid or corrupt sessions", () => {
  const invalidMode = makeStorage(JSON.stringify({
    screen: "review",
    listId: "library-1",
    mode: "unknown",
    index: 0,
    showMeaning: false,
  }));
  const corrupt = makeStorage("{");

  assert.deepEqual(loadAppSession(invalidMode), { screen: "home" });
  assert.deepEqual(loadAppSession(corrupt), { screen: "home" });
});

test("updates the persisted screen to home", () => {
  const storage = makeStorage();

  saveHomeSession(storage);
  assert.deepEqual(loadAppSession(storage), { screen: "home" });
});
