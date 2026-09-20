import assert from "node:assert/strict";
import test from "node:test";
import { learningErrorCode, parseLearningSession, parseLearningProgress } from "../app/learn/learning-response.ts";

test("session handoff accepts new and returning learners without coercing server values", () => {
  assert.deepEqual(parseLearningSession({ profile: null, destination: "/learn/onboarding" }), { profile: null, destination: "/learn/onboarding" });
  for (const language of ["en", "ms"]) {
    for (const completed of [false, true]) {
      const profile = { preferred_language: language, onboarding_completed: completed, user_id: "not-needed-in-client-parser" };
      const destination = completed ? "/learn/dashboard" : "/learn/onboarding";
      assert.deepEqual(parseLearningSession({ email: "fixture@example.invalid", profile, destination }), { profile: { preferred_language: language, onboarding_completed: completed }, destination });
    }
  }
});

test("malformed successful session responses cannot redirect or overwrite locale", () => {
  const profile = { preferred_language: "ms", onboarding_completed: true };
  for (const value of [null, [], {}, { profile: null, destination: "/learn/dashboard" },
    { profile, destination: "https://example.invalid" }, { profile, destination: "//example.invalid" },
    { profile, destination: "/learn/onboarding" },
    { profile: { ...profile, preferred_language: ["ms"] }, destination: "/learn/dashboard" },
    { profile: { ...profile, onboarding_completed: "false" }, destination: "/learn/dashboard" }]) {
    assert.throws(() => parseLearningSession(value), /LEARNING_UNAVAILABLE/);
  }
});

test("valid topic saves normalise database text positions and preserve completion", () => {
  for (const total of [6, 7, 8]) {
    for (let completed = 0; completed <= total; completed++) {
      const percentage = Math.floor(100 * completed / total);
      assert.deepEqual(parseLearningProgress({ progress: { current_mission: String(completed + 1), progress_percentage: percentage } }, total),
        { progress: { current_mission: completed + 1, progress_percentage: percentage } });
    }
  }
});

test("invalid successful save responses cannot unlock topics or report false completion", () => {
  for (const progress of [null, [], {}, { current_mission: "2", progress_percentage: 100 },
    { current_mission: "01", progress_percentage: 0 }, { current_mission: "1e0", progress_percentage: 0 },
    { current_mission: "8", progress_percentage: 100 }, { current_mission: "7", progress_percentage: "100" },
    { current_mission: 2.5, progress_percentage: 25 }, { current_mission: Infinity, progress_percentage: 100 }]) {
    assert.throws(() => parseLearningProgress({ progress }, 6), /PROGRESS_REVIEW_REQUIRED/);
  }
});

test("error decoding preserves actionable API codes and tolerates malformed error bodies", () => {
  assert.equal(learningErrorCode({ error: "SIGN_IN_REQUIRED" }), "SIGN_IN_REQUIRED");
  assert.equal(learningErrorCode({ error: "PROGRESS_CHANGED_RELOAD" }), "PROGRESS_CHANGED_RELOAD");
  for (const value of [null, [], {}, { error: {} }, { error: "" }, { error: "<html>Bad gateway</html>" }]) {
    assert.equal(learningErrorCode(value), "LEARNING_UNAVAILABLE");
  }
});
