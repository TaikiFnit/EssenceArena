// ============================================================
// ESSENCE ARENA — Core Game Engine (shared between PC & Mobile)
// ============================================================

// --- Constants ---
const WORLD_SIZE = 4000;
const TILE_SIZE = 64;
const BASE_SPEED = 100; // slower for spacing gameplay
const SWORD_LENGTH = 90; // longer sword for spacing
const SWORD_ARC = Math.PI * 0.65;
const CHARGE_TIME = 0.45; // time to charge an attack
const SWING_TIME = 0.18; // actual swing is fast once charged
const SWING_COOLDOWN = 0.15; // short cooldown after swing
const HIT_STOP_PARRY = 0.28; // freeze frames on parry
const HIT_STOP_HIT = 0.18; // freeze frames on hit
const STAGGER_TIME = 0.5; // stagger after being hit (can't attack)
const PARRY_STAGGER = 0.35; // stagger after being parried
const DASH_DISTANCE = 45; // short dash ~half sword
const DASH_TIME = 0.08;
const DASH_COOLDOWN = 1.8; // lower CD
const BASE_HP = 300; // internal HP (displayed as 3.00)
const DAMAGE = 100; // 1.00 displayed
const ESSENCE_ABSORB_SPEED = 8; // essence per second when in cloud
const ESSENCE_HEAL_RATE = 5; // HP heal per second while absorbing
const ENEMY_SENSE_RANGE = 300;
const ENEMY_ATTACK_RANGE = SWORD_LENGTH + 20;
const IFRAMES = 0.3;
const DEATH_ESSENCE_SCATTER_RADIUS = 150; // base scatter radius
const MINIMAP_RANGE = 600;
const AUTO_AIM_RANGE = 250;
const INITIAL_ENEMIES = 120;
const MAX_ENEMIES = 160;
const LEVEL_ESSENCE = [0, 20, 50, 100, 170, 260, 380, 530, 720, 960, 1260, 1640, 2120, 2720, 3480, 4440]; // cumulative essence for each level

// --- Audio ---
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playSFX(freq, dur, type='square', vol=0.15) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}
function playCharge() { playSFX(300, 0.3, 'sine', 0.06); }
function playSlash() { playSFX(180, 0.12, 'sawtooth', 0.15); playSFX(350, 0.08, 'square', 0.08); }
function playParry() {
  playSFX(900, 0.35, 'triangle', 0.25);
  playSFX(1400, 0.2, 'sine', 0.18);
  playSFX(600, 0.15, 'square', 0.1);
}
function playHit() { playSFX(80, 0.25, 'sawtooth', 0.25); playSFX(150, 0.15, 'square', 0.12); }
function playDeath() { playSFX(60, 0.6, 'sawtooth', 0.3); playSFX(40, 1.0, 'sine', 0.2); }
function playEssence() { playSFX(500 + Math.random()*300, 0.08, 'sine', 0.06); }
function playLevelUp() {
  playSFX(523, 0.2, 'sine', 0.2);
  setTimeout(()=>playSFX(659, 0.2, 'sine', 0.2), 120);
  setTimeout(()=>playSFX(784, 0.3, 'sine', 0.25), 240);
  setTimeout(()=>playSFX(1047, 0.4, 'sine', 0.2), 380);
}

// --- Game State ---
let gamePhase = 'title';
let player = null;
let entities = [];
let essenceClouds = []; // area-based essence (replaces instant orbs)
let particles = [];
let corpses = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let camera = { x: 0, y: 0 };
let skillMenuOpen = false;
let totalGameTime = 0;
let hitStopTimer = 0; // global hit stop
let levelUpPending = false;
let levelUpChoices = [];

// Input (set by platform-specific code)
let inputMoveX = 0, inputMoveY = 0;
let inputLeftAttack = false, inputRightAttack = false;
let inputDash = false;
let inputAngle = 0; // player aim angle
let inputAngleAuto = false; // true if using auto-aim

// --- Skill System (Vampire Survivors + GunFire Reborn style) ---
const SKILL_POOL = [
  { id: 'maxHp', name: 'HP上限', desc: 'HP上限アップ', maxLevel: 3, effects: [50, 100, 200], icon: '♥' },
  { id: 'moveSpeed', name: '移動速度', desc: '移動速度アップ', maxLevel: 3, effects: [0.1, 0.2, 0.35], icon: '⚡' },
  { id: 'swordLen', name: '刀身延長', desc: '剣のリーチ拡大', maxLevel: 3, effects: [12, 25, 45], icon: '⚔' },
  { id: 'chargeSpd', name: '居合速度', desc: '溜め時間短縮', maxLevel: 3, effects: [0.06, 0.12, 0.2], icon: '🔥' },
  { id: 'dashStock', name: 'ダッシュ蓄積', desc: 'ダッシュストック+1', maxLevel: 2, effects: [1, 1], icon: '💨' },
  { id: 'dashRange', name: 'ダッシュ距離', desc: 'ダッシュ飛距離アップ', maxLevel: 3, effects: [10, 20, 35], icon: '🌀' },
  { id: 'absorb', name: '吸収速度', desc: 'エッセンス吸収速度アップ', maxLevel: 3, effects: [4, 8, 15], icon: '✧' },
  { id: 'healBoost', name: '回復力', desc: '吸収中の回復量アップ', maxLevel: 3, effects: [3, 7, 14], icon: '💚' },
];

function getPlayerSkillLevel(skillId) {
  if (!player || !player.skills) return 0;
  return player.skills[skillId] || 0;
}

function getSkillEffect(skillId) {
  const def = SKILL_POOL.find(s => s.id === skillId);
  if (!def) return 0;
  const lvl = getPlayerSkillLevel(skillId);
  let total = 0;
  for (let i = 0; i < lvl; i++) total += def.effects[i] || 0;
  return total;
}

