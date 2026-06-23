let lastTime = Date.now();

/* ================= UI ELEMENTS ================= */

const goldEl = document.getElementById("gold");
const crystalsEl = document.getElementById("crystals");
const waveEl = document.getElementById("wave");
const killsEl = document.getElementById("kills");
const dpsEl = document.getElementById("dps");
const livesEl = document.getElementById("lives");

const damageBtn = document.getElementById("damageBtn");
const speedBtn = document.getElementById("speedBtn");
const rangeBtn = document.getElementById("rangeBtn");
const freezeBtn = document.getElementById("freezeBtn");
const multiBtn = document.getElementById("multiBtn");
const flameBtn = document.getElementById("flameBtn");
const assistantBtn = document.getElementById("assistantBtn");

const waveBtn = document.getElementById("waveBtn");
const autoBtn = document.getElementById("autoBtn");
const speedToggle = document.getElementById("speedToggle");
const prestigeBtn = document.getElementById("prestigeBtn");

const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");
const menu = document.getElementById("menu");

/* ================= CANVAS ================= */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    tower.x = canvas.width / 2;
    tower.y = canvas.height / 2;
}
addEventListener("resize", resize);

/* ================= MENU ================= */

let started = false;

playBtn.onclick = async () => {
    started = true;
    menu.style.display = "none";

    if (audioCtx.state === "suspended") {
        await audioCtx.resume();
    }

    startMusic();
};

resetBtn.onclick = () => {
    localStorage.removeItem("perfect_tower_save");
    location.reload();
};

/* ================= SAVE ================= */

const save = JSON.parse(localStorage.getItem("perfect_tower_save")) || {};

/* ================= GAME VARIABLES ================= */

let gold = save.gold || 150;
let crystals = save.crystals || 0;
let wave = save.wave || 1;
let kills = save.kills || 0;
let lives = save.lives || 20;

let autoWave = false;
let gameSpeed = 1;
let waveInProgress = false;

let damageDone = 0;

let enemies = [];
let bullets = [];
let particles = [];
let texts = [];
let turrets = [];

let screenShake = 0;

/* ================= STATS ================= */

const stats = {
    highestWave: save.highestWave || 1,
    totalGoldEarned: save.totalGoldEarned || 0,
    totalDamage: save.totalDamage || 0,
    bossesKilled: save.bossesKilled || 0,
    playTime: save.playTime || 0,
    prestiges: save.prestiges || 0,
    totalKills: save.totalKills || 0
};

/* ================= STARS ================= */

const stars = Array.from({ length: 140 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    size: Math.random() * 2
}));

/* ================= TOWER ================= */

const tower = {
    x: 0,
    y: 0,
    angle: 0,

    damage: save.damage || 18,
    fireRate: save.fireRate || 30,
    range: save.range || 240,

    crit: 0.15 + crystals * 0.005,

    freeze: save.freeze || 0,
    flameLevel: save.flameLevel || 0,

    flameRadius: 0,
    multiShot: save.multiShot || 1,

    assistantLevel: save.assistantLevel || 0,
    assistantCooldown: 0,

    cooldown: 0
};

resize();

/* ================= SAVE FUNCTION ================= */

function saveGame() {
    localStorage.setItem(
        "perfect_tower_save",
        JSON.stringify({
            gold,
            crystals,
            wave,
            kills,
            lives,

            damage: tower.damage,
            fireRate: tower.fireRate,
            range: tower.range,
            freeze: tower.freeze,
            flameLevel: tower.flameLevel,
            multiShot: tower.multiShot,
            assistantLevel: tower.assistantLevel,

            highestWave: stats.highestWave,
            totalGoldEarned: stats.totalGoldEarned,
            totalDamage: stats.totalDamage,
            bossesKilled: stats.bossesKilled,
            playTime: stats.playTime,
            prestiges: stats.prestiges,
            totalKills: stats.totalKills
        })
    );
}

setInterval(saveGame, 3000);

/* ================= SOUND SYSTEM ================= */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    let freq = 440;
    let duration = 0.1;

    switch (type) {
        case "shoot": freq = 600; duration = 0.05; break;
        case "flame": freq = 250; duration = 0.01; break;
        case "hit": freq = 200; duration = 0.08; break;
        case "kill": freq = 120; duration = 0.15; break;
        case "upgrade": freq = 800; duration = 0.1; break;
        case "wave": freq = 300; duration = 0.2; break;
        case "damageCrit": freq = 1000; duration = 0.07; break;
        case "gameOver": freq = 80; duration = 0.5; break;
    }

    osc.frequency.value = freq;
    osc.type = "square";

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

