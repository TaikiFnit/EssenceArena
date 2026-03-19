// ============================================================
// ESSENCE ARENA — Core Game Engine (shared between PC & Mobile)
// ============================================================

// --- Constants ---
const WORLD_SIZE = 4000;
const TILE_SIZE = 64;
const BASE_SPEED = 150; // faster for spacing gameplay
const SWORD_LENGTH = 90; // longer sword for spacing
const SWORD_ARC = Math.PI * 0.65;
const CHARGE_TIME = 1.0; // base enemy charge time
const SWING_TIME = 0.18; // actual swing is fast once charged
const SWING_COOLDOWN = 0.15; // short cooldown after swing
const HIT_STOP_PARRY = 0.28; // freeze frames on parry
const HIT_STOP_HIT = 0.18; // freeze frames on hit
const STAGGER_TIME = 0.5; // stagger after being hit (can't attack)
const PARRY_STAGGER = 0.7; // stagger after being parried (longer — follow-up window)
const FOLLOW_UP_WINDOW = 0.6; // window for player follow-up after just-parry
const FOLLOW_UP_CHARGE_TIME = 0.12; // near-instant charge for follow-up attack
const PARRY_WINDOW_START = 0.55; // parry window opens at 55% charge progress
const PARRY_WINDOW_END = 0.95; // parry window closes at 95% charge progress
const JUST_PARRY_WINDOW = 0.15; // tight "just" timing window (within last 15% of parry window)
const ENEMY_WHIFF_CHANCE = 0.35; // enemies swing out of range this often
const ENEMY_PRESWING_DIST = 1.4; // enemies start charging from 1.4x attack range (swing before in range)
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
const WHIFF_FOLLOWTHROUGH_TIME = 0.5; // heavy whiff penalty — spam is punished hard
const WHIFF_OVERSHOOT_ARC = Math.PI * 0.5; // extra arc overshoot past normal end (-60° from 30° basically)
const ELITE_THRESHOLD = 50; // power needed for elite status
const BOSS_THRESHOLD = 120; // power needed for boss status
const PLAYER_TITLE_THRESHOLD = 80; // essence needed for player to earn a title
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
function playJustParry() {
  // Crisp, satisfying "kin!" sound — high metallic ring
  playSFX(1200, 0.3, 'triangle', 0.3);
  playSFX(1800, 0.15, 'sine', 0.2);
  playSFX(700, 0.25, 'square', 0.12);
}
function playFollowUp() {
  // Quick, aggressive slash confirmation
  playSFX(250, 0.12, 'sawtooth', 0.2);
  playSFX(500, 0.08, 'square', 0.15);
}
function playParryMiss() {
  // Dull thud — mistimed parry
  playSFX(120, 0.15, 'sine', 0.1);
}

// --- Unique Name Generator ---
const TITLE_PREFIXES = ['蒼', '紅', '闇', '雷', '鬼', '幻', '鉄', '黒', '白', '炎', '嵐', '氷', '血', '影', '獄', '天', '星', '月', '夜', '風'];
const TITLE_SUFFIXES = ['牙', '刃', '王', '姫', '神', '鬼', '龍', '狼', '鴉', '蛇', '虎', '獅子', '翼', '拳', '爪', '眼', '心', '魂', '帝', '覇'];
const TITLE_NAMES = ['修羅', '羅刹', '阿修羅', '夜叉', '餓鬼', '天魔', '武神', '剣鬼', '暴君', '覇王',
  '斬鉄', '疾風', '雷光', '深淵', '黄泉', '焔', '業火', '氷獄', '嵐帝', '閃光',
  '虚無', '混沌', '無双', '一刀', '千斬', '万骨', '百鬼', '九尾', '三途', '不滅'];

function generateUniqueName(power) {
  if (power >= BOSS_THRESHOLD) {
    // Boss: epic compound name
    const pre = TITLE_PREFIXES[Math.floor(Math.random() * TITLE_PREFIXES.length)];
    const name = TITLE_NAMES[Math.floor(Math.random() * TITLE_NAMES.length)];
    return pre + 'の' + name;
  } else {
    // Elite: simpler title
    const pre = TITLE_PREFIXES[Math.floor(Math.random() * TITLE_PREFIXES.length)];
    const suf = TITLE_SUFFIXES[Math.floor(Math.random() * TITLE_SUFFIXES.length)];
    return pre + suf;
  }
}

function generatePlayerTitle(totalEssence) {
  const tier = Math.floor(totalEssence / PLAYER_TITLE_THRESHOLD);
  const titles = ['虚ろの旅人', '求道者', '収集者', '狩人', '斬撃者', '修羅の徒', '覇道の者', '剣聖', '万骨の主', '不滅の王'];
  return titles[Math.min(tier, titles.length - 1)];
}