function getPlayerSwordLength() { return SWORD_LENGTH + getSkillEffect('swordLen'); }
function getPlayerChargeTime() { return Math.max(0.15, CHARGE_TIME - getSkillEffect('chargeSpd')); }
function getPlayerSpeed() { return BASE_SPEED * (1 + getSkillEffect('moveSpeed')); }
function getPlayerMaxHp() { return BASE_HP + getSkillEffect('maxHp'); }
function getPlayerMaxDashStocks() { return 1 + getSkillEffect('dashStock'); }
function getPlayerDashDist() { return DASH_DISTANCE + getSkillEffect('dashRange'); }
function getPlayerAbsorbSpeed() { return ESSENCE_ABSORB_SPEED + getSkillEffect('absorb'); }
function getPlayerHealRate() { return ESSENCE_HEAL_RATE + getSkillEffect('healBoost'); }

// --- Level System ---
function getPlayerLevel() {
  if (!player) return 0;
  const total = player.totalEssence;
  for (let i = LEVEL_ESSENCE.length - 1; i >= 0; i--) {
    if (total >= LEVEL_ESSENCE[i]) return i;
  }
  return 0;
}

function getNextLevelEssence() {
  const lvl = getPlayerLevel();
  if (lvl + 1 < LEVEL_ESSENCE.length) return LEVEL_ESSENCE[lvl + 1];
  return Infinity;
}

function checkLevelUp() {
  if (!player || levelUpPending) return;
  const lvl = getPlayerLevel();
  if (lvl > player.lastLevelUp) {
    player.lastLevelUp = lvl;
    generateLevelUpChoices();
    levelUpPending = true;
  }
}

function generateLevelUpChoices() {
  // Pick 3 random skills (can include ones already chosen = level up)
  const available = SKILL_POOL.filter(s => getPlayerSkillLevel(s.id) < s.maxLevel);
  if (available.length === 0) { levelUpPending = false; return; }
  levelUpChoices = [];
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(3, shuffled.length); i++) {
    const s = shuffled[i];
    const currentLvl = getPlayerSkillLevel(s.id);
    levelUpChoices.push({
      ...s,
      currentLevel: currentLvl,
      nextLevel: currentLvl + 1,
      effectValue: s.effects[currentLvl],
    });
  }
}

function selectSkill(index) {
  if (index < 0 || index >= levelUpChoices.length) return;
  const choice = levelUpChoices[index];
  if (!player.skills) player.skills = {};
  player.skills[choice.id] = (player.skills[choice.id] || 0) + 1;
  // Apply max HP increase
  if (choice.id === 'maxHp') {
    const newMax = getPlayerMaxHp();
    player.hp = Math.min(player.hp + choice.effectValue, newMax);
    player.maxHp = newMax;
  }
  playLevelUp();
  levelUpPending = false;
  levelUpChoices = [];
}

// --- Entity Creation ---
function createPlayer(x, y, totalEssence=0, skills=null) {
  const p = {
    x, y, radius: 14, color: '#4ec8b0',
    vx: 0, vy: 0, angle: 0,
    hp: BASE_HP, maxHp: BASE_HP,
    essence: 0,
    totalEssence: totalEssence,
    skills: skills || {},
    lastLevelUp: 0,
    // Combat - charge system
    charging: false, chargeTime: 0, chargeSide: 0, // 1=left(red), -1=right(blue)
    swinging: false, swingTime: 0, swingDir: 0, swingSide: 0,
    swingCooldown: 0,
    stagger: 0,
    // Iframes
    iframes: 0, hitFlash: 0,
    // Dash
    dashStocks: 1, maxDashStocks: 1,
    dashCooldown: 0, dashing: false, dashTime: 0, dashAngle: 0,
    // Absorbing
    absorbing: false, absorbAmount: 0,
    // State
    alive: true, isPlayer: true, kills: 0,
  };
  // Recalc from skills
  p.maxHp = getPlayerMaxHp.call ? BASE_HP : BASE_HP;
  p.hp = p.maxHp;
  p.maxDashStocks = 1;
  return p;
}

let entityIdCounter = 0;
function createEnemy(x, y, power=0) {
  // power = accumulated essence/strength
  const aggression = 0.4 + Math.min(power / 80, 0.55);
  const hue = Math.random() * 360;
  const r = 10 + Math.min(power * 0.15, 12);
  const hpBonus = Math.floor(power * 1.5);
  return {
    id: entityIdCounter++,
    x, y, radius: r,
    color: `hsl(${hue},55%,50%)`,
    vx: 0, vy: 0, angle: Math.random() * Math.PI * 2,
    hp: BASE_HP + hpBonus,
    maxHp: BASE_HP + hpBonus,
    power: power,
    totalEssence: power,
    // Combat - charge system
    charging: false, chargeTime: 0, chargeSide: 0,
    swinging: false, swingTime: 0, swingDir: 0, swingSide: 0,
    swingCooldown: 0,
    stagger: 0,
    iframes: 0, hitFlash: 0,
    // AI
    ai: true, aggression,
    target: null, aiTimer: Math.random() * 2,
    wanderAngle: Math.random() * Math.PI * 2,
    senseRange: ENEMY_SENSE_RANGE + power * 0.3,
    atkRange: SWORD_LENGTH + 15,
    chargeTimeBase: CHARGE_TIME + 0.1 * Math.random(),
    // Dash
    dashStocks: 0, maxDashStocks: 0,
    dashCooldown: 0, dashing: false, dashTime: 0, dashAngle: 0,
    // Absorbing
    absorbing: false, absorbAmount: 0,
    alive: true, isPlayer: false, kills: 0,
  };
}

// --- Essence Cloud System ---
function spawnEssenceCloud(x, y, amount, fromPower) {
  // Stronger entity = wider spread, more essence
  const radius = Math.min(300, DEATH_ESSENCE_SCATTER_RADIUS + fromPower * 0.8);
  essenceClouds.push({
    x, y, amount, maxAmount: amount,
    radius, baseRadius: radius,
    life: 45 + amount * 0.3, // longer life for bigger clouds
    age: 0,
    absorbers: 0, // track how many are absorbing
    pulsePhase: Math.random() * Math.PI * 2,
  });
}

