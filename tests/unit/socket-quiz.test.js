/**
 * Unit tests for backend/socket/quiz.js — live quiz engine.
 *
 * This is the largest socket handler with the most state: lobby →
 * question → results → finished state machine, per-player score
 * tracking, time-bonus scoring, teacher-only actions, and a reveal
 * timer. Bugs here are visible to every student joining a quiz
 * session, so the handler deserves its own unit test surface.
 *
 * We mock:
 *   - @supabase/supabase-js so announceNewQuiz doesn't actually
 *     hit the DB (it runs fire-and-forget on create_session)
 *   - pushNotification is a vi.fn — we inject it through attachQuiz's
 *     second arg
 *
 * Timers (setTimeout for auto-reveal) are covered by vi.useFakeTimers
 * where relevant.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { attachQuiz, cleanupQuiz, _resetQuizRateLimit } from "../../backend/socket/quiz.js";
import { quizStore } from "../../backend/socket/store/quizStore.js";

// Mock Supabase so announceNewQuiz doesn't try to hit a real DB.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => Promise.resolve({ data: [] }) }),
      }),
      insert: async () => ({ data: [], error: null }),
    }),
  }),
}));

function mockIo() {
  const emitted = []; // [{ room, event, payload }]
  const emit = vi.fn((event, payload) => {
    emitted[emitted.length - 1].event = event;
    emitted[emitted.length - 1].payload = payload;
  });
  const to = vi.fn((room) => {
    emitted.push({ room, event: null, payload: null });
    return { emit };
  });
  return { io: { to }, emitted };
}

// create_session is staff-only now, and the host name + org come from
// the session rather than the payload, so the fixture carries both.
function mockSocket({
  id = "teacher-socket",
  userId = "teacher-id",
  userRole = "teacher",
  orgId = "org-A",
} = {}) {
  const handlers = {};
  return {
    id,
    userId,
    userRole,
    userName: "Prof X",
    request: { session: { user: { id: userId, role: userRole, org_id: orgId } } },
    on:     vi.fn((event, fn) => { handlers[event] = fn; }),
    join:   vi.fn(),
    emit:   vi.fn(),
    _handlers: handlers,
  };
}

// Reset the shared quiz store between tests.
beforeEach(() => {
  for (const [code] of quizStore.entries()) quizStore.delete(code);
  _resetQuizRateLimit();   // the 5-per-hour host cap is process-wide
});

// ═══════════════════════════════════════════════════════════
// Wiring
// ═══════════════════════════════════════════════════════════

describe("attachQuiz — wiring", () => {
  it("registers all six teacher/student handlers", () => {
    const { io } = mockIo();
    const socket = mockSocket();
    attachQuiz(io, socket, { pushNotification: vi.fn() });

    for (const event of [
      "create_session", "join_session", "next_question",
      "submit_answer", "reveal_answer", "end_session",
    ]) {
      expect(socket._handlers[event]).toBeTypeOf("function");
    }
  });
});

// ═══════════════════════════════════════════════════════════
// create_session — teacher boots a quiz
// ═══════════════════════════════════════════════════════════

describe("create_session", () => {
  it("creates a session keyed by a 6-char code", async () => {
    const { io } = mockIo();
    const socket = mockSocket();
    attachQuiz(io, socket, { pushNotification: vi.fn() });

    await socket._handlers.create_session({
      questions: [{ question: "2+2", options: ["3","4","5","6"], correct_index: 1, points: 50 }],
    });

    // socket.emit called with the code
    expect(socket.emit).toHaveBeenCalledWith("session_created", expect.objectContaining({
      code: expect.stringMatching(/^[A-Z0-9]{6}$/),
    }));
  });

  it("joins the teacher's socket into the room", async () => {
    const { io } = mockIo();
    const socket = mockSocket();
    attachQuiz(io, socket, { pushNotification: vi.fn() });

    await socket._handlers.create_session({
      questions: [{ question: "2+2", options: ["3","4"], correct_index: 1 }],
    });
    expect(socket.join).toHaveBeenCalledWith(expect.stringMatching(/^[A-Z0-9]{6}$/));
  });
});

// ═══════════════════════════════════════════════════════════
// join_session — student enters the lobby
// ═══════════════════════════════════════════════════════════

describe("join_session", () => {
  async function bootSession() {
    const { io, emitted } = mockIo();
    const teacher = mockSocket({ id: "teacher-socket" });
    attachQuiz(io, teacher, { pushNotification: vi.fn() });
    await teacher._handlers.create_session({
      questions: [
        { question: "2+2", options: ["3","4","5","6"], correct_index: 1, points: 50, timeLimit: 30 },
      ],
    });
    const code = socketLastEmitCode(teacher);
    return { io, emitted, teacher, code };
  }

  it("adds the student to session.players + broadcasts lobby update", async () => {
    const { io, teacher, code } = await bootSession();
    const student = mockSocket({ id: "student-socket" });
    attachQuiz(io, student, { pushNotification: vi.fn() });

    student._handlers.join_session({ code, playerName: "Alice" });

    const session = quizStore.get(code);
    expect(session.players["student-socket"].name).toBe("Alice");
    expect(session.players["student-socket"].score).toBe(0);
    expect(student.join).toHaveBeenCalledWith(code);
    expect(student.emit).toHaveBeenCalledWith("joined", { code, playerName: "Alice" });
    void teacher; // referenced to silence unused warning
  });

  it("rejects join on an unknown code", async () => {
    const { io } = mockIo();
    const student = mockSocket();
    attachQuiz(io, student, { pushNotification: vi.fn() });

    student._handlers.join_session({ code: "NOPE01", playerName: "Alice" });

    expect(student.emit).toHaveBeenCalledWith("join_error", "Session not found");
    expect(student.join).not.toHaveBeenCalled();
  });

  it("rejects join once the quiz has already started (status != lobby)", async () => {
    const { io, code } = await bootSession();
    const session = quizStore.get(code);
    session.status = "question";

    const student = mockSocket();
    attachQuiz(io, student, { pushNotification: vi.fn() });
    student._handlers.join_session({ code, playerName: "Latejoin" });

    expect(student.emit).toHaveBeenCalledWith("join_error", "Quiz already started");
    expect(student.join).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════
// next_question — teacher-only advance
// ═══════════════════════════════════════════════════════════

describe("next_question", () => {
  it("ignores requests from a non-teacher socket", async () => {
    const { io } = mockIo();
    const teacher = mockSocket({ id: "teacher-socket" });
    attachQuiz(io, teacher, { pushNotification: vi.fn() });
    await teacher._handlers.create_session({
      questions: [{ question: "Q", options: ["A","B","C","D"], correct_index: 0, points: 50 }],
    });
    const code = socketLastEmitCode(teacher);

    const impostor = mockSocket({ id: "impostor-socket" });
    attachQuiz(io, impostor, { pushNotification: vi.fn() });

    impostor._handlers.next_question({ code });

    const session = quizStore.get(code);
    expect(session.currentQ).toBe(-1); // still in lobby — no advance
  });

  it("transitions status to 'question' and broadcasts question_start", async () => {
    vi.useFakeTimers();
    try {
      const { io, emitted } = mockIo();
      const teacher = mockSocket({ id: "teacher-socket" });
      attachQuiz(io, teacher, { pushNotification: vi.fn() });
      await teacher._handlers.create_session({
          questions: [{ question: "Q", options: ["A","B","C","D"], correct_index: 0, points: 50 }],
      });
      const code = socketLastEmitCode(teacher);

      teacher._handlers.next_question({ code });

      const session = quizStore.get(code);
      expect(session.status).toBe("question");
      expect(session.currentQ).toBe(0);

      const lastEmit = emitted[emitted.length - 1];
      expect(lastEmit.room).toBe(code);
      expect(lastEmit.event).toBe("question_start");
      expect(lastEmit.payload.questionNumber).toBe(1);
      expect(lastEmit.payload.total).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flips to 'finished' after the last question and emits quiz_finished with leaderboard", async () => {
    vi.useFakeTimers();
    try {
      const { io, emitted } = mockIo();
      const teacher = mockSocket({ id: "teacher-socket" });
      attachQuiz(io, teacher, { pushNotification: vi.fn() });
      await teacher._handlers.create_session({
          questions: [{ question: "Q1", options: ["A","B","C","D"], correct_index: 0, points: 50 }],
      });
      const code = socketLastEmitCode(teacher);

      // Advance through the single question, then advance again → finished.
      teacher._handlers.next_question({ code });
      teacher._handlers.next_question({ code });

      const finishEmit = emitted[emitted.length - 1];
      expect(finishEmit.event).toBe("quiz_finished");
      expect(Array.isArray(finishEmit.payload.leaderboard)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ═══════════════════════════════════════════════════════════
// submit_answer — scoring logic
// ═══════════════════════════════════════════════════════════

describe("submit_answer", () => {
  async function setupAnswerFlow() {
    vi.useFakeTimers();
    const { io, emitted } = mockIo();
    const teacher = mockSocket({ id: "teacher-socket" });
    attachQuiz(io, teacher, { pushNotification: vi.fn() });
    await teacher._handlers.create_session({
      questions: [{ question: "Q", options: ["A","B","C","D"], correct_index: 1, points: 50, timeLimit: 30 }],
    });
    const code = socketLastEmitCode(teacher);
    const student = mockSocket({ id: "student-socket" });
    attachQuiz(io, student, { pushNotification: vi.fn() });
    student._handlers.join_session({ code, playerName: "Alice" });
    teacher._handlers.next_question({ code });   // status → question
    return { io, emitted, teacher, student, code };
  }

  afterEach(() => vi.useRealTimers());

  it("awards base points + time bonus for a correct fast answer", async () => {
    const { student, code } = await setupAnswerFlow();

    student._handlers.submit_answer({ code, answerIndex: 1 });

    const session = quizStore.get(code);
    const player  = session.players["student-socket"];
    // timeBonus = floor((30 - 0) / 30 * 50) = 50; total = 50 + 50 = 100
    expect(player.score).toBe(100);
  });

  it("awards only base points when the player answers at the last second", async () => {
    const { student, code } = await setupAnswerFlow();

    // Age the SERVER clock rather than claiming a time in the payload —
    // questionStartedAt is now the only input to the bonus.
    quizStore.get(code).questionStartedAt = Date.now() - 30_000;
    student._handlers.submit_answer({ code, answerIndex: 1 });

    const session = quizStore.get(code);
    expect(session.players["student-socket"].score).toBe(50); // timeBonus = 0
  });

  it("ignores a timeTaken the client sends — the score is the servers to set", async () => {
    const { student, code } = await setupAnswerFlow();

    quizStore.get(code).questionStartedAt = Date.now() - 30_000;
    // The old handler read this field: 0 bought a full bonus and a
    // negative number an unbounded one.
    student._handlers.submit_answer({ code, answerIndex: 1, timeTaken: -1_000_000 });

    expect(quizStore.get(code).players["student-socket"].score).toBe(50);
  });

  it.each([-1, 99, 1.5, "1", null, undefined])(
    "ignores an out-of-range answerIndex (%p) instead of scoring it",
    async (answerIndex) => {
      const { student, code } = await setupAnswerFlow();
      student._handlers.submit_answer({ code, answerIndex });
      const player = quizStore.get(code).players["student-socket"];
      expect(player.lastAnswer).toBeNull();
      expect(player.score).toBe(0);
    },
  );

  it("awards zero for a wrong answer (no penalty in live quiz)", async () => {
    const { student, code } = await setupAnswerFlow();

    student._handlers.submit_answer({ code, answerIndex: 2 });

    expect(quizStore.get(code).players["student-socket"].score).toBe(0);
  });

  it("ignores double submissions from the same socket", async () => {
    const { student, code } = await setupAnswerFlow();

    student._handlers.submit_answer({ code, answerIndex: 1 });
    student._handlers.submit_answer({ code, answerIndex: 1 }); // retry

    const attempts = quizStore.get(code).players["student-socket"].answers;
    expect(attempts.length).toBe(1);
  });

  it("ignores submissions when status is not 'question' (e.g. during results)", async () => {
    const { student, code } = await setupAnswerFlow();
    quizStore.get(code).status = "results";

    student._handlers.submit_answer({ code, answerIndex: 1 });

    expect(quizStore.get(code).players["student-socket"].score).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// reveal_answer + end_session — teacher-only
// ═══════════════════════════════════════════════════════════

describe("reveal_answer / end_session — teacher guard", () => {
  async function setup() {
    const { io, emitted } = mockIo();
    const teacher = mockSocket({ id: "teacher-socket" });
    attachQuiz(io, teacher, { pushNotification: vi.fn() });
    await teacher._handlers.create_session({
      questions: [{ question: "Q", options: ["A","B","C","D"], correct_index: 0, points: 50 }],
    });
    const code = socketLastEmitCode(teacher);
    const impostor = mockSocket({ id: "impostor-socket" });
    attachQuiz(io, impostor, { pushNotification: vi.fn() });
    return { io, emitted, teacher, impostor, code };
  }

  it("reveal_answer from non-teacher is ignored", async () => {
    const { impostor, code } = await setup();
    impostor._handlers.reveal_answer({ code });
    // No crash, session still exists
    expect(quizStore.get(code)).toBeDefined();
  });

  it("end_session from non-teacher is ignored (session NOT deleted)", async () => {
    const { impostor, code } = await setup();
    impostor._handlers.end_session({ code });
    expect(quizStore.get(code)).toBeDefined();
  });

  it("end_session from teacher deletes the session + broadcasts session_ended", async () => {
    const { teacher, emitted, code } = await setup();
    teacher._handlers.end_session({ code });
    expect(quizStore.get(code)).toBeUndefined();
    expect(emitted[emitted.length - 1].event).toBe("session_ended");
  });
});

// ═══════════════════════════════════════════════════════════
// cleanupQuiz — on disconnect
// ═══════════════════════════════════════════════════════════

describe("cleanupQuiz", () => {
  it("removes the disconnecting student from every session + broadcasts update", async () => {
    const { io } = mockIo();
    const teacher = mockSocket({ id: "teacher-socket" });
    attachQuiz(io, teacher, { pushNotification: vi.fn() });
    await teacher._handlers.create_session({
      questions: [{ question: "Q", options: ["A","B","C","D"], correct_index: 0 }],
    });
    const code = socketLastEmitCode(teacher);

    const student = mockSocket({ id: "student-socket" });
    attachQuiz(io, student, { pushNotification: vi.fn() });
    student._handlers.join_session({ code, playerName: "Alice" });
    expect(quizStore.get(code).players["student-socket"]).toBeDefined();

    cleanupQuiz(io, student);

    expect(quizStore.get(code).players["student-socket"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Helper — extract the freshly-generated code from a teacher's
// most-recent `socket.emit("session_created", { code })` call.
// ─────────────────────────────────────────────────────────────
function socketLastEmitCode(socket) {
  const calls = socket.emit.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i][0] === "session_created") return calls[i][1].code;
  }
  throw new Error("no session_created call on this socket");
}

// ═══════════════════════════════════════════════════════════
// create_session — who is allowed to host
// ═══════════════════════════════════════════════════════════

describe("create_session — authorisation", () => {
  const ONE_Q = [{ question: "2+2", options: ["3", "4"], correct_index: 1 }];

  async function attempt(socketOpts) {
    const { io } = mockIo();
    const socket = mockSocket(socketOpts);
    attachQuiz(io, socket, { pushNotification: vi.fn() });
    await socket._handlers.create_session({ questions: ONE_Q });
    return socket;
  }

  it("refuses an anonymous socket", async () => {
    const socket = await attempt({ userId: null, userRole: null });
    expect(socket.emit).toHaveBeenCalledWith("session_error", expect.any(String));
    expect(socket.join).not.toHaveBeenCalled();
    expect([...quizStore.entries()]).toHaveLength(0);
  });

  it("refuses a signed-in student", async () => {
    const socket = await attempt({ userId: "s-1", userRole: "student" });
    expect(socket.emit).toHaveBeenCalledWith("session_error", expect.any(String));
    expect([...quizStore.entries()]).toHaveLength(0);
  });

  it.each(["teacher", "admin", "super_admin"])("allows a %s", async (userRole) => {
    const socket = await attempt({ userRole });
    expect(socket.emit).toHaveBeenCalledWith("session_created", expect.any(Object));
  });

  it("takes the host name from the session, not the payload", async () => {
    const { io } = mockIo();
    const socket = mockSocket();
    attachQuiz(io, socket, { pushNotification: vi.fn() });
    // A hostile payload naming someone else — this text used to be
    // mailed verbatim to every student in the database.
    await socket._handlers.create_session({ teacherName: "Principal", questions: ONE_Q });
    const [, session] = [...quizStore.entries()][0];
    expect(session.teacherName).toBe("Prof X");
  });

  it("records the host's org so the announcement can be scoped", async () => {
    const { io } = mockIo();
    const socket = mockSocket({ orgId: "org-B" });
    attachQuiz(io, socket, { pushNotification: vi.fn() });
    await socket._handlers.create_session({ questions: ONE_Q });
    const [, session] = [...quizStore.entries()][0];
    expect(session.orgId).toBe("org-B");
  });

  it("refuses a malformed question list", async () => {
    const socket = await attempt({});
    expect(socket.emit).toHaveBeenCalledWith("session_created", expect.any(Object));

    const { io } = mockIo();
    const bad = mockSocket({ id: "other-socket" });
    attachQuiz(io, bad, { pushNotification: vi.fn() });
    await bad._handlers.create_session({ questions: [{ options: ["only one"] }] });
    expect(bad.emit).toHaveBeenCalledWith("session_error", expect.any(String));
  });

  it("caps how many quizzes one host can start", async () => {
    const { io } = mockIo();
    const socket = mockSocket();
    attachQuiz(io, socket, { pushNotification: vi.fn() });

    for (let i = 0; i < 5; i++) {
      await socket._handlers.create_session({ questions: ONE_Q });
    }
    expect(socket.emit).not.toHaveBeenCalledWith("session_error", expect.any(String));

    await socket._handlers.create_session({ questions: ONE_Q });
    expect(socket.emit).toHaveBeenCalledWith("session_error", expect.stringMatching(/too many/i));
  });
});
