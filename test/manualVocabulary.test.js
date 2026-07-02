import test from "node:test";
import assert from "node:assert/strict";
import { createManualWords } from "../src/manualVocabulary.js";

test("turns trimmed manual entries into compatible unmastered words", () => {
  const words = createManualWords([
    { word: "  lucid  ", meaning: " 清晰的 " },
    { word: "recoil from", meaning: "畏缩" },
  ]);

  assert.equal(words.length, 2);
  assert.equal(words[0].word, "lucid");
  assert.equal(words[0].meaning, "清晰的");
  assert.equal(words[0].mastered, false);
  assert.equal(typeof words[0].id, "string");
  assert.notEqual(words[0].id, words[1].id);
});

test("rejects empty English words or meanings", () => {
  assert.throws(
    () => createManualWords([{ word: "", meaning: "清晰的" }]),
    /第 1 行/,
  );
  assert.throws(
    () => createManualWords([{ word: "lucid", meaning: " " }]),
    /第 1 行/,
  );
  assert.throws(() => createManualWords([]), /至少添加一个单词/);
});
