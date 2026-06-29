import test from "node:test";
import assert from "node:assert/strict";
import { parseVocabulary } from "../src/parser.js";

test("parses complete English phrases until the first Chinese character", () => {
  const input = [
    "recoil from 畏缩",
    "be susceptible to 易受……影响",
    "give way to 让步于",
    "mother-in-law 婆婆",
    "can't help 情不自禁",
  ].join("\n");

  assert.deepEqual(
    parseVocabulary(input).map(({ word, meaning }) => ({ word, meaning })),
    [
      { word: "recoil from", meaning: "畏缩" },
      { word: "be susceptible to", meaning: "易受……影响" },
      { word: "give way to", meaning: "让步于" },
      { word: "mother-in-law", meaning: "婆婆" },
      { word: "can't help", meaning: "情不自禁" },
    ],
  );
});

test("supports colon, dash, tab, and plain-space delimiters", () => {
  const input = [
    "recoil from 畏缩",
    "recoil from：畏缩",
    "recoil from - 畏缩",
    "recoil from\t畏缩",
  ].join("\n");

  const parsed = parseVocabulary(input);

  assert.equal(parsed.length, 4);
  for (const entry of parsed) {
    assert.equal(entry.word, "recoil from");
    assert.equal(entry.meaning, "畏缩");
  }
});

test("returns every valid entry without a preview limit", () => {
  const input = Array.from(
    { length: 12 },
    (_, index) => `word ${String.fromCharCode(97 + index)} 中文释义${index + 1}`,
  ).join("\n");

  assert.equal(parseVocabulary(input).length, 12);
});
