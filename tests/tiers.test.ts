import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTier } from "../src/lib/types.ts";

test("래더 티어 입력: 코드·한글 줄임말·영어 이름·등급 숫자", () => {
  assert.equal(parseTier("그마"), "GM");
  assert.equal(parseTier("Grand Master"), "GM");
  assert.equal(parseTier("마스터"), "M");
  assert.equal(parseTier("다이아몬드 II"), "DM");
  assert.equal(parseTier("다이야"), "DM");
  assert.equal(parseTier("Diamond IV"), "DM");
  assert.equal(parseTier("dm"), "DM");
  assert.equal(parseTier("플래 3"), "PT");
  assert.equal(parseTier("Silver I"), "SV");
  assert.equal(parseTier("아이언4"), "IR");
});

test("래더에 없는 티어와 빈 칸은 받지 않는다", () => {
  assert.equal(parseTier(""), null);
  assert.equal(parseTier("S"), null); // 예전 S/A/B/C
  assert.equal(parseTier("아마추어"), null); // V-ARCHIVE에만 있는 티어
  assert.equal(parseTier("비기너"), null);
});
