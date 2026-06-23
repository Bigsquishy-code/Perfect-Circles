const SAVE_KEY = "perfect_tower_save";

let lastTime = Date.now();

/* ================= UI ELEMENTS ================= */

const ui = {
  stats: {
    gold: document.getElementById("gold"),
    crystals: document.getElementById("crystals"),
    wave: document.getElementById("wave"),
    kills: document.getElementById("kills"),
    dps: document.getElementById("dps"),
    lives: document.getElementById("lives")
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
const menu = ui.menu.root;


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

  // 🎧 UNLOCK AUDIO SYSTEM (THIS IS THE MISSING PIECE)
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  startMusic();
};

resetBtn.onclick = () => {

  localStorage.removeItem(SAVE_KEY);
  location.reload();
};

/* ================= SAVE ================= */

function loadGameState() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch {
    return {};
  }
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function bindClick(element, handler) {
  if (element) {
    element.addEventListener("click", handler);
  }
}

function purchaseUpgrade(cost, onPurchase) {

  if (gold < cost) return false;

  gold -= cost;
  onPurchase();

  return true;
}

function cycleGameSpeed() {

  if (gameSpeed === 1) {

    gameSpeed = 2;
  }

  else if (gameSpeed === 2) {

    gameSpeed = 4;
  }

  else {

    gameSpeed = 1;
  }

  speedToggle.textContent = `⏩ SPEED x${gameSpeed}`;
}

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    size: Math.random() * 2
  }));
}

const save = loadGameState();

/* ================= GAME ================= */

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

const stars = createStars(140);

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

  /* assistant tower */

  assistantLevel: save.assistantLevel || 0,
  assistantCooldown: 0,

  cooldown: 0
};

resize();

/* ================= SAVE ================= */
function saveGame() {

  localStorage.setItem(SAVE_KEY, JSON.stringify(getSaveData()));

}

