import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickAutoCandidate,
  picksUntilTurn,
  shuffle,
  slotAt,
  snakeOrder,
  startProblem,
  totalPicks,
} from "../src/lib/draft.ts";

test("snakeOrder: 홀수 라운드는 역순", () => {
  assert.deepEqual(snakeOrder([1, 2, 3], 3), [1, 2, 3, 3, 2, 1, 1, 2, 3]);
  assert.deepEqual(snakeOrder([1, 2], 0), []);
});

test("slotAt은 snakeOrder와 항상 일치", () => {
  for (const n of [2, 3, 5, 8]) {
    const base = Array.from({ length: n }, (_, i) => i + 10);
    for (const rounds of [1, 2, 3, 4]) {
      const full = snakeOrder(base, rounds);
      full.forEach((teamId, pickNo) => {
        const s = slotAt(base, rounds, pickNo)!;
        assert.equal(s.teamId, teamId);
        assert.equal(s.round, Math.floor(pickNo / n));
      });
    }
  }
});

test("slotAt: 범위 밖이면 null", () => {
  assert.equal(slotAt([1, 2], 2, -1), null);
  assert.equal(slotAt([1, 2], 2, 4), null);
  assert.equal(slotAt([], 3, 0), null);
  assert.equal(slotAt([1, 2], 2, 1.5), null);
});

test("picksUntilTurn: 라운드 경계의 연속 픽 포함", () => {
  // [A,B,C] → A B C | C B A
  assert.equal(picksUntilTurn([1, 2, 3], 2, 0, 1), 0);
  assert.equal(picksUntilTurn([1, 2, 3], 2, 1, 1), 4);
  assert.equal(picksUntilTurn([1, 2, 3], 2, 2, 3), 0);
  assert.equal(picksUntilTurn([1, 2, 3], 2, 3, 3), 0); // C는 2·3번 픽을 연속으로
  assert.equal(picksUntilTurn([1, 2, 3], 2, 6, 1), null);
});

test("pickAutoCandidate: 최고 레이팅, 동점이면 닉네임 순", () => {
  const ps = [
    { id: 1, nickname: "b", rating: 900 },
    { id: 2, nickname: "a", rating: 900 },
    { id: 3, nickname: "c", rating: 100 },
  ];
  assert.equal(pickAutoCandidate(ps)?.id, 2);
  assert.equal(pickAutoCandidate([]), null);
});

test("shuffle: 원소를 보존하는 순열", () => {
  let s = 42;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(input, rand);
  assert.deepEqual([...out].sort((a, b) => a - b), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8], "원본은 변경되지 않음");
});

test("startProblem / totalPicks", () => {
  assert.equal(totalPicks(8, 3), 24);
  assert.match(startProblem(1, 10, 3)!, /2개 이상/);
  assert.match(startProblem(4, 11, 3)!, /11\/12/);
  assert.equal(startProblem(4, 12, 3), null);
});