/* ================= BACKGROUND MUSIC ================= */

let music = null;
let musicStarted = false;

function startMusic() {
    if (musicStarted) return;

    music = new Audio("./the_red_pl.mp3");
    music.loop = true;
    music.volume = 0.35;

    music.play()
        .then(() => musicStarted = true)
        .catch(() => musicStarted = false);
}

/* ================= HELPERS ================= */

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ================= V3 STRATEGY LAYER ================= */

let strategyMode = false;
let showAIOverlay = false;
let showEnemyIntel = false;

const threatMap = new Map();
let predictionDots = [];

/* ================= BUTTONS ================= */

const strategyBtn = document.getElementById("strategyModeBtn");
const aiOverlayBtn = document.getElementById("aiOverlayBtn");
const enemyIntelBtn = document.getElementById("enemyIntelBtn");

if (strategyBtn) {
  strategyBtn.addEventListener("click", () => {
    strategyMode = !strategyMode;
    strategyBtn.textContent = strategyMode ? "TACTICS: ON" : "TACTICS: OFF";
  });
}

if (aiOverlayBtn) {
  aiOverlayBtn.addEventListener("click", () => {
    showAIOverlay = !showAIOverlay;
  });
}

if (enemyIntelBtn) {
  enemyIntelBtn.addEventListener("click", () => {
    showEnemyIntel = !showEnemyIntel;
  });
}
/* ================= THREAT SYSTEM ================= */

function updateThreatMap() {
  if (!strategyMode) return;

  for (const e of enemies) {
    const key = (e.x / 50 | 0) + "," + (e.y / 50 | 0);
    threatMap.set(key, (threatMap.get(key) || 0) + 0.25);
  }

  for (const [key, value] of threatMap) {
    const next = value * 0.97;
    if (next < 0.05) threatMap.delete(key);
    else threatMap.set(key, next);
  }
}

/* ================= PREDICTION ================= */

function predictEnemyPaths() {
  predictionDots = [];
  if (!strategyMode) return;

  for (const e of enemies) {
    const steps = 6;

    let px = e.x;
    let py = e.y;

    const dx = tower.x - e.x;
    const dy = tower.y - e.y;
    const len = Math.hypot(dx, dy);

    if (!len) continue;

    const vx = (dx / len) * e.speed;
    const vy = (dy / len) * e.speed;

    for (let i = 0; i < steps; i++) {
      px += vx * 12;
      py += vy * 12;

      predictionDots.push({
        x: px,
        y: py,
        size: 3,
        alpha: 1 - i * 0.14
      });
    }
  }
}

/* ================= THREAT SCORE ================= */

function getThreatLevel() {
  let total = 0;

  for (const e of enemies) {
    const d = dist(e, tower);

    let weight = 1;
    if (e.type === "fast") weight = 1.4;
    if (e.type === "tank") weight = 1.8;
    if (e.type === "boss") weight = 3.5;

    total += (weight * 120) / (d + 1);
  }

  return total | 0;
}

/* ================= MAIN UPDATE HOOK ================= */

function updateStrategyLayer() {
  updateThreatMap();
  predictEnemyPaths();
}

/* ================= DRAW ================= */

function drawStrategyOverlay() {
  if (!showAIOverlay && !showEnemyIntel) return;

  ctx.save();

  if (showAIOverlay) {
    for (const p of predictionDots) {
      ctx.globalAlpha = p.alpha * 0.6;
      ctx.fillStyle = "#60a5fa";

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (showEnemyIntel) {
    for (const e of enemies) {
      const d = dist(e, tower);
      const intensity = Math.min(1, 280 / (d + 1));

      ctx.strokeStyle = `rgba(248,113,113,${intensity})`;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(tower.x, tower.y);
      ctx.stroke();
    }

    ctx.fillStyle = "#fca5a5";
    ctx.font = "14px Arial";
    ctx.fillText(
      "THREAT: " + getThreatLevel(),
      20,
      canvas.height - 30
    );
  }

  ctx.restore();
}