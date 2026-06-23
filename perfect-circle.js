/* ================================================================= */
/* ⭕ PERFECT TOWER - UNIFIED ARCHITECTURE CORE ENGINE               */
/* ================================================================= */

const SAVE_KEY = "perfect_tower_save";

/* ================= GLOBAL ENGINE INITIALIZATION ================= */
const canvas = document.getElementById("game");
const ctx = canvas ? canvas.getContext("2d") : null;

if (canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// System State Flags
let started = false;
let gameSpeed = 1;
let lastTime = Date.now();
let screenShake = 0;

// Dynamic Spawning Variables
let waveInProgress = false;
let enemiesLeftToSpawn = 0;
let spawnCooldownTimer = 0;
let autoWave = false;

/* ================= SAVE / RESTORATION LAYERS ================= */
function loadGameState() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch {
    return {};
  }
}

const save = loadGameState();

// Economical Run States
let gold = save.gold !== undefined ? save.gold : 150;
let crystals = save.crystals !== undefined ? save.crystals : 0;
let wave = save.wave !== undefined ? save.wave : 1;
let kills = save.kills !== undefined ? save.kills : 0;
let lives = save.lives !== undefined ? save.lives : 20;
let damageDone = 0;

// Permanent Statistics Profiles
const stats = {
  highestWave: save.highestWave || 1,
  totalGoldEarned: save.totalGoldEarned || 0,
  totalDamage: save.totalDamage || 0,
  bossesKilled: save.bossesKilled || 0,
  playTime: save.playTime || 0,
  prestiges: save.prestiges || 0,
  totalKills: save.totalKills || 0
};

// Core Central Tower State Object
const tower = {
  x: canvas ? canvas.width / 2 : 0,
  y: canvas ? canvas.height / 2 : 0,
  angle: 0,
  damage: save.damage || 18,
  fireRate: save.fireRate || 30,
  range: save.range || 240,

  get crit() {
    return 0.15 + crystals * 0.005;
  },

  freeze: save.freeze || 0,
  flameLevel: save.flameLevel || 0,
  flameRadius: 0,
  multiShot: save.multiShot || 1,
  assistantLevel: save.assistantLevel || 0,
  assistantCooldown: 0,
  cooldown: 0
};

// Active Entity Containers
let enemies = [];
let bullets = [];
let particles = [];
let texts = [];

/* ================= CRITICAL SYSTEM HELPERS ================= */
function bindClick(element, callback) {
  if (element) {
    element.addEventListener("click", callback);
  }
}

function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function purchaseUpgrade(cost, successCallback) {
  if (gold >= cost) {
    gold -= cost;
    successCallback();
    updateUI(); 
    return true;
  } else {
    // Spawns a floating notification over the tower instead of freezing the game!
    texts.push(new DamageText(tower.x - 50, tower.y - 40, "Not enough gold!", "#ef4444"));
    return false;
  }
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 2
  }));
}

const stars = createStars(140);

/* ================= SYSTEM LAYER DOM MAPPINGS ================= */
const ui = {
  stats: {
    gold: document.getElementById("goldEl"),
    crystals: document.getElementById("crystalsEl"),
    wave: document.getElementById("waveEl"),
    kills: document.getElementById("killsEl"),
    dps: document.getElementById("dpsEl"),
    lives: document.getElementById("livesEl")
  },
  upgrades: {
    damage: document.getElementById("damageBtn"),
    speed: document.getElementById("speedBtn"),
    range: document.getElementById("rangeBtn"),
    freeze: document.getElementById("freezeBtn"),
    multi: document.getElementById("multiBtn"),
    flame: document.getElementById("flameBtn"),
    assistant: document.getElementById("assistantBtn")
  },
  controls: {
    wave: document.getElementById("waveBtn"),
    auto: document.getElementById("autoBtn"),
    speedToggle: document.getElementById("speedToggle"),
    prestige: document.getElementById("prestigeBtn")
  },
  menu: {
    play: document.getElementById("playBtn"),
    reset: document.getElementById("resetBtn"),
    root: document.getElementById("menu")
  }
};