// --- Game State ---
let gamePhase = 'title';
let player = null;
let entities = [];
let essenceClouds = []; // area-based essence (replaces instant orbs)
let particles = [];
let absorbParticles = []; // floating essence orbs that get sucked into absorbing entities
let corpses = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let camera = { x: 0, y: 0 };
let skillMenuOpen = false;
let totalGameTime = 0;
let hitStopTimer = 0; // global hit stop
let levelUpPending = false;
let levelUpChoices = [];
let playerTitle = ''; // current player title
let deathTitle = ''; // title at time of death (for mourning)

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
    // Rhythm-game parry state
    justParried: false, justParryTimer: 0, followUpTarget: null,
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
  // Strong enemies charge faster and are more aggressive
  const isElite = power >= ELITE_THRESHOLD;
  const isBoss = power >= BOSS_THRESHOLD;
  // Boss: much faster charge (0.6-0.7s), Elite: moderate (0.75-0.85s), Normal: 1.0-1.1s
  const chargeBase = isBoss ? 0.6 + Math.random() * 0.1
    : isElite ? 0.75 + Math.random() * 0.1
    : CHARGE_TIME + 0.1 * Math.random();
  return {
    id: entityIdCounter++,
    x, y, radius: r,
    color: `hsl(${hue},55%,50%)`,
    vx: 0, vy: 0, angle: Math.random() * Math.PI * 2,
    hp: BASE_HP + hpBonus,
    maxHp: BASE_HP + hpBonus,
    power: power,
    totalEssence: power,
    // Unique naming
    uniqueName: isBoss || isElite ? generateUniqueName(power) : '',
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
    chargeTimeBase: chargeBase,
    // Follow-up tracking
    justParried: false, justParryTimer: 0, followUpTarget: null,
    // Dash
    dashStocks: 0, maxDashStocks: 0,
    dashCooldown: 0, dashing: false, dashTime: 0, dashAngle: 0,
    // Absorbing
    absorbing: false, absorbAmount: 0,
    // Whiff follow-through
    whiffing: false, whiffTime: 0, whiffDir: 0, whiffSide: 0, whiffEndAngle: 0,
    swingHitSomething: false, // track if this swing connected
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
  if (entity.charging || entity.swinging || entity.whiffing || entity.swingCooldown > 0 || entity.stagger > 0) return;
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
  entity.swingHitSomething = false; // track if this swing connects
  entity.whiffing = false;
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
  if (entity.whiffing) {
    // During whiff follow-through, sword continues past normal endpoint
    const progress = entity.whiffTime / WHIFF_FOLLOWTHROUGH_TIME;
    const normalEnd = entity.whiffEndAngle;
    const overshootEnd = normalEnd - entity.whiffSide * WHIFF_OVERSHOOT_ARC;
    // Ease-out: sword decelerates during overshoot
    const eased = 1 - (1 - Math.min(progress, 1)) * (1 - Math.min(progress, 1));
    const currentAngle = normalEnd + (overshootEnd - normalEnd) * eased;
    return { angle: currentAngle, progress: 1, side: entity.whiffSide, whiffing: true, whiffProgress: progress };
  }
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
  a.whiffing = false; b.whiffing = false; // parry cancels whiff
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
  attacker.swingHitSomething = true; // this swing connected, no whiff penalty
  defender.hp -= DAMAGE;
  defender.iframes = IFRAMES;
  defender.hitFlash = 0.25;
  defender.stagger = STAGGER_TIME;
  defender.swinging = false;
  defender.charging = false;
  defender.whiffing = false; // getting hit cancels whiff state
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
    deathTitle = playerTitle; // save for mourning screen
    playerTitle = ''; // lost on death
    if (typeof onPlayerDeath === 'function') onPlayerDeath(entity, deathTitle);
  }
}

