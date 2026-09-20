/**
 * Live Quiz engine. Session state lives in `quizStore` (see ./store/quizStore.js)
 * keyed by room code. Reveal timers stay as in-process setTimeout handles —
 * moving to Redis requires replacing them with a delayed-job queue.
 */

import { quizStore } from "./store/quizStore.js";
import { logger } from "../config/logger.js";

function generateCode() {
  // 6-char uppercase alphanumeric room code
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

/* Who may host a live quiz. `create_session` used to accept ANY socket,
   including an anonymous one, and each call fanned a notification out to
   every active student in the database with a display name the caller
   chose — a ready-made spam and phishing channel. */
const HOST_ROLES = new Set(["teacher", "admin", "super_admin"]);

/* Hosts are capped so a compromised teacher account can't fan out
   notifications in a loop. In-process like the rest of the quiz state;
   it moves to Redis with everything else if we ever run two instances. */
const QUIZ_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
const hostQuizTimes = new Map(); // userId -> number[] (ms timestamps)

function hostRateLimited(userId, now = Date.now()) {
  const recent = (hostQuizTimes.get(userId) || [])
    .filter((t) => now - t < QUIZ_RATE_LIMIT.windowMs);
  if (recent.length >= QUIZ_RATE_LIMIT.max) {
    hostQuizTimes.set(userId, recent);
    return true;
  }
  recent.push(now);
  hostQuizTimes.set(userId, recent);
  return false;
}

/* Exported for tests; also keeps the map from growing without bound
   across a long-lived process. */
export function _resetQuizRateLimit() {
  hostQuizTimes.clear();
}

/**
 * Normalise and bound-check a question list arriving over the socket.
 * Returns null when the payload is unusable. Everything the engine later
 * reads (`correct_index`, `timeLimit`, `points`, `options`) is coerced
 * here so a malformed question can't produce NaN scores downstream.
 */
export function sanitiseQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (questions.length > 50) return null;

  const clean = [];
  for (const q of questions) {
    if (!q || typeof q !== "object") return null;
    const options = Array.isArray(q.options) ? q.options.slice(0, 8).map((o) => String(o).slice(0, 500)) : null;
    if (!options || options.length < 2) return null;

    const correctIndex = Number(q.correct_index);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;

    clean.push({
      title:         String(q.title || "").slice(0, 200),
      question:      String(q.question || "").slice(0, 2000),
      options,
      correct_index: correctIndex,
      timeLimit:     Math.min(300, Math.max(5, Number(q.timeLimit) || 30)),
      points:        Math.min(1000, Math.max(0, Number(q.points) || 50)),
      solution:      q.solution ? String(q.solution).slice(0, 4000) : null,
    });
  }
  return clean;
}

/**
 * Score one answer. Time is measured from the server's own
 * `questionStartedAt`, never from the client.
 *
 * The old version trusted a `timeTaken` the browser sent:
 *   Math.max(0, ((limit - timeTaken) / limit) * points)
 * Sending 0 bought a full time bonus and sending a negative number
 * bought an unbounded one, so any player could set their score to
 * whatever they liked.
 */
export function scoreAnswer({ isCorrect, elapsedMs, timeLimit, points }) {
  if (!isCorrect) return 0;
  const limit    = Math.max(1, timeLimit);
  const elapsedS = Math.min(limit, Math.max(0, elapsedMs / 1000));
  const bonus    = Math.floor(((limit - elapsedS) / limit) * points);
  return points + Math.max(0, bonus);
}

function revealAnswer(io, code) {
  const session = quizStore.get(code);
  if (!session) return;
  session.status = "results";
  quizStore.touch?.(code);

  const q = session.questions[session.currentQ];
  const podium = Object.values(session.players)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));

  io.to(code).emit("question_result", {
    correctIndex: q.correct_index,
    solution:     q.solution || null,
    podium,
    isLast:       session.currentQ >= session.questions.length - 1,
  });
}

/**
 * Notify every active student row about a newly created quiz. Takes
 * `pushNotification` as a dependency so this module doesn't import
 * from socket/notifications.js (keeps the dep graph shallow).
 */