const goldEl = ui.stats.gold;
const crystalsEl = ui.stats.crystals;
const waveEl = ui.stats.wave;
const killsEl = ui.stats.kills;
const dpsEl = ui.stats.dps;
const livesEl = ui.stats.lives;

const damageBtn = ui.upgrades.damage;
const speedBtn = ui.upgrades.speed;
const rangeBtn = ui.upgrades.range;
const freezeBtn = ui.upgrades.freeze;
const multiBtn = ui.upgrades.multi;
const flameBtn = ui.upgrades.flame;
const assistantBtn = ui.upgrades.assistant;

const waveBtn = ui.controls.wave;
const autoBtn = ui.controls.auto;
const speedToggle = ui.controls.speedToggle;
const prestigeBtn = ui.controls.prestige;

const playBtn = ui.menu.play;
const resetBtn = ui.menu.reset;
const menuDiv = ui.menu.root;

/* ================= WEB AUDIO SYNTH FX ENGINE ================= */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === "suspended") return;

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

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

let music = null;
let musicStarted = false;

function startMusic() {
  if (musicStarted) return;
  music = new Audio("./the_red_pl.mp3");
  music.loop = true;
  music.volume = 0.35;

  music.play()
    .then(() => { musicStarted = true; })
    .catch((err) => {
      console.log("Music context deferred until direct gesture:", err);
      musicStarted = false;
    });
}

/* ================= OBJECT ENTITY COMPONENTS ================= */

class DamageText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 40;
  }
  update() {
    this.y -= 0.7 * gameSpeed;
    this.life -= 1 * gameSpeed;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / 40);
    ctx.fillStyle = this.color;
    ctx.font = "bold 18px Inter, Arial, sans-serif";
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
    this.life = 25;
    this.color = color;
  }
  update() {
    this.x += this.vx * gameSpeed;
    this.y += this.vy * gameSpeed;
    this.life -= 1 * gameSpeed;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / 25);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Enemy {
  constructor(type = "normal") {
    this.type = type;
    this.freeze = 0;
    this.dead = false;

    const side = Math.floor(Math.random() * 4);
    if (side === 0) { this.x = -60; this.y = random(0, canvas.height); }
    else if (side === 1) { this.x = canvas.width + 60; this.y = random(0, canvas.height); }
    else if (side === 2) { this.x = random(0, canvas.width); this.y = -60; }
    else { this.x = random(0, canvas.width); this.y = canvas.height + 60; }

    if (type === "normal") {
      this.radius = 16;
      this.health = 60 + wave * 20;
      this.speed = 1 + wave * 0.04;
      this.color = "#ef4444";
      this.reward = 15;
    } else if (type === "fast") {
      this.radius = 11;
      this.health = 40 + wave * 10;
      this.speed = 2.8 + wave * 0.03;
      this.color = "#22c55e";
      this.reward = 18;
    } else if (type === "tank") {
      this.radius = 28;
      this.health = 300 + wave * 80;
      this.speed = 0.7;
      this.color = "#f59e0b";
      this.reward = 40;
    } else if (type === "boss") {
      this.radius = 40;
      this.health = 2200 + wave * 2550;
      this.speed = 0.9;
      this.color = "#a855f7";
      this.reward = 300;

      texts.push(new DamageText(canvas.width / 2 - 80, 120, "BOSS INCOMING!", "#a855f7"));
      playSound("wave");
    }
    this.maxHealth = this.health;
  }

  update() {
    const dx = tower.x - this.x;
    const dy = tower.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;

    let speedMult = 1;
    if (this.freeze > 0) {
      this.freeze -= gameSpeed;
      speedMult = 0.45;
    }

    this.x += (dx / d) * this.speed * speedMult * gameSpeed;
    this.y += (dy / d) * this.speed * speedMult * gameSpeed;

    if (this.type === "boss" && Math.random() < 0.004) {
      tower.cooldown += 30;
      screenShake = 10;
    }

    if (d < 42) {
      this.dead = true;
      lives--;
      screenShake = 8;
      if (lives <= 0) gameOver();
    }
  }

  draw() {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 25;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#111827";
    ctx.fillRect(this.x - 30, this.y - 40, 60, 8);
    const healthPercentage = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(this.x - 30, this.y - 40, 60 * healthPercentage, 8);
  }
}

