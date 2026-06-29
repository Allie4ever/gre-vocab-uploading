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
});
