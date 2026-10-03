(() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let lastScore = Number((document.querySelector("#score")?.textContent || "0").split("/")[0]) || 0;

  const MUSIC_VOLUME = 0.72;
  const FADE_IN_MS = 1800;
  const FADE_OUT_MS = 2200;

  const tracks = [
    "./assets/audio/te-esperando.mp3",
    "./assets/audio/ilha.mp3"
  ];

  const musicBtn = document.querySelector("#musicOpen");
  const musicBars = document.querySelector("#musicBars");

  const audio = new Audio();
  audio.preload = "auto";
  audio.volume = 0;
  audio.playsInline = true;

  let track = 0;
  let started = false;
  let playing = false;
  let fadingOut = false;
  let fadeTimer = null;

  const getCtx = async () => {
    if (!AudioCtx) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
    return ctx;
  };

  function tone(freq, duration = 0.08, type = "square", volume = 0.07, delay = 0) {
    getCtx().then(ac => {
      if (!ac || !master) return;
      const t = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.03);
    });
  }

  const SFX = {
    click() {
      tone(430, .055, "square", .055);
      tone(650, .05, "square", .035, .04);
    },
    flip() {
      tone(300, .07, "square", .06);
      tone(470, .07, "square", .055, .05);
    },
    heart() {
      tone(660, .09, "sine", .085);
      tone(880, .11, "sine", .07, .065);
    },
    select() {
      tone(520, .07, "triangle", .065);
      tone(630, .06, "triangle", .045, .045);
    },
    note() {
      tone(392, .10, "triangle", .06);
      tone(523, .13, "triangle", .055, .075);
    },
    success() {
      tone(523, .13, "square", .07);
      tone(659, .14, "square", .065, .10);
      tone(784, .20, "square", .06, .21);
    }
  };
  window.SFX = SFX;

  function clearFade() {
    if (fadeTimer) {
      cancelAnimationFrame(fadeTimer);
      fadeTimer = null;
    }
  }

  function fadeTo(target, duration, done) {
    clearFade();
    const from = audio.volume;
    const diff = target - from;
    const start = performance.now();

    const step = now => {
      const p = Math.min(1, (now - start) / duration);
      const eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      audio.volume = Math.max(0, Math.min(1, from + diff * eased));

      if (p < 1) {
        fadeTimer = requestAnimationFrame(step);
      } else {
        fadeTimer = null;
        audio.volume = target;
        if (done) done();
      }
    };
    fadeTimer = requestAnimationFrame(step);
  }

  function renderMusic() {
    musicBtn?.classList.toggle("playing", playing);
    musicBtn?.setAttribute("aria-pressed", String(playing));
    if (musicBars) musicBars.classList.toggle("active", playing);
  }

  async function loadTrack(index, autoPlay = true) {
    track = index;
    fadingOut = false;
    clearFade();

    audio.src = tracks[track];
    audio.volume = 0;
    audio.load();

    if (autoPlay) {
      try {
        await audio.play();
        playing = true;
        renderMusic();
        fadeTo(MUSIC_VOLUME, FADE_IN_MS);
      } catch {
        playing = false;
        renderMusic();
      }
    }
  }

  async function startMusic() {
    await getCtx();

    if (!started) {
      started = true;
      await loadTrack(0, true);
      return;
    }

    if (playing) {
      fadeTo(0, 500, () => {
        audio.pause();
        playing = false;
        renderMusic();
      });
    } else {
      try {
        await audio.play();
        playing = true;
        renderMusic();
        fadeTo(MUSIC_VOLUME, 700);
      } catch {}
    }
  }

  musicBtn?.addEventListener("click", () => {
    startMusic();
    SFX.click();
  });

  audio.addEventListener("play", () => {
    playing = true;
    renderMusic();
  });

  audio.addEventListener("pause", () => {
    if (!audio.ended) {
      playing = false;
      renderMusic();
    }
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration || !playing || fadingOut) return;
    const remaining = audio.duration - audio.currentTime;

    if (remaining <= FADE_OUT_MS / 1000 + .15) {
      fadingOut = true;
      fadeTo(0, Math.max(350, remaining * 1000 - 80));
    }
  });

  audio.addEventListener("ended", async () => {
    playing = false;
    renderMusic();

    if (track < tracks.length - 1) {
      await loadTrack(track + 1, true);
    }
  });

  audio.addEventListener("error", () => {
    playing = false;
    renderMusic();
    console.error("Não foi possível carregar a trilha local:", audio.currentSrc);
  });

  document.addEventListener("pointerdown", () => {
    getCtx();
  }, { once: true, passive: true });

  document.addEventListener("click", e => {
    const button = e.target.closest("button,.note");
    if (!button || button.id === "musicOpen") return;

    if (button.classList.contains("heart")) SFX.heart();
    else if (button.classList.contains("mem")) SFX.flip();
    else if (button.classList.contains("choice") || button.classList.contains("option")) SFX.select();
    else if (button.classList.contains("note")) SFX.note();
    else SFX.click();
  });

  const scoreEl = document.querySelector("#score");
  if (scoreEl) {
    new MutationObserver(() => {
      const now = Number(scoreEl.textContent.split("/")[0]) || 0;
      if (now > lastScore) SFX.success();
      lastScore = now;
    }).observe(scoreEl, { childList: true, characterData: true, subtree: true });
  }

  renderMusic();
})();