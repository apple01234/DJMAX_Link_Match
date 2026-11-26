import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTier, tierFromRating } from "../src/lib/types.ts";

test("레이팅 → V-ARCHIVE 티어 그룹 (그룹 최저 점수 경계)", () => {
  assert.equal(tierFromRating(9950), "GM");
  assert.equal(tierFromRating(9949), "M");
  assert.equal(tierFromRating(9700), "M");
  assert.equal(tierFromRating(9000), "DM");
  assert.equal(tierFromRating(8999), "PT");
  assert.equal(tierFromRating(5300), "BR");
  assert.equal(tierFromRating(499), "BG");
  assert.equal(tierFromRating(0), "BG");
});

test("티어 입력: 코드·한글 줄임말·영어 이름(단계 숫자 포함)", () => {
  assert.equal(parseTier("그마"), "GM");
  assert.equal(parseTier("Grand Master"), "GM");
  assert.equal(parseTier("마스터"), "M");
  assert.equal(parseTier("다이야"), "DM");
  assert.equal(parseTier("Diamond II"), "DM");
  assert.equal(parseTier("dm"), "DM");
  assert.equal(parseTier("플래티넘 3"), "PT");
  assert.equal(parseTier("Silver IV"), "SV");
  assert.equal(parseTier("S"), null); // 예전 S/A/B/C는 받지 않는다
  assert.equal(parseTier("챌린저"), null);
});