// --- Rhythm-Game Parry System ---
// Player clicks/taps to parry an incoming enemy attack
// Success = enemy gets staggered, player gets follow-up window
function attemptParry(playerEntity, side) {
  if (!playerEntity || !playerEntity.alive) return false;
  
  // Find nearest enemy that is currently charging within parry range
  let bestTarget = null;
  let bestDist = SWORD_LENGTH * 2.5; // generous range for parry detection
  let bestChargeProgress = 0;
  
  for (const e of entities) {
    if (!e.alive || !e.charging) continue;
    const d = distFn(playerEntity.x, playerEntity.y, e.x, e.y);
    if (d > bestDist) continue;
    const maxCharge = e.chargeTimeBase || CHARGE_TIME;
    const progress = Math.min(1, e.chargeTime / maxCharge);
    // Must be in the parry window (charge progress between START and END)
    if (progress >= PARRY_WINDOW_START && progress <= PARRY_WINDOW_END) {
      // Prefer the closest enemy in the parry window
      if (!bestTarget || d < bestDist) {
        bestTarget = e;
        bestDist = d;
        bestChargeProgress = progress;
      }
    }
  }
  
  if (!bestTarget) {
    playParryMiss();
    return false;
  }
  
  // Check if this is a "just" parry (timing is tight near the end)
  const justThreshold = PARRY_WINDOW_END - JUST_PARRY_WINDOW;
  const isJustParry = bestChargeProgress >= justThreshold;
  
  // Side matching: same side = parry, different = hit through
  // But for rhythm-game feel, we're more lenient:
  // Any click during the window parries, but "just" timing = bonus
  
  // Cancel enemy's charge
  bestTarget.charging = false;
  bestTarget.swinging = false;
  bestTarget.whiffing = false;
  bestTarget.stagger = PARRY_STAGGER;
  bestTarget.swingCooldown = PARRY_STAGGER + 0.1;
  
  // Knockback on enemy
  const ang = Math.atan2(bestTarget.y - playerEntity.y, bestTarget.x - playerEntity.x);
  bestTarget.vx += Math.cos(ang) * 200;
  bestTarget.vy += Math.sin(ang) * 200;
  // Small player knockback
  playerEntity.vx -= Math.cos(ang) * 60;
  playerEntity.vy -= Math.sin(ang) * 60;
  
  // Effects
  const mx = (playerEntity.x + bestTarget.x) / 2;
  const my = (playerEntity.y + bestTarget.y) / 2;
  
  if (isJustParry) {
    // JUST PARRY — perfect timing!
    spawnJustParryEffect(mx, my);
    playJustParry();
    addScreenShake(12);
    hitStopTimer = Math.max(hitStopTimer, HIT_STOP_PARRY * 1.3);
    // Grant follow-up window
    playerEntity.justParried = true;
    playerEntity.justParryTimer = FOLLOW_UP_WINDOW;
    playerEntity.followUpTarget = bestTarget;
    // Spawn "just!" text particle
    spawnTextParticle(mx, my - 20, 'JUST!', '#ffd700', 1.0);
  } else {
    // Normal parry — still parries but no follow-up bonus
    spawnParryEffect(mx, my);
    playParry();
    addScreenShake(8);
    hitStopTimer = Math.max(hitStopTimer, HIT_STOP_PARRY);
    // Still grant follow-up but shorter window
    playerEntity.justParried = true;
    playerEntity.justParryTimer = FOLLOW_UP_WINDOW * 0.5;
    playerEntity.followUpTarget = bestTarget;
  }
  
  playerEntity.swingCooldown = 0; // can immediately follow-up
  return true;
}

function spawnJustParryEffect(x, y) {
  // Extra dramatic parry — bigger sparks, gold flash
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 120 + Math.random() * 300;
    const hue = 40 + Math.random() * 20; // gold
    particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      color: i < 15 ? '#ffd700' : `hsl(${hue},100%,80%)`,
      life: 0.4 + Math.random()*0.5, maxLife: 0.9,
      size: 4 + Math.random()*6,
    });
  }
  // Double shockwave
  particles.push({
    x, y, vx: 0, vy: 0,
    color: 'ring', ringRadius: 5, ringMaxRadius: 100,
    life: 0.35, maxLife: 0.35, size: 0,
  });
  particles.push({
    x, y, vx: 0, vy: 0,
    color: 'ring', ringRadius: 15, ringMaxRadius: 60,
    life: 0.2, maxLife: 0.2, size: 0,
  });
}

function spawnTextParticle(x, y, text, color, duration) {
  particles.push({
    x, y, vx: 0, vy: -40,
    color: 'text', text, textColor: color,
    life: duration, maxLife: duration, size: 16,
  });
}

