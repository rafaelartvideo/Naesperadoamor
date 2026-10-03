(() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let sfxEnabled = localStorage.getItem("amorSfx") !== "off";
  let lastScore = Number((document.querySelector("#score")?.textContent || "0").split("/")[0]) || 0;

  const playlist = [
    { id: "qvTJKqZfBjg", title: "Te Esperando", artist: "Luan Santana" },
    { id: "dl0Dp_FRMo4", title: "ILHA", artist: "Luan Santana" }
  ];

  let player = null;
  let track = 0;
  let ready = false;
  let isPlaying = false;
  let pendingStart = false;
  let duckTimer = null;
  const NORMAL_VOLUME = 72;
  const DUCK_VOLUME = 22;

  const dock = document.querySelector("#musicDock");
  const panel = document.querySelector("#musicPanel");
  const openBtn = document.querySelector("#musicOpen");
  const playBtn = document.querySelector("#musicPlay");
  const nextBtn = document.querySelector("#musicNext");
  const sfxBtn = document.querySelector("#sfxToggle");
  const titleEl = document.querySelector("#musicTitle");
  const statusEl = document.querySelector("#musicStatus");
  const fallbackEl = document.querySelector("#musicFallback");

  function ensureAudio() {
    if (!AudioCtx) return Promise.resolve(null);
    if (!ctx) {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.95;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      return ctx.resume().then(() => ctx).catch(() => null);
    }
    return Promise.resolve(ctx);
  }

  function tone(freq, duration = 0.08, type = "square", volume = 0.075, delay = 0) {
    if (!sfxEnabled) return;
    ensureAudio().then(ac => {
      if (!ac || !master) return;
      const t = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.025);
    });
  }

  function duckMusic(ms = 420) {
    if (!player || !ready || !isPlaying || typeof player.setVolume !== "function") return;
    clearTimeout(duckTimer);
    try { player.setVolume(DUCK_VOLUME); } catch {}
    duckTimer = setTimeout(() => {
      if (player && ready && isPlaying) {
        try { player.setVolume(NORMAL_VOLUME); } catch {}
      }
    }, ms);
  }

  const SFX = {
    click() {
      duckMusic(240);
      tone(440, .07, "square", .065);
      tone(660, .06, "square", .045, .045);
    },
    flip() {
      duckMusic(280);
      tone(300, .07, "square", .065);
      tone(460, .07, "square", .06, .05);
    },
    heart() {
      duckMusic(360);
      tone(660, .09, "sine", .09);
      tone(880, .11, "sine", .08, .065);
    },
    select() {
      duckMusic(260);
      tone(520, .08, "triangle", .075);
      tone(620, .06, "triangle", .05, .045);
    },
    note() {
      duckMusic(420);
      tone(392, .10, "triangle", .07);
      tone(523, .13, "triangle", .065, .075);
    },
    success() {
      duckMusic(760);
      tone(523, .13, "square", .075);
      tone(659, .14, "square", .07, .10);
      tone(784, .21, "square", .065, .21);
    }
  };
  window.SFX = SFX;

  function unlockWithGesture() {
    ensureAudio().then(() => {
      if (sfxEnabled) {
        tone(740, .035, "square", .022);
      }
    });
  }
  document.addEventListener("pointerdown", unlockWithGesture, { once: true, passive: true });

  document.addEventListener("click", (e) => {
    const button = e.target.closest("button,.note");
    if (!button) return;
    if (button.id === "sfxToggle") return;
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

  function renderSfx() {
    if (!sfxBtn) return;
    sfxBtn.classList.toggle("off", !sfxEnabled);
    sfxBtn.setAttribute("aria-pressed", String(sfxEnabled));
    sfxBtn.querySelector("span").textContent = sfxEnabled ? "SFX ON" : "SFX OFF";
  }
  sfxBtn?.addEventListener("click", async () => {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem("amorSfx", sfxEnabled ? "on" : "off");
    renderSfx();
    if (sfxEnabled) {
      await ensureAudio();
      SFX.success();
    }
  });
  renderSfx();

  function setTrackUi(status = "") {
    const item = playlist[track];
    if (titleEl) titleEl.textContent = item.title;
    if (statusEl) statusEl.textContent = status || item.artist;
    if (fallbackEl) fallbackEl.href = "https://www.youtube.com/watch?v=" + item.id;
    if (playBtn) {
      playBtn.classList.toggle("playing", isPlaying);
      const label = playBtn.querySelector("span");
      if (label) label.textContent = isPlaying ? "PAUSAR" : "TOCAR";
      playBtn.setAttribute("aria-label", isPlaying ? "Pausar música" : "Tocar música");
    }
  }

  function openDock() {
    dock?.classList.add("open");
    panel?.setAttribute("aria-hidden", "false");
  }

  function requestPlay() {
    openDock();
    pendingStart = true;
    if (!player || !ready) {
      setTrackUi("CARREGANDO PLAYER...");
      return;
    }
    pendingStart = false;
    try {
      player.unMute();
      player.setVolume(NORMAL_VOLUME);
      player.playVideo();
      setTrackUi("INICIANDO...");
    } catch {
      setTrackUi("TOQUE EM TOCAR");
    }
  }

  openBtn?.addEventListener("click", () => {
    ensureAudio();
    if (!dock?.classList.contains("open")) {
      requestPlay();
    } else if (!isPlaying) {
      requestPlay();
    } else {
      dock.classList.remove("open");
      panel?.setAttribute("aria-hidden", "true");
    }
  });

  playBtn?.addEventListener("click", () => {
    ensureAudio();
    openDock();
    if (!player || !ready) {
      pendingStart = true;
      setTrackUi("CARREGANDO PLAYER...");
      return;
    }
    if (isPlaying) {
      player.pauseVideo();
    } else {
      try {
        player.unMute();
        player.setVolume(NORMAL_VOLUME);
        player.playVideo();
      } catch {
        setTrackUi("TOQUE NOVAMENTE");
      }
    }
  });

  nextBtn?.addEventListener("click", () => {
    ensureAudio();
    openDock();
    if (!player || !ready) {
      setTrackUi("CARREGANDO PLAYER...");
      return;
    }
    track = track < playlist.length - 1 ? track + 1 : 0;
    try {
      player.loadVideoById(playlist[track].id);
      player.unMute();
      player.setVolume(NORMAL_VOLUME);
      player.playVideo();
      setTrackUi("TROCANDO FAIXA...");
    } catch {
      setTrackUi("NÃO FOI POSSÍVEL TROCAR");
    }
  });

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("ytPlayer", {
      width: "300",
      height: "200",
      videoId: playlist[0].id,
      playerVars: {
        autoplay: 0,
        playsinline: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin
      },
      events: {
        onReady() {
          ready = true;
          try {
            player.unMute();
            player.setVolume(NORMAL_VOLUME);
          } catch {}
          setTrackUi("PRONTA — CLIQUE AQUI");
          if (pendingStart) {
            pendingStart = false;
            try {
              player.playVideo();
            } catch {
              setTrackUi("TOQUE EM TOCAR");
            }
          }
        },
        onStateChange(event) {
          if (event.data === YT.PlayerState.PLAYING) {
            isPlaying = true;
            try { player.setVolume(NORMAL_VOLUME); } catch {}
            setTrackUi();
          } else if (event.data === YT.PlayerState.PAUSED) {
            isPlaying = false;
            setTrackUi("PAUSADA");
          } else if (event.data === YT.PlayerState.ENDED) {
            isPlaying = false;
            if (track < playlist.length - 1) {
              track++;
              try {
                player.loadVideoById(playlist[track].id);
                player.unMute();
                player.setVolume(NORMAL_VOLUME);
                player.playVideo();
                setTrackUi("PRÓXIMA FAIXA...");
              } catch {
                setTrackUi("TOQUE EM TOCAR");
              }
            } else {
              setTrackUi("PLAYLIST FINALIZADA");
            }
          }
        },
        onError(event) {
          isPlaying = false;
          pendingStart = false;
          setTrackUi("ERRO NO PLAYER — ABRA NO YOUTUBE");
          if (fallbackEl) fallbackEl.hidden = false;
        }
      }
    });
  };

  window.addEventListener("load", () => {
    setTimeout(() => {
      if (!ready && statusEl) statusEl.textContent = "PLAYER CARREGANDO...";
    }, 1800);
  });

  setTrackUi("CLIQUE AQUI PARA OUVIR");
})();