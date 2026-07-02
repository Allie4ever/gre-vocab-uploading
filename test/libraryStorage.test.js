import test from "node:test";
import assert from "node:assert/strict";
import {
  LIBRARY_STORAGE_KEY,
  createLibrary,
  loadLibraries,
  persistLibraries,
  updateLibrary,
} from "../src/libraryStorage.js";

function makeStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: () => value,
    setItem: (key, nextValue) => {
      assert.equal(key, LIBRARY_STORAGE_KEY);
      value = nextValue;
    },
  };
}

test("saves and loads complete word libraries", () => {
  const storage = makeStorage();
  const library = createLibrary(
    "GRE 高频词",
    [{ id: "word-0", word: "arduous", meaning: "艰难的" }],
    "2026-06-29T00:00:00.000Z",
  );

  persistLibraries([library], storage);
  assert.deepEqual(loadLibraries(storage), [library]);
});

test("overwriting preserves creation time and updates content", () => {
  const original = {
    id: "library-1",
    name: "旧名称",
    words: [],
    starredWordIds: ["word-0", "removed-word"],
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  };
  const updated = updateLibrary(
    original,
    "新名称",
    [{ id: "word-0", word: "recoil from", meaning: "畏缩" }],
    "2026-06-29T00:00:00.000Z",
  );

  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.updatedAt, "2026-06-29T00:00:00.000Z");
  assert.equal(updated.words.length, 1);
  assert.equal(updated.lastIndex, 0);
  assert.deepEqual(updated.starredWordIds, ["word-0"]);
});

test("adds an empty star list when loading older libraries", () => {
  const legacyLibrary = {
    id: "library-1",
    name: "旧词库",
    words: [{ id: "word-0", word: "lucid", meaning: "清晰的" }],
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  };
  const storage = makeStorage(JSON.stringify([legacyLibrary]));

  assert.deepEqual(loadLibraries(storage)[0].starredWordIds, []);
  assert.equal(loadLibraries(storage)[0].words[0].mastered, false);
  assert.equal(loadLibraries(storage)[0].lastIndex, 0);
});

test("clamps a saved lastIndex to the current library bounds", () => {
  const library = {
    id: "library-1",
    name: "缩短后的词库",
    words: [
      { id: "word-0", word: "lucid", meaning: "清晰的" },
      { id: "word-1", word: "arduous", meaning: "艰难的" },
    ],
    starredWordIds: [],
    lastIndex: 99,
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
  };
  const storage = makeStorage(JSON.stringify([library]));

  assert.equal(loadLibraries(storage)[0].lastIndex, 1);
});

test("appending words preserves existing progress, stars, and mastery", () => {
  const original = {
    id: "library-1",
    name: "GRE 生词",
    words: [
      {
        id: "word-0",
        word: "lucid",
        meaning: "清晰的",
        mastered: true,
      },
      {
        id: "word-1",
        word: "arduous",
        meaning: "艰难的",
        mastered: false,
      },
    ],
    starredWordIds: ["word-0"],
    lastIndex: 1,
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  };
  const appended = updateLibrary(
    original,
    original.name,
    [
      ...original.words,
      {
        id: "word-2",
        word: "recoil from",
        meaning: "畏缩",
        mastered: false,
      },
    ],
    "2026-07-02T00:00:00.000Z",
  );

  assert.equal(appended.words.length, 3);
  assert.equal(appended.words[0].mastered, true);
  assert.deepEqual(appended.starredWordIds, ["word-0"]);
  assert.equal(appended.lastIndex, 1);
});