// --- Particles ---
function spawnParticles(x, y, color, count, speed=150, life=0.5) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      color, life: life * (0.5 + Math.random()*0.5),
      maxLife: life, size: 2 + Math.random()*3,
    });
  }
}

function spawnBlood(x, y, angle, count=10) {
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random()-0.5)*1.4;
    const s = 60 + Math.random() * 140;
    particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      color: `hsl(${350+Math.random()*20},80%,${35+Math.random()*25}%)`,
      life: 0.4 + Math.random()*0.5, maxLife: 0.9, size: 2+Math.random()*5,
    });
  }
}

function spawnParryEffect(x, y) {
  // Big white/gold sparks
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 200;
    const hue = 40 + Math.random() * 30; // gold
    particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      color: i < 10 ? '#fff' : `hsl(${hue},90%,70%)`,
      life: 0.3 + Math.random()*0.4, maxLife: 0.7,
      size: 3 + Math.random()*5,
    });
  }
  // Shockwave ring (rendered specially)
  particles.push({
    x, y, vx: 0, vy: 0,
    color: 'ring', ringRadius: 5, ringMaxRadius: 80,
    life: 0.3, maxLife: 0.3, size: 0,
  });
}

function spawnHitEffect(x, y, angle) {
  spawnBlood(x, y, angle, 14);
  // Hit flash ring
  particles.push({
    x, y, vx: 0, vy: 0,
    color: 'ring', ringRadius: 5, ringMaxRadius: 40,
    life: 0.2, maxLife: 0.2, size: 0,
  });
}

function addScreenShake(intensity) {
  screenShake.intensity = Math.max(screenShake.intensity, intensity);
}

// --- Corpse ---
function spawnCorpse(entity) {
  corpses.push({
    x: entity.x, y: entity.y, radius: entity.radius * 0.7,
    color: entity.color,
    isPlayerCorpse: entity.isPlayer,
    life: 90,
    fragments: Array.from({length: 6}, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * 20 + 5,
      size: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
    })),
  });
  // Spawn essence cloud at death location
  // Total essence = all essence this entity ever accumulated
  const totalEss = entity.totalEssence || entity.power || 0;
  if (totalEss > 1) {
    spawnEssenceCloud(entity.x, entity.y, totalEss, totalEss);
  }
}

// --- Combat System (Charge → Swing → Parry/Hit) ---
function startCharge(entity, side) {
  // side: 1 = left swing (red), -1 = right swing (blue)
  if (entity.charging || entity.swinging || entity.swingCooldown > 0 || entity.stagger > 0) return;
  entity.charging = true;
  entity.chargeSide = side;
  entity.chargeTime = 0;
  if (entity.isPlayer) playCharge();
}

function releaseSwing(entity) {
  if (!entity.charging) return;
  entity.charging = false;
  entity.swinging = true;
  entity.swingTime = 0;
  entity.swingDir = entity.angle;
  entity.swingSide = entity.chargeSide;
  entity.swingCooldown = SWING_COOLDOWN;
  if (entity.isPlayer) playSlash();
}

function getChargeProgress(entity) {
  if (!entity.charging) return 0;
  const maxCharge = entity.isPlayer ? getPlayerChargeTime() : (entity.chargeTimeBase || CHARGE_TIME);
  return Math.min(1, entity.chargeTime / maxCharge);
}

function getSwordLen(entity) {
  return entity.isPlayer ? getPlayerSwordLength() : SWORD_LENGTH;
}

function getSwordArc(entity) {
  if (!entity.swinging) return null;
  const progress = entity.swingTime / SWING_TIME;
  const startAngle = entity.swingDir + entity.swingSide * SWORD_ARC / 2;
  const endAngle = entity.swingDir - entity.swingSide * SWORD_ARC / 2;
  const currentAngle = startAngle + (endAngle - startAngle) * Math.min(progress, 1);
  return { angle: currentAngle, progress, side: entity.swingSide };
}

function checkSwordHit(attacker, defender) {
  if (!attacker.swinging || defender.iframes > 0 || !defender.alive) return false;
  const arc = getSwordArc(attacker);
  if (!arc || arc.progress < 0.15 || arc.progress > 0.85) return false;
  const sLen = getSwordLen(attacker);
  for (let t = 0.3; t <= 1; t += 0.15) {
    const px = attacker.x + Math.cos(arc.angle) * sLen * t;
    const py = attacker.y + Math.sin(arc.angle) * sLen * t;
    const dx = px - defender.x;
    const dy = py - defender.y;
    if (Math.sqrt(dx*dx + dy*dy) < defender.radius + 12) return true;
  }
  return false;
}

function checkParry(a, b) {
  if (!a.swinging || !b.swinging) return false;
  const arcA = getSwordArc(a);
  const arcB = getSwordArc(b);
  if (!arcA || !arcB) return false;
  if (arcA.progress < 0.1 || arcA.progress > 0.9) return false;
  if (arcB.progress < 0.1 || arcB.progress > 0.9) return false;
  const d = distFn(a.x, a.y, b.x, b.y);
  if (d > getSwordLen(a) + getSwordLen(b)) return false;
  // Parry: both swing same side (left=red, right=blue)
  return a.swingSide === b.swingSide;
}

function doParry(a, b) {
  a.swinging = false; b.swinging = false;
  a.charging = false; b.charging = false;
  a.stagger = PARRY_STAGGER; b.stagger = PARRY_STAGGER;
  a.swingCooldown = 0; b.swingCooldown = 0;
  // Knockback
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const kb = 150;
  a.vx -= Math.cos(ang) * kb; a.vy -= Math.sin(ang) * kb;
  b.vx += Math.cos(ang) * kb; b.vy += Math.sin(ang) * kb;
  // Effects
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  spawnParryEffect(mx, my);
  // Only apply hit-stop, screen shake, and SFX when player is involved
  if (a.isPlayer || b.isPlayer) {
    playParry();
    addScreenShake(10);
    hitStopTimer = Math.max(hitStopTimer, HIT_STOP_PARRY);
  }
}

