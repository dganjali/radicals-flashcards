(function () {
  "use strict";

  const STORE_KEY = "radicals-fsrs-v1";
  // state: { [radical]: { card: <fsrs card>, starred: bool } }
  let state = load();

  // FSRS handles (populated after dynamic import)
  let scheduler, Rating, State, createEmptyCard, GRADE;

  const $ = (id) => document.getElementById(id);
  const NOW = () => new Date();
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  function rec(r) {
    if (!state[r]) state[r] = { card: null, starred: false };
    return state[r];
  }
  function reviveCard(c) {
    const d = Object.assign({}, c);
    d.due = new Date(c.due);
    if (c.last_review) d.last_review = new Date(c.last_review);
    return d;
  }
  function getCard(r) {
    const c = rec(r).card;
    return c ? reviveCard(c) : createEmptyCard(NOW());
  }
  function setCard(r, card) { rec(r).card = card; save(); }

  function gradeCard(r, key) {
    if (!scheduler) return;
    const sched = scheduler.repeat(getCard(r), NOW());
    setCard(r, sched[GRADE[key]].card);
  }
  function previews(r) {
    const now = NOW();
    const sched = scheduler.repeat(getCard(r), now);
    const fmt = (k) => fmtInterval(new Date(sched[GRADE[k]].card.due).getTime() - now.getTime());
    return { again: fmt("again"), hard: fmt("hard"), good: fmt("good"), easy: fmt("easy") };
  }
  function fmtInterval(ms) {
    const m = ms / 60000;
    if (m < 1) return "<1m";
    if (m < 60) return Math.round(m) + "m";
    const h = m / 60;
    if (h < 24) return Math.round(h) + "h";
    const d = h / 24;
    if (d < 30) return Math.round(d) + "d";
    const mo = d / 30;
    if (mo < 12) return Math.round(mo) + "mo";
    return Math.round(d / 365) + "y";
  }

  function isLearned(r) {
    const s = state[r];
    return !!(s && s.card && s.card.state === State.Review);
  }
  function learnedCount() { return RADICALS.filter((c) => isLearned(c.radical)).length; }
  function dueRadicals() {
    const now = Date.now();
    return RADICALS.filter((c) => getCard(c.radical).due.getTime() <= now);
  }
  function dueCount() { return dueRadicals().length; }
  function nextDueLabel() {
    const now = Date.now();
    let min = Infinity;
    RADICALS.forEach((c) => {
      const s = state[c.radical];
      if (s && s.card) {
        const t = new Date(s.card.due).getTime();
        if (t > now && t < min) min = t;
      }
    });
    return min === Infinity ? null : fmtInterval(min - now) + " from now";
  }

  /* ---------- Tabs ---------- */
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      $("view-" + tab.dataset.view).classList.add("active");
      if (tab.dataset.view === "browse") renderBrowse();
    });
  });

  /* ---------- Speech ---------- */
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* ================= STUDY ================= */
  let deck = [];
  let idx = 0;
  let flipped = false;

  function buildDeck() {
    const mode = $("studyMode").value;
    let cards;
    if (mode === "due") {
      cards = dueRadicals().sort((a, b) => getCard(a.radical).due - getCard(b.radical).due);
    } else if (mode === "starred") {
      cards = RADICALS.filter((c) => rec(c.radical).starred);
      if ($("shuffleToggle").checked) cards = shuffle(cards);
    } else {
      cards = RADICALS.slice();
      if ($("shuffleToggle").checked) cards = shuffle(cards);
    }
    deck = cards;
    idx = 0;
    $("studyDone").classList.add("hidden");
    $("flashcard").classList.remove("hidden");
    renderCard();
  }

  function isCramMode() { return $("studyMode").value === "cram"; }

  function showReveal() {
    $("revealRow").classList.remove("hidden");
    $("gradesRow").classList.add("hidden");
    $("cramRow").classList.add("hidden");
  }

  function renderCard() {
    updateMeta();
    if (deck.length === 0) { finishDeck(true); return; }

    const card = deck[idx];
    const e = rec(card.radical);
    const dir = $("studyDir").value;
    const fc = $("flashcard");
    fc.classList.remove("flipped");
    flipped = false;

    if (dir === "radical") {
      $("cardFront").textContent = card.radical;
      $("cardFront").style.fontFamily = '"Noto Serif SC", serif';
      $("cardFront").style.fontSize = "";
      $("speakBtn").classList.remove("hidden");
    } else {
      $("cardFront").textContent = card.meaning;
      $("cardFront").style.fontFamily = '"Cormorant Garamond", serif';
      $("cardFront").style.fontSize = "84px";
      $("speakBtn").classList.add("hidden");
    }
    $("cardPinyin").textContent = card.pinyin;
    $("cardMeaning").textContent = card.meaning;
    const showVariant = card.variant && card.variant !== card.radical;
    $("variantBlock").classList.toggle("hidden", !showVariant);
    $("cardVariant").textContent = showVariant ? card.variant : "";
    if (card.example) {
      $("cardExample").textContent = card.example.char;
      $("cardExampleSub").textContent = `${card.example.pinyin} · ${card.example.meaning}`;
    } else {
      $("cardExample").textContent = "";
      $("cardExampleSub").textContent = "";
    }
    $("starBtn").textContent = e.starred ? "★" : "☆";

    $("cardCounter").textContent = (idx + 1) + " / " + deck.length;
    $("studyProgress").style.width = (idx / deck.length * 100) + "%";
    showReveal();
  }

  function updateMeta() {
    $("dueCounter").textContent =
      `Due ${dueCount()} · Learned ${learnedCount()} / ${RADICALS.length}`;
  }

  function reveal() {
    if (deck.length === 0 || flipped) return;
    flipped = true;
    $("flashcard").classList.add("flipped");
    $("revealRow").classList.add("hidden");
    if (isCramMode()) {
      $("cramRow").classList.remove("hidden");
    } else {
      const p = previews(deck[idx].radical);
      $("intAgain").textContent = p.again;
      $("intHard").textContent = p.hard;
      $("intGood").textContent = p.good;
      $("intEasy").textContent = p.easy;
      $("gradesRow").classList.remove("hidden");
    }
  }

  function grade(key) {
    if (!flipped || deck.length === 0) return;
    gradeCard(deck[idx].radical, key);
    advance();
  }

  function advance() {
    if (idx < deck.length - 1) { idx++; renderCard(); }
    else finishDeck(false);
  }

  function finishDeck(empty) {
    $("studyProgress").style.width = "100%";
    $("flashcard").classList.add("hidden");
    $("revealRow").classList.add("hidden");
    $("gradesRow").classList.add("hidden");
    $("cramRow").classList.add("hidden");
    updateMeta();
    const mode = $("studyMode").value;
    if (empty) {
      if (mode === "starred") {
        $("doneSummary").textContent = "No starred cards yet — tap ★ on a card to add it.";
      } else {
        const nd = nextDueLabel();
        $("doneSummary").textContent = nd
          ? `Nothing due right now. Next review ${nd}.`
          : "Nothing due right now.";
      }
    } else {
      $("doneSummary").textContent =
        `Reviewed ${deck.length} card${deck.length > 1 ? "s" : ""} · ${learnedCount()} of ${RADICALS.length} learned.`;
    }
    $("studyDone").classList.remove("hidden");
  }

  $("flashcard").addEventListener("click", (ev) => {
    if (ev.target.closest("#starBtn") || ev.target.closest("#speakBtn")) return;
    if (!flipped) {
      reveal();
    } else {
      $("flashcard").classList.remove("flipped");
      flipped = false;
    }
  });
  $("revealBtn").addEventListener("click", reveal);
  document.querySelectorAll(".grade").forEach((b) =>
    b.addEventListener("click", () => grade(b.dataset.grade)));
  $("cramPrev").addEventListener("click", () => {
    if (idx > 0) { idx--; renderCard(); }
  });
  $("cramNext").addEventListener("click", () => {
    if (idx < deck.length - 1) { idx++; renderCard(); }
    else finishDeck(false);
  });
  $("starBtn").addEventListener("click", () => {
    if (deck.length === 0) return;
    const e = rec(deck[idx].radical);
    e.starred = !e.starred;
    save();
    $("starBtn").textContent = e.starred ? "★" : "☆";
  });
  $("speakBtn").addEventListener("click", () => {
    if (deck[idx]) speak(deck[idx].radical);
  });
  $("restartStudy").addEventListener("click", buildDeck);
  $("restartStudy2").addEventListener("click", buildDeck);
  $("cramAll").addEventListener("click", () => { $("studyMode").value = "all"; buildDeck(); });
  $("studyDir").addEventListener("change", renderCard);
  $("studyMode").addEventListener("change", buildDeck);
  $("shuffleToggle").addEventListener("change", buildDeck);

  document.addEventListener("keydown", (ev) => {
    if (!$("view-study").classList.contains("active")) return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (deck.length === 0) return;
    if (ev.key === "s" || ev.key === "S") { $("starBtn").click(); return; }
    if (ev.key === "ArrowRight") {
      if (!flipped) reveal();
      else if (isCramMode()) $("cramNext").click();
      return;
    }
    if (ev.key === "ArrowLeft") {
      if (flipped) { $("flashcard").classList.remove("flipped"); flipped = false; }
      else if (isCramMode()) $("cramPrev").click();
      return;
    }
    if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      if (!flipped) reveal();
      else { $("flashcard").classList.remove("flipped"); flipped = false; }
      return;
    }
    if (!flipped) return;
    const map = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
    if (map[ev.key]) grade(map[ev.key]);
  });

  /* ================= QUIZ ================= */
  let quiz = { questions: [], i: 0, score: 0, mistakes: [], dir: "radical" };

  function startQuiz() {
    const dir = $("quizDir").value;
    const len = parseInt($("quizLen").value, 10);
    let pool = shuffle(RADICALS);
    if (len > 0) pool = pool.slice(0, len);
    quiz = { questions: pool, i: 0, score: 0, mistakes: [], dir };
    $("quizSetup").classList.add("hidden");
    $("quizResults").classList.add("hidden");
    $("quizActive").classList.remove("hidden");
    renderQuestion();
  }

  function renderQuestion() {
    const q = quiz.questions[quiz.i];
    const dir = quiz.dir;
    const promptEl = $("quizPrompt");
    const optsEl = $("quizOptions");

    if (dir === "radical") {
      promptEl.textContent = q.radical;
      promptEl.classList.remove("text");
    } else {
      promptEl.textContent = q.meaning;
      promptEl.classList.add("text");
    }

    const distractors = shuffle(RADICALS.filter((c) => c.radical !== q.radical)).slice(0, 3);
    const options = shuffle([q, ...distractors]);

    optsEl.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "quiz-opt" + (dir === "radical" ? "" : " zh");
      btn.textContent = dir === "radical" ? opt.meaning : opt.radical;
      btn.addEventListener("click", () => answer(btn, opt, q));
      optsEl.appendChild(btn);
    });

    $("quizCounter").textContent = (quiz.i + 1) + " / " + quiz.questions.length;
    $("quizScore").textContent = "Score: " + quiz.score;
    $("quizProgress").style.width = (quiz.i / quiz.questions.length * 100) + "%";
  }

  function answer(btn, chosen, correct) {
    const buttons = Array.from($("quizOptions").children);
    buttons.forEach((b) => (b.disabled = true));
    const correctText = quiz.dir === "radical" ? correct.meaning : correct.radical;

    if (chosen.radical === correct.radical) {
      btn.classList.add("correct");
      quiz.score++;
      gradeCard(correct.radical, "good");
    } else {
      btn.classList.add("wrong");
      quiz.mistakes.push(correct);
      gradeCard(correct.radical, "again");
      buttons.forEach((b) => { if (b.textContent === correctText) b.classList.add("correct"); });
    }
    $("quizScore").textContent = "Score: " + quiz.score;

    setTimeout(() => {
      if (quiz.i < quiz.questions.length - 1) { quiz.i++; renderQuestion(); }
      else finishQuiz();
    }, 700);
  }

  function finishQuiz() {
    $("quizActive").classList.add("hidden");
    const total = quiz.questions.length;
    const pct = Math.round(quiz.score / total * 100);
    $("quizGrade").textContent = pct >= 90 ? "Excellent · " + pct + "%" : pct >= 70 ? "Nicely done · " + pct + "%" : "Keep studying · " + pct + "%";
    $("quizResultSummary").textContent = `You got ${quiz.score} of ${total} correct.`;

    const mEl = $("quizMistakes");
    mEl.innerHTML = "";
    if (quiz.mistakes.length) {
      const h = document.createElement("p");
      h.className = "muted";
      h.textContent = "Review these:";
      mEl.appendChild(h);
      quiz.mistakes.forEach((m) => {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `<span class="zh">${m.radical}</span><span>${m.pinyin}</span><span>${m.meaning}</span>`;
        mEl.appendChild(row);
      });
    }
    $("quizResults").classList.remove("hidden");
  }

  $("startQuiz").addEventListener("click", startQuiz);
  $("retryQuiz").addEventListener("click", () => {
    $("quizResults").classList.add("hidden");
    $("quizSetup").classList.remove("hidden");
  });
  $("quitQuiz").addEventListener("click", () => {
    $("quizActive").classList.add("hidden");
    $("quizSetup").classList.remove("hidden");
  });

  /* ================= BROWSE ================= */
  function renderBrowse() {
    const q = $("browseSearch").value.trim().toLowerCase();
    const grid = $("browseGrid");
    grid.innerHTML = "";
    const filtered = RADICALS.filter((c) =>
      !q || c.radical.includes(q) || c.pinyin.toLowerCase().includes(q) || c.meaning.toLowerCase().includes(q)
    );
    $("browseCount").textContent = filtered.length + " radicals";
    filtered.forEach((c) => {
      const s = state[c.radical];
      const learned = isLearned(c.radical);
      const cell = document.createElement("div");
      cell.className = "cell" + (learned ? " known" : "");
      const showVar = c.variant && c.variant !== c.radical;
      cell.innerHTML = `
        <div class="badge">${s && s.starred ? "★" : ""}${learned ? "✓" : ""}</div>
        <div class="zh">${c.radical}${showVar ? `<span class="cell-variant">${c.variant}</span>` : ""}</div>
        <div class="py">${c.pinyin}</div>
        <div class="mn">${c.meaning}</div>
        <div class="cell-eg">${c.example.char} <span>${c.example.meaning}</span></div>`;
      cell.addEventListener("click", () => speak(c.radical));
      cell.style.cursor = "pointer";
      cell.title = "Click to hear pronunciation";
      grid.appendChild(cell);
    });
  }
  $("browseSearch").addEventListener("input", renderBrowse);
  $("resetProgress").addEventListener("click", () => {
    if (confirm("Reset all scheduling, stars, and progress?")) {
      state = {};
      save();
      renderBrowse();
    }
  });

  /* ---------- Init ---------- */
  (async function init() {
    try {
      const m = await import("https://esm.sh/ts-fsrs@4");
      createEmptyCard = m.createEmptyCard;
      Rating = m.Rating;
      State = m.State;
      scheduler = m.fsrs(m.generatorParameters({ enable_fuzz: true, maximum_interval: 36500 }));
      GRADE = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };
    } catch (e) {
      console.error("Failed to load FSRS scheduler", e);
      $("doneSummary").textContent = "Could not load the scheduler (offline?). Reload to retry.";
    }
    buildDeck();
  })();
})();
