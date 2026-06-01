(function () {
  "use strict";

  const STORE_KEY = "radicals-progress-v1";

  // progress: { [radical]: { status: "known"|"unknown"|null, starred: bool } }
  let progress = loadProgress();

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveProgress() {
    localStorage.setItem(STORE_KEY, JSON.stringify(progress));
  }
  function entry(r) {
    if (!progress[r]) progress[r] = { status: null, starred: false };
    return progress[r];
  }

  const $ = (id) => document.getElementById(id);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

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
    const filter = $("studyFilter").value;
    let cards = RADICALS.filter((c) => {
      const e = progress[c.radical];
      if (filter === "known") return e && e.status === "known";
      if (filter === "unknown") return !e || e.status !== "known";
      if (filter === "starred") return e && e.starred;
      return true;
    });
    if ($("shuffleToggle").checked) cards = shuffle(cards);
    deck = cards;
    idx = 0;
    flipped = false;
    $("studyDone").classList.add("hidden");
    $("flashcard").classList.remove("hidden");
    document.querySelector("#view-study .card-actions").classList.remove("hidden");
    renderCard();
  }

  function renderCard() {
    const total = deck.length;
    $("knownCounter").textContent =
      RADICALS.filter((c) => progress[c.radical]?.status === "known").length + " / " + RADICALS.length + " known";

    if (total === 0) {
      $("cardFront").textContent = "—";
      $("cardCounter").textContent = "0 / 0";
      $("studyProgress").style.width = "0%";
      $("flashcard").classList.add("hidden");
      document.querySelector("#view-study .card-actions").classList.add("hidden");
      const done = $("studyDone");
      done.classList.remove("hidden");
      $("doneSummary").textContent = "No cards match this filter.";
      $("reviewUnknown").classList.add("hidden");
      return;
    }

    const card = deck[idx];
    const e = progress[card.radical];
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
      $("cardFront").style.fontSize = "92px";
      $("speakBtn").classList.add("hidden");
    }
    $("cardPinyin").textContent = card.pinyin;
    $("cardMeaning").textContent = card.meaning;
    $("cardRadical").textContent = card.radical;
    $("starBtn").textContent = e && e.starred ? "★" : "☆";

    $("cardCounter").textContent = (idx + 1) + " / " + total;
    $("studyProgress").style.width = ((idx) / total * 100) + "%";
  }

  function flip() {
    flipped = !flipped;
    $("flashcard").classList.toggle("flipped", flipped);
  }

  function advance() {
    if (idx < deck.length - 1) {
      idx++;
      renderCard();
    } else {
      finishDeck();
    }
  }

  function finishDeck() {
    $("studyProgress").style.width = "100%";
    $("flashcard").classList.add("hidden");
    document.querySelector("#view-study .card-actions").classList.add("hidden");
    const known = deck.filter((c) => progress[c.radical]?.status === "known").length;
    $("doneSummary").textContent =
      `You reviewed ${deck.length} cards · ${known} marked known, ${deck.length - known} still learning.`;
    $("reviewUnknown").classList.remove("hidden");
    $("studyDone").classList.remove("hidden");
  }

  function mark(status) {
    const card = deck[idx];
    if (!card) return;
    entry(card.radical).status = status;
    saveProgress();
    advance();
  }

  $("flashcard").addEventListener("click", (ev) => {
    if (ev.target.closest("#starBtn") || ev.target.closest("#speakBtn")) return;
    flip();
  });
  $("starBtn").addEventListener("click", () => {
    const card = deck[idx];
    if (!card) return;
    const e = entry(card.radical);
    e.starred = !e.starred;
    saveProgress();
    $("starBtn").textContent = e.starred ? "★" : "☆";
  });
  $("speakBtn").addEventListener("click", () => {
    const card = deck[idx];
    if (card) speak(card.radical);
  });
  $("nextCard").addEventListener("click", advance);
  $("prevCard").addEventListener("click", () => { if (idx > 0) { idx--; renderCard(); } });
  $("markKnown").addEventListener("click", () => mark("known"));
  $("markLearning").addEventListener("click", () => mark("unknown"));
  $("restartStudy").addEventListener("click", buildDeck);
  $("restartStudy2").addEventListener("click", buildDeck);
  $("reviewUnknown").addEventListener("click", () => {
    $("studyFilter").value = "unknown";
    buildDeck();
  });
  $("studyDir").addEventListener("change", renderCard);
  $("studyFilter").addEventListener("change", buildDeck);
  $("shuffleToggle").addEventListener("change", buildDeck);

  document.addEventListener("keydown", (ev) => {
    if (!$("view-study").classList.contains("active")) return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    switch (ev.key) {
      case " ": case "Enter": ev.preventDefault(); flip(); break;
      case "ArrowRight": advance(); break;
      case "ArrowLeft": if (idx > 0) { idx--; renderCard(); } break;
      case "k": case "K": mark("known"); break;
      case "j": case "J": mark("unknown"); break;
      case "s": case "S": $("starBtn").click(); break;
    }
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

    // build 4 options
    const distractors = shuffle(RADICALS.filter((c) => c.radical !== q.radical)).slice(0, 3);
    const options = shuffle([q, ...distractors]);

    optsEl.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "quiz-opt" + (dir === "radical" ? "" : " zh");
      btn.textContent = dir === "radical" ? opt.meaning : opt.radical;
      btn.addEventListener("click", () => answer(btn, opt, q, options));
      optsEl.appendChild(btn);
    });

    $("quizCounter").textContent = (quiz.i + 1) + " / " + quiz.questions.length;
    $("quizScore").textContent = "Score: " + quiz.score;
    $("quizProgress").style.width = (quiz.i / quiz.questions.length * 100) + "%";
  }

  function answer(btn, chosen, correct, options) {
    const buttons = Array.from($("quizOptions").children);
    buttons.forEach((b) => (b.disabled = true));
    const correctText = quiz.dir === "radical" ? correct.meaning : correct.radical;

    if (chosen.radical === correct.radical) {
      btn.classList.add("correct");
      quiz.score++;
      entry(correct.radical).status = "known";
    } else {
      btn.classList.add("wrong");
      quiz.mistakes.push(correct);
      entry(correct.radical).status = "unknown";
      buttons.forEach((b) => { if (b.textContent === correctText) b.classList.add("correct"); });
    }
    saveProgress();
    $("quizScore").textContent = "Score: " + quiz.score;

    setTimeout(() => {
      if (quiz.i < quiz.questions.length - 1) {
        quiz.i++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }, 700);
  }

  function finishQuiz() {
    $("quizActive").classList.add("hidden");
    const total = quiz.questions.length;
    const pct = Math.round(quiz.score / total * 100);
    $("quizGrade").textContent = pct >= 90 ? "🏆 " + pct + "%" : pct >= 70 ? "👍 " + pct + "%" : "📚 " + pct + "%";
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
      const e = progress[c.radical];
      const cell = document.createElement("div");
      cell.className = "cell" + (e?.status === "known" ? " known" : "");
      cell.innerHTML = `
        <div class="badge">${e?.starred ? "★" : ""}${e?.status === "known" ? "✓" : ""}</div>
        <div class="zh">${c.radical}</div>
        <div class="py">${c.pinyin}</div>
        <div class="mn">${c.meaning}</div>`;
      cell.addEventListener("click", () => speak(c.radical));
      cell.style.cursor = "pointer";
      cell.title = "Click to hear pronunciation";
      grid.appendChild(cell);
    });
  }
  $("browseSearch").addEventListener("input", renderBrowse);
  $("resetProgress").addEventListener("click", () => {
    if (confirm("Reset all progress, stars, and known marks?")) {
      progress = {};
      saveProgress();
      renderBrowse();
    }
  });

  /* ---------- Init ---------- */
  buildDeck();
})();