function dealDamage(attacker, defender, angle) {
  defender.hp -= DAMAGE;
  defender.iframes = IFRAMES;
  defender.hitFlash = 0.25;
  defender.stagger = STAGGER_TIME;
  defender.swinging = false;
  defender.charging = false;
  spawnHitEffect(defender.x, defender.y, angle);
  // Only apply hit-stop, screen shake, and SFX when player is involved
  if (attacker.isPlayer || defender.isPlayer) {
    addScreenShake(7);
    hitStopTimer = Math.max(hitStopTimer, HIT_STOP_HIT);
    playHit();
  }
  if (defender.hp <= 0) {
    killEntity(defender, attacker);
  }
}

function killEntity(entity, killer) {
  entity.alive = false;
  spawnParticles(entity.x, entity.y, entity.color, 30, 250, 1.0);
  spawnCorpse(entity);
  if (killer) {
    killer.kills++;
  }
  // Screen shake, death SFX only when player is involved
  if (entity.isPlayer || (killer && killer.isPlayer)) {
    playDeath();
    addScreenShake(12);
  }
  if (entity.isPlayer) {
    gamePhase = 'dead';
    if (typeof onPlayerDeath === 'function') onPlayerDeath(entity);
  }
}

// --- World Generation ---
function generateWorld() {
  entities = [];
  essenceClouds = [];
  particles = [];
  corpses = [];
  // Many enemies, varied power
  for (let i = 0; i < INITIAL_ENEMIES; i++) {
    let x, y;
    if (i < 10) {
      const a = Math.random() * Math.PI * 2;
      const d = 200 + Math.random() * 350;
      x = WORLD_SIZE/2 + Math.cos(a) * d;
      y = WORLD_SIZE/2 + Math.sin(a) * d;
    } else {
      x = Math.random() * (WORLD_SIZE - 200) + 100;
      y = Math.random() * (WORLD_SIZE - 200) + 100;
    }
    const power = Math.random() * 20;
    entities.push(createEnemy(x, y, power));
  }
  // Scatter some initial essence clouds
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * WORLD_SIZE;
    const y = Math.random() * WORLD_SIZE;
    spawnEssenceCloud(x, y, 8 + Math.random() * 25, 10);
  }
}

// --- AI ---
function updateAI(entity, dt) {
  if (!entity.ai || !entity.alive) return;
  if (entity.stagger > 0) return; // can't act while staggered

  entity.aiTimer -= dt;

  // Find nearest entity or essence cloud
  let nearestEntity = null, nearestEntDist = entity.senseRange;
  const allTargets = [player, ...entities].filter(e => e && e.alive && e !== entity);
  for (const t of allTargets) {
    const d = distFn(entity.x, entity.y, t.x, t.y);
    if (d < nearestEntDist) { nearestEntity = t; nearestEntDist = d; }
  }

  let nearestCloud = null, nearestCloudDist = entity.senseRange * 0.7;
  for (const c of essenceClouds) {
    if (c.amount < 2) continue;
    const d = distFn(entity.x, entity.y, c.x, c.y);
    if (d < nearestCloudDist) { nearestCloud = c; nearestCloudDist = d; }
  }

  // Attack decision
  if (entity.aiTimer <= 0) {
    entity.aiTimer = 0.2 + Math.random() * 0.4;

    if (nearestEntity && nearestEntDist < entity.atkRange) {
      if (!entity.charging && !entity.swinging && Math.random() < entity.aggression) {
        entity.angle = Math.atan2(nearestEntity.y - entity.y, nearestEntity.x - entity.x);
        // If opponent is charging, try to match their side for parry
        let side;
        if (nearestEntity.charging && Math.random() < 0.6) {
          side = nearestEntity.chargeSide; // try to parry
        } else {
          side = Math.random() > 0.5 ? 1 : -1;
        }
        startCharge(entity, side);
      }
    }
  }

  // Auto-release charge when ready
  if (entity.charging) {
    const maxCharge = entity.chargeTimeBase || CHARGE_TIME;
    if (entity.chargeTime >= maxCharge) {
      releaseSwing(entity);
    }
  }

  // Movement
  let targetX = entity.x, targetY = entity.y;
  let moveToTarget = false;

  if (nearestEntity && nearestEntDist < entity.senseRange) {
    if (nearestEntDist > entity.atkRange * 0.7 || Math.random() < entity.aggression * 0.3) {
      targetX = nearestEntity.x;
      targetY = nearestEntity.y;
      moveToTarget = true;
      entity.angle = Math.atan2(nearestEntity.y - entity.y, nearestEntity.x - entity.x);
    } else if (nearestEntDist < entity.atkRange * 0.4) {
      // Too close, back up slightly
      const away = Math.atan2(entity.y - nearestEntity.y, entity.x - nearestEntity.x);
      targetX = entity.x + Math.cos(away) * 50;
      targetY = entity.y + Math.sin(away) * 50;
      moveToTarget = true;
    }
  } else if (nearestCloud && nearestCloudDist < entity.senseRange * 0.5) {
    targetX = nearestCloud.x;
    targetY = nearestCloud.y;
    moveToTarget = true;
  } else {
    entity.wanderAngle += (Math.random() - 0.5) * 1;
    targetX = entity.x + Math.cos(entity.wanderAngle) * 100;
    targetY = entity.y + Math.sin(entity.wanderAngle) * 100;
    moveToTarget = true;
  }

  if (moveToTarget && !entity.charging) {
    const a = Math.atan2(targetY - entity.y, targetX - entity.x);
    const speed = BASE_SPEED * 0.65;
    entity.vx += Math.cos(a) * speed * dt * 3;
    entity.vy += Math.sin(a) * speed * dt * 3;
  }
}