// --- World Generation ---
function generateWorld() {
  entities = [];
  essenceClouds = [];
  particles = [];
  absorbParticles = [];
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

// --- AI (Rhythm-game overhaul: enemies INITIATE, player REACTS) ---
function updateAI(entity, dt) {
  if (!entity.ai || !entity.alive) return;
  if (entity.stagger > 0) return;

  entity.aiTimer -= dt;

  const isElite = (entity.power || 0) >= ELITE_THRESHOLD;
  const isBoss = (entity.power || 0) >= BOSS_THRESHOLD;
  // Faster decision cycle for stronger enemies
  const decisionInterval = isBoss ? 0.06 + Math.random() * 0.1
    : isElite ? 0.1 + Math.random() * 0.15
    : 0.15 + Math.random() * 0.3;

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

  // NO reactive parry — enemies don't counter player charges.
  // Enemies are pure INITIATORS. They attack frequently and often whiff.

  // Attack decision — enemies attack MORE and from FURTHER away
  if (entity.aiTimer <= 0) {
    entity.aiTimer = decisionInterval;

    if (nearestEntity) {
      // Start charging from further out (ENEMY_PRESWING_DIST * atkRange)
      // This means enemies swing BEFORE they're in range = whiffs
      const engageRange = entity.atkRange * ENEMY_PRESWING_DIST;
      if (nearestEntDist < engageRange) {
        const effectiveAggression = isBoss ? Math.min(0.98, entity.aggression + 0.3)
          : isElite ? Math.min(0.95, entity.aggression + 0.15)
          : entity.aggression;
        if (!entity.charging && !entity.swinging && !entity.whiffing && Math.random() < effectiveAggression) {
          entity.angle = Math.atan2(nearestEntity.y - entity.y, nearestEntity.x - entity.x);
          // Random side — no side-matching against player
          const side = Math.random() > 0.5 ? 1 : -1;
          startCharge(entity, side);
        }
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

  // Movement — enemies approach aggressively, then circle
  let targetX = entity.x, targetY = entity.y;
  let moveToTarget = false;
  const speedMult = isBoss ? 0.9 : isElite ? 0.78 : 0.65;

  if (nearestEntity && nearestEntDist < entity.senseRange) {
    // Approach to engagement range (slightly outside attack range)
    const idealDist = entity.atkRange * 0.9;
    if (nearestEntDist > idealDist) {
      // Close distance
      targetX = nearestEntity.x;
      targetY = nearestEntity.y;
      moveToTarget = true;
      entity.angle = Math.atan2(nearestEntity.y - entity.y, nearestEntity.x - entity.x);
    } else if (nearestEntDist < entity.atkRange * 0.35 && !isBoss) {
      // Too close — back up slightly
      const away = Math.atan2(entity.y - nearestEntity.y, entity.x - nearestEntity.x);
      targetX = entity.x + Math.cos(away) * 50;
      targetY = entity.y + Math.sin(away) * 50;
      moveToTarget = true;
    } else {
      // Circle strafe at engagement range
      const circleDir = (entity.id % 2 === 0) ? 1 : -1;
      const baseAngle = Math.atan2(nearestEntity.y - entity.y, nearestEntity.x - entity.x);
      const strafeAngle = baseAngle + circleDir * Math.PI * 0.4;
      targetX = entity.x + Math.cos(strafeAngle) * 40;
      targetY = entity.y + Math.sin(strafeAngle) * 40;
      moveToTarget = true;
      entity.angle = baseAngle; // always face target
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
    const speed = BASE_SPEED * speedMult;
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

    // === RHYTHM-GAME COMBAT ===
    // Left click/tap = parry attempt (match side of incoming attack)
    // Right click/tap = parry attempt (other side)
    // During follow-up window after just-parry: click = instant follow-up attack
    
    // Follow-up window timer
    if (player.justParried) {
      player.justParryTimer -= dt;
      if (player.justParryTimer <= 0) {
        player.justParried = false;
        player.followUpTarget = null;
      }
    }

    if (player.stagger <= 0) {
      if (inputLeftAttack || inputRightAttack) {
        const side = inputLeftAttack ? 1 : -1;
        
        if (player.justParried && player.followUpTarget && player.followUpTarget.alive) {
          // FOLLOW-UP ATTACK — instant, no charge needed
          player.angle = Math.atan2(player.followUpTarget.y - player.y, player.followUpTarget.x - player.x);
          player.charging = false;
          player.swinging = true;
          player.swingTime = 0;
          player.swingDir = player.angle;
          player.swingSide = side;
          player.swingCooldown = SWING_COOLDOWN;
          player.swingHitSomething = false;
          player.justParried = false;
          player.followUpTarget = null;
          playSlash();
          playFollowUp();
        } else if (!player.charging && !player.swinging && !player.justParried) {
          // PARRY ATTEMPT — try to parry a nearby enemy's attack
          const parryResult = attemptParry(player, side);
          if (!parryResult) {
            // No enemy to parry — do a normal charge attack as fallback
            startCharge(player, side);
          }
        }
        inputLeftAttack = false;
        inputRightAttack = false;
      }
    }

    // Auto-release when charged (for fallback normal attacks)
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
        // If swing didn't hit anything, enter whiff follow-through (vulnerability)
        if (!e.swingHitSomething) {
          e.whiffing = true;
          e.whiffTime = 0;
          e.whiffSide = e.swingSide;
          e.whiffDir = e.swingDir;
          e.whiffEndAngle = e.swingDir - e.swingSide * SWORD_ARC / 2;
          e.stagger = WHIFF_FOLLOWTHROUGH_TIME; // can't attack during whiff
          e.swingCooldown = WHIFF_FOLLOWTHROUGH_TIME + 0.05; // extended cooldown
        }
      }
    }
    // Whiff follow-through update
    if (e.whiffing) {
      e.whiffTime += dt;
      if (e.whiffTime >= WHIFF_FOLLOWTHROUGH_TIME) {
        e.whiffing = false;
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
          const oldPower = e.power || 0;
          e.power = oldPower + absorbed;
          e.maxHp = BASE_HP + Math.floor(e.power * 1.5);
          e.senseRange = ENEMY_SENSE_RANGE + e.power * 0.3;
          e.radius = Math.min(26, 10 + e.power * 0.15);
          e.aggression = Math.min(0.95, 0.4 + e.power / 80);
          // Assign unique name when crossing elite/boss threshold
          if (!e.uniqueName && e.power >= ELITE_THRESHOLD) {
            e.uniqueName = generateUniqueName(e.power);
            // Recalc charge time for newly-promoted entity
            e.chargeTimeBase = e.power >= BOSS_THRESHOLD ? 0.6 + Math.random() * 0.1 : 0.75 + Math.random() * 0.1;
          } else if (e.uniqueName && oldPower < BOSS_THRESHOLD && e.power >= BOSS_THRESHOLD) {
            // Promote from elite to boss — get a grander name
            e.uniqueName = generateUniqueName(e.power);
            e.chargeTimeBase = 0.6 + Math.random() * 0.1;
          }
        }
        
        if (e.isPlayer && absorbed > 0.01) playEssence();

        // Spawn absorption particles (floating essence orbs that get sucked in)
        if (absorbed > 0.05) {
          const spawnChance = Math.min(1, absorbed * 0.6);
          if (Math.random() < spawnChance) {
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = c.radius * (0.3 + Math.random() * 0.7);
            absorbParticles.push({
              x: c.x + Math.cos(spawnAngle) * spawnDist,
              y: c.y + Math.sin(spawnAngle) * spawnDist,
              targetEntity: e,
              life: 0.4 + Math.random() * 0.4,
              maxLife: 0.8,
              size: 2.5 + Math.random() * 3,
              hue: 155 + Math.random() * 25, // teal-green range
              brightness: 60 + Math.random() * 30,
              orbiting: true,
              orbitAngle: spawnAngle,
              orbitSpeed: 3 + Math.random() * 4,
            });
          }
        }
      }
    }
    // Shrink cloud as it's consumed
    c.radius = c.baseRadius * (c.amount / c.maxAmount) * 0.6 + c.baseRadius * 0.4;
  }

  // Update absorption particles
  for (let i = absorbParticles.length - 1; i >= 0; i--) {
    const ap = absorbParticles[i];
    ap.life -= dt;
    if (ap.life <= 0 || !ap.targetEntity || !ap.targetEntity.alive) {
      absorbParticles.splice(i, 1);
      continue;
    }
    // Accelerate toward target entity (suction effect)
    const tx = ap.targetEntity.x;
    const ty = ap.targetEntity.y;
    const dx = tx - ap.x;
    const dy = ty - ap.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Get closer over time — starts slow, accelerates (ease-in)
    const lifeRatio = 1 - (ap.life / ap.maxLife); // 0 at birth, 1 at death
    const speed = 80 + lifeRatio * 400; // accelerates toward entity
    if (dist > 3) {
      ap.x += (dx / dist) * speed * dt;
      ap.y += (dy / dist) * speed * dt;
      // Add slight spiral motion
      ap.orbitAngle += ap.orbitSpeed * dt;
      const spiralR = Math.max(0, (1 - lifeRatio) * 15);
      ap.x += Math.cos(ap.orbitAngle) * spiralR * dt * 3;
      ap.y += Math.sin(ap.orbitAngle) * spiralR * dt * 3;
    }
    // Snap and remove when very close
    if (dist < 8) {
      absorbParticles.splice(i, 1);
    }
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

  // Level up check & player title update
  if (player && player.alive) {
    checkLevelUp();
    // Update player title based on accumulated essence
    if (player.totalEssence >= PLAYER_TITLE_THRESHOLD) {
      const newTitle = generatePlayerTitle(player.totalEssence);
      if (newTitle !== playerTitle) playerTitle = newTitle;
    }
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
  drawAbsorbParticles();
  drawCorpses();

  const allVisible = [...entities.filter(e => e.alive), player].filter(e => e && e.alive);
  for (const e of allVisible) drawEntity(e);

  // Parry timing ring on PLAYER — shows when nearby enemy is in parry window
  if (player && player.alive && !player.justParried) {
    let nearestChargingEnemy = null;
    let nearestChargeDist = SWORD_LENGTH * 2.5;
    for (const e of entities) {
      if (!e.alive || !e.charging) continue;
      const d = distFn(player.x, player.y, e.x, e.y);
      if (d < nearestChargeDist) {
        const maxCharge = e.chargeTimeBase || CHARGE_TIME;
        const prog = Math.min(1, e.chargeTime / maxCharge);
        if (prog >= PARRY_WINDOW_START * 0.5) {
          nearestChargingEnemy = e;
          nearestChargeDist = d;
        }
      }
    }
    if (nearestChargingEnemy) {
      const ce = nearestChargingEnemy;
      const maxCharge = ce.chargeTimeBase || CHARGE_TIME;
      const prog = Math.min(1, ce.chargeTime / maxCharge);
      const inWindow = prog >= PARRY_WINDOW_START && prog <= PARRY_WINDOW_END;
      const justThreshold = PARRY_WINDOW_END - JUST_PARRY_WINDOW;
      const inJust = prog >= justThreshold && prog <= PARRY_WINDOW_END;
      
      ctx.save();
      ctx.translate(player.x, player.y);
      // Direction arrow toward enemy
      const dirAngle = Math.atan2(ce.y - player.y, ce.x - player.x);
      const arrowDist = player.radius + 20;
      ctx.globalAlpha = inWindow ? 0.8 : 0.3;
      ctx.fillStyle = inJust ? '#ffd700' : inWindow ? '#00ff88' : '#ffffff';
      ctx.save();
      ctx.translate(Math.cos(dirAngle) * arrowDist, Math.sin(dirAngle) * arrowDist);
      ctx.rotate(dirAngle);
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Shrinking ring on player
      const ringR = player.radius + 25 - prog * 15;
      ctx.globalAlpha = inWindow ? (inJust ? 0.7 : 0.4) : 0.15;
      ctx.strokeStyle = inJust ? '#ffd700' : inWindow ? '#00ff88' : '#888';
      ctx.lineWidth = inJust ? 4 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

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

function drawAbsorbParticles() {
  for (const ap of absorbParticles) {
    const lifeRatio = ap.life / ap.maxLife;
    const alpha = Math.min(1, lifeRatio * 2) * 0.9; // fade in quickly, fade out at end
    const size = ap.size * (0.5 + lifeRatio * 0.5);
    
    ctx.save();
    ctx.globalAlpha = alpha;
    // Glowing orb with halo
    const grad = ctx.createRadialGradient(ap.x, ap.y, 0, ap.x, ap.y, size * 2.5);
    grad.addColorStop(0, `hsla(${ap.hue}, 80%, ${ap.brightness + 20}%, 1)`);
    grad.addColorStop(0.4, `hsla(${ap.hue}, 70%, ${ap.brightness}%, 0.6)`);
    grad.addColorStop(1, `hsla(${ap.hue}, 60%, ${ap.brightness - 10}%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, size * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Bright core
    ctx.globalAlpha = alpha * 1.2;
    ctx.fillStyle = `hsla(${ap.hue}, 50%, 90%, 1)`;
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
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

  // Charge indicator on ENEMIES — shrinking ring with parry window highlight
  if (e.charging && !e.isPlayer) {
    const maxCharge = e.chargeTimeBase || CHARGE_TIME;
    const progress = Math.min(1, e.chargeTime / maxCharge);
    const pulse = 1 + Math.sin(totalGameTime * 12) * 0.06 * (1 - progress);
    const baseChargeR = getSwordLen(e) * 1.0 + 25;
    const chargeRadius = baseChargeR * (1 - progress * 0.7) * pulse;
    const isRed = e.chargeSide === 1;
    const chargeColor = isRed ? 'rgba(255,80,80,' : 'rgba(80,120,255,';
    
    ctx.save();
    // Outer glow
    ctx.globalAlpha = 0.08 + progress * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, chargeRadius + 6, 0, Math.PI * 2);
    ctx.fillStyle = chargeColor + (0.06 + progress * 0.12) + ')';
    ctx.fill();
    // Main charge circle
    ctx.beginPath();
    ctx.arc(0, 0, chargeRadius, 0, Math.PI * 2);
    ctx.fillStyle = chargeColor + (0.1 + progress * 0.25) + ')';
    ctx.fill();
    ctx.strokeStyle = chargeColor + (0.3 + progress * 0.5) + ')';
    ctx.lineWidth = 2 + progress * 2;
    ctx.stroke();
    
    // PARRY WINDOW highlight — shows when the player can parry
    if (progress >= PARRY_WINDOW_START * 0.8) {
      const inWindow = progress >= PARRY_WINDOW_START && progress <= PARRY_WINDOW_END;
      const justThreshold = PARRY_WINDOW_END - JUST_PARRY_WINDOW;
      const inJust = progress >= justThreshold && progress <= PARRY_WINDOW_END;
      
      if (inWindow) {
        // Parry window active — bright highlight ring
        const windowAlpha = inJust ? 0.9 : 0.6;
        const windowColor = inJust ? '#ffd700' : '#00ff88';
        ctx.globalAlpha = windowAlpha;
        ctx.strokeStyle = windowColor;
        ctx.lineWidth = inJust ? 5 : 3;
        ctx.beginPath();
        ctx.arc(0, 0, chargeRadius - 4, 0, Math.PI * 2);
        ctx.stroke();
        // Pulsing "tap!" indicator
        if (inJust) {
          ctx.globalAlpha = 0.6 + Math.sin(totalGameTime * 20) * 0.4;
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 11px Inter,sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('!', 0, -chargeRadius - 6);
        }
      } else {
        // Approaching parry window — dim preview
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#00ff8844';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, chargeRadius - 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }
  
  // Player's own charge indicator (for fallback attacks)
  if (e.charging && e.isPlayer) {
    const progress = getChargeProgress(e);
    const baseChargeR = getSwordLen(e) * 0.8 + 15;
    const chargeRadius = baseChargeR * (1 - progress * 0.6);
    const isRed = e.chargeSide === 1;
    const chargeColor = isRed ? 'rgba(255,80,80,' : 'rgba(80,120,255,';
    ctx.save();
    ctx.globalAlpha = 0.15 + progress * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, chargeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = chargeColor + (0.5 + progress * 0.4) + ')';
    ctx.lineWidth = 2 + progress * 2;
    ctx.stroke();
    ctx.restore();
  }
  
  // Follow-up window indicator on player
  if (e.isPlayer && e.justParried) {
    const remaining = e.justParryTimer / FOLLOW_UP_WINDOW;
    ctx.save();
    // Golden pulsing ring showing follow-up window
    ctx.globalAlpha = 0.4 + remaining * 0.5;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    // Arc showing remaining time
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
    ctx.stroke();
    // "Attack!" prompt
    if (remaining > 0.3) {
      ctx.globalAlpha = 0.5 + Math.sin(totalGameTime * 16) * 0.3;
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('追撃!', 0, -e.radius - 18);
    }
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

  // Sword swing (active swing or whiff follow-through)
  if (e.swinging || e.whiffing) {
    const arc = getSwordArc(e);
    const sLen = getSwordLen(e);
    if (arc) {
      const isWhiff = !!arc.whiffing;
      // Draw the swept arc trail
      const swingStart = (isWhiff ? e.whiffDir : e.swingDir) + (isWhiff ? e.whiffSide : e.swingSide) * SWORD_ARC / 2;
      const swingCurrent = arc.angle;
      const side = arc.side;
      ctx.save();
      ctx.globalAlpha = isWhiff ? 0.1 + 0.1 * (1 - (arc.whiffProgress || 0)) : 0.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      if (side === 1) {
        ctx.arc(0, 0, sLen, swingStart, swingCurrent, true);
      } else {
        ctx.arc(0, 0, sLen, swingStart, swingCurrent, false);
      }
      ctx.closePath();
      ctx.fillStyle = side === 1 ? '#ff5050' : '#5078ff';
      ctx.fill();
      ctx.restore();

      // Draw the sword blade at current angle
      ctx.save();
      ctx.rotate(arc.angle);
      const swordAlpha = isWhiff ? 0.3 + 0.3 * (1 - (arc.whiffProgress || 0)) : Math.max(0.5, 1 - Math.abs(arc.progress - 0.5) * 1.5);
      ctx.globalAlpha = swordAlpha;
      ctx.beginPath();
      ctx.moveTo(e.radius - 2, 0);
      ctx.lineTo(sLen, 0);
      ctx.strokeStyle = side === 1 ? '#ff8888' : '#8899ff';
      ctx.lineWidth = isWhiff ? 2 : 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sLen, 0, isWhiff ? 2 : 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
    }
  }

  // Boss/Elite mark above entity
  const isEliteEnemy = !e.isPlayer && (e.power || 0) >= ELITE_THRESHOLD;
  const isBossEnemy = !e.isPlayer && (e.power || 0) >= BOSS_THRESHOLD;
  if (isBossEnemy) {
    // Boss crown mark
    ctx.save();
    ctx.globalAlpha = 0.9;
    const crownY = -e.radius - 22;
    ctx.fillStyle = '#ffd700';
    ctx.font = '600 14px Inter,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♛', 0, crownY);
    // Glowing aura
    ctx.globalAlpha = 0.15 + Math.sin(totalGameTime * 3) * 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  } else if (isEliteEnemy) {
    // Elite diamond mark
    ctx.save();
    ctx.globalAlpha = 0.8;
    const eliteY = -e.radius - 20;
    ctx.fillStyle = '#ff8844';
    ctx.font = '600 11px Inter,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◆', 0, eliteY);
    ctx.restore();
  }

  // Player title display
  if (e.isPlayer && playerTitle) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.font = '600 10px Inter,sans-serif';
    ctx.fillStyle = '#4ec8b0';
    ctx.textAlign = 'center';
    ctx.fillText(playerTitle, 0, -e.radius - 20);
    ctx.restore();
  }

  // HP bar
  if (e.hp < e.maxHp) {
    ctx.globalAlpha = 1;
    const barW = e.radius * 2.8;
    const barH = 3;
    const barY = -e.radius - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-barW/2, barY, barW, barH);
    ctx.fillStyle = e.isPlayer ? '#ff4466' : (isBossEnemy ? '#ffd700' : '#ff6644');
    ctx.fillRect(-barW/2, barY, barW * Math.max(0, e.hp / e.maxHp), barH);
  }

  // Unique name or power display for enemies
  if (!e.isPlayer && e.uniqueName) {
    ctx.globalAlpha = 0.8;
    ctx.font = isBossEnemy ? 'bold 11px Inter,sans-serif' : '600 10px Inter,sans-serif';
    ctx.fillStyle = isBossEnemy ? '#ffd700' : '#ff8844';
    ctx.textAlign = 'center';
    ctx.fillText(e.uniqueName, 0, e.radius + 16);
  } else if (!e.isPlayer && e.power > 10) {
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
    } else if (p.color === 'text') {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.textColor || '#fff';
      ctx.font = `bold ${p.size}px Inter,sans-serif`;
      ctx.textAlign = 'center';
      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(p.text, p.x, p.y);
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
    const ePow = e.power || 0;
    const isBossM = ePow >= BOSS_THRESHOLD;
    const isEliteM = ePow >= ELITE_THRESHOLD;
    miniCtx.fillStyle = isBossM ? '#ffd700' : isEliteM ? '#ff8844' : e.color;
    miniCtx.globalAlpha = isBossM ? 1 : isEliteM ? 0.85 : 0.7;
    const sz = isBossM ? 5 : isEliteM ? 4 : Math.min(4, 2 + ePow * 0.02);
    if (isBossM || isEliteM) {
      miniCtx.beginPath(); miniCtx.arc(mx, my, sz/2, 0, Math.PI*2); miniCtx.fill();
    } else {
      miniCtx.fillRect(mx-sz/2, my-sz/2, sz, sz);
    }
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
  playerTitle = '';
  deathTitle = '';
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
  playerTitle = '';
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
window.render_game_to_text = () => {
  const elites = entities.filter(e => e.alive && (e.power||0) >= ELITE_THRESHOLD);
  const bosses = entities.filter(e => e.alive && (e.power||0) >= BOSS_THRESHOLD);
  return JSON.stringify({
    phase: gamePhase,
    player: player ? { x: Math.round(player.x), y: Math.round(player.y), hp: player.hp, maxHp: player.maxHp, totalEssence: Math.round(player.totalEssence), alive: player.alive, kills: player.kills, level: getPlayerLevel(), whiffing: player.whiffing, swinging: player.swinging, justParried: player.justParried, followUpTarget: !!player.followUpTarget, title: playerTitle } : null,
    enemies: entities.filter(e=>e.alive).length,
    elites: elites.length,
    bosses: bosses.length,
    eliteNames: elites.slice(0,5).map(e => e.uniqueName || ''),
    chargingNearby: entities.filter(e => e.alive && e.charging && player && distFn(e.x,e.y,player.x,player.y) < SWORD_LENGTH * 3).length,
    clouds: essenceClouds.length,
    absorbParticles: absorbParticles.length,
    corpses: corpses.length,
    time: Math.round(totalGameTime),
  });
};
