/* ═══════════════════════════════════════════════════════════════════════════
   Game of Cybersecurity — game.js
   All game logic: state, timer, swipe/drag, API calls, leaderboard
   ═══════════════════════════════════════════════════════════════════════════ */

const G = (() => {

  /* ── State ─────────────────────────────────────────────────────────────── */
  const state = {
    username:   'Anonymous',
    difficulty: 'beginner',
    questions:  [],
    index:      0,
    score:      0,
    timeLeft:   30,
    timerMax:   30,
    timer:      null,
    results:    [],
    lbTab:      'beginner',
    answered:   false,
  };

  const SCORE_PER   = 100;
  const TIME_BONUS  = { beginner: 5, advanced: 8 };
  const CACHE       = {};            // question cache per lang+diff

  /* ── Helpers ───────────────────────────────────────────────────────────── */
  const $  = id => document.getElementById(id);
  const shuffle = a => a.sort(() => Math.random() - 0.5);

  function show(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    $(`pg-${name}`).classList.add('active');
    window.scrollTo(0, 0);
  }

  function toast(msg, type='') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.className = 'toast', 2400);
  }

  /* ── Navigation ─────────────────────────────────────────────────────────── */
  function goChoose() {
    const v = $('username').value.trim();
    state.username = v || 'Anonymous';
    show('choose');
  }

  function playAnon() {
    state.username = 'Anonymous';
    show('choose');
  }

  /* ── Start game ─────────────────────────────────────────────────────────── */
  async function startGame(diff) {
    state.difficulty = diff;
    state.index   = 0;
    state.score   = 0;
    state.timeLeft = 30;
    state.timerMax = 30;
    state.results  = [];
    state.answered = false;

    const cacheKey = `${LANG}-${diff}`;
    if (!CACHE[cacheKey]) {
      try {
        const r = await fetch(`/api/questions?lang=${LANG}&difficulty=${diff}`);
        CACHE[cacheKey] = await r.json();
      } catch(e) {
        toast('Network error loading questions.', 'bad');
        return;
      }
    }
    state.questions = shuffle([...CACHE[cacheKey]]);
    show('game');
    renderCard();
    startTimer();
  }

  /* ── Card rendering ─────────────────────────────────────────────────────── */
  function renderCard() {
    const q = state.questions[state.index];
    $('card-cat').textContent = q.category;
    $('card-q').textContent   = q.question;
    $('card-tip').textContent = `${T.swipe_true} / ${T.swipe_false}`;
    $('q-counter').textContent = `${state.index + 1}/${state.questions.length}`;
    $('live-score').textContent = state.score;

    const card = $('quiz-card');
    card.style.cssText = '';
    card.classList.remove('dragging');
    ['sw-right','sw-left','sw-up','sw-down'].forEach(id => $( id).style.opacity = 0);

    // Reset buttons
    const btns = document.querySelectorAll('.ans-btn');
    btns.forEach(b => { b.disabled = false; b.className = 'ans-btn'; });
    state.answered = false;
  }

  /* ── Answer ─────────────────────────────────────────────────────────────── */
  function answer(val) {
    if (state.answered) return;
    state.answered = true;

    const q = state.questions[state.index];
    const result = (val === 'skip' || val === 'maybe') ? 'skip'
                 : val === q.answer ? 'correct' : 'wrong';

    state.results.push({
      question:      q.question,
      category:      q.category,
      userAnswer:    val,
      correctAnswer: q.answer,
      explanation:   q.explanation,
      result
    });

    // Disable all buttons, highlight chosen
    document.querySelectorAll('.ans-btn').forEach(b => b.disabled = true);

    const btnMap = { true: 'btn-true', false: 'btn-false', maybe: 'btn-maybe', skip: 'btn-skip' };
    const chosen = $(btnMap[String(val)]);

    if (result === 'correct') {
      if (chosen) chosen.classList.add('correct');
      state.score += SCORE_PER;
      state.timeLeft = Math.min(state.timeLeft + TIME_BONUS[state.difficulty], 90);
      state.timerMax = Math.max(state.timerMax, state.timeLeft);
      $('live-score').textContent = state.score;
      toast(`✓ ${T.fb_correct} +${SCORE_PER}pts — ${q.explanation}`, 'ok');
    } else if (result === 'wrong') {
      if (chosen) chosen.classList.add('wrong');
      // Highlight correct answer
      const correctKey = btnMap[String(q.answer)];
      if (correctKey) $(correctKey).classList.add('correct');
      toast(`✗ ${T.fb_wrong} — ${q.explanation}`, 'bad');
    } else {
      toast(`${T.fb_skip} — ${q.explanation}`);
    }

    setTimeout(advance, 1900);
  }

  function advance() {
    state.index++;
    if (state.index >= state.questions.length) {
      endGame();
    } else {
      renderCard();
    }
  }

  /* ── Timer ──────────────────────────────────────────────────────────────── */
  function startTimer() {
    clearInterval(state.timer);
    updateTimerUI();
    state.timer = setInterval(() => {
      state.timeLeft--;
      updateTimerUI();
      if (state.timeLeft <= 0) {
        clearInterval(state.timer);
        endGame();
      }
    }, 1000);
  }

  function updateTimerUI() {
    const pct = Math.max(0, (state.timeLeft / state.timerMax) * 100);
    const bar = $('timer-bar');
    bar.style.width = pct + '%';
    $('timer-num').textContent = state.timeLeft;
    const col = pct < 25 ? 'var(--red)' : pct < 55 ? 'var(--yellow)' : 'var(--accent)';
    bar.style.background = col;
    $('timer-num').style.color = col;
  }

  function quitGame() {
    if (confirm(T.quit_confirm)) {
      clearInterval(state.timer);
      show('home');
    }
  }

  /* ── End game ───────────────────────────────────────────────────────────── */
  async function endGame() {
    clearInterval(state.timer);
    const correct = state.results.filter(r => r.result === 'correct').length;
    const wrong   = state.results.filter(r => r.result === 'wrong').length;
    const skip    = state.results.filter(r => r.result === 'skip').length;

    show('score');
    $('ring-num').textContent   = state.score;
    $('tc-correct').textContent = correct;
    $('tc-wrong').textContent   = wrong;
    $('tc-skip').textContent    = skip;

    const pct  = state.questions.length ? state.score / (state.questions.length * SCORE_PER) : 0;
    const circ = 415;
    setTimeout(() => {
      $('ring-fg').style.strokeDashoffset = circ - pct * circ;
    }, 120);

    const [title, msg] = pct >= 0.8 ? [T.rank_expert, T.rank_expert_msg]
                       : pct >= 0.6 ? [T.rank_good,   T.rank_good_msg]
                       : pct >= 0.4 ? [T.rank_ok,     T.rank_ok_msg]
                       : [T.rank_keep, T.rank_keep_msg];
    $('score-title').textContent = title;
    $('score-msg').textContent   = msg;

    // POST to server leaderboard
    try {
      const r = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:   state.username,
          difficulty: state.difficulty,
          score:      state.score
        })
      });
      const data = await r.json();
      if (data.rank) {
        const rt = $('rank-toast');
        rt.textContent = `${T.your_rank}${data.rank}`;
        rt.style.display = 'block';
      }
    } catch(e) { /* silent fail */ }
  }

  /* ── Details ────────────────────────────────────────────────────────────── */
  function showDetails() {
    show('details');
    const tbody = $('dtbl-body');
    tbody.innerHTML = '';
    state.results.forEach((r, i) => {
      const ansLabel = r.userAnswer === true  ? T.ans_true
                     : r.userAnswer === false ? T.ans_false
                     : r.userAnswer === 'maybe' ? T.ans_maybe : T.ans_skip;
      const corrLabel = r.correctAnswer === true ? T.ans_true : T.ans_false;
      const [bCls, bLabel] = r.result === 'correct' ? ['ok',  T.badge_correct]
                           : r.result === 'wrong'   ? ['bad', T.badge_wrong]
                           : ['skip', T.badge_skip];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--muted)">${i+1}</td>
        <td>${esc(r.question)}<br/><span style="font-size:.62rem;color:var(--muted)">${esc(r.category)}</span></td>
        <td>${esc(ansLabel)}</td>
        <td class="corr-ans">${esc(corrLabel)}<br/><span style="color:var(--muted);font-size:.67rem">${esc(r.explanation)}</span></td>
        <td><span class="rbadge ${bCls}">${esc(bLabel)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  /* ── Leaderboard ────────────────────────────────────────────────────────── */
  function switchTab(diff) {
    state.lbTab = diff;
    $('tab-beg').classList.toggle('active', diff === 'beginner');
    $('tab-adv').classList.toggle('active', diff === 'advanced');
    renderLB();
  }

  async function renderLB() {
    const container = $('lb-rows');
    container.innerHTML = `<div class="lb-empty" style="color:var(--muted);font-size:.75rem;padding:2rem;text-align:center">Loading...</div>`;
    try {
      const r    = await fetch(`/api/leaderboard?difficulty=${state.lbTab}`);
      const rows = await r.json();
      if (!rows.length) {
        container.innerHTML = `<div class="lb-empty">${T.lb_empty}</div>`;
        return;
      }
      container.innerHTML = rows.map((e, i) => {
        const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i+1);
        return `<div class="lb-row">
          <div class="lb-rank ${rankCls}">${medal}</div>
          <div class="lb-name">${esc(e.username)}</div>
          <div class="lb-score">${e.score}</div>
          <div class="lb-date">${esc(e.date)}</div>
        </div>`;
      }).join('');
    } catch(err) {
      container.innerHTML = `<div class="lb-empty">${T.lb_empty}</div>`;
    }
  }

  /* ── Swipe / Drag ───────────────────────────────────────────────────────── */
  (function initDrag() {
    const card = $('quiz-card');
    let sx = 0, sy = 0, cx = 0, cy = 0, active = false;

    function start(x, y) {
      if (!$('pg-game').classList.contains('active')) return;
      if (state.answered) return;
      active = true;
      sx = x; sy = y;
      card.classList.add('dragging');
    }

    function move(x, y) {
      if (!active) return;
      cx = x - sx;
      cy = y - sy;
      card.style.transform = `translate(${cx}px,${cy}px) rotate(${cx * 0.075}deg)`;
      const th = 55;
      $('sw-right').style.opacity = cx >  th ? Math.min((cx  - th) / 75, .92) : 0;
      $('sw-left' ).style.opacity = cx < -th ? Math.min((-cx - th) / 75, .92) : 0;
      $('sw-up'   ).style.opacity = cy < -th ? Math.min((-cy - th) / 75, .75) : 0;
      $('sw-down' ).style.opacity = cy >  th ? Math.min((cy  - th) / 75, .75) : 0;
    }

    function end() {
      if (!active) return;
      active = false;
      card.classList.remove('dragging');

      const THRESHOLD = 95;
      let action = null;
      if      (cx >  THRESHOLD) action = true;
      else if (cx < -THRESHOLD) action = false;
      else if (cy < -THRESHOLD) action = 'maybe';
      else if (cy >  THRESHOLD) action = 'skip';

      if (action !== null && !state.answered) {
        // Fly the card off
        card.style.transition = 'transform .32s ease, opacity .32s';
        const tx = action === true ? 650 : action === false ? -650 : cx * 1.5;
        const ty = action === 'maybe' ? -650 : action === 'skip' ? 650 : cy * 0.6;
        card.style.transform = `translate(${tx}px,${ty}px) rotate(${cx * 0.05}deg)`;
        card.style.opacity = '0';
        answer(action);
      } else {
        card.style.transition = 'transform .25s ease';
        card.style.transform  = '';
        card.style.opacity    = '1';
        ['sw-right','sw-left','sw-up','sw-down'].forEach(id => $(id).style.opacity = 0);
      }
      cx = 0; cy = 0;
    }

    // Mouse
    card.addEventListener('mousedown',  e => start(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    window.addEventListener('mouseup',   () => end());

    // Touch
    card.addEventListener('touchstart', e => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      const t = e.touches[0];
      move(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchend', () => end());
  })();

  /* ── Public API ─────────────────────────────────────────────────────────── */
  return { show, goChoose, playAnon, startGame, answer, quitGame, showDetails, switchTab, renderLB };

})();