// --- Spawner ---
let spawnTimer = 0;
function updateSpawner(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = 1.5 + Math.random() * 3;
    const aliveCount = entities.filter(e => e.alive).length;
    if (aliveCount < MAX_ENEMIES) {
      const toSpawn = Math.min(5, MAX_ENEMIES - aliveCount);
      for (let s = 0; s < toSpawn; s++) {
        let x, y;
        do {
          x = Math.random() * WORLD_SIZE;
          y = Math.random() * WORLD_SIZE;
        } while (player && distFn(x, y, player.x, player.y) < 500);
        const power = Math.random() * (5 + totalGameTime * 0.05);
        entities.push(createEnemy(x, y, power));
      }
    }
  }
}

// --- Auto-aim (for mobile) ---
let autoAimTarget = null;
function findAutoAimTarget() {
  if (!player || !player.alive) { autoAimTarget = null; return; }
  let nearest = null, nearestDist = AUTO_AIM_RANGE;
  for (const e of entities) {
    if (!e.alive) continue;
    const d = distFn(player.x, player.y, e.x, e.y);
    if (d < nearestDist) { nearest = e; nearestDist = d; }
  }
  autoAimTarget = nearest;
  if (nearest && inputAngleAuto) {
    inputAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
  }
}

// --- Main Update ---
function update(dt) {
  if (gamePhase !== 'playing') return;
  if (levelUpPending) return; // pause during level up
  
  // Hit stop
  if (hitStopTimer > 0) {
    hitStopTimer -= dt;
    return; // freeze everything during hit stop
  }
  
  totalGameTime += dt;

  screenShake.intensity *= Math.max(0, 1 - dt * 8);
  screenShake.x = (Math.random()-0.5) * screenShake.intensity * 2;
  screenShake.y = (Math.random()-0.5) * screenShake.intensity * 2;

  // Auto-aim
  findAutoAimTarget();

  // Player input
  if (player && player.alive) {
    // Movement
    let mx = inputMoveX, my = inputMoveY;
    const dz = 0.12;
    if (Math.abs(mx) < dz) mx = 0;
    if (Math.abs(my) < dz) my = 0;
    const mag = Math.sqrt(mx*mx + my*my);
    if (mag > 1) { mx /= mag; my /= mag; }

    if (player.stagger <= 0 && !player.charging) {
      const speed = getPlayerSpeed();
      player.vx += mx * speed * dt * 5;
      player.vy += my * speed * dt * 5;
    }

    player.angle = inputAngle;

    // Attacks
    if (player.stagger <= 0) {
      if (inputLeftAttack) {
        if (!player.charging) {
          startCharge(player, 1); // red
        }
        inputLeftAttack = false;
      }
      if (inputRightAttack) {
        if (!player.charging) {
          startCharge(player, -1); // blue
        }
        inputRightAttack = false;
      }
    }

    // Auto-release when charged
    if (player.charging) {
      const maxCharge = getPlayerChargeTime();
      if (player.chargeTime >= maxCharge) {
        releaseSwing(player);
      }
    }

    // Dash
    if (inputDash) {
      if (player.dashStocks > 0 && !player.dashing && player.stagger <= 0) {
        player.dashing = true;
        player.dashTime = DASH_TIME;
        player.dashAngle = (mx || my) ? Math.atan2(my, mx) : player.angle;
        player.dashStocks--;
        player.iframes = DASH_TIME + 0.05;
        player.charging = false;
        playSFX(400, 0.1, 'sine', 0.12);
        spawnParticles(player.x, player.y, '#4ec8b044', 6, 50, 0.3);
      }
      inputDash = false;
    }

    // Dash cooldown & stock regen
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.maxDashStocks = getPlayerMaxDashStocks();
    if (player.dashStocks < player.maxDashStocks && player.dashCooldown <= 0) {
      player.dashStocks++;
      player.dashCooldown = DASH_COOLDOWN;
    }

    // Dashing
    if (player.dashing) {
      player.dashTime -= dt;
      const dd = getPlayerDashDist();
      const dashSpeed = dd / DASH_TIME;
      player.vx = Math.cos(player.dashAngle) * dashSpeed;
      player.vy = Math.sin(player.dashAngle) * dashSpeed;
      if (player.dashTime <= 0) player.dashing = false;
    }

    player.maxHp = getPlayerMaxHp();
  }

  // Update all combat entities
  const allCombatants = [player, ...entities].filter(e => e && e.alive);

  for (const e of allCombatants) {
    // Physics
    e.vx *= 0.82;
    e.vy *= 0.82;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = Math.max(e.radius, Math.min(WORLD_SIZE - e.radius, e.x));
    e.y = Math.max(e.radius, Math.min(WORLD_SIZE - e.radius, e.y));
    // Timers
    e.iframes = Math.max(0, e.iframes - dt);
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.swingCooldown = Math.max(0, e.swingCooldown - dt);
    e.stagger = Math.max(0, e.stagger - dt);
    // Charge update
    if (e.charging) {
      e.chargeTime += dt;
    }
    // Swing update
    if (e.swinging) {
      e.swingTime += dt;
      if (e.swingTime >= SWING_TIME) {
        e.swinging = false;
      }
    }
    // AI
    if (e.ai) updateAI(e, dt);
    // Enemy dash CD
    if (e.ai) {
      e.dashCooldown = Math.max(0, e.dashCooldown - dt);
    }
  }

  // Combat resolution
  for (let i = 0; i < allCombatants.length; i++) {
    for (let j = i+1; j < allCombatants.length; j++) {
      const a = allCombatants[i], b = allCombatants[j];
      if (!a.alive || !b.alive) continue;
      const d = distFn(a.x, a.y, b.x, b.y);
      if (d > getSwordLen(a) + getSwordLen(b) + 20) continue;

      // Check parry first (same side = parry)
      if (a.swinging && b.swinging && checkParry(a, b)) {
        doParry(a, b);
        continue;
      }

      // Hits
      const aHitsB = checkSwordHit(a, b);
      const bHitsA = checkSwordHit(b, a);
      if (aHitsB && bHitsA) {
        const angAB = Math.atan2(b.y-a.y, b.x-a.x);
        dealDamage(a, b, angAB);
        dealDamage(b, a, angAB + Math.PI);
      } else if (aHitsB) {
        dealDamage(a, b, Math.atan2(b.y-a.y, b.x-a.x));
      } else if (bHitsA) {
        dealDamage(b, a, Math.atan2(a.y-b.y, a.x-b.x));
      }

      // Push apart
      if (d < a.radius + b.radius && d > 0) {
        const overlap = (a.radius + b.radius - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
      }
    }
  }

  // Essence cloud absorption
  for (let i = essenceClouds.length - 1; i >= 0; i--) {
    const c = essenceClouds[i];
    c.age += dt;
    c.life -= dt;
    if (c.life <= 0 || c.amount <= 0.1) { essenceClouds.splice(i, 1); continue; }

    c.absorbers = 0;
    // Any entity in range absorbs over time
    for (const e of allCombatants) {
      if (!e.alive) continue;
      const d = distFn(e.x, e.y, c.x, c.y);
      if (d < c.radius) {
        c.absorbers++;
        const absorbSpd = e.isPlayer ? getPlayerAbsorbSpeed() : ESSENCE_ABSORB_SPEED * 0.7;
        const absorbed = Math.min(c.amount, absorbSpd * dt);
        c.amount -= absorbed;
        e.totalEssence = (e.totalEssence || 0) + absorbed;
        e.absorbing = true;
        e.absorbAmount = absorbed;
        
        // HP regen while absorbing
        if (e.isPlayer) {
          const heal = getPlayerHealRate() * dt;
          e.hp = Math.min(e.maxHp, e.hp + heal);
        } else {
          e.hp = Math.min(e.maxHp, e.hp + 3 * dt);
          // Enemy power scaling
          e.power = (e.power || 0) + absorbed;
          e.maxHp = BASE_HP + Math.floor(e.power * 1.5);
          e.senseRange = ENEMY_SENSE_RANGE + e.power * 0.3;
          e.radius = Math.min(26, 10 + e.power * 0.15);
          e.aggression = Math.min(0.95, 0.4 + e.power / 80);
        }
        
        if (e.isPlayer && absorbed > 0.01) playEssence();
      }
    }
    // Shrink cloud as it's consumed
    c.radius = c.baseRadius * (c.amount / c.maxAmount) * 0.6 + c.baseRadius * 0.4;
  }

  // Reset absorbing flag each frame
  for (const e of allCombatants) {
    if (e.absorbing) { e.absorbing = false; }
  }

  // Corpse decay
  for (let i = corpses.length - 1; i >= 0; i--) {
    corpses[i].life -= dt;
    if (corpses[i].life <= 0) corpses.splice(i, 1);
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.color === 'ring') {
      p.ringRadius += (p.ringMaxRadius - 5) * dt / p.maxLife;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
    }
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Remove dead
  entities = entities.filter(e => e.alive);

  // Spawner
  updateSpawner(dt);

  // Level up check
  if (player && player.alive) {
    checkLevelUp();
  }

  // Camera
  if (player) {
    camera.x = player.x - (typeof canvas !== 'undefined' ? canvas.width : 375) / 2;
    camera.y = player.y - (typeof canvas !== 'undefined' ? canvas.height : 812) / 2;
  }
}

// --- Render ---
function render() {
  if (typeof canvas === 'undefined' || typeof ctx === 'undefined') return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x + screenShake.x, -camera.y + screenShake.y);

  drawBackground();
  drawEssenceClouds();
  drawCorpses();

  const allVisible = [...entities.filter(e => e.alive), player].filter(e => e && e.alive);
  for (const e of allVisible) drawEntity(e);

  // Aim indicator (mobile)
  if (player && player.alive && autoAimTarget && inputAngleAuto) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#4ec8b0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(inputAngle)*25, player.y + Math.sin(inputAngle)*25);
    ctx.lineTo(player.x + Math.cos(inputAngle)*AUTO_AIM_RANGE, player.y + Math.sin(inputAngle)*AUTO_AIM_RANGE);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawParticles();
  ctx.restore();
  drawMinimap();
}