function getSaveData() {

  return {

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

  };

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
  // OR just "the_red_pl.mp3" also works

  music.loop = true;
  music.volume = 0.35;

  music.play()
    .then(() => {
      musicStarted = true;
    })
    .catch((err) => {
      console.log("Music blocked until user interaction:", err);
      musicStarted = false;
    });
}
/* ================= HELPERS ================= */

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
/* ================= DAMAGE TEXT ================= */
class DamageText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 40;
  }

  update() {
    this.y -= 0.7;
    this.life--;
  }

  draw() {
    ctx.globalAlpha = this.life / 40;
    ctx.fillStyle = this.color;
    ctx.font = "bold 18px Arial";
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

/* ================= PARTICLES ================= */

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
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw() {
    ctx.globalAlpha = this.life / 25;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
/* ================= ENEMY ================= */

class Enemy {

  constructor(type = "normal") {

    this.type = type;

    const side =
      Math.floor(Math.random() * 4);

    if (side === 0) {

      this.x = -60;
      this.y = random(0, canvas.height);
    }

    if (side === 1) {

      this.x = canvas.width + 60;
      this.y = random(0, canvas.height);
    }

    if (side === 2) {

      this.x = random(0, canvas.width);
      this.y = -60;
    }

    if (side === 3) {

      this.x = random(0, canvas.width);
      this.y = canvas.height + 60;
    }

    this.freeze = 0;

    this.dead = false;

    if (type === "normal") {

      this.radius = 16;
      this.health = 60 + wave * 20;
      this.speed = 1 + wave * 0.04;
      this.color = "#ef4444";
      this.reward = 15;
    }

    if (type === "fast") {

      this.radius = 11;
      this.health = 40 + wave * 10;
      this.speed = 2.8 + wave * 0.03;
      this.color = "#22c55e";
      this.reward = 18;
    }

    if (type === "tank") {

      this.radius = 28;
      this.health = 300 + wave * 80;
      this.speed = 0.7;
      this.color = "#f59e0b";
      this.reward = 40;
    }

    if (type === "boss") {

      this.radius = 40;
      this.health = 1200 + wave * 250;
      this.speed = 0.9;
      this.color = "#a855f7";
      this.reward = 300;
    }

    this.maxHealth = this.health;
  }

  update() {

    const dx =
      tower.x - this.x;

    const dy =
      tower.y - this.y;

    const d =
      Math.hypot(dx, dy);

    if (d === 0) return;

    let speedMult = 1;

    if (this.freeze > 0) {

      this.freeze--;

      speedMult = 0.45;
    }

    this.x +=
      dx / d * this.speed * speedMult * gameSpeed;

    this.y +=
      dy / d * this.speed * speedMult * gameSpeed;

    if (this.type === "boss") {

      if (Math.random() < 0.004) {

        tower.cooldown += 30;
        screenShake = 10;
      }
    }

    if (d < 42) {

      this.dead = true;

      lives--;

      screenShake = 8;

      if (lives <= 0) {

        gameOver();
      }
    }
  }

  draw() {

    ctx.save();

    ctx.fillStyle = this.color;

    ctx.shadowBlur = 25;
    ctx.shadowColor = this.color;

    ctx.beginPath();

    ctx.arc(
      this.x,
      this.y,
      this.radius,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    ctx.fillStyle = "#111827";

    ctx.fillRect(
      this.x - 30,
      this.y - 40,
      60,
      8
    );

    ctx.fillStyle = "#22c55e";

    ctx.fillRect(
      this.x - 30,
      this.y - 40,
      60 * (this.health / this.maxHealth),
      8
    );
  }
}

/* ================= BULLET ================= */

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

    const dx =
      this.target.x - this.x;

    const dy =
      this.target.y - this.y;

    const d =
      Math.hypot(dx, dy);

    if (d === 0) return;

    this.x +=
      dx / d * this.speed;

    this.y +=
      dy / d * this.speed;

    if (d < 10) {
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
      this.target.freeze =
        tower.freeze;

      texts.push(

        new DamageText(

          this.x,
          this.y,

          Math.floor(dmg),

          crit
            ? "#facc15"
            : "#ffffff"
        )
      );

      if (particles.length < 700) {

        for (let i = 0; i < 10; i++) {

          particles.push(

            new Particle(

              this.x,
              this.y,

              crit
                ? "#facc15"
                : "#ffffff",

              random(2, 5)
            )
          );
        }
      }

      if (crit) {

        enemies.forEach(e => {

          if (
            e !== this.target &&
            dist(e, this.target) < 130
          ) {

            e.health -=
              tower.damage * 0.5;
          }
        });
      }

      this.target.dead = true;
      if (this.target.type === "boss") {
        stats.bossesKilled++;
      }

      if (this.target.health <= 0) {
        playSound("kill");
        this.target.dead = true;

        gold += this.target.reward;
        stats.totalGoldEarned += this.target.reward;
        stats.totalKills++;
        kills++;
        stats.totalKills++;

        screenShake = 6;

        for (let i = 0; i < 25; i++) {

          particles.push(

            new Particle(

              this.target.x,
              this.target.y,

              this.target.color,

              random(3, 7)
            )
          );
        }
      }

      this.dead = true;
    }
  }

  draw() {

    ctx.fillStyle = "#facc15";

    ctx.shadowBlur = 15;
    ctx.shadowColor = "#fde047";

    ctx.beginPath();

    ctx.arc(
      this.x,
      this.y,
      5,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.shadowBlur = 0;
  }
}

/* ================= TARGET ================= */

function getTarget() {

  let best = null;
  let bestDist = Infinity;

  for (const e of enemies) {

    const d = dist(e, tower);

    if (
      d < tower.range &&
      d < bestDist
    ) {

      best = e;
      bestDist = d;
    }
  }

  return best;
}

function createAssistantBullet(target) {

  return {

    x: tower.x,
    y: tower.y,

    target,
    speed: 13,
    dead: false,
    assistant: true,

    update() {

      if (!this.target || this.target.dead) {

        this.dead = true;
        return;
      }

      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);

      if (d === 0) return;

      this.x += dx / d * this.speed * gameSpeed;
      this.y += dy / d * this.speed * gameSpeed;

      if (d < 12) {

        const dmg = tower.damage * (0.45 + tower.assistantLevel * 0.15);

        this.target.health -= dmg;

        damageDone += dmg;
        stats.totalDamage += dmg;
        texts.push(
          new DamageText(
            this.x,
            this.y,
            Math.floor(dmg),
            "#60a5fa"
          )
        );

        for (let i = 0; i < 8; i++) {

          particles.push(
            new Particle(
              this.x,
              this.y,
              "#60a5fa"
            )
          );
        }

        if (this.target.health <= 0) {

          this.target.dead = true;

          gold += this.target.reward;
          stats.totalGoldEarned += this.target.reward;
          kills++;
          stats.totalKills++;
          screenShake = 5;
          playSound("kill");
        }

        this.dead = true;
      }
    },

    draw() {

      ctx.fillStyle = "#60a5fa";

      ctx.shadowBlur = 15;
      ctx.shadowColor = "#60a5fa";

      ctx.beginPath();

      ctx.arc(
        this.x,
        this.y,
        4,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.shadowBlur = 0;
    }
  };
}

function spawnWaveEnemy() {

  const r = Math.random();

  if (r < 0.6) {

    enemies.push(new Enemy("normal"));
    return;
  }

  if (r < 0.85) {

    enemies.push(new Enemy("fast"));
    return;
  }

  enemies.push(new Enemy("tank"));
}

function createWaveEnemies(amount) {

  for (let i = 0; i < amount; i++) {

    setTimeout(() => {
      spawnWaveEnemy();
    }, i * 250);
  }
}

function firePrimaryAttack(target) {

  tower.angle = Math.atan2(
    target.y - tower.y,
    target.x - tower.x
  );

  if (tower.cooldown > 0) return;

  tower.cooldown = tower.fireRate;
  playSound("flame");

  if (tower.flameLevel > 0) {

    tower.flameRadius = tower.flameLevel * 35;

    const burnDamage = tower.damage * (0.05 + tower.flameLevel * 0.02);

    target.health -= burnDamage;
    damageDone += burnDamage;

    particles.push(
      new Particle(
        target.x + random(-20, 20),
        target.y + random(-20, 20),
        "#f97316",
        random(2, 5)
      )
    );
  }

  else {

    for (let i = 0; i < tower.multiShot; i++) {
      bullets.push(new Bullet(target));
    }
  }

  updateAssistantAI();
}

function updateAssistantAI() {

  if (tower.assistantLevel <= 0) return;

  tower.assistantCooldown -= gameSpeed;

  if (tower.assistantCooldown > 0) return;

  const nearbyEnemies = enemies.filter(
    (enemy) => dist(enemy, tower) < tower.range * 0.9
  );

  if (nearbyEnemies.length === 0) return;

  const enemy = nearbyEnemies[
    Math.floor(Math.random() * nearbyEnemies.length)
  ];

  bullets.push(createAssistantBullet(enemy));

  tower.assistantCooldown = Math.max(22 - tower.assistantLevel * 2, 6);
}

function updateCombat() {

  const target = getTarget();

  if (!target) return;

  firePrimaryAttack(target);
}

function updateWorldEntities() {

  enemies.forEach((enemy) => enemy.update());

  bullets.forEach((bullet) => {

    if (bullet.update) {
      bullet.update();
    }
  });

  particles.forEach((particle) => particle.update());
  texts.forEach((text) => text.update());
}

function cleanupWorldEntities() {

  enemies = enemies.filter((enemy) => !enemy.dead);
  bullets = bullets.filter((bullet) => !bullet.dead);
  particles = particles.filter((particle) => particle.life > 0);
  texts = texts.filter((text) => text.life > 0);
}

function updateWaveProgression() {

  if (waveInProgress && enemies.length === 0) {

    waveInProgress = false;
  }

  if (wave > stats.highestWave) {
    stats.highestWave = wave;
  }

  gold += 0.04 * gameSpeed;
}

/* ================= WAVES ================= */

function spawnWave() {

  if (waveInProgress) return;

  waveInProgress = true;

  const amount = 5 + Math.floor(wave * 1.2);

  if (wave % 7 === 0) {

    enemies.push(
      new Enemy("boss")
    );
  }

  createWaveEnemies(amount);

  wave++;
  texts.push(
    new DamageText(
      canvas.width / 2 - 80,
      120,
      `WAVE ${wave}`,
      "#60a5fa"
    )
  );
}

/* ================= PRESTIGE ================= */

function prestige() {

  if (wave < 25) return;

  const gain =
    Math.floor(wave / 10);

  crystals += gain;

  gold = 150;
  wave = 1;
  kills = 0;
  lives = 20;

  enemies = [];
  bullets = [];

  tower.damage = 18 + crystals * 2;
  tower.fireRate = 3;
  tower.range = 240;
  tower.freeze = 0;
  tower.flame = false;
  tower.multiShot = 1;

  alert(
    "Prestiged for "
    + gain +
    " crystals!"
  );
}

/* ================= GAME OVER ================= */

function gameOver() {

  alert("GAME OVER");

  localStorage.removeItem(
    SAVE_KEY
  );

  location.reload();
}

/* ================= UPDATE ================= */

function update() {


  if (!started) return;

  if (autoWave && !waveInProgress) {

    spawnWave();
  }

  const now = Date.now();

  stats.playTime += (now - lastTime) / 1000;

  lastTime = now;
  tower.cooldown -= gameSpeed;

  updateCombat();

  updateWorldEntities();
  cleanupWorldEntities();
  updateWaveProgression();

  updateUI();
}

/* ================= UI ================= */

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

/* ================= COSTS ================= */

function damageCost() {

  return Math.floor(
    30 * Math.pow(
      1.18,
      tower.damage / 6
    )
  );
}

function speedCost() {

  return Math.floor(
    45 * Math.pow(
      1.16,
      20 - tower.fireRate
    )
  );
}

function rangeCost() {

  return Math.floor(
    60 * Math.pow(
      1.15,
      (tower.range - 240) / 25
    )
  );
}

function freezeCost() {

  return Math.floor(
    90 * Math.pow(
      1.18,
      tower.freeze / 15
    )
  );
}

function multiCost() {

  return Math.floor(
    140 * Math.pow(
      1.35,
      tower.multiShot
    )
  );
}

function flameCost() {

  return Math.floor(
    180 * Math.pow(
      1.28,
      tower.flameLevel
    )
  );
}

function assistantCost() {

  return Math.floor(
    220 * Math.pow(
      1.42,
      tower.assistantLevel
    )
  );
}

/* ================= DRAW ================= */

function drawBackground() {

  const grad =
    ctx.createLinearGradient(
      0,
      0,
      0,
      canvas.height
    );

  grad.addColorStop(
    0,
    "#0f172a"
  );

  grad.addColorStop(
    1,
    "#020617"
  );

  ctx.fillStyle = grad;

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  stars.forEach(s => {

    s.y += 0.2 * gameSpeed;

    if (s.y > canvas.height) {

      s.y = 0;
    }

    ctx.fillStyle =
      "rgba(255,255,255,0.18)";

    ctx.fillRect(
      s.x,
      s.y,
      s.size,
      s.size
    );
  });
}

function drawTower() {

  ctx.save();
  const pulse =
    Math.sin(Date.now() * 0.004) * 4;

  ctx.fillStyle =
    tower.flameLevel > 0
      ? "#f97316"
      : "#3b82f6";

  ctx.shadowBlur = 45;

  ctx.shadowColor =
    tower.flameLevel > 0
      ? "#fb923c"
      : "#60a5fa";

  ctx.beginPath();

  ctx.arc(
    0,
    0,
    32 + pulse,
    0,
    Math.PI * 2
  );

  ctx.fill();
  ctx.translate(
    tower.x,
    tower.y
  );

  ctx.rotate(
    tower.angle
  );

  ctx.beginPath();

  ctx.arc(
    0,
    0,
    tower.range,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle =
    "rgba(255,255,255,0.08)";

  ctx.stroke();

  ctx.fillStyle =
    tower.flameLevel > 0 ? "#f97316" : "#2563eb";

  ctx.shadowBlur = 30;

  ctx.shadowColor =
    tower.flameLevel > 0 ? "#f97316" : "#2563eb";
  ctx.beginPath();

  ctx.arc(
    0,
    0,
    32,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle =
    tower.flame
      ? "#fdba74"
      : "#93c5fd";
  ctx.fillRect(
    0,
    -7,
    46,
    14
  );

  /* ================= ASSISTANT DRONES ================= */

  if (tower.assistantLevel > 0) {

    const orbit =
      Date.now() * 0.002;

    const droneCount =
      Math.min(tower.assistantLevel, 4);

    for (let i = 0; i < droneCount; i++) {

      const angle =
        orbit + (Math.PI * 2 / droneCount) * i;

      const dx =
        Math.cos(angle) * 70;

      const dy =
        Math.sin(angle) * 70;

      ctx.fillStyle = "#60a5fa";

      ctx.shadowBlur = 20;
      ctx.shadowColor = "#60a5fa";

      ctx.beginPath();

      ctx.arc(
        dx,
        dy,
        10,
        0,
        Math.PI * 2
      );

      ctx.fill();

      /* little laser line */

      ctx.strokeStyle =
        "rgba(96,165,250,0.25)";

      ctx.beginPath();

      ctx.moveTo(0, 0);

      ctx.lineTo(dx, dy);

      ctx.stroke();
    }
  }

  ctx.restore();

  ctx.restore();
}

function draw() {

  drawBackground();

  if (!started) return;

  ctx.save();

  ctx.translate(

    random(-screenShake, screenShake) * 0.5,

    random(-screenShake, screenShake) * 0.5
  );

  screenShake *= 0.85;

  drawTower();

  enemies.forEach(
    e => e.draw()
  );

  bullets.forEach(b => {

    if (b.draw) {
      b.draw();
    }
  });

  particles.forEach(
    p => p.draw()
  );

  texts.forEach(
    t => t.draw()
  );

  ctx.restore();
  ctx.strokeStyle =
    "rgba(255,255,255,0.03)";

  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function playStartBurst() {

  screenShake = 15;

  particles.push(
    ...Array.from({ length: 80 }, () =>
      new Particle(
        tower.x,
        tower.y,
        "#60a5fa"
      )
    )
  );
}

/* ================= LOOP ================= */

function loop() {

  update();
  draw();

  requestAnimationFrame(loop);
}

loop();

/* ================= BUTTONS ================= */

bindClick(waveBtn, spawnWave);

playStartBurst();

bindClick(autoBtn, () => {

  autoWave = !autoWave;

  autoBtn.textContent =
    autoWave
      ? "AUTO WAVE: OFF"
      : "AUTO WAVE: ON";
});

bindClick(speedToggle, cycleGameSpeed);

bindClick(prestigeBtn, prestige);

/* damage */

bindClick(damageBtn, () => {

  const cost =
    damageCost();

  purchaseUpgrade(cost, () => {

    tower.damage += 6;

    playSound("upgrade"); // ✅ ONLY HERE
  });
});

/* speed */

bindClick(speedBtn, () => {

  const cost =
    speedCost();

  purchaseUpgrade(cost, () => {

    playSound("upgrade"); // ✅ ONLY HERE

    tower.fireRate =
      Math.max(
        4,
        tower.fireRate - 1
      );
  });
});

/* range */

bindClick(rangeBtn, () => {

  const cost =
    rangeCost();

  purchaseUpgrade(cost, () => {

    tower.range += 25;
    playSound("upgrade"); // ✅ ONLY HERE
  });
});

/* freeze */

bindClick(freezeBtn, () => {

  const cost =
    freezeCost();

  purchaseUpgrade(cost, () => {

    playSound("upgrade"); // ✅ ONLY HERE
    tower.freeze =
      Math.min(
        tower.freeze + 15,
        120
      );
  });
});

/* multishot */

bindClick(multiBtn, () => {

  const cost =
    multiCost();

  purchaseUpgrade(cost, () => {

    tower.multiShot++;
    playSound("upgrade"); // ✅ ONLY HERE
  });
});

/* flame */

bindClick(flameBtn, () => {

  const cost = flameCost();

  purchaseUpgrade(cost, () => {

    // first unlock
    if (tower.flameLevel === 0) {
      tower.flameLevel = 10;
    } else {
      tower.flameLevel++;
    }

    playSound("upgrade");
  });
});
/* assistant tower */

bindClick(assistantBtn, () => {

  const cost =
    assistantCost();

  purchaseUpgrade(cost, () => {

    tower.assistantLevel++;

    playSound("upgrade");
  });
});