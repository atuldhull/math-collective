/**
 * Live-quiz scoring and payload validation.
 *
 * Regression guards for two holes in socket/quiz.js:
 *   - the time bonus was computed from a `timeTaken` the PLAYER sent, so
 *     0 bought a full bonus and a negative number an unbounded one;
 *   - `create_session` accepted any question array at all, so a
 *     malformed payload could reach the scorer.
 */

import { describe, it, expect } from "vitest";
import { scoreAnswer, sanitiseQuestions } from "../../backend/socket/quiz.js";

const Q = { timeLimit: 30, points: 50 };

describe("scoreAnswer", () => {
  it("gives nothing for a wrong answer, however fast", () => {
    expect(scoreAnswer({ isCorrect: false, elapsedMs: 0, ...Q })).toBe(0);
  });

  it("gives points plus a full bonus for an instant correct answer", () => {
    expect(scoreAnswer({ isCorrect: true, elapsedMs: 0, ...Q })).toBe(100);
  });

  it("decays the bonus as time passes", () => {
    const fast = scoreAnswer({ isCorrect: true, elapsedMs: 5_000, ...Q });
    const slow = scoreAnswer({ isCorrect: true, elapsedMs: 25_000, ...Q });
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThanOrEqual(50);
  });

  it("never pays a bonus past the time limit", () => {
    expect(scoreAnswer({ isCorrect: true, elapsedMs: 60_000, ...Q })).toBe(50);
  });

  it("cannot be driven above the maximum by a negative elapsed time", () => {
    // The old client-supplied path: a negative timeTaken scaled the
    // bonus without bound. Clamping at 0 caps this at points * 2.
    const cheated = scoreAnswer({ isCorrect: true, elapsedMs: -10_000_000, ...Q });
    expect(cheated).toBe(100);
  });

  it("is bounded by points * 2 for every elapsed value", () => {
    for (const elapsedMs of [-1e9, -1, 0, 1, 15_000, 30_000, 1e9]) {
      const score = scoreAnswer({ isCorrect: true, elapsedMs, ...Q });
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("sanitiseQuestions", () => {
  const good = { title: "T", question: "2+2?", options: ["3", "4"], correct_index: 1 };

  it("accepts a well-formed question and applies defaults", () => {
    const [q] = sanitiseQuestions([good]);
    expect(q.correct_index).toBe(1);
    expect(q.timeLimit).toBe(30);
    expect(q.points).toBe(50);
  });

  it.each([
    ["not an array", "nope"],
    ["an empty list", []],
    ["a null entry", [null]],
    ["fewer than two options", [{ ...good, options: ["only"] }]],
    ["a correct_index past the end", [{ ...good, correct_index: 9 }]],
    ["a negative correct_index", [{ ...good, correct_index: -1 }]],
    ["a non-integer correct_index", [{ ...good, correct_index: 1.5 }]],
    ["missing options", [{ title: "T", question: "?", correct_index: 0 }]],
  ])("rejects %s", (_name, input) => {
    expect(sanitiseQuestions(input)).toBeNull();
  });

  it("rejects an absurdly long quiz", () => {
    expect(sanitiseQuestions(Array(51).fill(good))).toBeNull();
  });

  it("clamps a hostile timeLimit and points into range", () => {
    const [q] = sanitiseQuestions([{ ...good, timeLimit: 999_999, points: 1e9 }]);
    expect(q.timeLimit).toBe(300);
    expect(q.points).toBe(1000);
  });
});