async function announceNewQuiz(code, teacherName, pushNotificationFn, orgId) {
  // Without an org we do not broadcast at all. This used to notify
  // EVERY active student row in the database, across every tenant.
  if (!orgId) {
    logger.warn({ code }, "Quiz: announce skipped — host has no org context");
    return;
  }
  try {
    const { default: supabase } = await import("../config/supabase.js");

    const { data: students } = await supabase
      .from("students")
      .select("user_id")
      .eq("role", "student")
      .eq("is_active", true)
      .eq("org_id", orgId);

    if (!students?.length) return;

    const now = new Date().toISOString();
    const notifications = students.map((s) => ({
      user_id:    s.user_id,
      title:      "\u{1F3AF} Live Quiz Starting!",
      body:       `${teacherName} has started a live quiz! Join now with code: ${code}`,
      type:       "quiz_invite",
      link:       `/live-quiz?code=${code}`,
      is_read:    false,
      created_at: now,
    }));
    await supabase.from("notifications").insert(notifications);

    for (const s of students) {
      pushNotificationFn(s.user_id, {
        id:         `quiz-${code}-${s.user_id}`,
        title:      "\u{1F3AF} Live Quiz Starting!",
        message:    `${teacherName} started a live quiz! Code: ${code}`,
        type:       "quiz_invite",
        link:       `/live-quiz?code=${code}`,
        created_at: now,
      });
    }
    logger.info({ studentCount: students.length, code }, "Quiz: session announce sent");
  } catch (err) {
    logger.error({ err: err }, "Quiz Failed to notify students");
  }
}

