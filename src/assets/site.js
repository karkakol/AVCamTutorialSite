/* AVCam tutorial site: client behaviour. No dependencies.
   Progress lives in localStorage. Every access is inside try/catch, and the
   site works (without saved progress) when storage is not available. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;
  var PROGRESS_KEY = 'avcam-tutorial:progress';
  var THEME_KEY = 'avcam-tutorial:theme';
  var slug = body.getAttribute('data-page');
  var kind = body.getAttribute('data-kind');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 760px)');

  function $(selector, scope) { return (scope || doc).querySelector(selector); }
  function $$(selector, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(selector)); }

  // ---------------------------------------------------------------- storage

  var memory = null;

  function emptyProgress() { return { steps: {}, pages: {}, quiz: {}, last: null }; }

  function progress() {
    if (memory) return memory;
    var data = null;
    try { data = JSON.parse(window.localStorage.getItem(PROGRESS_KEY)); } catch (error) { data = null; }
    if (!data || typeof data !== 'object') data = emptyProgress();
    if (!data.steps || typeof data.steps !== 'object') data.steps = {};
    if (!data.pages || typeof data.pages !== 'object') data.pages = {};
    if (!data.quiz || typeof data.quiz !== 'object') data.quiz = {};
    memory = data;
    return memory;
  }

  function saveProgress() {
    try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress())); } catch (error) { /* no storage */ }
  }

  function doneStepCount(pageSlug) {
    var steps = progress().steps[pageSlug];
    return steps ? Object.keys(steps).length : 0;
  }

  function isPageDone(pageSlug, stepTotal) {
    if (progress().pages[pageSlug]) return true;
    return stepTotal > 0 && doneStepCount(pageSlug) >= stepTotal;
  }

  // ---------------------------------------------------------------- theme

  var THEMES = ['auto', 'light', 'dark'];

  function currentTheme() {
    var value = root.getAttribute('data-theme');
    return value === 'light' || value === 'dark' ? value : 'auto';
  }

  function setTheme(value) {
    if (value === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', value);
    try {
      if (value === 'auto') window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, value);
    } catch (error) { /* no storage */ }
    refreshTheme();
  }

  function refreshTheme() {
    var now = currentTheme();
    $$('[data-theme-set]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-theme-set') === now));
    });
  }

  $$('[data-theme-set]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (desktop.matches) {
        setTheme(button.getAttribute('data-theme-set'));
      } else {
        // The narrow bar shows one button. It goes to the next theme.
        var next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
        setTheme(next);
        var active = $('[data-theme-set="' + next + '"]');
        if (active) active.focus();
        toast(next === 'auto' ? 'Theme: same as the system' : 'Theme: ' + next);
      }
    });
  });
  refreshTheme();

  // ---------------------------------------------------------------- toast and copy

  var toastEl = $('.toast');
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1600);
  }

  function copyText(text, button) {
    function done() {
      toast('Copied');
      if (button) {
        button.classList.add('is-copied');
        setTimeout(function () { button.classList.remove('is-copied'); }, 1600);
      }
    }
    function fallback() {
      var area = doc.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      (button && button.closest('dialog') || body).appendChild(area);
      area.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (error) { ok = false; }
      area.remove();
      if (ok) done(); else toast('Copy is not available');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  doc.addEventListener('click', function (event) {
    var button = event.target.closest('[data-copy-text], [data-copy-code]');
    if (!button) return;
    event.preventDefault();
    if (button.hasAttribute('data-copy-text')) {
      copyText(button.getAttribute('data-copy-text'), button);
      return;
    }
    var card = button.closest('[data-code]');
    if (!card) return;
    var selector = button.getAttribute('data-copy-code') === 'hl' ? '.ln.hl .tx' : '.ln:not(.rm) .tx';
    var text = $$(selector, card).map(function (line) { return line.textContent; }).join('').replace(/\n$/, '');
    copyText(text, button);
  });

  // ---------------------------------------------------------------- pickers (top bar menus)

  var openPicker = null;

  function closePicker(focusButton) {
    if (!openPicker) return;
    var button = $('.picker-btn', openPicker);
    $('.picker-menu', openPicker).hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
    openPicker = null;
  }

  $$('[data-picker]').forEach(function (picker) {
    var button = $('.picker-btn', picker);
    var menu = $('.picker-menu', picker);
    button.addEventListener('click', function () {
      if (openPicker === picker) { closePicker(false); return; }
      closePicker(false);
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      openPicker = picker;
      var current = $('[aria-current]', menu);
      if (current) {
        // Scroll only the menu, not the page.
        var offset = current.getBoundingClientRect().top - menu.getBoundingClientRect().top;
        menu.scrollTop += offset - menu.clientHeight / 2 + current.offsetHeight / 2;
      }
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) closePicker(false);
    });
    picker.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (menu.hidden) return;
      var links = $$('a', menu);
      if (!links.length) return;
      event.preventDefault();
      var index = links.indexOf(doc.activeElement);
      var next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      if (index === -1) next = event.key === 'ArrowDown' ? 0 : links.length - 1;
      links[(next + links.length) % links.length].focus();
    });
  });

  doc.addEventListener('click', function (event) {
    if (openPicker && !openPicker.contains(event.target)) closePicker(false);
  });
  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && openPicker) closePicker(true);
  });
  doc.addEventListener('focusin', function (event) {
    if (openPicker && !openPicker.contains(event.target)) closePicker(false);
  });

  // ---------------------------------------------------------------- scroll tracking

  var barHeight = 56;
  function measureBar() {
    var bar = $('.topbar');
    barHeight = bar ? bar.offsetHeight : 0;
  }

  // Sections (for the section picker)
  var sections = $$('[data-sec]');
  var sectionLinks = $$('[data-sec-link]');
  var sectionLabel = $('[data-section-label]');
  var sectionCount = $('[data-section-count]');
  var currentSection = -1;

  function updateSection() {
    if (!sections.length || !sectionLabel) return;
    var threshold = barHeight + window.innerHeight * 0.28;
    var index = 0;
    for (var i = 0; i < sections.length; i += 1) {
      if (sections[i].getBoundingClientRect().top <= threshold) index = i;
    }
    if (index === currentSection) return;
    currentSection = index;
    var link = sectionLinks[index];
    sectionLabel.textContent = link ? $('.menu-text', link).textContent : '';
    sectionCount.textContent = (index + 1) + ' of ' + sections.length;
    sectionLinks.forEach(function (item, i) {
      if (i === index) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
    });
  }

  // Steps (tutorial pages)
  var steps = $$('.step');
  var grids = $$('.steps').map(function (el) {
    var own = $$('.step', el);
    return {
      el: el,
      steps: own,
      blocks: own.map(function (step) { return $('[data-block-for="' + step.id + '"]', el); }),
      shown: null
    };
  });
  var activeStep = null;
  var userScrolled = false;

  function activationLine() {
    return barHeight + (window.innerHeight - barHeight) * 0.42;
  }

  function scrollCodeToHighlight(block) {
    var scroller = $('.code-scroll', block);
    if (!scroller) return;
    var marks = $$('.code-label-remove, .ln.rm, .ln.hl', scroller);
    scroller.scrollLeft = 0;
    if (!marks.length) { scroller.scrollTop = 0; return; }
    var frame = scroller.getBoundingClientRect();
    var top = marks[0].getBoundingClientRect().top - frame.top + scroller.scrollTop;
    var bottom = marks[marks.length - 1].getBoundingClientRect().bottom - frame.top + scroller.scrollTop;
    var height = scroller.clientHeight;
    var span = bottom - top;
    var target = span <= height - 72 ? top - (height - span) / 2 : top - 36;
    scroller.scrollTop = Math.max(0, target);
  }

  function updateSteps() {
    if (!steps.length) return;
    var line = activationLine();
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < steps.length; i += 1) {
      var rect = steps[i].getBoundingClientRect();
      var distance = rect.top > line ? rect.top - line : rect.bottom < line ? line - rect.bottom : 0;
      if (distance < bestDistance) { bestDistance = distance; best = steps[i]; }
    }
    if (best !== activeStep) {
      if (activeStep) activeStep.classList.remove('is-active');
      activeStep = best;
      if (activeStep) activeStep.classList.add('is-active');
      if (userScrolled) rememberPlace();
    }
    grids.forEach(function (grid) {
      var index = grid.steps.indexOf(activeStep);
      if (index === -1) index = grid.el.getBoundingClientRect().top > line ? 0 : grid.steps.length - 1;
      var block = grid.blocks[index];
      if (block === grid.shown) return;
      if (grid.shown) grid.shown.classList.remove('is-shown');
      grid.shown = block;
      if (block) {
        block.classList.add('is-shown');
        if (desktop.matches) scrollCodeToHighlight(block);
      }
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      updateSection();
      updateSteps();
      updateChapterSpy();
    });
  }

  // A click on a step card moves it to the active position.
  steps.forEach(function (step) {
    step.addEventListener('click', function (event) {
      if (!desktop.matches) return;
      if (event.target.closest('a, button, input, label, summary')) return;
      var selection = window.getSelection && window.getSelection();
      if (selection && String(selection).length) return;
      var rect = step.getBoundingClientRect();
      var delta = rect.top + Math.min(rect.height, 160) / 2 - activationLine();
      userScrolled = true;
      window.scrollBy({ top: delta, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });
  });

  // ---------------------------------------------------------------- remember the place ("Continue")

  var rememberTimer = null;
  function rememberPlace() {
    if (!slug || kind === 'overview') return;
    clearTimeout(rememberTimer);
    rememberTimer = setTimeout(function () {
      var data = progress();
      data.last = {
        slug: slug,
        title: body.getAttribute('data-title') || '',
        step: activeStep ? activeStep.id : null,
        time: Date.now()
      };
      saveProgress();
    }, 400);
  }

  // ---------------------------------------------------------------- step checks and page progress

  var stepTotal = Number(body.getAttribute('data-steps')) || 0;

  function refreshPageProgress() {
    if (kind === 'overview') return;
    var data = progress();
    var doneSteps = data.steps[slug] || {};
    var doneCount = 0;
    steps.forEach(function (step) {
      var id = step.getAttribute('data-step');
      var done = Boolean(doneSteps[id]);
      if (done) doneCount += 1;
      step.classList.toggle('is-done', done);
      var check = $('[data-step-check]', step);
      if (check) {
        check.setAttribute('aria-pressed', String(done));
        check.title = done ? 'Mark as not done' : 'Mark as done';
      }
    });

    var allSteps = stepTotal > 0 && doneCount >= stepTotal;
    var marked = Boolean(data.pages[slug]);
    var complete = allSteps || marked;

    var box = $('[data-pagedone]');
    if (box) {
      var status = $('[data-pagedone-status]', box);
      var button = $('[data-mark-complete]', box);
      box.classList.toggle('is-complete', complete);
      if (allSteps) status.textContent = 'All ' + stepTotal + ' steps are done. This page is complete.';
      else if (marked) status.textContent = 'You marked this page as complete.';
      else if (stepTotal) status.textContent = doneCount + ' of ' + stepTotal + ' steps done';
      else status.textContent = '';
      button.hidden = allSteps;
      button.setAttribute('aria-pressed', String(marked));
      $('span', button).textContent = marked ? 'Mark page as not complete' : 'Mark page as complete';
    }

    var bar = $('.page-progress span');
    if (bar) bar.style.width = (complete ? 100 : stepTotal ? Math.round((doneCount / stepTotal) * 100) : 0) + '%';

    refreshMenuMarks();
  }

  function refreshMenuMarks() {
    $$('.menu-item[data-slug]').forEach(function (item) {
      var mark = $('.menu-done', item);
      if (mark) mark.hidden = !isPageDone(item.getAttribute('data-slug'), Number(item.getAttribute('data-steps')) || 0);
    });
  }

  doc.addEventListener('click', function (event) {
    var check = event.target.closest('[data-step-check]');
    if (check) {
      var step = check.closest('.step');
      var id = step.getAttribute('data-step');
      var data = progress();
      var mine = data.steps[slug] || (data.steps[slug] = {});
      if (mine[id]) delete mine[id]; else mine[id] = 1;
      if (!Object.keys(mine).length) delete data.steps[slug];
      saveProgress();
      refreshPageProgress();
      return;
    }
    var mark = event.target.closest('[data-mark-complete]');
    if (mark) {
      var store = progress();
      if (store.pages[slug]) delete store.pages[slug]; else store.pages[slug] = 1;
      saveProgress();
      refreshPageProgress();
      return;
    }
    var reset = event.target.closest('[data-reset-progress]');
    if (reset) {
      if (!window.confirm('Reset your progress on all pages? This removes the done marks, the quiz answers, and the place where you stopped.')) return;
      memory = emptyProgress();
      try { window.localStorage.removeItem(PROGRESS_KEY); } catch (error) { /* no storage */ }
      refreshAll();
      $$('[data-quiz]').forEach(function (quiz) { if (quiz.resetQuiz) quiz.resetQuiz(); });
      toast('Progress is reset');
    }
  });

  // ---------------------------------------------------------------- code: phone excerpt, full file dialog

  doc.addEventListener('click', function (event) {
    var expand = event.target.closest('[data-expand]');
    if (expand) {
      var card = expand.closest('.codecard');
      var open = card.classList.toggle('is-expanded');
      expand.setAttribute('aria-expanded', String(open));
      expand.textContent = open ? 'Show only the changed lines' : 'Show all ' + expand.getAttribute('data-count') + ' lines';
      return;
    }
    var full = event.target.closest('[data-full-file]');
    if (full) openFile(full);
    var close = event.target.closest('[data-close-dialog]');
    if (close) close.closest('dialog').close();
  });

  var dialog = $('#file-dialog');
  if (dialog) {
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close(); // a click on the backdrop
    });
  }

  function parseRanges(text) {
    var set = {};
    String(text || '').split(',').forEach(function (part) {
      var match = /^(\d+)(?:-(\d+))?$/.exec(part);
      if (!match) return;
      var from = Number(match[1]);
      var to = match[2] ? Number(match[2]) : from;
      for (var n = from; n <= to; n += 1) set[n] = true;
    });
    return set;
  }

  function loadFileData(key, src, callback) {
    var files = window.__siteFiles || {};
    if (files[key]) { callback(files[key]); return; }
    var script = doc.createElement('script');
    script.src = src;
    script.onload = function () { callback((window.__siteFiles || {})[key] || null); };
    script.onerror = function () { callback(null); };
    doc.head.appendChild(script);
  }

  function openFile(button) {
    if (!dialog) return;
    var key = button.getAttribute('data-file-key');
    var bodyEl = $('.filedialog-body', dialog);
    var title = $('#file-dialog-title', dialog);
    var note = $('.filedialog-note', dialog);
    title.textContent = key.slice(key.indexOf(':') + 1);
    note.textContent = '';
    bodyEl.innerHTML = '<p class="filedialog-message">Loading the file…</p>';
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');

    loadFileData(key, button.getAttribute('data-file-src'), function (data) {
      if (!data) {
        bodyEl.innerHTML = '<p class="filedialog-message">The file is not available.</p>';
        return;
      }
      var marked = parseRanges(button.getAttribute('data-lines'));
      var digits = Math.max(2, String(data.lines.length).length);
      var html = '';
      for (var i = 0; i < data.lines.length; i += 1) {
        html += '<span class="ln' + (marked[i + 1] ? ' hl' : '') + '"><span class="no" data-n="' + (i + 1) + '"></span><span class="tx">' + data.lines[i] + '\n</span></span>';
      }
      title.textContent = data.path;
      note.textContent = 'The complete file at the end of this chapter (branch ' + data.branch + '). It can have code from later steps. The lines of this step are marked.';
      bodyEl.innerHTML = '<pre class="code" style="--digits:' + digits + '"><code>' + html + '</code></pre>';
      scrollCodeToHighlight(dialog);
      bodyEl.focus();
    });
  }

  // ---------------------------------------------------------------- quiz

  $$('[data-quiz]').forEach(function (quiz) {
    var questions = $$('[data-question]', quiz);
    var result = $('[data-quiz-result]', quiz);
    var total = questions.length;
    if (!total) return;

    function state() {
      var data = progress();
      var mine = data.quiz[slug];
      if (!mine || !Array.isArray(mine.answers)) mine = data.quiz[slug] = { answers: [] };
      return mine;
    }

    function correctIndex(question) {
      return $$('.choice', question).findIndex(function (choice) { return choice.hasAttribute('data-correct'); });
    }

    function show(index, focus) {
      questions.forEach(function (question, i) { question.hidden = i !== index; });
      result.hidden = true;
      if (focus) {
        var heading = $('h3', questions[index]);
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }

    function showResult(focus) {
      var answers = state().answers;
      var right = 0;
      questions.forEach(function (question, i) {
        question.hidden = true;
        if (answers[i] === correctIndex(question)) right += 1;
      });
      $('[data-quiz-score]', result).textContent = 'You answered ' + right + ' of ' + total + (total === 1 ? ' question' : ' questions') + ' correctly on the first try.';
      $('[data-quiz-comment]', result).textContent = right === total
        ? 'Good work. You understand the ideas of this page.'
        : 'Read the parts of the page again that go with the questions you missed. Then do the quiz again.';
      result.hidden = false;
      if (focus) result.focus();
    }

    function resetQuestion(question) {
      $$('.choice', question).forEach(function (choice) {
        choice.classList.remove('is-right', 'is-wrong');
        $('.choice-why', choice).hidden = true;
        var input = $('input', choice);
        input.checked = false;
        input.disabled = false;
      });
      $('[data-quiz-submit]', question).disabled = true;
      $('[data-quiz-next]', question).disabled = true;
    }

    function reveal(question, choiceIndex) {
      var choices = $$('.choice', question);
      var choice = choices[choiceIndex];
      if (!choice) return false;
      var right = choice.hasAttribute('data-correct');
      choice.classList.add(right ? 'is-right' : 'is-wrong');
      $('.choice-why', choice).hidden = false;
      $('input', choice).checked = true;
      if (right) choices.forEach(function (item) { $('input', item).disabled = true; });
      $('[data-quiz-next]', question).disabled = false;
      $('[data-quiz-submit]', question).disabled = true;
      return right;
    }

    questions.forEach(function (question, index) {
      var submit = $('[data-quiz-submit]', question);
      var next = $('[data-quiz-next]', question);
      question.addEventListener('change', function (event) {
        if (event.target.matches('input[type="radio"]')) {
          var choice = event.target.closest('.choice');
          submit.disabled = choice.classList.contains('is-wrong') || choice.classList.contains('is-right');
        }
      });
      submit.addEventListener('click', function () {
        var checked = $('input:checked', question);
        if (!checked) return;
        var choiceIndex = Number(checked.value);
        var mine = state();
        if (mine.answers[index] === undefined || mine.answers[index] === null) {
          mine.answers[index] = choiceIndex;
          saveProgress();
        }
        reveal(question, choiceIndex);
        next.focus();
      });
      next.addEventListener('click', function () {
        if (index + 1 < total) show(index + 1, true); else showResult(true);
      });
    });

    $('[data-quiz-restart]', quiz).addEventListener('click', function () {
      delete progress().quiz[slug];
      saveProgress();
      questions.forEach(resetQuestion);
      show(0, true);
    });

    quiz.resetQuiz = function () {
      questions.forEach(resetQuestion);
      show(0, false);
    };

    // Restore the saved state.
    var saved = state().answers;
    var firstOpen = -1;
    questions.forEach(function (question, i) {
      if (saved[i] === undefined || saved[i] === null) {
        if (firstOpen === -1) firstOpen = i;
      } else {
        reveal(question, saved[i]);
      }
    });
    if (firstOpen === -1) showResult(false); else show(firstOpen, false);
  });

  // ---------------------------------------------------------------- overview

  var chapterEls = $$('[data-chapter]');
  var chapterLinks = $$('[data-chapter-link]');
  var currentChapter = null;

  function updateChapterSpy() {
    if (!chapterLinks.length) return;
    var threshold = barHeight + window.innerHeight * 0.3;
    var current = chapterEls[0];
    chapterEls.forEach(function (chapter) {
      if (chapter.getBoundingClientRect().top <= threshold) current = chapter;
    });
    if (current === currentChapter) return;
    currentChapter = current;
    chapterLinks.forEach(function (link) {
      link.classList.toggle('is-current', link.getAttribute('data-chapter-link') === current.id);
    });
  }

  function refreshOverview() {
    if (kind !== 'overview') return;
    chapterEls.forEach(function (chapter) {
      var rows = $$('a.pagerow', chapter);
      var done = 0;
      rows.forEach(function (row) {
        var rowSlug = row.getAttribute('data-slug');
        var total = Number(row.getAttribute('data-steps')) || 0;
        var complete = isPageDone(rowSlug, total);
        var count = doneStepCount(rowSlug);
        if (complete) done += 1;
        row.classList.toggle('is-done', complete);
        $('[data-done-text]', row).textContent = complete ? 'Complete' : 'Not complete';
        var partial = $('[data-partial]', row);
        partial.hidden = complete || !total || !count;
        partial.textContent = count + ' of ' + total + ' steps done';
      });
      var label = $('[data-chapter-progress]', chapter);
      var total = Number(label.getAttribute('data-total')) || 0;
      if (total) {
        label.textContent = done >= total ? 'Complete' : done + ' of ' + total + (total === 1 ? ' page' : ' pages') + ' complete';
        label.classList.toggle('is-complete', done >= total);
      }
      var link = $('[data-chapter-link="' + chapter.id + '"] .oindex-done');
      if (link) link.hidden = !(total && done >= total);
    });

    var last = progress().last;
    var button = $('[data-continue]');
    var start = $('[data-start]');
    if (button) {
      var row = last && last.slug ? $('a.pagerow[data-slug="' + last.slug + '"]') : null;
      if (row) {
        var place = '';
        var match = /^step-(\d+)-(\d+)$/.exec(last.step || '');
        if (match) place = ', section ' + match[1] + ', step ' + match[2];
        button.href = last.slug + '.html' + (match ? '#' + last.step : '');
        $('[data-continue-title]', button).textContent = row.getAttribute('data-title') + place;
        button.hidden = false;
        button.classList.add('btn-primary');
        if (start) { start.classList.remove('btn-primary'); $('span', start).textContent = 'Start from the first page'; }
      } else {
        button.hidden = true;
        if (start) { start.classList.add('btn-primary'); $('span', start).textContent = 'Start the tutorial'; }
      }
    }
  }

  // ---------------------------------------------------------------- start

  function refreshAll() {
    refreshPageProgress();
    refreshOverview();
  }

  function layout() {
    measureBar();
    currentSection = -1;
    updateSection();
    updateSteps();
    updateChapterSpy();
    if (desktop.matches) grids.forEach(function (grid) { if (grid.shown) scrollCodeToHighlight(grid.shown); });
  }

  window.addEventListener('scroll', function () { userScrolled = true; onScroll(); }, { passive: true });
  window.addEventListener('resize', function () { window.requestAnimationFrame(layout); });
  window.addEventListener('storage', function (event) {
    if (event.key === PROGRESS_KEY || event.key === null) { memory = null; refreshAll(); }
    if (event.key === THEME_KEY) {
      var value = null;
      try { value = window.localStorage.getItem(THEME_KEY); } catch (error) { value = null; }
      if (value === 'light' || value === 'dark') root.setAttribute('data-theme', value); else root.removeAttribute('data-theme');
      refreshTheme();
    }
  });
  window.addEventListener('load', function () {
    layout();
    // Smooth scrolling starts after the first jump to a "#step" address.
    setTimeout(function () { root.classList.add('is-ready'); }, 300);
  });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(layout);

  layout();
  refreshAll();

  // Remember the page for "Continue where you stopped". Keep the step of an
  // earlier visit until the learner scrolls.
  if (slug && kind !== 'overview') {
    var data = progress();
    var keepStep = data.last && data.last.slug === slug ? data.last.step : null;
    data.last = { slug: slug, title: body.getAttribute('data-title') || '', step: keepStep, time: Date.now() };
    saveProgress();
  }
})();