class Bullet {
  constructor(target) {
    this.x = tower.x;
    this.y = tower.y;
    this.target = target;
    this.speed = tower.fireRate > 20 ? 10 : 14;
    this.dead = false;
  }

  update() {
    if (!this.target || this.target.dead) {
      this.dead = true;
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;

    this.x += (dx / d) * this.speed * gameSpeed;
    this.y += (dy / d) * this.speed * gameSpeed;

    if (d < 12) {
      playSound("hit");
      let dmg = tower.damage;
      let crit = false;

      if (Math.random() < tower.crit) {
        playSound("damageCrit");
        dmg *= 3;
        crit = true;
      }

      this.target.health -= dmg;
      damageDone += dmg;
      stats.totalDamage += dmg;
      
      if (tower.freeze > 0) this.target.freeze = tower.freeze;

      texts.push(new DamageText(this.x, this.y, Math.floor(dmg), crit ? "#facc15" : "#ffffff"));

      if (particles.length < 500) {
        const pColor = crit ? "#facc15" : "#ffffff";
        for (let i = 0; i < 8; i++) particles.push(new Particle(this.x, this.y, pColor));
      }

      if (crit) {
        enemies.forEach(e => {
          if (e !== this.target && !e.dead && dist(e, this.target) < 130) {
            e.health -= tower.damage * 0.5;
            if (e.health <= 0) processEnemyDeath(e);
          }
        });
      }

      if (this.target.health <= 0) processEnemyDeath(this.target);
      this.dead = true;
    }
  }

  draw() {
    ctx.save();
    ctx.fillStyle = "#facc15";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#fde047";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ================= TARGETING & DESTRUCTION GLOBAL ROUTERS ================= */
function getTarget(mode = "first") {
  if (enemies.length === 0) return null;
  let validEnemies = enemies.filter(e => !e.dead && dist(tower, e) <= tower.range);
  if (validEnemies.length === 0) return null;

  if (mode === "strong") {
    return validEnemies.reduce((max, e) => e.health > max.health ? e : max, validEnemies[0]);
  }
  return validEnemies.reduce((closest, e) => dist(tower, e) < dist(tower, closest) ? e : closest, validEnemies[0]);
}

function processEnemyDeath(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;

  playSound("kill");
  gold += enemy.reward;
  stats.totalGoldEarned += enemy.reward;
  kills++;
  stats.totalKills++;

  if (enemy.type === "boss") stats.bossesKilled++;
  screenShake = enemy.type === "boss" ? 15 : 6;

  if (particles.length < 600) {
    const burst = enemy.type === "boss" ? 45 : 15;
    for (let i = 0; i < burst; i++) particles.push(new Particle(enemy.x, enemy.y, enemy.color));
  }
}

function createAssistantBullet(target) {
  return {
    x: tower.x,
    y: tower.y,
    target,
    speed: 13,
    dead: false,
    update() {
      if (!this.target || this.target.dead) {
        this.dead = true;
        return;
      }
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d === 0) return;

      this.x += (dx / d) * this.speed * gameSpeed;
      this.y += (dy / d) * this.speed * gameSpeed;

      if (d < 12) {
        const dmg = tower.damage * (0.45 + tower.assistantLevel * 0.15);
        this.target.health -= dmg;
        damageDone += dmg;
        stats.totalDamage += dmg;
        
        texts.push(new DamageText(this.x, this.y, Math.floor(dmg), "#60a5fa"));

        if (particles.length < 400) {
          for (let i = 0; i < 6; i++) particles.push(new Particle(this.x, this.y, "#60a5fa"));
        }

        if (this.target.health <= 0) processEnemyDeath(this.target);
        this.dead = true;
      }
    },
    draw() {
      ctx.save();
      ctx.fillStyle = "#60a5fa";
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#60a5fa";
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
}

/* ================= LIFECYCLE SPAWN PROCEDURES ================= */
function spawnWaveEnemy() {
  const r = Math.random();
  if (r < 0.6) {
    enemies.push(new Enemy("normal"));
  } else if (r < 0.85) {
    enemies.push(new Enemy("fast")); // FIXED: Corrected typo 'entries.push' reference crash
    enemies.push(new Enemy("fast"));
  } else {
    enemies.push(new Enemy("tank"));
  }
}

function spawnWave() {
  if (waveInProgress) return;
  waveInProgress = true;
  playStartBurst();
  
  // Configure spawning quantities dynamically per wave progression rules
  let spawnAmount = 10 + wave * 3;
  enemiesLeftToSpawn = spawnAmount;
  spawnCooldownTimer = 0;
}

function processActiveSpawning() {
  if (enemiesLeftToSpawn <= 0) return;

  spawnCooldownTimer -= gameSpeed;
  if (spawnCooldownTimer <= 0) {
    spawnWaveEnemy();
    enemiesLeftToSpawn--;
    spawnCooldownTimer = 14; 
  }
}

/* ================= ATTACK CONTROLLERS ================= */
function firePrimaryAttack(target) {
  tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);

  if (tower.cooldown > 0) return;
  tower.cooldown = Math.max(tower.fireRate, 1);
  playSound("shoot");

  if (tower.flameLevel > 0) {
    playSound("flame");
    tower.flameRadius = tower.flameLevel * 35;
    const burnDamage = tower.damage * (0.05 + tower.flameLevel * 0.05);

    target.health -= burnDamage;
    damageDone += burnDamage;

    if (particles.length < 400) {
      particles.push(new Particle(target.x + random(-15, 15), target.y + random(-15, 15), "#f97316"));
    }
    if (target.health <= 0) processEnemyDeath(target);
  } else {
    for (let i = 0; i < tower.multiShot; i++) {
      bullets.push(new Bullet(target));
    }
  }
}

function updateAssistantAI() {
  if (tower.assistantLevel <= 0) return;

  tower.assistantCooldown -= gameSpeed;
  if (tower.assistantCooldown > 0) return;

  const nearby = enemies.filter(e => !e.dead && dist(e, tower) < tower.range * 0.9);
  if (nearby.length === 0) return;

  const enemy = nearby[Math.floor(Math.random() * nearby.length)];
  bullets.push(createAssistantBullet(enemy));
  tower.assistantCooldown = Math.max(22 - tower.assistantLevel * 2, 6);
}

function updateCombat() {
  if (tower.cooldown > 0) tower.cooldown -= gameSpeed;
  processActiveSpawning();

  const target = getTarget();
  if (target) firePrimaryAttack(target);

  updateAssistantAI();
}

function updateWaveProgression() {
  if (waveInProgress && enemies.length === 0 && enemiesLeftToSpawn === 0) {
    waveInProgress = false;
    gold += 50 + wave * 10; // Round Clear Bonus payout adjustments
    wave++;
    saveGame();
    updateUI();
  }

  if (wave > stats.highestWave) stats.highestWave = wave;
  gold += 0.04 * gameSpeed; // Strategic background idle gold generation
}

function cycleGameSpeed() {
  if (gameSpeed === 1) gameSpeed = 2;
  else if (gameSpeed === 2) gameSpeed = 4;
  else gameSpeed = 1;

  if (speedToggle) speedToggle.textContent = `⏩ SPEED x${gameSpeed}`;
}

/* ================= PRICING SCALE FORMULAS ================= */
function damageCost() {
  const manualUpgrades = Math.max(0, (tower.damage - (18 + crystals * 2)) / 6);
  return Math.floor(30 * Math.pow(1.18, manualUpgrades));
}

function speedCost() {
  const speedUpgrades = Math.max(0, 30 - tower.fireRate);
  return Math.floor(45 * Math.pow(1.16, speedUpgrades));
}

function rangeCost() {
  const rangeUpgrades = Math.max(0, (tower.range - 240) / 25);
  return Math.floor(60 * Math.pow(1.15, rangeUpgrades));
}

function freezeCost() {
  const freezeUpgrades = Math.max(0, tower.freeze / 15);
  return Math.floor(90 * Math.pow(1.18, freezeUpgrades));
}

function multiCost() {
  const multiUpgrades = Math.max(0, tower.multiShot - 1);
  return Math.floor(140 * Math.pow(1.45, multiUpgrades));
}

function flameCost() {
  return Math.floor(180 * Math.pow(1.28, tower.flameLevel));
}

function assistantCost() {
  return Math.floor(220 * Math.pow(1.42, tower.assistantLevel));
}

/* ================= GRAPHICAL DESIGN SYSTEM LAYERS ================= */
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#020617");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  stars.forEach(s => {
    s.y += 0.2 * gameSpeed;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
}

function drawTower() {
  ctx.save();
  ctx.translate(tower.x, tower.y);

  // Range Indicator Ring
  ctx.strokeStyle = "rgba(59, 130, 246, 0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, tower.range, 0, Math.PI * 2);
  ctx.stroke();

  // Pulse Core Aura
  const pulse = Math.sin(Date.now() * 0.005) * 4;
  ctx.save();
  ctx.shadowBlur = 40;
  ctx.shadowColor = tower.flameLevel > 0 ? "#f97316" : "#60a5fa";
  ctx.fillStyle = tower.flameLevel > 0 ? "rgba(249, 115, 22, 0.3)" : "rgba(59, 130, 246, 0.3)";
  ctx.beginPath();
  ctx.arc(0, 0, 36 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Weapon Barrel Barrel Matrix
  ctx.save();
  ctx.rotate(tower.angle);
  ctx.fillStyle = tower.flameLevel > 0 ? "#ea580c" : "#1e40af";
  ctx.fillRect(0, -8, 48, 16);
  ctx.fillStyle = tower.flameLevel > 0 ? "#fdba74" : "#93c5fd";
  ctx.fillRect(16, -4, 28, 8);
  ctx.restore();

  // Base Crystal Cap
  ctx.fillStyle = tower.flameLevel > 0 ? "#f97316" : "#2563eb";
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  // Assistant Orbit Drone Nodes
  if (tower.assistantLevel > 0) {
    const orbit = Date.now() * 0.0015;
    const droneCount = Math.min(tower.assistantLevel, 4);

    for (let i = 0; i < droneCount; i++) {
      const angle = orbit + (Math.PI * 2 / droneCount) * i;
      const dx = Math.cos(angle) * 65;
      const dy = Math.sin(angle) * 65;

      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.arc(dx, dy, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(96, 165, 250, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dx, dy);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function draw() {
  drawBackground();
  if (!started) return;

  ctx.save();
  
  // Clean Screen Shaking Implementation
  if (screenShake > 0.1) {
    const dx = (Math.random() - 0.5) * screenShake;
    const dy = (Math.random() - 0.5) * screenShake;
    ctx.translate(dx, dy);
    screenShake *= 0.9;
  }

  // Combat Overlay Strategy Grid Elements
  ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // Draw calls running depth configurations order stack
  enemies.forEach(e => { if (!e.dead) e.draw(); });
  bullets.forEach(b => { if (b.draw && !b.dead) b.draw(); });
  particles.forEach(p => p.draw());
  texts.forEach(t => t.draw());
  
  drawTower();

  ctx.restore();
}

/* ================= TICK CONTROLLERS & RUNTIMES ================= */
function update() {
  if (!started) return;

  if (autoWave && !waveInProgress && enemies.length === 0 && enemiesLeftToSpawn === 0) {
    spawnWave();
  }

  const now = Date.now();
  stats.playTime += (now - lastTime) / 1000;
  lastTime = now;

  updateCombat();
  
  bullets.forEach(bullet => { if (bullet.update) bullet.update(); });
  bullets = bullets.filter(bullet => !bullet.dead);

  enemies.forEach(enemy => enemy.update());
  enemies = enemies.filter(enemy => !enemy.dead);

  particles.forEach(particle => particle.update());
  particles = particles.filter(particle => particle.life > 0);

  texts.forEach(text => text.update());
  texts = texts.filter(text => text.life > 0);

  updateWaveProgression();
}

let uiThrottleTimer = 0;
function loop() {
  update();
  draw();

  uiThrottleTimer++;
  if (uiThrottleTimer % 3 === 0) {
    updateUI();
  }

  requestAnimationFrame(loop);
}

function playStartBurst() {
  screenShake = 15;
  if (particles.length < 500) {
    for (let i = 0; i < 80; i++) {
      particles.push(new Particle(tower.x, tower.y, i % 2 === 0 ? "#60a5fa" : "#3b82f6"));
    }
  }
}

/* ================= SYSTEM RESET AND GAME OVER LAYERS ================= */
function saveGame() {
  const data = {
    gold, crystals, wave, kills, lives,
    damage: tower.damage, fireRate: tower.fireRate, range: tower.range,
    freeze: tower.freeze, flameLevel: tower.flameLevel, multiShot: tower.multiShot,
    assistantLevel: tower.assistantLevel, highestWave: stats.highestWave,
    totalGoldEarned: stats.totalGoldEarned, totalDamage: stats.totalDamage,
    bossesKilled: stats.bossesKilled, playTime: stats.playTime,
    prestiges: stats.prestiges, totalKills: stats.totalKills
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

setInterval(saveGame, 3000);

function prestige() {
  if (wave < 25) {
    alert("You must reach wave 25 to prestige!");
    return;
  }

  const gain = Math.floor(wave / 10);
  crystals += gain;

  gold = 150;
  wave = 1;
  kills = 0;
  lives = 20;

  enemies = []; bullets = []; particles = []; texts = [];
  waveInProgress = false;
  enemiesLeftToSpawn = 0;

  tower.damage = 18 + crystals * 2;
  tower.fireRate = 30; 
  tower.range = 240;
  tower.freeze = 0;
  tower.flameLevel = 0; 
  tower.multiShot = 1;
  tower.assistantLevel = 0;
  tower.cooldown = 0;

  stats.prestiges++;
  saveGame();

  alert(`Prestiged successfully! Gained ${gain} Crystals.`);
  location.reload();
}

function gameOver() {
  playSound("gameOver");
  alert("🔮 THE CORE HAS FALLEN! GAME OVER 🔮\nYour run has been reset, but your Prestige Crystals remain safe!");

  gold = 150;
  wave = 1;
  kills = 0;
  lives = 20;
  
  enemies = []; bullets = []; particles = []; texts = [];
  waveInProgress = false;
  enemiesLeftToSpawn = 0;

  saveGame();
  location.reload();
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  tower.x = canvas.width / 2;
  tower.y = canvas.height / 2;
}

function updateUI() {
  setText(goldEl, Math.floor(gold));
  setText(crystalsEl, crystals);
  setText(waveEl, wave);
  setText(killsEl, kills);
  setText(livesEl, lives);
  setText(dpsEl, Math.floor(damageDone));
  updateUpgradeLabels();
}

function updateUpgradeLabels() {
  setText(damageBtn, `Damage +6 (${damageCost()})`);
  setText(speedBtn, `Fire Speed (${speedCost()})`);
  setText(rangeBtn, `Range +25 (${rangeCost()})`);
  setText(freezeBtn, `❄ Freeze (${freezeCost()})`);
  setText(multiBtn, `🔫 Multi Shot (${multiCost()})`);
  setText(flameBtn, `🔥 Flamethrower (${flameCost()})`);
  setText(assistantBtn, `🤖 Assistant Tower (${assistantCost()})`);
}

/* ================= EVENT ATTACHMENTS & INITIALIZATION ================= */
window.addEventListener("resize", resize);

if (playBtn) {
  playBtn.onclick = async () => {
    started = true;
    if (menuDiv) menuDiv.style.display = "none";
    if (audioCtx.state === "suspended") await audioCtx.resume();
    startMusic();
    playStartBurst();
    lastTime = Date.now();
  };
}

if (resetBtn) {
  resetBtn.onclick = () => {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  };
}

bindClick(waveBtn, spawnWave);
bindClick(speedToggle, cycleGameSpeed);
bindClick(prestigeBtn, prestige);

bindClick(autoBtn, () => {
  autoWave = !autoWave;
  autoBtn.textContent = autoWave ? "AUTO WAVE: ON" : "AUTO WAVE: OFF";
  playSound("upgrade");
});

bindClick(damageBtn, () => {
  purchaseUpgrade(damageCost(), () => { tower.damage += 6; playSound("upgrade"); });
});

bindClick(speedBtn, () => {
  purchaseUpgrade(speedCost(), () => { tower.fireRate = Math.max(4, tower.fireRate - 1); playSound("upgrade"); });
});

bindClick(rangeBtn, () => {
  purchaseUpgrade(rangeCost(), () => { tower.range += 25; playSound("upgrade"); });
});

bindClick(freezeBtn, () => {
  purchaseUpgrade(freezeCost(), () => { tower.freeze = Math.min(tower.freeze + 15, 120); playSound("upgrade"); });
});

bindClick(multiBtn, () => {
  purchaseUpgrade(multiCost(), () => { tower.multiShot++; playSound("upgrade"); });
});

bindClick(flameBtn, () => {
  purchaseUpgrade(flameCost(), () => {
    if (tower.flameLevel === 0) tower.flameLevel = 1;
    else tower.flameLevel++;
    playSound("upgrade");
  });
});

bindClick(assistantBtn, () => {
  purchaseUpgrade(assistantCost(), () => { tower.assistantLevel++; playSound("upgrade"); });
});

// Setup baseline interface strings and start engine loop
resize();
if (autoBtn) autoBtn.textContent = "AUTO WAVE: OFF";
requestAnimationFrame(loop);

/* ================= BUTTON COUPLING LISTENERS ================= */

bindClick(waveBtn, spawnWave);
bindClick(speedToggle, cycleGameSpeed);
bindClick(prestigeBtn, prestige);

bindClick(autoBtn, () => {
  autoWave = !autoWave;
  autoBtn.textContent = autoWave ? "AUTO WAVE: ON" : "AUTO WAVE: OFF";
  playSound("upgrade");
});

bindClick(damageBtn, () => {
  const cost = damageCost();
  purchaseUpgrade(cost, () => {
    tower.damage += 6;
    playSound("upgrade");
  });
});

bindClick(speedBtn, () => {
  const cost = speedCost();
  purchaseUpgrade(cost, () => {
    // Capped at 6 frames per shot to ensure performance/physics tracking safety limits
    tower.fireRate = Math.max(6, tower.fireRate - 2); 
    playSound("upgrade");
  });
});

bindClick(rangeBtn, () => {
  const cost = rangeCost();
  purchaseUpgrade(cost, () => {
    tower.range += 25;
    playSound("upgrade");
  });
});

bindClick(freezeBtn, () => {
  const cost = freezeCost();
  purchaseUpgrade(cost, () => {
    // Tracks freeze effect duration metrics (max 90 frames / 1.5s stun)
    tower.freeze = Math.min(tower.freeze + 10, 90);
    playSound("upgrade");
  });
});

bindClick(multiBtn, () => {
  const cost = multiCost();
  purchaseUpgrade(cost, () => {
    tower.multiShot++;
    playSound("upgrade");
  });
});

bindClick(flameBtn, () => {
  const cost = flameCost();
  purchaseUpgrade(cost, () => {
    tower.flameLevel++;
    playSound("upgrade");
  });
});

bindClick(assistantBtn, () => {
  const cost = assistantCost();
  purchaseUpgrade(cost, () => {
    tower.assistantLevel++;
    playSound("upgrade");
  });
});

/* ================= WAVE CELEBRATION EFFECTS ================= */

function playStartBurst() {
  screenShake = 15;

  // Spawns a beautiful, deep kinetic energy shockwave ring on new wave entries
  if (particles.length < 500) {
    for (let i = 0; i < 80; i++) {
      particles.push(
        new Particle(
          tower.x,
          tower.y,
          i % 2 === 0 ? "#60a5fa" : "#3b82f6"
        )
      );
    }
  }
}

/* ================= EVENT INITIALIZATION & SETUP ================= */

// Boot up the initial visual celebration ring blast safely on load
if (typeof playStartBurst === "function") {
  playStartBurst();
}

/* ================= CORE SYSTEM BUTTON LISTENERS ================= */

bindClick(waveBtn, spawnWave);
bindClick(speedToggle, cycleGameSpeed);
bindClick(prestigeBtn, prestige);

bindClick(autoBtn, () => {
  autoWave = !autoWave;
  // FIXED: Adjusted text labels to properly match the boolean state properties
  autoBtn.textContent = autoWave ? "AUTO WAVE: ON" : "AUTO WAVE: OFF";
  if (typeof playSound === "function") playSound("upgrade");
});

/* ================= UPGRADE SPECIFIC PURCHASE ACTIONS ================= */

/* Damage Upgrade */
bindClick(damageBtn, () => {
  const cost = damageCost();
  purchaseUpgrade(cost, () => {
    tower.damage += 6;
    playSound("upgrade");
  });
});

/* Fire Speed Upgrade */
bindClick(speedBtn, () => {
  const cost = speedCost();
  purchaseUpgrade(cost, () => {
    // Safely caps fire rate frames to maintain game physics stability limits
    tower.fireRate = Math.max(4, tower.fireRate - 1);
    playSound("upgrade");
  });
});

/* Range Upgrade */
bindClick(rangeBtn, () => {
  const cost = rangeCost();
  purchaseUpgrade(cost, () => {
    tower.range += 25;
    playSound("upgrade");
  });
});

/* Freeze Effect Upgrade */
bindClick(freezeBtn, () => {
  const cost = freezeCost();
  purchaseUpgrade(cost, () => {
    // Tracks maximum frame freeze duration limits (Max 120 frames / 2s freeze)
    tower.freeze = Math.min(tower.freeze + 15, 120);
    playSound("upgrade");
  });
});

/* Multishot Upgrade */
bindClick(multiBtn, () => {
  const cost = multiCost();
  purchaseUpgrade(cost, () => {
    tower.multiShot++;
    playSound("upgrade");
  });
});

/* Flamethrower Weapon Upgrade */
bindClick(flameBtn, () => {
  const cost = flameCost();
  purchaseUpgrade(cost, () => {
    // FIXED: Corrected first-time unlock assignments to keep damage progression balanced
    if (tower.flameLevel === 0) {
      tower.flameLevel = 1;
    } else {
      tower.flameLevel++;
    }
    playSound("upgrade");
  });
});

/* Assistant Drone Upgrade */
bindClick(assistantBtn, () => {
  const cost = assistantCost();
  purchaseUpgrade(cost, () => {
    tower.assistantLevel++;
    playSound("upgrade");
  });
});