(() => {
  let ctx = null;
  let sfxEnabled = localStorage.getItem("amorSfx") !== "off";
  let lastScore = Number((document.querySelector("#score")?.textContent || "0").split("/")[0]) || 0;

  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  function tone(freq, duration = 0.08, type = "square", volume = 0.035, delay = 0) {
    if (!sfxEnabled) return;
    const ac = getCtx();
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  const SFX = {
    click() { tone(430, .055, "square", .022); tone(650, .045, "square", .012, .035); },
    flip() { tone(320, .055, "square", .018); tone(480, .055, "square", .018, .045); },
    heart() { tone(660, .07, "sine", .03); tone(880, .08, "sine", .025, .05); },
    select() { tone(520, .06, "triangle", .022); },
    note() { tone(392, .08, "triangle", .018); tone(523, .1, "triangle", .018, .06); },
    success() {
      tone(523, .12, "square", .026);
      tone(659, .12, "square", .025, .09);
      tone(784, .18, "square", .024, .18);
    }
  };
  window.SFX = SFX;

  document.addEventListener("pointerdown", () => {
    if (sfxEnabled) {
      try { getCtx(); } catch {}
    }
  }, { once: true });

  document.addEventListener("click", (e) => {
    const button = e.target.closest("button,.note");
    if (!button) return;
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

  const sfxBtn = document.querySelector("#sfxToggle");
  function renderSfx() {
    if (!sfxBtn) return;
    sfxBtn.classList.toggle("off", !sfxEnabled);
    sfxBtn.setAttribute("aria-pressed", String(sfxEnabled));
    sfxBtn.querySelector("span").textContent = sfxEnabled ? "SFX ON" : "SFX OFF";
  }
  if (sfxBtn) {
    sfxBtn.addEventListener("click", () => {
      sfxEnabled = !sfxEnabled;
      localStorage.setItem("amorSfx", sfxEnabled ? "on" : "off");
      if (sfxEnabled) SFX.success();
      renderSfx();
    });
  }
  renderSfx();

  const playlist = [
    { id: "qvTJKqZfBjg", title: "Te Esperando", artist: "Luan Santana" },
    { id: "dl0Dp_FRMo4", title: "ILHA", artist: "Luan Santana" }
  ];
  let player = null;
  let track = 0;
  let ready = false;
  let isPlaying = false;

  const dock = document.querySelector("#musicDock");
  const panel = document.querySelector("#musicPanel");
  const openBtn = document.querySelector("#musicOpen");
  const playBtn = document.querySelector("#musicPlay");
  const nextBtn = document.querySelector("#musicNext");
  const titleEl = document.querySelector("#musicTitle");
  const statusEl = document.querySelector("#musicStatus");

  function setTrackUi(status = "") {
    const item = playlist[track];
    if (titleEl) titleEl.textContent = item.title;
    if (statusEl) statusEl.textContent = status || item.artist;
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

  function closeDock() {
    if (player && ready && isPlaying) player.pauseVideo();
    dock?.classList.remove("open");
    panel?.setAttribute("aria-hidden", "true");
  }

  openBtn?.addEventListener("click", () => {
    if (dock?.classList.contains("open")) closeDock();
    else openDock();
  });

  playBtn?.addEventListener("click", () => {
    openDock();
    if (!player || !ready) {
      setTrackUi("CARREGANDO...");
      return;
    }
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  });

  nextBtn?.addEventListener("click", () => {
    openDock();
    if (!player || !ready) return;
    if (track < playlist.length - 1) {
      track++;
      player.loadVideoById(playlist[track].id);
      player.playVideo();
    } else {
      track = 0;
      player.loadVideoById(playlist[track].id);
      player.playVideo();
    }
    setTrackUi();
  });

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("ytPlayer", {
      width: "300",
      height: "200",
      videoId: playlist[0].id,
      playerVars: {
        playsinline: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1
      },
      events: {
        onReady() {
          ready = true;
          setTrackUi("PRONTA PARA TOCAR");
        },
        onStateChange(event) {
          if (event.data === YT.PlayerState.PLAYING) {
            isPlaying = true;
            setTrackUi();
          } else if (event.data === YT.PlayerState.PAUSED) {
            isPlaying = false;
            setTrackUi("PAUSADA");
          } else if (event.data === YT.PlayerState.ENDED) {
            isPlaying = false;
            if (track < playlist.length - 1) {
              track++;
              player.loadVideoById(playlist[track].id);
              player.playVideo();
              setTrackUi("PRÓXIMA FAIXA");
            } else {
              setTrackUi("PLAYLIST FINALIZADA");
            }
          }
        }
      }
    });
  };

  setTrackUi("TOQUE PARA OUVIR");
})();