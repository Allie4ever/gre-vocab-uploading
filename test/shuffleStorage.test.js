import test from "node:test";
import assert from "node:assert/strict";
import {
  SHUFFLE_STORAGE_KEY,
  createShuffleOrder,
  fisherYatesShuffle,
  loadLibraryShuffleState,
  reconcileShuffleOrder,
  saveLibraryShuffleState,
} from "../src/shuffleStorage.js";

function makeStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: (key) => {
      assert.equal(key, SHUFFLE_STORAGE_KEY);
      return value;
    },
    setItem: (key, nextValue) => {
      assert.equal(key, SHUFFLE_STORAGE_KEY);
      value = nextValue;
    },
  };
}

const words = [
  { id: "word-0", word: "lucid" },
  { id: "word-1", word: "arduous" },
  { id: "word-2", word: "recoil" },
];

test("uses Fisher-Yates shuffle without mutating the source array", () => {
  const source = ["a", "b", "c"];
  const shuffled = fisherYatesShuffle(source, () => 0);

  assert.deepEqual(source, ["a", "b", "c"]);
  assert.deepEqual(shuffled, ["b", "c", "a"]);
});

test("creates a shuffle order from word ids", () => {
  assert.deepEqual(
    createShuffleOrder(words, () => 0),
    ["word-1", "word-2", "word-0"],
  );
});

test("loads and saves each library shuffle state independently", () => {
  const storage = makeStorage();

  saveLibraryShuffleState("library-a", {
    enabled: true,
    order: ["word-2", "word-0", "word-1"],
  }, storage);
  saveLibraryShuffleState("library-b", {
    enabled: false,
    order: ["word-1", "word-0", "word-2"],
  }, storage);

  assert.deepEqual(
    loadLibraryShuffleState("library-a", words, storage),
    {
      enabled: true,
      order: ["word-2", "word-0", "word-1"],
    },
  );
  assert.deepEqual(
    loadLibraryShuffleState("library-b", words, storage),
    {
      enabled: false,
      order: ["word-1", "word-0", "word-2"],
    },
  );
});

test("reconciles shuffle order after words are added or removed", () => {
  assert.deepEqual(
    reconcileShuffleOrder(
      [
        { id: "word-1" },
        { id: "word-2" },
        { id: "word-3" },
      ],
      ["removed-word", "word-2", "word-1", "word-2"],
    ),
    ["word-2", "word-1", "word-3"],
  );
});
