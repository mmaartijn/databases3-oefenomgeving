/* DB3 Oefenomgeving: gedeelde logica (opslag, laden, highlighting, quiz-engine, flashcards, proeftoets). */
(function () {
  "use strict";
  const DB3 = window.DB3;

  /* ---------------- opslag (alleen per browser, faalt stil) ---------------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privé-venster e.d. */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };
  const PKEY = "db3.progress.v1";
  const EKEY = "db3.exams.v1";
  DB3.store = store;
  DB3.progress = {
    all() { return store.get(PKEY, {}); },
    topic(id) { return this.all()[id] || {}; },
    update(id, fn) { const all = this.all(); all[id] = fn(Object.assign({}, all[id] || {})); store.set(PKEY, all); },
    reset() { store.del(PKEY); store.del(EKEY); },
  };
  DB3.exams = { all() { return store.get(EKEY, []); }, add(e) { const a = this.all(); a.unshift(e); store.set(EKEY, a.slice(0, 20)); } };

  /* Beheersing: uitleg gelezen 20%, flashcards gekend 30%, beste quizscore 50%. */
  DB3.mastery = function (t) {
    const p = DB3.progress.topic(t.id);
    const cards = t.flashcards && t.flashcards.length ? Math.min(1, (p.known || []).length / t.flashcards.length) : 0;
    return Math.round((p.lesson ? 20 : 0) + cards * 30 + (p.quizBest || 0) * 0.5);
  };

  DB3.clusterColors = { integriteit: "#c6002a", consistentie: "#001c70", analyse: "#c24100", inrichting: "#6b3fa0", semi: "#1f7a4a", spatial: "#0a5fb4", tekst: "#505051" };
  DB3.clusterOf = (id) => DB3.clusters.find((c) => c.id === id) || {};

  /* ---------------- laden van alle onderwerpen ---------------- */
  DB3.loadTopics = function () {
    return Promise.all(DB3.catalog.map((c) => new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "data/topics/" + c.id + ".js";
      s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    })));
  };

  /* ---------------- helpers ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pad = (n) => String(n).padStart(2, "0");
  const LETTERS = ["A", "B", "C", "D"];
  DB3.util = { $, $$, esc, shuffle, pad };

  /* ---------------- SQL-highlighting ---------------- */
  const KW = new Set(("select from where and or not in is null as join inner left right full outer cross apply on group by order having insert into values " +
    "update set delete create alter drop table view trigger procedure proc function returns return begin end transaction tran commit rollback declare " +
    "exec execute if else exists distinct top union all case when then grant deny revoke to with schemabinding instead of after for index nonclustered " +
    "clustered include primary key foreign references check constraint default unique identity go use login user role member add between like " +
    "near system_time system_versioning period generated always row start nocount try catch throw desc asc output readonly type security policy " +
    "filter predicate state isolation level read committed uncommitted repeatable snapshot fulltext catalog language path auto root xml " +
    "without password database revert history_table on off true false var new").split(" "));
  const TYPES = new Set("int bigint smallint tinyint bit decimal numeric float real money char varchar nchar nvarchar text date datetime datetime2 time geography geometry".split(" "));
  const TOKEN = /(--[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(N?'(?:[^']|'')*')|("(?:[^"\\\n]|\\.)*")|(@@?\w+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)(?=\s*\()|([A-Za-z_][\w]*)/g;
  DB3.highlight = function (code) {
    let out = "", last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(code))) {
      out += esc(code.slice(last, m.index));
      const t = m[0];
      if (m[1]) out += '<span class="tok-com">' + esc(t) + "</span>";
      else if (m[2] || m[3]) out += '<span class="tok-str">' + esc(t) + "</span>";
      else if (m[4]) out += '<span class="tok-var">' + esc(t) + "</span>";
      else if (m[5]) out += '<span class="tok-num">' + esc(t) + "</span>";
      else if (m[6]) out += KW.has(t.toLowerCase()) ? '<span class="tok-kw">' + esc(t) + "</span>" : '<span class="tok-fn">' + esc(t) + "</span>";
      else out += KW.has(t.toLowerCase()) || TYPES.has(t.toLowerCase()) ? '<span class="tok-kw">' + esc(t) + "</span>" : esc(t);
      last = TOKEN.lastIndex;
    }
    return out + esc(code.slice(last));
  };
  DB3.enhanceCode = function (root) {
    $$("pre", root).forEach((pre) => {
      if (pre.dataset.done) return;
      pre.dataset.done = "1";
      const code = pre.querySelector("code") || pre;
      const raw = code.textContent;
      code.innerHTML = DB3.highlight(raw);
      const btn = document.createElement("button");
      btn.className = "copy-btn"; btn.type = "button"; btn.textContent = "kopieer";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const done = () => { btn.textContent = "gekopieerd"; setTimeout(() => (btn.textContent = "kopieer"), 1400); };
        if (navigator.clipboard) navigator.clipboard.writeText(raw).then(done, () => {}); else done();
      });
      pre.appendChild(btn);
    });
  };

  /* ---------------- thema ---------------- */
  DB3.initTheme = function () {
    const saved = store.get("db3.theme", null);
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    const btn = $("#theme-btn");
    if (!btn) return;
    const isDark = () => {
      const t = document.documentElement.getAttribute("data-theme");
      return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    const paint = () => { btn.textContent = isDark() ? "☀" : "☾"; btn.setAttribute("aria-label", isDark() ? "Licht thema" : "Donker thema"); };
    paint();
    btn.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      store.set("db3.theme", next);
      paint();
    });
  };

  /* ---------------- vraag-weergave (gedeeld door quiz en proeftoets) ---------------- */
  /* Maakt een vraag met geschudde opties; correct = index in de geschudde lijst. */
  DB3.prepareQuestion = function (q, topicId) {
    const order = shuffle([0, 1, 2, 3]);
    return { q: q.q, code: q.code, explain: q.explain, topic: topicId, options: order.map((i) => q.options[i]), correct: order.indexOf(q.answer) };
  };

  DB3.renderQuestionBody = function (pq) {
    return '<p class="q-text">' + pq.q + "</p>" +
      (pq.code ? '<pre><code class="sql">' + esc(pq.code) + "</code></pre>" : "") +
      '<div class="options" role="group" aria-label="Antwoordopties">' +
      pq.options.map((o, i) => '<button type="button" class="opt" data-i="' + i + '"><span class="letter">' + LETTERS[i] + "</span><span>" + o + "</span></button>").join("") +
      "</div>";
  };

  /* ---------------- oefenquiz (directe feedback) ---------------- */
  DB3.mountQuiz = function (el, topic, opts) {
    opts = opts || {};
    let qs, i, answers;
    const start = () => { qs = shuffle(topic.quiz).map((q) => DB3.prepareQuestion(q, topic.id)); i = 0; answers = []; render(); };

    const progressBar = () => '<div class="q-progress" aria-hidden="true">' + qs.map((_, k) =>
      "<i class=\"" + (k < answers.length ? (answers[k] === qs[k].correct ? "ok" : "bad") : k === i ? "cur" : "") + "\"></i>").join("") + "</div>";

    function render() {
      if (i >= qs.length) return finish();
      const pq = qs[i];
      const score = answers.filter((a, k) => a === qs[k].correct).length;
      el.innerHTML = '<div class="quiz">' + progressBar() +
        '<div class="q-meta"><span>Vraag ' + (i + 1) + " / " + qs.length + "</span><span>" + score + " goed</span></div>" +
        DB3.renderQuestionBody(pq) + '<div class="feedback" aria-live="polite"></div>' +
        '<div class="q-nav"><span class="muted" style="font-size:14px">Toets <kbd>1</kbd>–<kbd>4</kbd> of <kbd>A</kbd>–<kbd>D</kbd></span>' +
        '<button type="button" class="btn btn-primary btn-small next" hidden>' + (i + 1 === qs.length ? "Bekijk resultaat" : "Volgende") + " →</button></div></div>";
      DB3.enhanceCode(el);
      $$(".opt", el).forEach((b) => b.addEventListener("click", () => choose(+b.dataset.i)));
      $(".next", el).addEventListener("click", () => { i++; render(); el.scrollIntoView({ block: "start", behavior: "smooth" }); });
    }

    function choose(k) {
      if (answers.length > i) return;
      const pq = qs[i];
      answers.push(k);
      $$(".opt", el).forEach((b, n) => {
        b.disabled = true;
        if (n === pq.correct) b.classList.add("correct");
        else if (n === k) b.classList.add("wrong");
      });
      const ok = k === pq.correct;
      $(".feedback", el).innerHTML = '<div class="explain ' + (ok ? "ok" : "bad") + '"><b class="v">' + (ok ? "Goed" : "Niet goed, het juiste antwoord is " + LETTERS[pq.correct]) + "</b><p style=\"margin:6px 0 0\">" + pq.explain + "</p></div>";
      $(".q-progress", el).outerHTML = progressBar();
      const next = $(".next", el); next.hidden = false; next.focus({ preventScroll: true });
    }

    function finish() {
      const good = answers.filter((a, k) => a === qs[k].correct).length;
      const pct = Math.round((good / qs.length) * 100);
      DB3.progress.update(topic.id, (p) => { p.quizLast = pct; p.quizBest = Math.max(p.quizBest || 0, pct); return p; });
      const msg = pct >= 90 ? "Uitstekend, dit onderwerp zit erin." : pct >= 70 ? "Goed bezig. Lees de uitleg bij je fouten nog even na." : pct >= 50 ? "Op de goede weg. Herhaal de kernpunten en probeer het opnieuw." : "Neem de uitleg nog eens door en doe dan de flashcards.";
      el.innerHTML = '<div class="quiz"><div class="result"><div class="eyebrow">Resultaat</div><div class="score">' + good + "<small>/" + qs.length + "</small></div><p class=\"lead\" style=\"margin:14px auto 22px\">" + msg + "</p>" +
        '<div class="hero-actions" style="justify-content:center"><button type="button" class="btn btn-primary again">Opnieuw (andere volgorde)</button></div>' +
        '<div class="review-list">' + qs.map((pq, k) => {
          const ok = answers[k] === pq.correct;
          return '<details class="review-item ' + (ok ? "ok" : "bad") + '"' + (ok ? "" : " open") + "><summary>" + (ok ? "✓ " : "✗ ") + pq.q + '</summary><div class="ans">' +
            (ok ? "" : "Jouw antwoord: " + pq.options[answers[k]] + "<br>") + "<strong>Juist: " + pq.options[pq.correct] + "</strong><br>" + pq.explain + "</div></details>";
        }).join("") + "</div></div></div>";
      $(".again", el).addEventListener("click", start);
      if (opts.onFinish) opts.onFinish(pct);
    }

    el._keys = (e) => {
      const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
      const k = map[e.key.toLowerCase()];
      if (k !== undefined && qs && i < qs.length && answers.length === i) { e.preventDefault(); choose(k); }
      else if (e.key === "Enter") { const n = $(".next", el); if (n && !n.hidden && document.activeElement !== n) { e.preventDefault(); n.click(); } }
    };
    start();
  };

  /* ---------------- flashcards ---------------- */
  DB3.mountFlashcards = function (el, topic, opts) {
    opts = opts || {};
    const total = topic.flashcards.length;
    let deck, pos, flipped;
    const known = () => new Set(DB3.progress.topic(topic.id).known || []);
    const setKnown = (idx, yes) => DB3.progress.update(topic.id, (p) => {
      const s = new Set(p.known || []); if (yes) s.add(idx); else s.delete(idx); p.known = Array.from(s); return p;
    });

    const start = (onlyUnknown) => {
      const k = known();
      let idx = topic.flashcards.map((_, n) => n);
      if (onlyUnknown) idx = idx.filter((n) => !k.has(n));
      deck = shuffle(idx); pos = 0; flipped = false; render();
    };

    function render() {
      const k = known();
      if (!deck.length || pos >= deck.length) {
        el.innerHTML = '<div class="fc-wrap"><div class="fc-done"><div class="eyebrow">Stapel klaar</div><h3 style="margin:12px 0 8px">' + k.size + " van de " + total + " kaarten gekend</h3>" +
          '<p class="muted">' + (k.size === total ? "Alles gekend. Test jezelf nu met de oefenquiz." : "Herhaal de kaarten die je nog niet kende.") + "</p>" +
          '<div class="fc-actions">' + (k.size < total ? '<button type="button" class="btn btn-primary only">Alleen niet-gekende</button>' : "") +
          '<button type="button" class="btn btn-ghost all">Hele stapel opnieuw</button></div></div></div>';
        const o = $(".only", el); if (o) o.addEventListener("click", () => start(true));
        $(".all", el).addEventListener("click", () => start(false));
        if (opts.onChange) opts.onChange();
        return;
      }
      const card = topic.flashcards[deck[pos]];
      el.innerHTML = '<div class="fc-wrap"><div class="fc-top"><span>Kaart ' + (pos + 1) + " / " + deck.length + "</span><span>Gekend: " + k.size + " / " + total + "</span>" +
        '<button type="button" class="linklike reshuffle">Schudden</button></div>' +
        '<div class="fc' + (flipped ? " flipped" : "") + '" role="button" tabindex="0" aria-label="Draai kaart om"><div class="fc-inner">' +
        '<div class="fc-face fc-front"><div>' + card.front + '</div><span class="hint">klik of spatie om te draaien</span></div>' +
        '<div class="fc-face fc-back"><div>' + card.back + "</div></div></div></div>" +
        '<div class="fc-actions"><button type="button" class="btn btn-bad no">← Nog niet</button><button type="button" class="btn btn-ok yes">Ken ik →</button></div></div>';
      const fc = $(".fc", el);
      fc.addEventListener("click", flip);
      fc.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); flip(); } });
      $(".no", el).addEventListener("click", () => answer(false));
      $(".yes", el).addEventListener("click", () => answer(true));
      $(".reshuffle", el).addEventListener("click", () => start(false));
    }
    function flip() { flipped = !flipped; const fc = $(".fc", el); if (fc) fc.classList.toggle("flipped", flipped); }
    function answer(yes) {
      const idx = deck[pos];
      setKnown(idx, yes);
      if (!yes) deck.push(idx); /* later nog een keer */
      pos++; flipped = false; render();
      if (opts.onChange) opts.onChange();
    }
    el._keys = (e) => {
      if (!deck || pos >= deck.length) return;
      if (e.key === " ") { e.preventDefault(); flip(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); answer(true); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); answer(false); }
    };
    start(false);
  };

  /* ---------------- proeftoets ---------------- */
  DB3.buildExam = function (perTopic) {
    const qs = [];
    DB3.ordered().forEach((t) => shuffle(t.quiz).slice(0, perTopic).forEach((q) => qs.push(DB3.prepareQuestion(q, t.id))));
    return shuffle(qs);
  };
})();