export function attachQuiz(io, socket, { pushNotification }) {
  /* Teacher creates a quiz session.
     Staff only. The host identity comes from the SESSION, not from the
     payload — teacherName used to be attacker-chosen text that was
     mailed to every student in the database. */
  socket.on("create_session", async ({ questions }) => {
    if (!socket.userId || !HOST_ROLES.has(socket.userRole)) {
      socket.emit("session_error", "Only a teacher or admin can start a live quiz");
      logger.warn({ socketId: socket.id, role: socket.userRole }, "Quiz: create_session refused");
      return;
    }

    if (hostRateLimited(socket.userId)) {
      socket.emit("session_error", "Too many quizzes started recently. Try again later.");
      logger.warn({ userId: socket.userId }, "Quiz: create_session rate-limited");
      return;
    }

    const clean = sanitiseQuestions(questions);
    if (!clean) {
      socket.emit("session_error", "Those questions could not be read. Check each one has 2+ options and a valid answer.");
      return;
    }

    const orgId       = socket.request?.session?.user?.org_id || null;
    const teacherName = socket.userName || "Your teacher";
    const code        = generateCode();

    quizStore.create(code, {
      code,
      teacherName,
      teacherId:     socket.userId,
      orgId,
      teacherSocket: socket.id,
      questions:     clean,
      players: {},        // socketId -> { name, score, answers: [], lastAnswer }
      currentQ: -1,       // -1 = lobby
      status: "lobby",    // lobby | question | results | finished
      questionStartedAt: 0,
      timer: null,
    });
    socket.join(code);
    socket.emit("session_created", { code });
    logger.info({ code, teacherName, userId: socket.userId, orgId }, "Quiz: session created");

    await announceNewQuiz(code, teacherName, pushNotification, orgId);
  });

  /* Student joins the lobby. */
  socket.on("join_session", ({ code, playerName }) => {
    const session = quizStore.get(code);
    if (!session) { socket.emit("join_error", "Session not found"); return; }
    if (session.status !== "lobby") { socket.emit("join_error", "Quiz already started"); return; }

    session.players[socket.id] = { name: playerName, score: 0, answers: [], lastAnswer: null };
    quizStore.touch?.(code);
    socket.join(code);

    socket.emit("joined", { code, playerName });

    io.to(session.teacherSocket).emit("player_joined", {
      players: Object.values(session.players).map((p) => ({ name: p.name, score: p.score })),
    });

    io.to(code).emit("lobby_update", {
      players: Object.values(session.players).map((p) => p.name),
      count:   Object.keys(session.players).length,
    });

    logger.info({ playerName, code }, "Quiz: player joined");
  });

  /* Teacher advances to the next question. */
  socket.on("next_question", ({ code }) => {
    const session = quizStore.get(code);
    if (!session || session.teacherSocket !== socket.id) return;

    session.currentQ++;
    if (session.currentQ >= session.questions.length) {
      session.status = "finished";
      const final = Object.values(session.players)
        .sort((a, b) => b.score - a.score)
        .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));
      io.to(code).emit("quiz_finished", { leaderboard: final });
      return;
    }

    session.status = "question";
    const q = session.questions[session.currentQ];

    Object.values(session.players).forEach((p) => (p.lastAnswer = null));

    io.to(code).emit("question_start", {
      questionNumber: session.currentQ + 1,
      total:          session.questions.length,
      title:          q.title,
      question:       q.question,
      options:        q.options,
      timeLimit:      q.timeLimit || 30,
      points:         q.points || 50,
    });

    // The clock the scorer uses. Set AFTER the question goes out so a
    // slow fan-out does not eat into players' time.
    session.questionStartedAt = Date.now();

    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => revealAnswer(io, code), (q.timeLimit || 30) * 1000 + 2000);
    // Snapshot AFTER the question advances so a restart resumes on the
    // current question instead of replaying the previous one.
    quizStore.touch?.(code);
  });

  /* Student submits an answer. */
  socket.on("submit_answer", ({ code, answerIndex }) => {
    const session = quizStore.get(code);
    if (!session || session.status !== "question") return;

    const player = session.players[socket.id];
    if (!player || player.lastAnswer !== null) return; // already answered

    const q = session.questions[session.currentQ];
    if (!q) return;

    // Reject anything that is not already an in-range integer. Note we
    // do NOT coerce: Number(null) is 0 and Number("1") is 1, so a
    // coercing check would quietly score a malformed payload as though
    // the player had picked option 0.
    const choice = answerIndex;
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return;

    player.lastAnswer = choice;

    const isCorrect = choice === q.correct_index;
    // Elapsed time is measured here, from the server's own clock. The
    // browser no longer gets a say in its own score.
    const earned = scoreAnswer({
      isCorrect,
      elapsedMs: Date.now() - (session.questionStartedAt || Date.now()),
      timeLimit: q.timeLimit || 30,
      points:    q.points || 50,
    });

    player.score += earned;
    player.answers.push({ questionIndex: session.currentQ, answerIndex: choice, correct: isCorrect, earned });
    quizStore.touch?.(code);

    socket.emit("answer_received", { received: true });

    const answered = Object.values(session.players).filter((p) => p.lastAnswer !== null).length;
    io.to(session.teacherSocket).emit("answer_update", {
      answered,
      total: Object.keys(session.players).length,
    });

    // Auto-reveal when everyone has answered
    if (answered === Object.keys(session.players).length) {
      if (session.timer) clearTimeout(session.timer);
      revealAnswer(io, code);
    }
  });

  /* Teacher force-reveals the current answer. */
  socket.on("reveal_answer", ({ code }) => {
    const session = quizStore.get(code);
    if (!session || session.teacherSocket !== socket.id) return;
    if (session.timer) clearTimeout(session.timer);
    revealAnswer(io, code);
  });

  /* Teacher ends the session entirely. */
  socket.on("end_session", ({ code }) => {
    const session = quizStore.get(code);
    if (!session || session.teacherSocket !== socket.id) return;
    if (session.timer) clearTimeout(session.timer);
    io.to(code).emit("session_ended");
    quizStore.delete(code);
  });
}

/**
 * On disconnect, remove the socket from any quiz lobbies and notify the
 * teacher of updated player counts.
 */
export function cleanupQuiz(io, socket) {
  for (const [code, session] of quizStore.entries()) {
    if (session.players[socket.id]) {
      delete session.players[socket.id];
      io.to(code).emit("lobby_update", {
        players: Object.values(session.players).map((p) => p.name),
        count:   Object.keys(session.players).length,
      });
      io.to(session.teacherSocket).emit("player_joined", {
        players: Object.values(session.players).map((p) => ({ name: p.name, score: p.score })),
      });
    }
  }
}