function drawBackground() {
  const startX = Math.floor(camera.x / TILE_SIZE) * TILE_SIZE;
  const startY = Math.floor(camera.y / TILE_SIZE) * TILE_SIZE;
  const endX = startX + canvas.width + TILE_SIZE * 2;
  const endY = startY + canvas.height + TILE_SIZE * 2;

  ctx.fillStyle = '#0c0c14';
  ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = startX; x < endX; x += TILE_SIZE) {
    if (x < 0 || x > WORLD_SIZE) continue;
    ctx.beginPath(); ctx.moveTo(x, Math.max(0, startY)); ctx.lineTo(x, Math.min(WORLD_SIZE, endY)); ctx.stroke();
  }
  for (let y = startY; y < endY; y += TILE_SIZE) {
    if (y < 0 || y > WORLD_SIZE) continue;
    ctx.beginPath(); ctx.moveTo(Math.max(0, startX), y); ctx.lineTo(Math.min(WORLD_SIZE, endX), y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,68,102,0.3)'; ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
}

function drawEssenceClouds() {
  for (const c of essenceClouds) {
    if (c.amount < 0.1) continue;
    const alpha = Math.min(0.5, c.amount / c.maxAmount * 0.5) * (c.age < 0.5 ? c.age / 0.5 : 1);
    const pulse = 0.85 + Math.sin(totalGameTime * 2 + c.pulsePhase) * 0.15;
    
    // Outer glow
    ctx.save();
    ctx.globalAlpha = alpha * 0.3;
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius * pulse);
    grad.addColorStop(0, 'rgba(78,200,176,0.4)');
    grad.addColorStop(0.6, 'rgba(78,200,176,0.15)');
    grad.addColorStop(1, 'rgba(78,200,176,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Core particles
    ctx.globalAlpha = alpha * 0.6;
    const particleCount = Math.min(12, Math.ceil(c.amount / 5));
    for (let i = 0; i < particleCount; i++) {
      const a = (i / particleCount) * Math.PI * 2 + totalGameTime * 0.5;
      const r = c.radius * 0.3 + Math.sin(totalGameTime * 3 + i) * c.radius * 0.2;
      const px = c.x + Math.cos(a) * r;
      const py = c.y + Math.sin(a) * r;
      ctx.beginPath();
      ctx.arc(px, py, 2 + Math.sin(totalGameTime * 5 + i * 2) * 1, 0, Math.PI * 2);
      ctx.fillStyle = '#4ec8b0';
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCorpses() {
  for (const c of corpses) {
    const alpha = Math.min(1, c.life / 8);
    ctx.globalAlpha = alpha;
    for (const f of c.fragments) {
      ctx.save();
      ctx.translate(c.x + Math.cos(f.angle)*f.dist, c.y + Math.sin(f.angle)*f.dist);
      ctx.rotate(f.rot);
      ctx.fillStyle = c.isPlayerCorpse ? '#2a6b5c' : c.color;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillRect(-f.size/2, -f.size/2, f.size, f.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function drawEntity(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.hitFlash > 0) ctx.globalAlpha = 0.3 + 0.7 * (1 - e.hitFlash / 0.25);
  if (e.iframes > 0 && Math.sin(e.iframes * 40) > 0) ctx.globalAlpha *= 0.35;

  // Charge indicator - colored circle shrinking
  if (e.charging) {
    const progress = getChargeProgress(e);
    const chargeRadius = getSwordLen(e) * (1 - progress * 0.7) + 20;
    const chargeColor = e.chargeSide === 1 ? 'rgba(255,80,80,' : 'rgba(80,120,255,';
    
    ctx.save();
    ctx.globalAlpha = 0.15 + progress * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, chargeRadius, 0, Math.PI * 2);
    ctx.fillStyle = chargeColor + (0.2 + progress * 0.3) + ')';
    ctx.fill();
    ctx.strokeStyle = chargeColor + (0.4 + progress * 0.4) + ')';
    ctx.lineWidth = 2 + progress * 2;
    ctx.stroke();
    
    // Inner shrinking ring
    const innerR = 15 + (chargeRadius - 15) * (1 - progress);
    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = chargeColor + '0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  // Body
  ctx.beginPath();
  ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
  ctx.fillStyle = e.hitFlash > 0 ? '#fff' : e.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();

  // Direction indicator
  ctx.save();
  ctx.rotate(e.angle);
  ctx.beginPath();
  ctx.moveTo(e.radius + 4, 0);
  ctx.lineTo(e.radius - 3, -4);
  ctx.lineTo(e.radius - 3, 4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
  ctx.restore();

  // Stagger visual
  if (e.stagger > 0) {
    ctx.save();
    ctx.globalAlpha = e.stagger * 2;
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Sword swing
  if (e.swinging) {
    const arc = getSwordArc(e);
    const sLen = getSwordLen(e);
    if (arc) {
      // Draw the swept arc trail (from swing start position to current sword position)
      const swingStart = e.swingDir + e.swingSide * SWORD_ARC / 2;
      const swingCurrent = arc.angle;
      // swingSide=1 (left/red): sword sweeps from high angle to low (counterclockwise in canvas)
      // swingSide=-1 (right/blue): sword sweeps from low angle to high (clockwise in canvas)
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      if (e.swingSide === 1) {
        // Left swing: start is above, current is below → draw CCW from start to current
        ctx.arc(0, 0, sLen, swingStart, swingCurrent, true);
      } else {
        // Right swing: start is below, current is above → draw CW from start to current
        ctx.arc(0, 0, sLen, swingStart, swingCurrent, false);
      }
      ctx.closePath();
      ctx.fillStyle = e.swingSide === 1 ? '#ff5050' : '#5078ff';
      ctx.fill();
      ctx.restore();

      // Draw the sword blade at current angle
      ctx.save();
      ctx.rotate(arc.angle);
      const swordAlpha = 1 - Math.abs(arc.progress - 0.5) * 1.5;
      ctx.globalAlpha = Math.max(0.5, swordAlpha);
      ctx.beginPath();
      ctx.moveTo(e.radius - 2, 0);
      ctx.lineTo(sLen, 0);
      ctx.strokeStyle = e.swingSide === 1 ? '#ff8888' : '#8899ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sLen, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
    }
  }

  // HP bar
  if (e.hp < e.maxHp) {
    ctx.globalAlpha = 1;
    const barW = e.radius * 2.8;
    const barH = 3;
    const barY = -e.radius - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-barW/2, barY, barW, barH);
    ctx.fillStyle = e.isPlayer ? '#ff4466' : '#ff6644';
    ctx.fillRect(-barW/2, barY, barW * Math.max(0, e.hp / e.maxHp), barH);
  }

  // Power/essence indicator for enemies
  if (!e.isPlayer && e.power > 10) {
    ctx.globalAlpha = 0.5;
    ctx.font = '600 9px Inter,sans-serif';
    ctx.fillStyle = '#4ec8b0';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(e.power), 0, e.radius + 14);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    if (p.color === 'ring') {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 + (1 - alpha) * 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const s = p.size * alpha;
      ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
    }
  }
  ctx.globalAlpha = 1;
}

function drawMinimap() {
  if (typeof miniCanvas === 'undefined' || typeof miniCtx === 'undefined') return;
  const mw = miniCanvas.width, mh = miniCanvas.height;
  miniCtx.clearRect(0, 0, mw, mh);
  miniCtx.fillStyle = 'rgba(10,10,15,0.85)';
  miniCtx.fillRect(0, 0, mw, mh);
  if (!player) return;
  const scale = mw / (MINIMAP_RANGE * 2);
  const ox = player.x - MINIMAP_RANGE;
  const oy = player.y - MINIMAP_RANGE;
  miniCtx.strokeStyle = 'rgba(255,68,102,0.3)'; miniCtx.lineWidth = 1;
  miniCtx.strokeRect(-ox*scale, -oy*scale, WORLD_SIZE*scale, WORLD_SIZE*scale);
  for (const e of entities) {
    if (!e.alive) continue;
    const mx = (e.x-ox)*scale, my = (e.y-oy)*scale;
    if (mx<-5||mx>mw+5||my<-5||my>mh+5) continue;
    miniCtx.fillStyle = e.color; miniCtx.globalAlpha = 0.7;
    const sz = Math.min(4, 2 + (e.power || 0) * 0.02);
    miniCtx.fillRect(mx-sz/2, my-sz/2, sz, sz);
  }
  // Essence clouds on minimap
  for (const c of essenceClouds) {
    if (c.amount < 2) continue;
    const mx = (c.x-ox)*scale, my = (c.y-oy)*scale;
    if (mx<-5||mx>mw+5||my<-5||my>mh+5) continue;
    miniCtx.fillStyle = '#4ec8b0'; miniCtx.globalAlpha = 0.3;
    const r = Math.max(2, c.radius * scale);
    miniCtx.beginPath(); miniCtx.arc(mx, my, r, 0, Math.PI*2); miniCtx.fill();
  }
  miniCtx.globalAlpha = 1;
  miniCtx.fillStyle = '#4ec8b0';
  miniCtx.beginPath(); miniCtx.arc(mw/2, mh/2, 3, 0, Math.PI*2); miniCtx.fill();
}

// --- HUD ---
function updateHUD() {
  if (!player || typeof document === 'undefined') return;
  const hpBar = document.getElementById('hp-bar');
  const hpText = document.getElementById('hp-text');
  const essBar = document.getElementById('essence-bar');
  const essText = document.getElementById('essence-text');
  const lvlText = document.getElementById('level-text');
  const stats = document.getElementById('hud-stats');

  if (hpBar) hpBar.style.width = `${Math.max(0, player.hp / player.maxHp) * 100}%`;
  if (hpText) hpText.textContent = `${(player.hp/100).toFixed(1)}/${(player.maxHp/100).toFixed(1)}`;
  
  const currentLvl = getPlayerLevel();
  const nextEss = getNextLevelEssence();
  if (essBar) {
    const prevEss = LEVEL_ESSENCE[currentLvl] || 0;
    const progress = nextEss === Infinity ? 1 : (player.totalEssence - prevEss) / (nextEss - prevEss);
    essBar.style.width = `${Math.min(100, progress * 100)}%`;
  }
  if (essText) essText.textContent = Math.floor(player.totalEssence);
  if (lvlText) lvlText.textContent = `Lv.${currentLvl}`;
  
  if (stats) stats.innerHTML = `Kills: ${player.kills}<br>Time: ${formatTime(totalGameTime)}`;
}

function formatTime(s) {
  const m = Math.floor(s/60);
  const sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

// --- Game Flow ---
function startNewGame() {
  initAudio();
  gamePhase = 'playing';
  totalGameTime = 0;
  hitStopTimer = 0;
  levelUpPending = false;
  levelUpChoices = [];
  player = createPlayer(WORLD_SIZE/2, WORLD_SIZE/2);
  player.maxHp = getPlayerMaxHp();
  player.hp = player.maxHp;
  player.dashCooldown = 0;
  player.dashStocks = 1;
  generateWorld();
}

function doRespawn() {
  initAudio();
  gamePhase = 'playing';
  hitStopTimer = 0;
  levelUpPending = false;
  // Lose most skills on death
  const keptSkills = {};
  if (player && player.skills) {
    for (const [k, v] of Object.entries(player.skills)) {
      if (v > 0 && Math.random() < 0.3) keptSkills[k] = Math.max(0, v - 1);
    }
  }
  const x = Math.random() * (WORLD_SIZE - 400) + 200;
  const y = Math.random() * (WORLD_SIZE - 400) + 200;
  player = createPlayer(x, y, 0, keptSkills);
  player.maxHp = getPlayerMaxHp();
  player.hp = player.maxHp;
  player.dashCooldown = 0;
  player.dashStocks = getPlayerMaxDashStocks();
  // Recalculate lastLevelUp
  player.lastLevelUp = getPlayerLevel();
}

// --- Utility ---
function distFn(x1, y1, x2, y2) {
  const dx = x2-x1, dy = y2-y1;
  return Math.sqrt(dx*dx + dy*dy);
}

// --- Game Loop ---
let lastTime = 0;
let accumulator = 0;
const TICK = 1/60;
let frames = 0, fpsTime = 0, fps = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  frames++; fpsTime += dt;
  if (fpsTime >= 1) { fps = frames; frames = 0; fpsTime = 0; }
  accumulator += dt;
  while (accumulator >= TICK) { update(TICK); accumulator -= TICK; }
  render();
  updateHUD();
}

// Testing hooks
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000/60)));
  for (let i = 0; i < steps; i++) update(TICK);
  render(); updateHUD();
};
window.render_game_to_text = () => JSON.stringify({
  phase: gamePhase,
  player: player ? { x: Math.round(player.x), y: Math.round(player.y), hp: player.hp, maxHp: player.maxHp, totalEssence: Math.round(player.totalEssence), alive: player.alive, kills: player.kills, level: getPlayerLevel() } : null,
  enemies: entities.filter(e=>e.alive).length,
  clouds: essenceClouds.length,
  corpses: corpses.length,
  time: Math.round(totalGameTime),
});
