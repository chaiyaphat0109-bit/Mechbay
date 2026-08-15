import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { storage } from "./storage";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

/* ---------- SFX: tiny synthesized sounds via Web Audio API, no files ---------- */
let _actx = null;
function getAudioCtx() {
  if (typeof window === "undefined") return null;
  if (!_actx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _actx = new Ctx();
  }
  if (_actx.state === "suspended") _actx.resume().catch(() => {});
  return _actx;
}
function tone(freq, start, dur, type, gainPeak) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "square";
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainPeak || 0.12, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}
function playSFX(kind) {
  try {
    if (kind === "click") tone(520, 0, 0.05, "square", 0.05);
    else if (kind === "buy") {
      tone(440, 0, 0.08, "square", 0.09);
      tone(660, 0.07, 0.1, "square", 0.09);
    } else if (kind === "gacha") {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.12, "triangle", 0.08));
    } else if (kind === "upgrade") {
      tone(392, 0, 0.07, "sawtooth", 0.07);
      tone(523, 0.06, 0.07, "sawtooth", 0.07);
      tone(784, 0.12, 0.14, "sawtooth", 0.08);
    } else if (kind === "hit") {
      tone(150, 0, 0.08, "square", 0.1);
    } else if (kind === "crit") {
      tone(200, 0, 0.05, "sawtooth", 0.12);
      tone(120, 0.04, 0.1, "square", 0.12);
    } else if (kind === "win") {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.18, "triangle", 0.09));
    } else if (kind === "lose") {
      [392, 330, 262].forEach((f, i) => tone(f, i * 0.14, 0.22, "sawtooth", 0.08));
    } else if (kind === "claim") {
      tone(660, 0, 0.06, "triangle", 0.09);
      tone(880, 0.05, 0.1, "triangle", 0.09);
    }
  } catch (e) {}
}

/* ---------- Fonts ---------- */
function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

/* ---------- Data (rebalanced) ---------- */
const HEAD = [
  { id: "h1", name: "เกราะหัวมาตรฐาน", icon: "🪖", stats: { def: 4, hp: 10 }, color: "#7C8494" },
  { id: "h2", name: "สแกนเนอร์เหยี่ยว", icon: "🦅", stats: { def: 2, spd: 5 }, color: "#47E0D2" },
  { id: "h3", name: "หมวกไททาเนียม", icon: "⛑️", stats: { def: 9, hp: 3 }, color: "#FFB020" },
  { id: "h4", name: "โดมเรดาร์คู่", icon: "📡", stats: { spd: 7, atk: 1 }, color: "#B57BFF" },
  { id: "hs1", name: "หมวกควอนตัม", icon: "🧿", stats: { def: 14, hp: 8 }, color: "#7BD8FF", shop: true, price: 80, slotLabel: "หัว" },
];
const ARMS = [
  { id: "a1", name: "แขนกลมาตรฐาน", icon: "🦾", stats: { atk: 3, def: 2 }, color: "#7C8494" },
  { id: "a2", name: "แขนไฮดรอลิก", icon: "💪", stats: { atk: 6 }, color: "#FF5A4E" },
  { id: "a3", name: "แขนเกราะหนัก", icon: "🛡️", stats: { atk: 2, def: 7 }, color: "#FFB020" },
  { id: "a4", name: "แขนใยคาร์บอน", icon: "⚙️", stats: { atk: 4, spd: 3 }, color: "#47E0D2" },
  { id: "a5", name: "แขนพ่นพิษ", icon: "🧪", stats: { atk: 2 }, dot: { label: "พิษ", perTurn: 3 }, color: "#8CF07A" },
  { id: "as1", name: "แขนกรงเล็บนาโน", icon: "🦂", stats: { atk: 9, def: 3 }, color: "#FF8A3D", shop: true, price: 70, slotLabel: "แขน (ซ้าย/ขวา)" },
];
const LEGS = [
  { id: "l1", name: "ขามาตรฐาน", icon: "🦿", stats: { spd: 4, def: 2 }, color: "#7C8494", legType: "standard" },
  { id: "l2", name: "ขาสปริงไฮเปอร์", icon: "🌀", stats: { spd: 10 }, color: "#47E0D2", legType: "spring" },
  { id: "l3", name: "ขาตีนตะขาบ", icon: "🛞", stats: { def: 7, spd: -2, hp: 5 }, color: "#FFB020", legType: "tracked" },
  { id: "l4", name: "ขาเจ็ตบูสต์", icon: "🚀", stats: { spd: 8, atk: 1 }, color: "#B57BFF", legType: "jet" },
  { id: "ls1", name: "ขาไฮเปอร์ไดรฟ์", icon: "🛸", stats: { spd: 14 }, color: "#7BFFEA", legType: "jet", shop: true, price: 90, slotLabel: "ขา" },
];
const CORE = [
  { id: "c1", name: "แกนพลังมาตรฐาน", icon: "🔋", stats: { hp: 18 }, color: "#7C8494" },
  { id: "c2", name: "แกนฟิวชันคู่", icon: "☢️", stats: { hp: 12, atk: 3 }, color: "#FF5A4E" },
  { id: "c3", name: "แกนเกราะหนา", icon: "🧱", stats: { hp: 9, def: 7 }, color: "#FFB020" },
  { id: "c4", name: "แกนกระแสไว", icon: "⚡", stats: { hp: 7, spd: 5 }, color: "#47E0D2" },
  { id: "cs1", name: "แกนดาวฤกษ์จิ๋ว", icon: "⭐", stats: { hp: 22, atk: 5, def: 3 }, color: "#FFE066", shop: true, price: 100, slotLabel: "แกนกลาง" },
];

const WEAPON_CATS = [
  { id: "melee", label: "ระยะประชิด" },
  { id: "midrange", label: "ระยะกลาง" },
  { id: "longrange", label: "ระยะไกล" },
  { id: "elemental", label: "พิษ/ธาตุ" },
  { id: "code", label: "กำหนดโค้ดเอง" },
];
const CODE_FORMAT_HINT = "โค้ดต้องเป็นตัวพิมพ์ใหญ่ ขึ้นต้นด้วย MECH- ตามด้วยคำ (A-Z/0-9) เช่น MECH-DRAGON — ผู้สร้างโค้ดตั้งคำท้ายเองได้ แต่ต้องขึ้นต้นด้วย MECH- เสมอ";
const WEAPONS = [
  { id: "w1", cat: "melee", name: "มีดสั้น", icon: "🔪", stats: { atk: 7, spd: 2 } },
  { id: "w2", cat: "melee", name: "ดาบพลังงาน", icon: "⚔️", stats: { atk: 12 } },
  { id: "w3", cat: "melee", name: "หมัดเหล็ก", icon: "👊", stats: { atk: 9, def: 2 } },
  { id: "w4", cat: "melee", name: "ขวานไทเทเนียม", icon: "🪓", stats: { atk: 11, spd: -1 } },
  { id: "w5", cat: "midrange", name: "ปืนกลมือ", icon: "🔫", stats: { atk: 8, spd: 3 } },
  { id: "w6", cat: "midrange", name: "แหลนไฟฟ้า", icon: "🔱", stats: { atk: 10, spd: -1 } },
  { id: "w7", cat: "midrange", name: "บูมเมอแรงไฟฟ้า", icon: "🪃", stats: { atk: 9, spd: 2 } },
  { id: "w8", cat: "longrange", name: "ปืนสไนเปอร์", icon: "🎯", stats: { atk: 15, spd: -3 } },
  { id: "w9", cat: "longrange", name: "ปืนเลเซอร์", icon: "🔦", stats: { atk: 12, spd: -1 } },
  { id: "w10", cat: "longrange", name: "จรวดนำวิถี", icon: "🚀", stats: { atk: 17, spd: -4 } },
  { id: "w11", cat: "elemental", name: "มีดพิษ", icon: "🧪", stats: { atk: 5 }, dot: { label: "พิษ", perTurn: 4 } },
  { id: "w12", cat: "elemental", name: "ปืนพ่นไฟ", icon: "🔥", stats: { atk: 7 }, dot: { label: "ไฟไหม้", perTurn: 4 } },
  { id: "w13", cat: "elemental", name: "ตะขอไฟฟ้า", icon: "⚡", stats: { atk: 5 }, dot: { label: "ช็อต", perTurn: 3 } },
  { id: "ws1", cat: "longrange", name: "ปืนแอนตี้แมทเทอร์", icon: "🌌", stats: { atk: 24, spd: -3 }, shop: true, price: 120, slotLabel: "อาวุธ • ระยะไกล" },
  { id: "ws2", cat: "melee", name: "ดาบพลาสม่าคู่", icon: "🔆", stats: { atk: 18 }, shop: true, price: 110, slotLabel: "อาวุธ • ระยะประชิด" },
  { id: "cw1", cat: "code", name: "ดาบมังกรทองคำ", icon: "🐉", stats: { atk: 22, spd: 4 }, codeOnly: true, code: "MECH-DRAGON" },
  { id: "cw2", cat: "code", name: "ปืนจักรวาลอนันต์", icon: "🪐", stats: { atk: 20, def: 5 }, codeOnly: true, code: "MECH-COSMOS" },
];

const CHIPS = [
  { id: "chip1", name: "ชิปฮีลฉุกเฉิน", icon: "💚", color: "#8CF07A", stats: {}, effect: "heal", desc: "ฮีล 5% เลือดสูงสุดทุกเทิร์นเมื่อเลือดต่ำกว่า 30%" },
  { id: "chip2", name: "ชิปสะท้อนดาเมจ", icon: "🪞", color: "#7BD8FF", stats: {}, effect: "reflect", desc: "สะท้อนดาเมจที่ได้รับ 10% กลับไปหาศัตรู" },
  { id: "chip3", name: "ชิปเจาะเกราะ", icon: "🗲", color: "#FFB020", stats: {}, effect: "pierce", desc: "เพิกเฉยเกราะศัตรู 20% เวลาโจมตี" },
];

const CATEGORIES = [
  { id: "head", label: "หัว", data: HEAD },
  { id: "armL", label: "แขนซ้าย", data: ARMS },
  { id: "armR", label: "แขนขวา", data: ARMS },
  { id: "legs", label: "ขา", data: LEGS },
  { id: "core", label: "แกนกลาง", data: CORE },
  { id: "weapon", label: "อาวุธ", data: null },
  { id: "chip", label: "ชิป", data: CHIPS },
];

const WEATHERS = [
  { id: "clear", label: "ท้องฟ้าแจ่มใส", icon: "☀️", desc: "ไม่มีผลพิเศษ" },
  { id: "acid", label: "ฝนกรด", icon: "🧪", desc: "เกราะกัดกร่อนทุกฝ่าย ป้องกันลดลง 15%" },
  { id: "emStorm", label: "พายุแม่เหล็กไฟฟ้า", icon: "⚡", desc: "สัญญาณรบกวน ลำดับโจมตีสุ่มทุกเทิร์น" },
  { id: "lowG", label: "แรงโน้มถ่วงต่ำ", icon: "🌙", desc: "ทุกฝ่ายโจมตีแรงขึ้น 15%" },
];

const BOUNTIES = [
  { id: "speedster", name: "สายฟ้าจอมเร็ว", icon: "🌩️", desc: "บอทความเร็วสูงมาก แต่เกราะบางเฉียบ", statMult: { atk: 1.1, def: 0.6, spd: 2.2, hp: 0.8 }, reward: { coins: 60, shards: 3 } },
  { id: "tank", name: "ป้อมเหล็กเดินได้", icon: "🛡️", desc: "เกราะหนาเตอะ พลังชีวิตสูงลิ่ว", statMult: { atk: 0.8, def: 2.0, spd: 0.6, hp: 1.6 }, reward: { coins: 70, shards: 3 } },
  { id: "berserker", name: "จอมพิฆาตบ้าคลั่ง", icon: "💢", desc: "โจมตีแรงสุดขีด แต่เปราะบางมาก", statMult: { atk: 1.8, def: 0.5, spd: 1.1, hp: 0.9 }, reward: { coins: 80, shards: 4 } },
];
function getTodayBounty() {
  const d = new Date();
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return BOUNTIES[doy % BOUNTIES.length];
}
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/* ---------- Gacha-exclusive items (only obtainable from the gacha machine) ---------- */
const GACHA_HEAD = { id: "g_h1", name: "หมวกเทพสายฟ้า", icon: "🌩️", stats: { def: 12, spd: 6 }, color: "#7BD8FF", gacha: true, rarity: "rare", slotLabel: "หัว" };
const GACHA_ARM1 = { id: "g_a1", name: "แขนกังหันลม", icon: "🌪️", stats: { atk: 8, spd: 5 }, color: "#7BFFC9", gacha: true, rarity: "common", slotLabel: "แขน (ซ้าย/ขวา)" };
const GACHA_ARM2 = { id: "g_a2", name: "แขนหุ่นยักษ์โบราณ", icon: "🗿", stats: { atk: 14, def: 6 }, color: "#B0A98F", gacha: true, rarity: "legendary", slotLabel: "แขน (ซ้าย/ขวา)" };
const GACHA_LEG = { id: "g_l1", name: "ขาดาวตก", icon: "☄️", stats: { spd: 12, atk: 3 }, color: "#FF9C6B", legType: "jet", gacha: true, rarity: "rare", slotLabel: "ขา" };
const GACHA_CORE = { id: "g_c1", name: "แกนซูเปอร์โนวา", icon: "🌟", stats: { hp: 20, atk: 6, spd: 4 }, color: "#FFE066", gacha: true, rarity: "legendary", slotLabel: "แกนกลาง" };
const GACHA_W1 = { id: "g_w1", cat: "melee", name: "กระบี่เทพสายรุ้ง", icon: "🌈", stats: { atk: 20 }, gacha: true, rarity: "legendary", slotLabel: "อาวุธ • ระยะประชิด" };
const GACHA_W2 = { id: "g_w2", cat: "midrange", name: "ปืนนาโนบอท", icon: "🤖", stats: { atk: 13, spd: 4 }, gacha: true, rarity: "common", slotLabel: "อาวุธ • ระยะกลาง" };
HEAD.push(GACHA_HEAD);
ARMS.push(GACHA_ARM1, GACHA_ARM2);
LEGS.push(GACHA_LEG);
CORE.push(GACHA_CORE);
WEAPONS.push(GACHA_W1, GACHA_W2);

const RARITY_COLOR = { common: "#7C8494", rare: "#47E0D2", legendary: "#FFB020" };
const RARITY_WEIGHT = { common: 3, rare: 2, legendary: 1 };
const GACHA_COST = 150;

const SHOP_ITEMS = [...HEAD, ...ARMS, ...LEGS, ...CORE, ...WEAPONS].filter((i) => i.shop);
const GACHA_ITEMS = [...HEAD, ...ARMS, ...LEGS, ...CORE, ...WEAPONS].filter((i) => i.gacha);
const LOCKED_ITEMS = [...HEAD, ...ARMS, ...LEGS, ...CORE, ...WEAPONS].filter((i) => i.shop || i.codeOnly || i.gacha);

function gachaRoll() {
  const total = GACHA_ITEMS.reduce((s, i) => s + RARITY_WEIGHT[i.rarity], 0);
  let r = Math.random() * total;
  for (const item of GACHA_ITEMS) {
    r -= RARITY_WEIGHT[item.rarity];
    if (r <= 0) return item;
  }
  return GACHA_ITEMS[GACHA_ITEMS.length - 1];
}

const FRAME_COLORS = ["#3A4354", "#47E0D2", "#FF5A4E", "#FFB020", "#8CF07A", "#B57BFF", "#7BD8FF", "#FF7AC6"];

const GARAGE_THEMES = [
  { id: "default", label: "มาตรฐาน", grid: "#1E2530", glow: "#47E0D2", bg: "#0D1015", minWins: 0 },
  { id: "neon", label: "โรงงานนีออน", grid: "#3D1A3E", glow: "#FF2A9E", bg: "#140A18", minWins: 3 },
  { id: "space", label: "ฐานทัพอวกาศ", grid: "#151A30", glow: "#4D6BFF", bg: "#080A16", minWins: 6, stars: true },
  { id: "lab", label: "ห้องทดลองใต้ดิน", grid: "#12261E", glow: "#3DFFB0", bg: "#081410", minWins: 10 },
];

const ALL_ITEMS = [...HEAD, ...ARMS, ...LEGS, ...CORE, ...WEAPONS, ...CHIPS];
function findItemById(id) {
  return ALL_ITEMS.find((i) => i.id === id) || null;
}
function categoryOfItem(item) {
  if (HEAD.includes(item)) return "head";
  if (ARMS.includes(item)) return "arms";
  if (LEGS.includes(item)) return "legs";
  if (CORE.includes(item)) return "core";
  if (WEAPONS.includes(item)) return "weapon";
  if (CHIPS.includes(item)) return "chip";
  return null;
}
const CATEGORY_LABEL = { head: "หัว", arms: "แขน", legs: "ขา", core: "แกนกลาง", weapon: "อาวุธ", chip: "ชิป" };

const DECALS = [
  { id: "none", label: "ไม่มี" },
  { id: "01", label: "เลข 01", text: "01" },
  { id: "77", label: "เลข 77", text: "77" },
  { id: "rx", label: "RX", text: "RX" },
  { id: "stripe", label: "ลายคาด" },
  { id: "camo", label: "ลายพราง" },
];

const MAX_STARS = 3;
function itemPower(item) {
  return Object.values(item.stats).reduce((a, v) => a + Math.max(0, v), 0);
}
function upgradeCost(item, stars) {
  const power = itemPower(item);
  const base = 15 + power * 3;
  return Math.round(base * (1 + stars * 0.7));
}
function statsAtStars(item, stars) {
  const dominant = getDominantStat(item);
  const out = {};
  Object.entries(item.stats).forEach(([k, v]) => {
    const mult = stars === 0 ? 1 : 1 + stars * (k === dominant ? 0.18 : 0.07);
    out[k] = Math.round(v * mult);
  });
  return out;
}

const ACHIEVEMENTS = [
  { id: "win5", name: "นักสู้มือใหม่", desc: "ชนะการประลองครบ 5 ครั้ง", check: (ctx) => ctx.winCount >= 5, reward: { coins: 200 } },
  { id: "legendary3", name: "นักสะสมระดับเทพ", desc: "สะสมชิ้นส่วนระดับ Legendary ครบ 3 ชิ้น", check: (ctx) => ctx.legendaryCount >= 3, reward: { title: "นักสะสมระดับเทพ" } },
  { id: "atk50", name: "จอมทำลายล้าง", desc: "ประกอบหุ่นให้ค่าพลังโจมตีทะลุ 50", check: (ctx) => ctx.atk >= 50, reward: { title: "จอมทำลายล้าง" } },
];

const BOSS_EQUIP = { head: GACHA_HEAD, armL: GACHA_ARM2, armR: GACHA_ARM2, legs: GACHA_LEG, core: GACHA_CORE, weapon: GACHA_W1 };
const BOSS_NAME = "ไททันโบราณ";

const BASE = { atk: 18, def: 8, spd: 6, hp: 300 };
const STAT_LABEL = { atk: "โจมตี", def: "ป้องกัน", spd: "ความเร็ว", hp: "พลังชีวิต" };
const STAT_COLOR = { atk: "#FF5A4E", def: "#47E0D2", spd: "#FFB020", hp: "#8CF07A" };
const STAT_MAX = { atk: 90, def: 70, spd: 50, hp: 450 };
const EMPTY_EQUIP = { head: null, armL: null, armR: null, legs: null, core: null, weapon: null, chip: null };

function getDominantStat(item) {
  let best = null;
  let bestVal = -Infinity;
  Object.entries(item.stats).forEach(([k, v]) => {
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  });
  return best;
}

function sumStats(equipped, upgrades) {
  const total = { ...BASE };
  Object.values(equipped).forEach((item) => {
    if (!item) return;
    const stars = (upgrades && upgrades[item.id]) || 0;
    const dominant = getDominantStat(item);
    Object.entries(item.stats).forEach(([k, v]) => {
      const mult = stars === 0 ? 1 : 1 + stars * (k === dominant ? 0.18 : 0.07);
      total[k] = (total[k] || 0) + Math.round(v * mult);
    });
  });
  return total;
}

/* Diminishing-returns armor mitigation: heavier armor reduces damage more,
   but with ever-smaller marginal gains, and a small guaranteed leak-through
   so no build can become fully immortal. */
function calcDamage(atk, def, mult) {
  const m = mult || 1;
  const K = 60;
  const mitigation = def / (def + K);
  const variance = 0.85 + Math.random() * 0.3;
  const raw = atk * m * (1 - mitigation) * variance;
  const floor = atk * m * 0.1;
  return Math.max(1, Math.round(Math.max(raw, floor)));
}

function dotSources(equipped) {
  const list = [];
  ["weapon", "armL", "armR"].forEach((slot) => {
    const it = equipped[slot];
    if (it && it.dot) list.push(it.dot);
  });
  return list;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateBotEquip() {
  return {
    head: pick(HEAD),
    armL: pick(ARMS),
    armR: pick(ARMS),
    legs: pick(LEGS),
    core: pick(CORE),
    weapon: pick(WEAPONS),
  };
}

function genCode(prefix) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

const BOT_NAMES = ["ไททันเบรค", "เนบิวล่า-9", "ไอรอนฟาง", "โวลท์ซีโร่", "เครสเซนต์", "ดัสก์วูล์ฟ"];

/* ---------- Animated number ---------- */
function CountUp({ value, className, style }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 450;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}

/* ---------- Power bar row ---------- */
function PowerBar({ label, value, max, color }) {
  const pct = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 flex-shrink-0 text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494", letterSpacing: 0.5 }}>
        {label}
      </span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "#14181F" }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, #2F86FF, ${color})` }}
        />
      </div>
      <CountUp
        value={value}
        className="w-9 flex-shrink-0 text-right"
        style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 14, color: "#E8ECF1" }}
      />
    </div>
  );
}

/* ---------- Elemental FX (poison drip / flame / shock bolt) ---------- */
function DotFX({ dot, x, y }) {
  if (!dot) return null;
  if (dot.label === "พิษ") {
    return (
      <g opacity="0.9">
        <path d={`M${x} ${y} q6 8 0 15 q-6 -7 0 -15 Z`} fill="#8CF07A" />
        <circle cx={x + 6} cy={y + 11} r="2.2" fill="#8CF07A" />
        <circle cx={x - 6} cy={y + 17} r="1.6" fill="#8CF07A" opacity="0.8" />
      </g>
    );
  }
  if (dot.label === "ไฟไหม้") {
    return (
      <g opacity="0.95">
        <path d={`M${x} ${y - 6} q8 6 4 15 q-2 6 -8 4 q-6 -2 -4 -10 q1 -6 8 -9 Z`} fill="#FF7A3D" />
        <path d={`M${x} ${y} q4 4 1 9 q-3 -2 -1 -9 Z`} fill="#FFD24D" />
      </g>
    );
  }
  if (dot.label === "ช็อต") {
    return <path d={`M${x - 4} ${y - 12} L${x + 3} ${y - 12} L${x - 2} ${y} L${x + 5} ${y} L${x - 6} ${y + 16} L${x - 1} ${y + 2} L${x - 8} ${y + 2} Z`} fill="#FFE066" />;
  }
  return null;
}

/* ---------- Robot preview SVG (with part icons + leg variants + elemental FX) ---------- */
function RobotPreview({ equipped, pulseKey, frameColor, decal, decalPos, theme }) {
  const dp = decalPos || { x: 50, y: 69 };
  const fc = frameColor || "#3A4354";
  const th = theme || GARAGE_THEMES[0];
  const c = (part, fallback) => (equipped[part] ? equipped[part].color : fallback);
  const icon = (part) => (equipped[part] ? equipped[part].icon : null);
  const legType = equipped.legs ? equipped.legs.legType || "standard" : null;

  return (
    <svg viewBox="0 0 220 260" className="w-full h-full">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke={th.grid} strokeWidth="1" />
        </pattern>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={th.glow} stopOpacity="0.18" />
          <stop offset="100%" stopColor={th.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="220" height="260" fill={th.bg} />
      <rect width="220" height="260" fill="url(#grid)" />
      <rect width="220" height="260" fill="url(#glow)" />
      {th.stars &&
        [
          [18, 22], [40, 60], [190, 30], [200, 90], [14, 140], [206, 180], [26, 230], [180, 220], [110, 14],
        ].map(([sx, sy], i) => <circle key={i} cx={sx} cy={sy} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity={0.5 + (i % 3) * 0.15} />)}

      {/* legs — shape depends on legType */}
      <g key={"legs" + pulseKey} className={equipped.legs ? "mb-part-in" : ""}>
        {legType === "tracked" && (
          <>
            <rect x="62" y="206" width="96" height="26" rx="13" fill={c("legs", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
            {[80, 98, 116, 134].map((cx) => (
              <circle key={cx} cx={cx} cy="219" r="6" fill="#0A0C10" stroke="#3A4354" strokeWidth="1.5" />
            ))}
          </>
        )}
        {legType === "jet" && (
          <>
            <ellipse cx="89" cy="240" rx="16" ry="6" fill={c("legs", "#47E0D2")} opacity="0.35" className="mb-jet-pulse" />
            <ellipse cx="131" cy="240" rx="16" ry="6" fill={c("legs", "#47E0D2")} opacity="0.35" className="mb-jet-pulse" />
            <rect x="78" y="184" width="20" height="42" rx="8" fill={c("legs", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
            <rect x="122" y="184" width="20" height="42" rx="8" fill={c("legs", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
            <path d="M83 226 q5 10 0 18 q-5 -8 0 -18 Z" fill="#FFE066" opacity="0.85" />
            <path d="M137 226 q5 10 0 18 q-5 -8 0 -18 Z" fill="#FFE066" opacity="0.85" />
          </>
        )}
        {legType === "spring" && (
          <>
            <rect x="82" y="190" width="12" height="50" rx="5" fill={c("legs", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
            <rect x="126" y="190" width="12" height="50" rx="5" fill={c("legs", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
            <path d="M82 196 q12 4 0 8 q-12 4 0 8 q12 4 0 8 q-12 4 0 8" fill="none" stroke={equipped.legs.color} strokeWidth="2" opacity="0.8" />
            <path d="M138 196 q-12 4 0 8 q12 4 0 8 q-12 4 0 8 q12 4 0 8" fill="none" stroke={equipped.legs.color} strokeWidth="2" opacity="0.8" />
          </>
        )}
        {(legType === "standard" || legType === null) && (
          <>
            <rect x="78" y="190" width="22" height="50" rx="6" fill={c("legs", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
            <rect x="120" y="190" width="22" height="50" rx="6" fill={c("legs", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
          </>
        )}
      </g>

      {/* left arm */}
      <g key={"armL" + pulseKey} className={equipped.armL ? "mb-part-in" : ""}>
        <rect x="38" y="118" width="20" height="62" rx="8" fill={c("armL", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
        {icon("armL") && (
          <text x="48" y="146" textAnchor="middle" dominantBaseline="central" fontSize="15">
            {icon("armL")}
          </text>
        )}
        {equipped.armL && equipped.armL.dot && <DotFX dot={equipped.armL.dot} x="48" y="180" />}
      </g>

      {/* right arm */}
      <g key={"armR" + pulseKey} className={equipped.armR ? "mb-part-in" : ""}>
        <rect x="162" y="118" width="20" height="62" rx="8" fill={c("armR", "#2A3140")} stroke="#0A0C10" strokeWidth="2" />
        {icon("armR") && (
          <text x="172" y="146" textAnchor="middle" dominantBaseline="central" fontSize="15">
            {icon("armR")}
          </text>
        )}
        {equipped.armR && equipped.armR.dot && <DotFX dot={equipped.armR.dot} x="172" y="180" />}
      </g>

      {/* core / torso */}
      <g key={"core" + pulseKey} className={equipped.core ? "mb-part-in" : ""}>
        <rect x="66" y="108" width="88" height="88" rx="14" fill={c("core", "#232935")} stroke="#0A0C10" strokeWidth="3" />
        <circle cx="110" cy="152" r="18" fill={c("core", "#3A4354")} stroke={equipped.core ? equipped.core.color : fc} strokeWidth="3" opacity="0.9" />
        {icon("core") && (
          <text x="110" y="152" textAnchor="middle" dominantBaseline="central" fontSize="17">
            {icon("core")}
          </text>
        )}
      </g>

      {/* head — always has a face; gear sits on top like a hat */}
      <g key={"head" + pulseKey} className={equipped.head ? "mb-part-in" : ""}>
        <rect x="80" y="52" width="60" height="52" rx="12" fill={c("head", "#232935")} stroke="#0A0C10" strokeWidth="3" />
        <rect x="92" y="74" width="14" height="8" rx="3" fill={fc} />
        <rect x="114" y="74" width="14" height="8" rx="3" fill={fc} />
        {icon("head") && (
          <>
            <ellipse cx="110" cy="50" rx="24" ry="7" fill="#0A0C10" opacity="0.5" />
            <text x="110" y="42" textAnchor="middle" dominantBaseline="central" fontSize="24">
              {icon("head")}
            </text>
          </>
        )}
      </g>

      {/* weapon in right hand */}
      {equipped.weapon && (
        <g key={"weapon" + pulseKey} className="mb-part-in">
          <text x="185" y="186" textAnchor="middle" dominantBaseline="central" fontSize="24" transform="rotate(22 185 186)">
            {equipped.weapon.icon}
          </text>
          {equipped.weapon.dot && <DotFX dot={equipped.weapon.dot} x="188" y="200" />}
        </g>
      )}

      {/* decal — freely positioned by the player */}
      {decal && decal !== "none" && (
        <g transform={`translate(${(dp.x / 100) * 220}, ${(dp.y / 100) * 260})`}>
          {decal === "01" || decal === "77" || decal === "rx" ? (
            <text textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="800" fill="#E8ECF1" stroke="#0A0C10" strokeWidth="0.6" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {decal === "01" ? "01" : decal === "77" ? "77" : "RX"}
            </text>
          ) : decal === "stripe" ? (
            <path d="M-40 0 L40 0 L34 8 L-34 8 Z" fill={fc} opacity="0.9" />
          ) : decal === "camo" ? (
            <g opacity="0.6">
              <ellipse cx="-16" cy="-4" rx="9" ry="5" fill="#4A5A3A" transform="rotate(-15)" />
              <ellipse cx="4" cy="4" rx="7" ry="4" fill="#5C6B45" transform="rotate(10)" />
              <ellipse cx="14" cy="-6" rx="8" ry="5" fill="#3E4A30" transform="rotate(5)" />
            </g>
          ) : null}
        </g>
      )}

      {["8,8 8,26 M8,8 26,8", "212,8 194,8 M212,8 212,26", "8,252 8,234 M8,252 26,252", "212,252 194,252 M212,252 212,234"].map((d, i) => (
        <path key={i} d={"M" + d} stroke={fc} strokeWidth="2" fill="none" />
      ))}
    </svg>
  );
}

/* ---------- Item cell: icon grid, tap to expand accordion (handles shop lock) ---------- */
/* ---------- Upgrade preview: shows stars, before→after per-stat, and cost ---------- */
function UpgradePreview({ item, stars, coins, onUpgrade }) {
  const maxed = stars >= MAX_STARS;
  const cost = upgradeCost(item, stars);
  const cur = statsAtStars(item, stars);
  const next = maxed ? cur : statsAtStars(item, stars + 1);
  return (
    <div className="mt-2 pt-2" style={{ borderTop: "1px solid #232935" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>
          {"★".repeat(stars)}
          {"☆".repeat(MAX_STARS - stars)}
        </span>
        {!maxed && (
          <span className="text-[9px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
            ราคาอัปเกรดอิงพลังไอเทม
          </span>
        )}
      </div>
      {!maxed && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-2">
          {Object.entries(item.stats).map(([k, v]) => {
            if (cur[k] === next[k]) return null;
            return (
              <span key={k} className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: STAT_COLOR[k] }}>
                {STAT_LABEL[k]} {cur[k]} → {next[k]}
              </span>
            );
          })}
        </div>
      )}
      <button
        onClick={() => onUpgrade(item)}
        disabled={maxed || coins < cost}
        className="w-full py-1.5 rounded-md text-[11px] font-semibold"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          background: maxed ? "#171B22" : coins < cost ? "#171B22" : "#3A2A14",
          color: maxed ? "#3A4354" : coins < cost ? "#3A4354" : "#FFB020",
          border: `1px solid ${maxed || coins < cost ? "#232935" : "#FFB020"}`,
        }}
      >
        {maxed ? "อัปเกรดสูงสุดแล้ว" : `อัปเกรด 🪙 ${cost}`}
      </button>
    </div>
  );
}

function ItemCell({ item, isEquipped, isOpen, owned, coins, upgrades, onToggle, onEquip, onUnequip, onBuy, onUpgrade }) {
  const locked = (item.shop || item.codeOnly || item.gacha) && !owned;
  const shopLocked = item.shop && !owned;
  const codeLocked = item.codeOnly && !owned;
  const gachaLocked = item.gacha && !owned;
  return (
    <div
      className="rounded-lg border overflow-hidden transition-colors"
      style={{
        background: "#14181F",
        borderColor: isEquipped ? "#FFB020" : isOpen ? "#47E0D2" : locked ? "#3A2E14" : "#232935",
        gridColumn: isOpen ? "1 / -1" : "auto",
      }}
    >
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-3 py-3 text-left">
        <div
          className="w-11 h-11 flex-shrink-0 rounded-lg flex items-center justify-center text-2xl relative"
          style={{ background: "#0D1015", border: "1px solid #232935", opacity: locked ? 0.5 : 1 }}
        >
          {item.icon}
          {locked && (
            <span className="absolute -top-1.5 -right-1.5 text-[10px]" style={{ filter: "drop-shadow(0 0 2px #0A0C10)" }}>
              🔒
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: locked ? "#7C8494" : "#E8ECF1" }}>
            {item.name}
          </div>
          {isEquipped ? (
            <div className="text-[9px] tracking-widest mt-0.5" style={{ color: "#FFB020", fontFamily: "'JetBrains Mono', monospace" }}>
              EQUIPPED
            </div>
          ) : shopLocked ? (
            <div className="text-[10px] mt-0.5" style={{ color: "#FFB020", fontFamily: "'JetBrains Mono', monospace" }}>
              🪙 {item.price}
            </div>
          ) : codeLocked ? (
            <div className="text-[10px] mt-0.5" style={{ color: "#B57BFF", fontFamily: "'JetBrains Mono', monospace" }}>
              ต้องใช้โค้ดลับ
            </div>
          ) : gachaLocked ? (
            <div className="text-[10px] mt-0.5" style={{ color: RARITY_COLOR[item.rarity], fontFamily: "'JetBrains Mono', monospace" }}>
              🎰 หากาชา
            </div>
          ) : null}
        </div>
        <span style={{ color: "#3A4354", fontSize: 12, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          ▶
        </span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 mb-part-in">
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 py-2 mb-3 rounded-md" style={{ background: "#0D1015" }}>
            {Object.entries(item.stats).map(([k, v]) => (
              <span key={k} className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: STAT_COLOR[k] }}>
                {v > 0 ? "+" : ""}
                {v} {STAT_LABEL[k]}
              </span>
            ))}
            {item.dot && (
              <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#8CF07A" }}>
                {item.dot.label} {item.dot.perTurn}/เทิร์น
              </span>
            )}
            {item.desc && (
              <span className="text-[11px]" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#7C8494" }}>
                {item.desc}
              </span>
            )}
          </div>
          {codeLocked ? (
            <div className="text-center text-[11px] py-2 rounded-md" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#B57BFF", background: "#1C1430", border: "1px solid #B57BFF" }}>
              🔒 ปลดล็อกด้วยโค้ดลับด้านบน
            </div>
          ) : gachaLocked ? (
            <div className="text-center text-[11px] py-2 rounded-md" style={{ fontFamily: "'Rajdhani', sans-serif", color: RARITY_COLOR[item.rarity], background: "#1C2330", border: `1px solid ${RARITY_COLOR[item.rarity]}` }}>
              🎰 หาได้จากกาชา หรือแลกด้วยชิ้นส่วนที่ร้านค้า
            </div>
          ) : shopLocked ? (
            <button
              onClick={onBuy}
              disabled={coins < item.price}
              className="w-full py-2 rounded-md text-xs font-semibold"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                background: coins < item.price ? "#232935" : "#3A2A14",
                color: coins < item.price ? "#3A4354" : "#FFB020",
                border: `1px solid ${coins < item.price ? "#232935" : "#FFB020"}`,
              }}
            >
              {coins < item.price ? "เหรียญไม่พอ" : `ซื้อ 🪙 ${item.price}`}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onUnequip}
                className="flex-1 py-2 rounded-md text-xs font-semibold"
                style={{ fontFamily: "'Rajdhani', sans-serif", background: "#3A1418", color: "#FF5A4E", border: "1px solid #FF5A4E" }}
              >
                ถอด
              </button>
              <button
                onClick={onEquip}
                className="flex-1 py-2 rounded-md text-xs font-semibold"
                style={{ fontFamily: "'Rajdhani', sans-serif", background: "#123A22", color: "#8CF07A", border: "1px solid #8CF07A" }}
              >
                ใส่
              </button>
            </div>
          )}
          {!locked && <UpgradePreview item={item} stars={(upgrades && upgrades[item.id]) || 0} coins={coins} onUpgrade={onUpgrade} />}
        </div>
      )}
    </div>
  );
}

/* ---------- Mini robot for battle / lobby screens ---------- */
function MiniBot({ equipped, ring, shakeKey, lungeKey, lungeDir, flashKey, frameColor, decal, decalPos }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: 92, height: 108 }}>
      {flashKey ? (
        <div key={"f" + flashKey} className="absolute inset-0 rounded-xl mb-flash" style={{ background: ring, filter: "blur(10px)" }} />
      ) : null}
      <div
        key={"s" + shakeKey + "-l" + lungeKey}
        className={(shakeKey ? "mb-shake " : "") + (lungeKey ? (lungeDir === "right" ? "mb-lunge-r " : "mb-lunge-l ") : "")}
        style={{ width: "100%", height: "100%", borderRadius: 12, background: "#0D1015", border: `2px solid ${ring}`, overflow: "hidden" }}
      >
        <RobotPreview equipped={equipped} pulseKey={0} frameColor={frameColor} decal={decal} decalPos={decalPos} />
      </div>
    </div>
  );
}

/* ---------- Battle overlay ---------- */
function BattleOverlay({ playerEquipped, playerStats, enemyEquipped, enemyName, isBotMatch, isBoss, isBounty, bountyId, frameColor, decal, decalPos, onReward, onBattleEnd, onBountyWin, onClose }) {
  const bounty = isBounty ? BOUNTIES.find((b) => b.id === bountyId) : null;
  const enemy = useMemo(() => {
    const eq = isBoss ? BOSS_EQUIP : enemyEquipped || generateBotEquip();
    const base = sumStats(eq);
    const hpScale = isBoss ? 2.2 + Math.random() * 0.4 : 0.88 + Math.random() * 0.28;
    const atkScale = isBoss ? 1.1 + Math.random() * 0.2 : 0.88 + Math.random() * 0.28;
    const bm = bounty ? bounty.statMult : { atk: 1, def: 1, spd: 1, hp: 1 };
    return {
      name: isBoss ? BOSS_NAME : bounty ? bounty.name : enemyName || pick(BOT_NAMES),
      equipped: eq,
      atk: Math.max(4, Math.round(base.atk * atkScale * bm.atk)),
      def: Math.max(2, Math.round(base.def * hpScale * bm.def)),
      spd: Math.max(2, Math.round(base.spd * hpScale * bm.spd)),
      hpMax: Math.max(20, Math.round(base.hp * hpScale * bm.hp)),
    };
  }, []); // eslint-disable-line

  const weather = useMemo(() => pick(WEATHERS), []);
  const [pHP, setPHP] = useState(playerStats.hp);
  const [eHP, setEHP] = useState(enemy.hpMax);
  const [log, setLog] = useState([
    `คู่ต่อสู้: ${enemy.name} — ถืออาวุธ ${enemy.equipped.weapon ? enemy.equipped.weapon.name + " " + enemy.equipped.weapon.icon : "ไม่มี"}`,
    `${weather.icon} สภาพอากาศ: ${weather.label} — ${weather.desc}`,
  ]);
  const [floats, setFloats] = useState([]);
  const [done, setDone] = useState(null);
  const [reward, setReward] = useState({ coins: 0, shards: 0 });
  const [fx, setFx] = useState({ pShake: 0, eShake: 0, pLunge: 0, eLunge: 0, pFlash: 0, eFlash: 0 });
  const [slash, setSlash] = useState(null);
  const idRef = useRef(0);
  const slashIdRef = useRef(0);
  const runningRef = useRef(false);
  const rewardedRef = useRef(false);

  const addFloat = (side, text, color) => {
    const id = idRef.current++;
    setFloats((f) => [...f, { id, side, text, color }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 800);
  };

  const fireSlash = (dir, emoji) => {
    const id = slashIdRef.current++;
    setSlash({ id, dir, emoji });
    playSFX("hit");
    setTimeout(() => setSlash((s) => (s && s.id === id ? null : s)), 420);
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const getComboFX = (weapon) => {
    if (!weapon) return { type: "multi", hits: 2, perHit: 0.4, label: "หมัดชุด!" };
    if (weapon.dot) return { type: "elemental", label: `${weapon.dot.label}ลุกลาม! (${weapon.name})`, dotBoost: weapon.dot.perTurn };
    if (weapon.cat === "longrange") return { type: "crit", mult: 1.55, label: `จุดอ่อน! (${weapon.name})` };
    if (weapon.cat === "midrange") return { type: "multi", hits: 3, perHit: 0.42, label: `กระหน่ำยิง! (${weapon.name})` };
    return { type: "multi", hits: 3, perHit: 0.42, label: `คอมโบ! (${weapon.name})` };
  };

  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    let curP = playerStats.hp;
    let curE = enemy.hpMax;
    const playerDots = dotSources(playerEquipped);
    const enemyDots = dotSources(enemy.equipped);
    const playerWeaponIcon = playerEquipped.weapon ? playerEquipped.weapon.icon : "👊";
    const enemyWeaponIcon = enemy.equipped.weapon ? enemy.equipped.weapon.icon : "👊";
    const playerFX = getComboFX(playerEquipped.weapon);
    const enemyFX = getComboFX(enemy.equipped.weapon);
    const wAtk = (v) => (weather.id === "lowG" ? Math.round(v * 1.15) : v);
    const wDef = (v) => (weather.id === "acid" ? Math.round(v * 0.85) : v);
    const chip = playerEquipped.chip;
    const defVsEnemy = (v) => {
      let d = wDef(v);
      if (chip && chip.effect === "pierce") d = Math.round(d * 0.8);
      return d;
    };
    const applyReflect = (dmgTaken) => {
      if (chip && chip.effect === "reflect" && dmgTaken > 0 && curE > 0) {
        const refl = Math.max(1, Math.round(dmgTaken * 0.1));
        curE = Math.max(0, curE - refl);
        setEHP(curE);
        addFloat("enemy", "🪞-" + refl, "#7BD8FF");
      }
    };

    const run = async () => {
      await wait(700);
      let turn = playerStats.spd >= enemy.spd ? "player" : "enemy";
      let round = 0;
      let bossTurnCounter = 0;
      const roundCap = isBoss ? 60 : 30;
      while (curP > 0 && curE > 0 && round < roundCap) {
        round++;
        if (weather.id === "emStorm") turn = Math.random() < 0.5 ? "player" : "enemy";
        if (chip && chip.effect === "heal" && curP > 0 && curP / playerStats.hp < 0.3) {
          const healAmt = Math.round(playerStats.hp * 0.05);
          curP = Math.min(playerStats.hp, curP + healAmt);
          setPHP(curP);
          addFloat("player", "💚+" + healAmt, "#8CF07A");
          setLog((l) => [`💚 ชิปฮีลฟื้นฟู +${healAmt}`, ...l].slice(0, 6));
        }
        if (turn === "player") {
          setFx((f) => ({ ...f, pLunge: f.pLunge + 1 }));
          const triggered = Math.random() < 0.1;
          if (triggered && playerFX.type === "multi") {
            setLog((l) => [`✨ ${playerFX.label}`, ...l].slice(0, 6));
            for (let hit = 0; hit < playerFX.hits && curE > 0; hit++) {
              fireSlash("toEnemy", playerWeaponIcon);
              await wait(150);
              const dmg = calcDamage(wAtk(playerStats.atk), defVsEnemy(enemy.def), playerFX.perHit);
              curE = Math.max(0, curE - dmg);
              setEHP(curE);
              addFloat("enemy", "💢 -" + dmg, "#FFB020");
              setFx((f) => ({ ...f, eShake: f.eShake + 1, eFlash: f.eFlash + 1 }));
              await wait(160);
            }
          } else if (triggered && playerFX.type === "crit") {
            setLog((l) => [`✨ ${playerFX.label}`, ...l].slice(0, 6));
            fireSlash("toEnemy", playerWeaponIcon);
            await wait(180);
            const dmg = calcDamage(wAtk(playerStats.atk), defVsEnemy(enemy.def), playerFX.mult);
            curE = Math.max(0, curE - dmg);
            setEHP(curE);
            addFloat("enemy", "🎯 -" + dmg, "#FFB020");
            setFx((f) => ({ ...f, eShake: f.eShake + 1, eFlash: f.eFlash + 1 }));
          } else if (triggered && playerFX.type === "elemental") {
            setLog((l) => [`✨ ${playerFX.label}`, ...l].slice(0, 6));
            fireSlash("toEnemy", playerWeaponIcon);
            await wait(180);
            const dmg = calcDamage(wAtk(playerStats.atk), defVsEnemy(enemy.def));
            curE = Math.max(0, curE - dmg);
            setEHP(curE);
            addFloat("enemy", "💥 -" + dmg, "#FF5A4E");
            setFx((f) => ({ ...f, eShake: f.eShake + 1, eFlash: f.eFlash + 1 }));
            await wait(320);
            curE = Math.max(0, curE - playerFX.dotBoost);
            setEHP(curE);
            addFloat("enemy", "🔥 -" + playerFX.dotBoost, "#8CF07A");
            setFx((f) => ({ ...f, eShake: f.eShake + 1 }));
          } else {
            fireSlash("toEnemy", playerWeaponIcon);
            await wait(180);
            const dmg = calcDamage(wAtk(playerStats.atk), defVsEnemy(enemy.def));
            curE = Math.max(0, curE - dmg);
            setEHP(curE);
            addFloat("enemy", "💥 -" + dmg, "#FF5A4E");
            setFx((f) => ({ ...f, eShake: f.eShake + 1, eFlash: f.eFlash + 1 }));
            setLog((l) => [`หุ่นของคุณโจมตี -${dmg}`, ...l].slice(0, 6));
          }
          await wait(400);
          for (const dot of playerDots) {
            if (curE <= 0) break;
            curE = Math.max(0, curE - dot.perTurn);
            setEHP(curE);
            addFloat("enemy", `${dot.label} -${dot.perTurn}`, "#8CF07A");
            setFx((f) => ({ ...f, eShake: f.eShake + 1 }));
            setLog((l) => [`${dot.label}สร้างความเสียหาย -${dot.perTurn}`, ...l].slice(0, 6));
            await wait(420);
          }
        } else {
          setFx((f) => ({ ...f, eLunge: f.eLunge + 1 }));
          if (isBoss) {
            bossTurnCounter++;
            const isBigHit = bossTurnCounter % 3 === 0;
            if (!isBigHit) {
              setLog((l) => [`🐲 ${enemy.name}กำลังสะสมพลัง...`, ...l].slice(0, 6));
              await wait(500);
            } else {
              fireSlash("toPlayer", enemyWeaponIcon);
              await wait(180);
              const base = calcDamage(wAtk(enemy.atk), wDef(playerStats.def));
              const capped = Math.min(base, Math.round(playerStats.hp * 0.28));
              const dmg = Math.max(4, capped);
              curP = Math.max(0, curP - dmg);
              setPHP(curP);
              addFloat("player", "💥 -" + dmg, "#FF5A4E");
              setFx((f) => ({ ...f, pShake: f.pShake + 1, pFlash: f.pFlash + 1 }));
              setLog((l) => [`🐲 ${enemy.name}ฟาดสุดพลัง! -${dmg}`, ...l].slice(0, 6));
              applyReflect(dmg);
            }
          } else if ((() => {
            const triggered = Math.random() < 0.1;
            return triggered && enemyFX.type === "multi";
          })()) {
            setLog((l) => [`✨ ${enemy.name}: ${enemyFX.label}`, ...l].slice(0, 6));
            for (let hit = 0; hit < enemyFX.hits && curP > 0; hit++) {
              fireSlash("toPlayer", enemyWeaponIcon);
              await wait(150);
              const dmg = calcDamage(wAtk(enemy.atk), wDef(playerStats.def), enemyFX.perHit);
              curP = Math.max(0, curP - dmg);
              setPHP(curP);
              addFloat("player", "💢 -" + dmg, "#FFB020");
              setFx((f) => ({ ...f, pShake: f.pShake + 1, pFlash: f.pFlash + 1 }));
              await wait(160);
            }
          } else if (enemyFX.type === "crit" && Math.random() < 0.1) {
            setLog((l) => [`✨ ${enemy.name}: ${enemyFX.label}`, ...l].slice(0, 6));
            fireSlash("toPlayer", enemyWeaponIcon);
            await wait(180);
            const dmg = calcDamage(wAtk(enemy.atk), wDef(playerStats.def), enemyFX.mult);
            curP = Math.max(0, curP - dmg);
            setPHP(curP);
            addFloat("player", "🎯 -" + dmg, "#FFB020");
            setFx((f) => ({ ...f, pShake: f.pShake + 1, pFlash: f.pFlash + 1 }));
            applyReflect(dmg);
          } else if (enemyFX.type === "elemental" && Math.random() < 0.1) {
            setLog((l) => [`✨ ${enemy.name}: ${enemyFX.label}`, ...l].slice(0, 6));
            fireSlash("toPlayer", enemyWeaponIcon);
            await wait(180);
            const dmg = calcDamage(wAtk(enemy.atk), wDef(playerStats.def));
            curP = Math.max(0, curP - dmg);
            setPHP(curP);
            addFloat("player", "💥 -" + dmg, "#FF5A4E");
            setFx((f) => ({ ...f, pShake: f.pShake + 1, pFlash: f.pFlash + 1 }));
            applyReflect(dmg);
            await wait(320);
            curP = Math.max(0, curP - enemyFX.dotBoost);
            setPHP(curP);
            addFloat("player", "🔥 -" + enemyFX.dotBoost, "#8CF07A");
            setFx((f) => ({ ...f, pShake: f.pShake + 1 }));
          } else {
            fireSlash("toPlayer", enemyWeaponIcon);
            await wait(180);
            const dmg = calcDamage(wAtk(enemy.atk), wDef(playerStats.def));
            curP = Math.max(0, curP - dmg);
            setPHP(curP);
            addFloat("player", "💥 -" + dmg, "#FF5A4E");
            setFx((f) => ({ ...f, pShake: f.pShake + 1, pFlash: f.pFlash + 1 }));
            setLog((l) => [`${enemy.name}โจมตี -${dmg}`, ...l].slice(0, 6));
            applyReflect(dmg);
          }
          await wait(400);
          if (!isBoss) {
            for (const dot of enemyDots) {
              if (curP <= 0) break;
              curP = Math.max(0, curP - dot.perTurn);
              setPHP(curP);
              addFloat("player", `${dot.label} -${dot.perTurn}`, "#8CF07A");
              setFx((f) => ({ ...f, pShake: f.pShake + 1 }));
              setLog((l) => [`${dot.label}สร้างความเสียหาย -${dot.perTurn}`, ...l].slice(0, 6));
              await wait(420);
            }
          }
        }
        turn = turn === "player" ? "enemy" : "player";
      }
      await wait(300);
      const result = curP > 0 ? "win" : "lose";
      setDone(result);
      playSFX(result === "win" ? "win" : "lose");
      onBattleEnd && onBattleEnd(result, enemy.name);
      if (result === "win" && (isBotMatch || isBoss || isBounty) && !rewardedRef.current) {
        rewardedRef.current = true;
        const coinAmt = isBoss ? 100 + Math.floor(Math.random() * 41) : isBounty ? bounty.reward.coins : 20 + Math.floor(Math.random() * 16);
        const shardAmt = isBoss ? 6 + Math.floor(Math.random() * 5) : isBounty ? bounty.reward.shards : Math.random() < 0.4 ? 1 + Math.floor(Math.random() * 3) : 0;
        setReward({ coins: coinAmt, shards: shardAmt });
        onReward && onReward(coinAmt, shardAmt);
        if (isBounty) onBountyWin && onBountyWin();
      }
    };
    run();
  }, []); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border p-5 relative overflow-hidden" style={{ background: "#0F1319", borderColor: "#232935" }}>
        <div className="text-center text-sm tracking-[0.2em] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>
          สนามต่อสู้
        </div>
        <div className="text-center text-[11px] mb-3" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: weather.id === "clear" ? "#3A4354" : "#FFB020" }}>
          {weather.icon} {weather.label}
        </div>

        {slash && (
          <div
            key={slash.id}
            className={slash.dir === "toEnemy" ? "mb-slash-r" : "mb-slash-l"}
            style={{ position: "absolute", top: "16%", fontSize: 24, zIndex: 10 }}
          >
            {slash.emoji}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mb-3">
          <MiniBot equipped={playerEquipped} ring="#47E0D2" shakeKey={fx.pShake} lungeKey={fx.pLunge} lungeDir="right" flashKey={fx.pFlash} frameColor={frameColor} decal={decal} decalPos={decalPos} />
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#3A4354", fontSize: 13 }}>VS</span>
          <MiniBot equipped={enemy.equipped} ring="#FF5A4E" shakeKey={fx.eShake} lungeKey={fx.eLunge} lungeDir="left" flashKey={fx.eFlash} />
        </div>

        <div className="mb-2 relative">
          <div className="flex justify-between text-xs mb-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#E8ECF1" }}>
            <span className="font-semibold">หุ่นของคุณ</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{pHP}/{playerStats.hp}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "#1C2330" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(pHP / playerStats.hp) * 100}%`, background: "#47E0D2" }} />
          </div>
          {floats.filter((f) => f.side === "player").map((f) => (
            <span key={f.id} className="mb-float" style={{ color: f.color }}>{f.text}</span>
          ))}
        </div>

        <div className="mb-3 relative">
          <div className="flex justify-between text-xs mb-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#E8ECF1" }}>
            <span className="font-semibold">{enemy.name}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{eHP}/{enemy.hpMax}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "#1C2330" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(eHP / enemy.hpMax) * 100}%`, background: "#FF5A4E" }} />
          </div>
          {floats.filter((f) => f.side === "enemy").map((f) => (
            <span key={f.id} className="mb-float" style={{ color: f.color }}>{f.text}</span>
          ))}
        </div>

        <div
          className="h-20 overflow-y-auto rounded-lg border px-3 py-2 mb-4 text-xs space-y-1"
          style={{ background: "#0A0C10", borderColor: "#232935", fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}
        >
          {log.map((l, i) => (
            <div key={i} style={{ opacity: 1 - i * 0.13 }}>{l}</div>
          ))}
        </div>

        {done && (
          <div className="text-center mb-4">
            <div className="text-lg tracking-wide" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: done === "win" ? "#8CF07A" : "#FF5A4E" }}>
              {done === "win" ? "ชนะ!" : "พ่ายแพ้"}
            </div>
            {reward.coins > 0 && (
              <div className="text-xs mt-1 space-x-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>
                <span>+{reward.coins} 🪙</span>
                {reward.shards > 0 && <span style={{ color: "#7BD8FF" }}>+{reward.shards} 🔩</span>}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          disabled={!done}
          className="w-full py-3 rounded-lg text-sm tracking-wide font-semibold transition-opacity"
          style={{ background: done ? "#FFB020" : "#232935", color: done ? "#0A0C10" : "#7C8494", fontFamily: "'Rajdhani', sans-serif", opacity: done ? 1 : 0.7 }}
        >
          {done ? "ปิด" : "กำลังต่อสู้..."}
        </button>
      </div>
    </div>
  );
}

/* ---------- Gacha claw machine ---------- */
const CAPSULE_COLORS = ["#FF6B6B", "#FFD166", "#06D6A0", "#4D96FF", "#FF6FB5", "#9B5DE5"];

function GachaMachine({ coins, onPull }) {
  const [phase, setPhase] = useState("idle"); // idle | coin | descend | grab | ascend | move | release | opening | revealed
  const [result, setResult] = useState(null);
  const floatingCapsules = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        id: i,
        color: CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)],
        left: 6 + Math.random() * 74,
        top: 14 + Math.random() * 46,
        rot: -14 + Math.random() * 28,
        delay: Math.random() * 2,
        dur: 2.6 + Math.random() * 1.6,
      })),
    [phase === "idle"]
  );

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const doPull = async () => {
    if (coins < GACHA_COST || phase !== "idle") return;
    const res = onPull();
    if (!res) return;
    setResult(res);
    setPhase("coin");
    await wait(550);
    setPhase("descend");
    await wait(780);
    setPhase("grab");
    await wait(300);
    setPhase("ascend");
    await wait(780);
    setPhase("move");
    await wait(650);
    setPhase("release");
    await wait(550);
    setPhase("opening");
    await wait(450);
    setPhase("revealed");
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
  };

  const holding = phase === "grab" || phase === "ascend" || phase === "move";
  const inChute = phase === "release" || phase === "opening" || phase === "revealed";
  const opened = phase === "opening" || phase === "revealed";
  const capsuleColor = result ? RARITY_COLOR[result.item.rarity] : "#47E0D2";

  let clawTransform = "translate(-50%, -34px)";
  if (phase === "descend" || phase === "grab") clawTransform = "translate(-50%, 60px)";
  else if (phase === "ascend") clawTransform = "translate(-50%, -20px)";
  else if (phase === "move" || phase === "release") clawTransform = "translate(calc(-50% + 55px), -20px)";

  return (
    <div className="space-y-3">
      <div className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
        หยอดเหรียญ {GACHA_COST} 🪙 ต่อครั้ง เพื่อลุ้นอุปกรณ์พิเศษที่หาจากร้านค้าปกติไม่ได้ — ได้ของซ้ำจะแปลงเป็นเศษกลไกให้แทน
      </div>

      <div
        className="relative overflow-hidden"
        style={{ height: 210, background: "linear-gradient(180deg,#12161D,#070809)", borderRadius: 18, border: "2px solid #232935" }}
      >
        {/* dome */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: "12%",
            right: "12%",
            top: 8,
            height: 118,
            borderRadius: "50% 50% 46% 46% / 60% 60% 40% 40%",
            background: "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.18), rgba(190,225,255,0.05) 45%, rgba(30,40,55,0.3) 100%)",
            border: "3px solid #3A4354",
          }}
        >
          {floatingCapsules.map((c) => (
            <div
              key={c.id}
              className="mb-bob absolute rounded-full overflow-hidden"
              style={{
                width: 20,
                height: 20,
                left: `${c.left}%`,
                top: `${c.top}%`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.dur}s`,
                boxShadow: "0 2px 3px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "52%", background: c.color }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "52%", background: "#f4f4f4" }} />
            </div>
          ))}

          {/* claw */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              transform: clawTransform,
              transition: "transform 0.72s cubic-bezier(.65,0,.35,1)",
            }}
          >
            <div style={{ width: 3, height: 22, background: "#7e8494", margin: "0 auto", borderRadius: 2 }} />
            <div style={{ position: "relative", width: 32, height: 18 }}>
              <div
                style={{
                  position: "absolute", top: 0, left: 2, width: 7, height: 22,
                  background: "linear-gradient(180deg,#9aa0ab,#3A4354)", borderRadius: 4,
                  transformOrigin: "top center",
                  transform: holding ? "rotate(-6deg)" : "rotate(-30deg)",
                  transition: "transform 0.3s ease",
                }}
              />
              <div
                style={{
                  position: "absolute", top: 0, right: 2, width: 7, height: 22,
                  background: "linear-gradient(180deg,#9aa0ab,#3A4354)", borderRadius: 4,
                  transformOrigin: "top center",
                  transform: holding ? "rotate(6deg)" : "rotate(30deg)",
                  transition: "transform 0.3s ease",
                }}
              />
              {holding && (
                <div
                  className="absolute rounded-full overflow-hidden"
                  style={{ top: 18, left: "50%", transform: "translateX(-50%)", width: 24, height: 24, boxShadow: "0 2px 4px rgba(0,0,0,0.4)" }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "52%", background: capsuleColor }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "52%", background: "#f4f4f4" }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* coin slot + drop */}
        <div className="absolute" style={{ left: "50%", top: 130, transform: "translateX(-50%)" }}>
          <div style={{ width: 30, height: 6, background: "#0d0f14", borderRadius: 3 }} />
          {phase === "coin" && (
            <div
              className="mb-coin-drop absolute rounded-full"
              style={{
                left: "50%", top: -34, width: 12, height: 12, marginLeft: -6,
                background: "radial-gradient(circle at 35% 30%, #fff6d5, #FFD166 60%, #b8860b 100%)",
              }}
            />
          )}
        </div>

        {/* chute */}
        <div
          className="absolute flex items-end justify-center overflow-hidden"
          style={{ left: "50%", bottom: 10, transform: "translateX(-50%)", width: 70, height: 46, background: "#0d0f14", border: "2px solid #000", borderTop: "none", borderRadius: "0 0 8px 8px" }}
        >
          <div
            className="relative mb-2"
            style={{
              width: 28, height: 28,
              transform: inChute ? "translateY(0)" : "translateY(-70px)",
              opacity: inChute ? 1 : 0,
              transition: "transform 0.5s cubic-bezier(.34,1.56,.64,1), opacity 0.2s ease",
            }}
          >
            <div
              style={{
                position: "absolute", left: 0, top: 0, width: 28, height: 14, overflow: "hidden",
                background: capsuleColor, borderRadius: "28px 28px 0 0",
                transform: opened ? "translateY(-11px) rotate(-22deg)" : "none",
                transition: "transform 0.45s ease",
              }}
            />
            <div
              style={{
                position: "absolute", left: 0, bottom: 0, width: 28, height: 14, overflow: "hidden",
                background: "#f4f4f4", borderRadius: "0 0 28px 28px",
                transform: opened ? "translateY(11px) rotate(18deg)" : "none",
                transition: "transform 0.45s ease",
              }}
            />
            {opened && result && (
              <div
                className="mb-part-in absolute"
                style={{ top: -6, left: "50%", transform: "translateX(-50%)", fontSize: 20 }}
              >
                {result.item.icon}
              </div>
            )}
          </div>
        </div>

        {phase === "revealed" && <div className="absolute inset-0 mb-sparkle-fade pointer-events-none" style={{ background: "radial-gradient(circle at 50% 80%, rgba(255,224,102,0.3), transparent 60%)" }} />}
      </div>

      {phase === "revealed" && result && (
        <div className="rounded-lg border p-3 mb-part-in" style={{ borderColor: RARITY_COLOR[result.item.rarity], background: "#14181F" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#E8ECF1" }}>{result.item.name}</span>
            <span className="text-[9px] uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: RARITY_COLOR[result.item.rarity] }}>{result.item.rarity}</span>
          </div>
          {result.duplicate ? (
            <div className="text-xs" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#7BD8FF" }}>ได้ซ้ำ! แปลงเป็นเศษกลไก +2 🔩</div>
          ) : (
            <div className="text-xs" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#8CF07A" }}>ปลดล็อกใหม่! เด้งเข้าหมวด "{result.item.slotLabel}" แล้ว</div>
          )}
        </div>
      )}

      <button
        onClick={phase === "revealed" ? reset : doPull}
        disabled={phase !== "idle" && phase !== "revealed" || (phase === "idle" && coins < GACHA_COST)}
        className="w-full py-3 rounded-lg text-sm font-bold tracking-wide"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          background: phase !== "idle" && phase !== "revealed" ? "#232935" : "#3A2A14",
          color: phase !== "idle" && phase !== "revealed" ? "#3A4354" : coins < GACHA_COST && phase === "idle" ? "#3A4354" : "#FFB020",
          border: `1px solid ${phase !== "idle" && phase !== "revealed" ? "#232935" : "#FFB020"}`,
        }}
      >
        {phase === "revealed" ? "หยอดอีกครั้ง" : phase !== "idle" ? "กำลังคีบ..." : coins < GACHA_COST ? "เหรียญไม่พอ" : `หยอดเหรียญ 🪙 ${GACHA_COST}`}
      </button>
    </div>
  );
}


/* ---------- Shard exchange: unlock any locked item with mechanism shards ---------- */
function ShardExchange({ shards, owned, onRedeem }) {
  const locked = LOCKED_ITEMS.filter((i) => !owned.includes(i.id));
  return (
    <div className="space-y-3">
      <div className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
        เก็บเศษกลไกจากการชนะบอท แลก 2 ชิ้นเพื่อปลดล็อกไอเทมล็อกอะไรก็ได้ที่คุณเลือกเอง (ของร้านค้า / โค้ด / กาชา)
      </div>
      {locked.length === 0 ? (
        <div className="text-xs" style={{ color: "#8CF07A", fontFamily: "'Rajdhani', sans-serif" }}>ปลดล็อกครบทุกไอเทมแล้ว!</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {locked.map((item) => (
            <div key={item.id} className="rounded-lg border p-3" style={{ borderColor: "#232935", background: "#14181F" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-2" style={{ background: "#0D1015", border: "1px solid #232935" }}>
                {item.icon}
              </div>
              <div className="text-[12px] mb-0.5" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: "#E8ECF1" }}>{item.name}</div>
              <div className="text-[9px] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>{item.slotLabel || ""}</div>
              <button
                onClick={() => onRedeem(item)}
                disabled={shards < 2}
                className="w-full py-1.5 rounded-md text-[11px] font-semibold"
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  background: shards < 2 ? "#232935" : "#0F2A3A",
                  color: shards < 2 ? "#3A4354" : "#7BD8FF",
                  border: `1px solid ${shards < 2 ? "#232935" : "#7BD8FF"}`,
                }}
              >
                แลก 2 🔩
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Endless Survival Mode: fight bots back-to-back, HP carries over ---------- */
function EndlessOverlay({ playerEquipped, playerStats, frameColor, decal, decalPos, onReward, onBattleEnd, onClose }) {
  const [curHP, setCurHP] = useState(playerStats.hp);
  const [wave, setWave] = useState(1);
  const [enemy, setEnemy] = useState(null);
  const [eHP, setEHP] = useState(0);
  const [log, setLog] = useState(["โหมดไร้ขีดจำกัดเริ่มขึ้น!"]);
  const [floats, setFloats] = useState([]);
  const [fx, setFx] = useState({ pShake: 0, eShake: 0, pLunge: 0, eLunge: 0, pFlash: 0, eFlash: 0 });
  const [slash, setSlash] = useState(null);
  const [dead, setDead] = useState(false);
  const [totals, setTotals] = useState({ coins: 0, shards: 0 });
  const idRef = useRef(0);
  const slashIdRef = useRef(0);
  const runningRef = useRef(false);
  const rewardedRef = useRef(false);

  const addFloat = (side, text, color) => {
    const id = idRef.current++;
    setFloats((f) => [...f, { id, side, text, color }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 800);
  };
  const fireSlash = (dir, emoji) => {
    const id = slashIdRef.current++;
    setSlash({ id, dir, emoji });
    playSFX("hit");
    setTimeout(() => setSlash((s) => (s && s.id === id ? null : s)), 420);
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    const runWave = async (waveNum, hpStart) => {
      const scale = 0.75 + waveNum * 0.09;
      const eq = generateBotEquip();
      const base = sumStats(eq);
      const foe = {
        name: `${pick(BOT_NAMES)} Lv.${waveNum}`,
        equipped: eq,
        atk: Math.max(4, Math.round(base.atk * scale)),
        def: Math.max(2, Math.round(base.def * scale)),
        spd: Math.max(2, Math.round(base.spd * scale)),
        hpMax: Math.max(18, Math.round(base.hp * scale)),
      };
      setEnemy(foe);
      setEHP(foe.hpMax);
      setLog((l) => [`🔥 รอบที่ ${waveNum}: เจอ ${foe.name}`, ...l].slice(0, 6));

      let curP = hpStart;
      let curE = foe.hpMax;
      const playerWeaponIcon = playerEquipped.weapon ? playerEquipped.weapon.icon : "👊";
      const enemyWeaponIcon = foe.equipped.weapon ? foe.equipped.weapon.icon : "👊";
      const playerDots = dotSources(playerEquipped);
      const enemyDots = dotSources(foe.equipped);

      await wait(500);
      let turn = playerStats.spd >= foe.spd ? "player" : "enemy";
      let round = 0;
      while (curP > 0 && curE > 0 && round < 25) {
        round++;
        if (turn === "player") {
          setFx((f) => ({ ...f, pLunge: f.pLunge + 1 }));
          fireSlash("toEnemy", playerWeaponIcon);
          await wait(180);
          const dmg = calcDamage(playerStats.atk, foe.def);
          curE = Math.max(0, curE - dmg);
          setEHP(curE);
          addFloat("enemy", "💥 -" + dmg, "#FF5A4E");
          setFx((f) => ({ ...f, eShake: f.eShake + 1, eFlash: f.eFlash + 1 }));
          await wait(380);
          for (const dot of playerDots) {
            if (curE <= 0) break;
            curE = Math.max(0, curE - dot.perTurn);
            setEHP(curE);
            addFloat("enemy", `${dot.label} -${dot.perTurn}`, "#8CF07A");
            await wait(300);
          }
        } else {
          setFx((f) => ({ ...f, eLunge: f.eLunge + 1 }));
          fireSlash("toPlayer", enemyWeaponIcon);
          await wait(180);
          const dmg = calcDamage(foe.atk, playerStats.def);
          curP = Math.max(0, curP - dmg);
          setCurHP(curP);
          addFloat("player", "💥 -" + dmg, "#FF5A4E");
          setFx((f) => ({ ...f, pShake: f.pShake + 1, pFlash: f.pFlash + 1 }));
          await wait(380);
          for (const dot of enemyDots) {
            if (curP <= 0) break;
            curP = Math.max(0, curP - dot.perTurn);
            setCurHP(curP);
            addFloat("player", `${dot.label} -${dot.perTurn}`, "#8CF07A");
            await wait(300);
          }
        }
        turn = turn === "player" ? "enemy" : "player";
      }

      if (curP <= 0) {
        setLog((l) => [`💀 หุ่นของคุณพังที่รอบ ${waveNum}`, ...l].slice(0, 6));
        playSFX("lose");
        onBattleEnd && onBattleEnd("lose", "Endless Run");
        setDead(true);
        return;
      }
      const waveCoin = 8 + waveNum * 2;
      setTotals((t) => {
        const n = { coins: t.coins + waveCoin, shards: t.shards + (waveNum % 3 === 0 ? 1 : 0) };
        return n;
      });
      onReward && onReward(waveCoin, waveNum % 3 === 0 ? 1 : 0);
      onBattleEnd && onBattleEnd("win", foe.name);
      playSFX("claim");
      setLog((l) => [`✅ ผ่านรอบ ${waveNum}! +${waveCoin} 🪙`, ...l].slice(0, 6));
      await wait(700);
      setWave(waveNum + 1);
      runWave(waveNum + 1, curP);
    };

    runWave(1, playerStats.hp);
  }, []); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border p-5 relative overflow-hidden" style={{ background: "#0F1319", borderColor: "#232935" }}>
        <div className="text-center text-sm tracking-[0.2em] mb-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>
          🔥 ไร้ขีดจำกัด — รอบที่ {wave}
        </div>

        {slash && (
          <div key={slash.id} className={slash.dir === "toEnemy" ? "mb-slash-r" : "mb-slash-l"} style={{ position: "absolute", top: "16%", fontSize: 24, zIndex: 10 }}>
            {slash.emoji}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mb-3">
          <MiniBot equipped={playerEquipped} ring="#47E0D2" shakeKey={fx.pShake} lungeKey={fx.pLunge} lungeDir="right" flashKey={fx.pFlash} frameColor={frameColor} decal={decal} decalPos={decalPos} />
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#3A4354", fontSize: 13 }}>VS</span>
          {enemy && <MiniBot equipped={enemy.equipped} ring="#FF5A4E" shakeKey={fx.eShake} lungeKey={fx.eLunge} lungeDir="left" flashKey={fx.eFlash} />}
        </div>

        <div className="mb-2 relative">
          <div className="flex justify-between text-xs mb-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#E8ECF1" }}>
            <span className="font-semibold">หุ่นของคุณ</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{curHP}/{playerStats.hp}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "#1C2330" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(curHP / playerStats.hp) * 100}%`, background: "#47E0D2" }} />
          </div>
          {floats.filter((f) => f.side === "player").map((f) => (
            <span key={f.id} className="mb-float" style={{ color: f.color }}>{f.text}</span>
          ))}
        </div>

        {enemy && (
          <div className="mb-3 relative">
            <div className="flex justify-between text-xs mb-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#E8ECF1" }}>
              <span className="font-semibold">{enemy.name}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{eHP}/{enemy.hpMax}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "#1C2330" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(eHP / enemy.hpMax) * 100}%`, background: "#FF5A4E" }} />
            </div>
            {floats.filter((f) => f.side === "enemy").map((f) => (
              <span key={f.id} className="mb-float" style={{ color: f.color }}>{f.text}</span>
            ))}
          </div>
        )}

        <div
          className="h-20 overflow-y-auto rounded-lg border px-3 py-2 mb-4 text-xs space-y-1"
          style={{ background: "#0A0C10", borderColor: "#232935", fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}
        >
          {log.map((l, i) => (
            <div key={i} style={{ opacity: 1 - i * 0.13 }}>{l}</div>
          ))}
        </div>

        {dead && (
          <div className="text-center mb-4">
            <div className="text-lg tracking-wide" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#FF5A4E" }}>
              ไปได้ถึงรอบที่ {wave}
            </div>
            <div className="text-xs mt-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>
              รวม +{totals.coins} 🪙 {totals.shards > 0 ? `+${totals.shards} 🔩` : ""}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          disabled={!dead}
          className="w-full py-3 rounded-lg text-sm tracking-wide font-semibold transition-opacity"
          style={{ background: dead ? "#FFB020" : "#232935", color: dead ? "#0A0C10" : "#7C8494", fontFamily: "'Rajdhani', sans-serif", opacity: dead ? 1 : 0.7 }}
        >
          {dead ? "ปิด" : "กำลังต่อสู้..."}
        </button>
      </div>
    </div>
  );
}

/* ---------- Shop screen ---------- */
function ShopScreen({ coins, owned, shards, onBuy, onGachaPull, onShardRedeem }) {
  const [tab, setTab] = useState("buy");
  return (
    <div className="px-4 py-4 space-y-4 pb-8">
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border px-3 py-2 flex items-center justify-between" style={{ borderColor: "#171B22", background: "#0D1015" }}>
          <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>เหรียญ</span>
          <span className="text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>🪙 {coins}</span>
        </div>
        <div className="flex-1 rounded-lg border px-3 py-2 flex items-center justify-between" style={{ borderColor: "#171B22", background: "#0D1015" }}>
          <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>ชิ้นส่วน</span>
          <span className="text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7BD8FF" }}>🔩 {shards}</span>
        </div>
      </div>

      <div className="flex gap-2">
        {[{ id: "buy", label: "ซื้อของ" }, { id: "gacha", label: "กาชา" }, { id: "shard", label: "แลกชิ้นส่วน" }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold border"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              background: tab === t.id ? "#1C2330" : "transparent",
              color: tab === t.id ? "#47E0D2" : "#7C8494",
              borderColor: tab === t.id ? "#47E0D2" : "#232935",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "buy" && (
        <>
          <div className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
            ชนะบอทในสนามต่อสู้เพื่อรับเหรียญ แล้วนำมาซื้ออุปกรณ์ที่นี่เพื่ออัปเกรดหุ่นของคุณ
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SHOP_ITEMS.map((item) => {
              const isOwned = owned.includes(item.id);
              return (
                <div key={item.id} className="rounded-lg border p-3" style={{ borderColor: isOwned ? "#FFB020" : "#232935", background: "#14181F" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: "#0D1015", border: "1px solid #232935" }}>
                      {item.icon}
                    </div>
                    {isOwned && <span className="text-[9px]" style={{ color: "#FFB020", fontFamily: "'JetBrains Mono', monospace" }}>มีแล้ว</span>}
                  </div>
                  <div className="text-[12px] mb-0.5" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: "#E8ECF1" }}>{item.name}</div>
                  <div className="text-[9px] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>{item.slotLabel}</div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-2">
                    {Object.entries(item.stats).map(([k, v]) => (
                      <span key={k} className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: STAT_COLOR[k] }}>
                        +{v} {STAT_LABEL[k]}
                      </span>
                    ))}
                  </div>
                  {!isOwned && (
                    <button
                      onClick={() => onBuy(item)}
                      disabled={coins < item.price}
                      className="w-full py-1.5 rounded-md text-[11px] font-semibold"
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        background: coins < item.price ? "#232935" : "#3A2A14",
                        color: coins < item.price ? "#3A4354" : "#FFB020",
                        border: `1px solid ${coins < item.price ? "#232935" : "#FFB020"}`,
                      }}
                    >
                      🪙 {item.price}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "gacha" && <GachaMachine coins={coins} onPull={onGachaPull} />}
      {tab === "shard" && <ShardExchange shards={shards} owned={owned} onRedeem={onShardRedeem} />}
    </div>
  );
}

/* ---------- Social / Friends / Online screen ---------- */
function SocialScreen({ profile, onSignOut, friends, onAddFriend, equipped, frameColor, decal, decalPos, onBattle, winCount, battleStats, legendaryCount, atk, achievementsClaimed, selectedTitle, onClaimAchievement, onSelectTitle }) {
  const [findCode, setFindCode] = useState("");
  const [findResult, setFindResult] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };

  const publishBuild = useCallback(
    async (prof) => {
      try {
        await storage.set("players:" + prof.code, JSON.stringify({ name: prof.name, equipped, updatedAt: Date.now() }), true);
      } catch (e) {}
    },
    [equipped]
  );

  const handleSync = async () => {
    if (!profile) return;
    await publishBuild(profile);
    showToast("ซิงค์ข้อมูลหุ่นล่าสุดแล้ว");
  };

  const handleFindFriend = async () => {
    const code = findCode.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await storage.get("players:" + code, true);
      const data = JSON.parse(r.value);
      setFindResult({ status: "found", code, data });
    } catch (e) {
      setFindResult({ status: "notfound", code });
    }
  };

  const handleAddFriend = () => {
    if (!findResult || findResult.status !== "found") return;
    if (friends.some((f) => f.code === findResult.code)) {
      showToast("เพิ่มเพื่อนคนนี้ไว้แล้ว");
      return;
    }
    onAddFriend({ code: findResult.code, name: findResult.data.name });
    showToast("เพิ่มเพื่อนแล้ว");
  };

  const handleChallengeFriend = async (friend) => {
    try {
      const r = await storage.get("players:" + friend.code, true);
      const data = JSON.parse(r.value);
      onBattle(data.equipped, data.name);
    } catch (e) {
      showToast("หาข้อมูลหุ่นของเพื่อนไม่เจอ (อาจยังไม่เคยซิงค์)");
    }
  };

  const handleCreateRoom = async () => {
    if (!profile) return;
    const code = genCode("RM");
    try {
      await storage.set("rooms:" + code, JSON.stringify({ name: profile.name, equipped, createdAt: Date.now() }), true);
      setRoomCode(code);
      showToast("สร้างห้องแล้ว ส่งโค้ดนี้ให้เพื่อน");
    } catch (e) {
      showToast("สร้างห้องไม่สำเร็จ");
    }
  };

  const handleJoinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await storage.get("rooms:" + code, true);
      const data = JSON.parse(r.value);
      setJoinMsg("");
      onBattle(data.equipped, data.name);
    } catch (e) {
      setJoinMsg("ไม่พบห้องนี้ ลองตรวจสอบโค้ดอีกครั้ง");
    }
  };

  const labelStyle = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3A4354", letterSpacing: 1 };
  const sectionTitle = (t) => (
    <div className="text-[11px] mb-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
      {t}
    </div>
  );

  return (
    <div className="px-4 py-4 space-y-5 pb-8">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs" style={{ background: "#123A22", color: "#8CF07A", fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div>
        {sectionTitle("โปรไฟล์")}
        <div className="rounded-lg border p-3 flex gap-3 items-center" style={{ borderColor: "#171B22", background: "#0D1015" }}>
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="" className="rounded-lg flex-shrink-0" style={{ width: 64, height: 76, objectFit: "cover", border: "1px solid #232935" }} />
          ) : (
            <div className="rounded-lg overflow-hidden flex-shrink-0" style={{ width: 64, height: 76, background: "#14181F", border: "1px solid #232935" }}>
              <RobotPreview equipped={equipped} pulseKey={0} frameColor={frameColor} decal={decal} decalPos={decalPos} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[15px] truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#E8ECF1" }}>
              {profile.name}
            </div>
            {selectedTitle && (
              <div className="text-[10px] mb-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>
                『{selectedTitle}』
              </div>
            )}
            <div className="text-[11px]" style={{ ...labelStyle, color: "#47E0D2" }}>{profile.code}</div>
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleSync}
                className="text-[10px] px-2 py-1 rounded-md"
                style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, background: "#1C2330", color: "#7C8494", border: "1px solid #232935" }}
              >
                ซิงค์หุ่นล่าสุด
              </button>
              <button
                onClick={onSignOut}
                className="text-[10px] px-2 py-1 rounded-md"
                style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, background: "#1C2330", color: "#FF5A4E", border: "1px solid #232935" }}
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </div>

      {profile && (
        <>
          <div>
            {sectionTitle("สถิติการต่อสู้")}
            <div className="rounded-lg border p-3" style={{ borderColor: "#171B22", background: "#0D1015" }}>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#8CF07A" }}>{battleStats.wins}</div>
                  <div className="text-[9px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>ชนะ</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FF5A4E" }}>{battleStats.losses}</div>
                  <div className="text-[9px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>แพ้</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#47E0D2" }}>
                    {battleStats.wins + battleStats.losses > 0 ? Math.round((battleStats.wins / (battleStats.wins + battleStats.losses)) * 100) : 0}%
                  </div>
                  <div className="text-[9px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>อัตราชนะ</div>
                </div>
              </div>
              {Object.keys(battleStats.defeated).length > 0 && (
                <div>
                  <div className="text-[10px] mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>ศัตรูที่เคยปราบ</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(battleStats.defeated)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([name, count]) => (
                        <span key={name} className="px-2 py-1 rounded-md text-[10px]" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, background: "#14181F", color: "#E8ECF1", border: "1px solid #232935" }}>
                          {name} ×{count}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            {sectionTitle("ความสำเร็จ & ฉายา")}
            <div className="space-y-2">
              {ACHIEVEMENTS.map((ach) => {
                const ctx = { winCount, legendaryCount, atk };
                const eligible = ach.check(ctx);
                const claimed = !!achievementsClaimed[ach.id];
                return (
                  <div key={ach.id} className="rounded-lg border p-3" style={{ borderColor: claimed ? "#FFB020" : "#171B22", background: "#0D1015" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: "#E8ECF1" }}>{ach.name}</div>
                        <div className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>{ach.desc}</div>
                      </div>
                      {claimed ? (
                        <span className="flex-shrink-0 text-[10px] px-2 py-1 rounded-md" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>✓ รับแล้ว</span>
                      ) : (
                        <button
                          onClick={() => onClaimAchievement(ach)}
                          disabled={!eligible}
                          className="flex-shrink-0 px-3 py-1.5 rounded-md text-[11px] font-semibold"
                          style={{
                            fontFamily: "'Rajdhani', sans-serif",
                            background: eligible ? "#123A22" : "#171B22",
                            color: eligible ? "#8CF07A" : "#3A4354",
                            border: `1px solid ${eligible ? "#8CF07A" : "#232935"}`,
                          }}
                        >
                          {eligible ? "รับรางวัล" : "ยังไม่ถึง"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {ACHIEVEMENTS.some((a) => achievementsClaimed[a.id] && a.reward.title) && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {ACHIEVEMENTS.filter((a) => achievementsClaimed[a.id] && a.reward.title).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onSelectTitle(selectedTitle === a.reward.title ? null : a.reward.title)}
                    className="px-2.5 py-1 rounded-full text-[10px]"
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 600,
                      background: selectedTitle === a.reward.title ? "#3A2A14" : "#14181F",
                      color: selectedTitle === a.reward.title ? "#FFB020" : "#7C8494",
                      border: `1px solid ${selectedTitle === a.reward.title ? "#FFB020" : "#232935"}`,
                    }}
                  >
                    『{a.reward.title}』
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {sectionTitle("เพิ่มเพื่อน")}
            <div className="rounded-lg border p-3" style={{ borderColor: "#171B22", background: "#0D1015" }}>
              <div className="flex gap-2">
                <input
                  value={findCode}
                  onChange={(e) => setFindCode(e.target.value)}
                  placeholder="รหัสเพื่อน เช่น MX-A1B2"
                  className="flex-1 px-3 py-2 rounded-md text-xs outline-none"
                  style={{ background: "#0A0C10", border: "1px solid #232935", color: "#E8ECF1", fontFamily: "'JetBrains Mono', monospace" }}
                />
                <button
                  onClick={handleFindFriend}
                  className="px-3 py-2 rounded-md text-xs font-semibold"
                  style={{ fontFamily: "'Rajdhani', sans-serif", background: "#1C2330", color: "#47E0D2", border: "1px solid #47E0D2" }}
                >
                  ค้นหา
                </button>
              </div>
              {findResult && findResult.status === "notfound" && (
                <div className="text-xs mt-2" style={{ color: "#FF5A4E", fontFamily: "'Rajdhani', sans-serif" }}>ไม่พบผู้เล่นรหัสนี้</div>
              )}
              {findResult && findResult.status === "found" && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs flex-1" style={{ color: "#E8ECF1", fontFamily: "'Rajdhani', sans-serif" }}>
                    พบ: {findResult.data.name}
                  </span>
                  <button
                    onClick={handleAddFriend}
                    className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold"
                    style={{ fontFamily: "'Rajdhani', sans-serif", background: "#123A22", color: "#8CF07A", border: "1px solid #8CF07A" }}
                  >
                    เพิ่มเป็นเพื่อน
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            {sectionTitle("รายชื่อเพื่อน")}
            {friends.length === 0 ? (
              <div className="text-xs" style={{ color: "#3A4354", fontFamily: "'Rajdhani', sans-serif" }}>ยังไม่มีเพื่อน ลองเพิ่มด้วยรหัสด้านบน</div>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <div key={f.code} className="rounded-lg border px-3 py-2 flex items-center gap-2" style={{ borderColor: "#171B22", background: "#0D1015" }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: "#E8ECF1" }}>{f.name}</div>
                      <div className="text-[10px]" style={labelStyle}>{f.code}</div>
                    </div>
                    <button
                      onClick={() => handleChallengeFriend(f)}
                      className="px-3 py-1.5 rounded-md text-[11px] font-semibold"
                      style={{ fontFamily: "'Rajdhani', sans-serif", background: "#3A2A14", color: "#FFB020", border: "1px solid #FFB020" }}
                    >
                      ท้าดวล
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {sectionTitle("ห้องต่อสู้ (รหัสห้อง)")}
            <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "#171B22", background: "#0D1015" }}>
              <div>
                <button
                  onClick={handleCreateRoom}
                  className="w-full py-2.5 rounded-md text-xs font-semibold"
                  style={{ fontFamily: "'Rajdhani', sans-serif", background: "#1C2330", color: "#47E0D2", border: "1px solid #232935" }}
                >
                  สร้างห้อง
                </button>
                {roomCode && (
                  <div className="text-center mt-2 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020", letterSpacing: 2 }}>
                    {roomCode}
                  </div>
                )}
              </div>
              <div className="h-px" style={{ background: "#232935" }} />
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="ใส่รหัสห้องเพื่อน"
                  className="flex-1 px-3 py-2 rounded-md text-xs outline-none"
                  style={{ background: "#0A0C10", border: "1px solid #232935", color: "#E8ECF1", fontFamily: "'JetBrains Mono', monospace" }}
                />
                <button
                  onClick={handleJoinRoom}
                  className="px-3 py-2 rounded-md text-xs font-semibold"
                  style={{ fontFamily: "'Rajdhani', sans-serif", background: "#123A22", color: "#8CF07A", border: "1px solid #8CF07A" }}
                >
                  เข้าร่วม
                </button>
              </div>
              {joinMsg && <div className="text-xs" style={{ color: "#FF5A4E" }}>{joinMsg}</div>}
            </div>
          </div>
        </>
      )}

      <div>
        {sectionTitle("โหมดด่วน")}
        <button
          onClick={() => onBattle(null, null)}
          className="w-full py-3.5 rounded-lg text-sm font-bold tracking-widest border"
          style={{ fontFamily: "'Rajdhani', sans-serif", background: "#0D1015", color: "#FFB020", borderColor: "#FFB020" }}
        >
          สุ่มหาคู่ต่อสู้ (บอท)
        </button>
      </div>
    </div>
  );
}

/* ---------- Lobby screen: mode select + party + friend invites ---------- */
function LobbyScreen({ profile, friends, onAddFriend, equipped, frameColor, decal, decalPos, onBattle, bountyClaimedDate }) {
  const [mode, setMode] = useState("normal");
  const [partyFriend, setPartyFriend] = useState(null);
  const [pendingInviteTo, setPendingInviteTo] = useState(null);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [toast, setToast] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [showRoomCode, setShowRoomCode] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };

  // poll for incoming invites addressed to me
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await storage.get("invite:" + profile.code, true);
        const data = JSON.parse(r.value);
        if (alive) setIncomingInvite((cur) => (cur && cur.ts === data.ts ? cur : data));
      } catch (e) {
        if (alive) setIncomingInvite(null);
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [profile]);

  // poll to see if my sent invite got accepted
  useEffect(() => {
    if (!pendingInviteTo || !profile) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await storage.get("partySlot:" + profile.code, true);
        const data = JSON.parse(r.value);
        if (alive) {
          setPartyFriend({ code: data.friendCode, name: data.friendName, equipped: data.friendEquipped });
          setPendingInviteTo(null);
          showToast(`${data.friendName} เข้าร่วมทีมแล้ว`);
        }
      } catch (e) {}
    };
    const t = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [pendingInviteTo, profile]);

  const inviteFriend = async (friend) => {
    if (!profile) return;
    try {
      await storage.set("invite:" + friend.code, JSON.stringify({ from: profile.code, fromName: profile.name, fromEquipped: equipped, ts: Date.now() }), true);
      setPendingInviteTo(friend.code);
      showToast(`ส่งคำเชิญไปหา ${friend.name} แล้ว`);
    } catch (e) {
      showToast("ส่งคำเชิญไม่สำเร็จ");
    }
  };

  const acceptInvite = async () => {
    if (!incomingInvite || !profile) return;
    try {
      await storage.set("partySlot:" + incomingInvite.from, JSON.stringify({ friendCode: profile.code, friendName: profile.name, friendEquipped: equipped, ts: Date.now() }), true);
      await storage.delete("invite:" + profile.code, true).catch(() => {});
    } catch (e) {}
    setPartyFriend({ code: incomingInvite.from, name: incomingInvite.fromName, equipped: incomingInvite.fromEquipped });
    setIncomingInvite(null);
  };

  const declineInvite = async () => {
    if (!profile) return;
    try { await storage.delete("invite:" + profile.code, true); } catch (e) {}
    setIncomingInvite(null);
  };

  const leaveParty = () => setPartyFriend(null);

  const handleAddFriendHere = async () => {
    const code = addCode.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await storage.get("players:" + code, true);
      const data = JSON.parse(r.value);
      if (friends.some((f) => f.code === code)) {
        setAddMsg("เพิ่มเพื่อนคนนี้ไว้แล้ว");
        return;
      }
      onAddFriend({ code, name: data.name });
      setAddMsg(`เพิ่ม ${data.name} เป็นเพื่อนแล้ว`);
      setAddCode("");
    } catch (e) {
      setAddMsg("ไม่พบผู้เล่นรหัสนี้");
    }
  };

  const handleCreateRoom = async () => {
    if (!profile) return;
    const code = genCode("RM");
    try {
      await storage.set("rooms:" + code, JSON.stringify({ name: profile.name, equipped, createdAt: Date.now() }), true);
      setRoomCode(code);
      setShowRoomCode(true);
    } catch (e) {
      showToast("สร้างห้องไม่สำเร็จ");
    }
  };

  const handleJoinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await storage.get("rooms:" + code, true);
      const data = JSON.parse(r.value);
      setPartyFriend({ code, name: data.name, equipped: data.equipped });
      setJoinMsg("");
      setJoinCode("");
    } catch (e) {
      setJoinMsg("ไม่พบห้องนี้ ลองตรวจสอบโค้ดอีกครั้ง");
    }
  };

  const sectionTitle = (t) => (
    <div className="text-[11px] mb-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
      {t}
    </div>
  );

  return (
    <div className="px-4 py-4 space-y-5 pb-8">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs" style={{ background: "#123A22", color: "#8CF07A", fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {incomingInvite && (
        <div className="rounded-lg border p-3 mb-part-in" style={{ borderColor: "#FFB020", background: "#1C1608" }}>
          <div className="text-xs mb-2" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#E8ECF1" }}>
            📨 คำเชิญจาก <span style={{ fontWeight: 700 }}>{incomingInvite.fromName}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={declineInvite} className="flex-1 py-2 rounded-md text-xs font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", background: "#3A1418", color: "#FF5A4E", border: "1px solid #FF5A4E" }}>
              ปฏิเสธ
            </button>
            <button onClick={acceptInvite} className="flex-1 py-2 rounded-md text-xs font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", background: "#123A22", color: "#8CF07A", border: "1px solid #8CF07A" }}>
              ยอมรับ
            </button>
          </div>
        </div>
      )}

      <div>
        {sectionTitle("ภารกิจล่าค่าหัวรายวัน")}
        {(() => {
          const bounty = getTodayBounty();
          const claimedToday = bountyClaimedDate === getTodayKey();
          return (
            <div className="rounded-lg border p-3" style={{ borderColor: claimedToday ? "#232935" : "#FFB020", background: claimedToday ? "#0D1015" : "#241C0A" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{bounty.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#E8ECF1" }}>{bounty.name}</div>
                  <div className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>{bounty.desc}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>
                  รางวัล: 🪙{bounty.reward.coins} 🔩{bounty.reward.shards}
                </span>
                <button
                  onClick={() => onBattle(null, null, { isBounty: true, bountyId: bounty.id })}
                  disabled={claimedToday}
                  className="px-3 py-1.5 rounded-md text-[11px] font-semibold"
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    background: claimedToday ? "#171B22" : "#3A2A14",
                    color: claimedToday ? "#3A4354" : "#FFB020",
                    border: `1px solid ${claimedToday ? "#232935" : "#FFB020"}`,
                  }}
                >
                  {claimedToday ? "รับแล้ววันนี้" : "ล่าค่าหัว"}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      <div>
        {sectionTitle("โหมด")}
        <div className="space-y-2">
          <button
            onClick={() => setMode("normal")}
            className="w-full rounded-lg border p-3 flex items-center justify-between"
            style={{ borderColor: mode === "normal" ? "#FFB020" : "#232935", background: mode === "normal" ? "#1C2330" : "#0D1015" }}
          >
            <span className="text-sm" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#E8ECF1" }}>โหมดทั่วไป</span>
            {mode === "normal" && <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>เลือกอยู่</span>}
          </button>
          <button
            onClick={() => setMode("boss")}
            className="w-full rounded-lg border p-3 flex items-center justify-between"
            style={{ borderColor: mode === "boss" ? "#FF5A4E" : "#232935", background: mode === "boss" ? "#2A1414" : "#0D1015" }}
          >
            <span className="text-sm flex items-center gap-1.5" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#E8ECF1" }}>
              🐲 บอสประจำสัปดาห์
            </span>
            {mode === "boss" && <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FF5A4E" }}>เลือกอยู่</span>}
          </button>
          {mode === "boss" && (
            <div className="text-[10px] px-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>
              ⚠️ {BOSS_NAME} — เลือดเยอะ โจมตีแรงมาก ชนะแล้วได้เหรียญและเศษกลไกก้อนใหญ่
            </div>
          )}
          <button
            onClick={() => setMode("endless")}
            className="w-full rounded-lg border p-3 flex items-center justify-between"
            style={{ borderColor: mode === "endless" ? "#FFB020" : "#232935", background: mode === "endless" ? "#2A2014" : "#0D1015" }}
          >
            <span className="text-sm flex items-center gap-1.5" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#E8ECF1" }}>
              🔥 ไร้ขีดจำกัด
            </span>
            {mode === "endless" && <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>เลือกอยู่</span>}
          </button>
          {mode === "endless" && (
            <div className="text-[10px] px-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>
              ⚠️ สู้บอทต่อเนื่องไปเรื่อยๆ พลังชีวิตไม่รีเซ็ตระหว่างรอบ ไปให้ไกลที่สุดก่อนหุ่นพัง
            </div>
          )}
        </div>
      </div>

      <div>
        {sectionTitle("ทีมของคุณ")}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border overflow-hidden" style={{ width: 96, height: 112, borderColor: "#47E0D2", background: "#0D1015" }}>
            <RobotPreview equipped={equipped} pulseKey={0} frameColor={frameColor} decal={decal} decalPos={decalPos} />
          </div>
          {partyFriend ? (
            <div className="relative">
              <div className="rounded-xl border overflow-hidden" style={{ width: 96, height: 112, borderColor: "#FFB020", background: "#0D1015" }}>
                <RobotPreview equipped={partyFriend.equipped} pulseKey={0} />
              </div>
              <div className="text-[10px] text-center mt-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#E8ECF1" }}>{partyFriend.name}</div>
              <button onClick={leaveParty} className="w-full mt-1 text-[9px] py-1 rounded" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#FF5A4E", background: "#3A1418" }}>
                ออกจากทีม
              </button>
            </div>
          ) : pendingInviteTo ? (
            <div className="rounded-xl border flex items-center justify-center text-center px-2" style={{ width: 96, height: 112, borderColor: "#3A4354", background: "#0D1015" }}>
              <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>รอเพื่อนตอบรับ...</span>
            </div>
          ) : (
            <div
              className="rounded-xl border-2 border-dashed flex items-center justify-center"
              style={{ width: 96, height: 112, borderColor: "#232935", background: "#0D1015", color: "#3A4354", fontSize: 26 }}
            >
              +
            </div>
          )}
        </div>
      </div>

      {!partyFriend && !pendingInviteTo && (
        <div>
          {sectionTitle("เชิญเพื่อน")}
          <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "#171B22", background: "#0D1015" }}>
            {!profile ? (
              <div className="text-xs" style={{ color: "#7C8494", fontFamily: "'Rajdhani', sans-serif" }}>
                เข้าสู่ระบบที่แท็บ "เพื่อน" ก่อน เพื่อเชิญเพื่อนเข้าทีม
              </div>
            ) : (
              <>
                <div>
                  <div className="text-[10px] mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>เพิ่มเพื่อนด้วยรหัส</div>
                  <div className="flex gap-2">
                    <input
                      value={addCode}
                      onChange={(e) => setAddCode(e.target.value)}
                      placeholder="รหัสเพื่อน เช่น MX-A1B2"
                      className="flex-1 px-3 py-2 rounded-md text-xs outline-none"
                      style={{ background: "#0A0C10", border: "1px solid #232935", color: "#E8ECF1", fontFamily: "'JetBrains Mono', monospace" }}
                    />
                    <button
                      onClick={handleAddFriendHere}
                      className="px-3 py-2 rounded-md text-xs font-semibold"
                      style={{ fontFamily: "'Rajdhani', sans-serif", background: "#123A22", color: "#8CF07A", border: "1px solid #8CF07A" }}
                    >
                      เพิ่ม
                    </button>
                  </div>
                  {addMsg && <div className="text-xs mt-1.5" style={{ color: "#7BD8FF", fontFamily: "'Rajdhani', sans-serif" }}>{addMsg}</div>}
                </div>

                <div className="h-px" style={{ background: "#232935" }} />

                {friends.length === 0 ? (
                  <div className="text-xs" style={{ color: "#7C8494", fontFamily: "'Rajdhani', sans-serif" }}>
                    ยังไม่มีเพื่อน — เพิ่มด้วยรหัสด้านบนก่อน
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map((f) => (
                      <div key={f.code} className="flex items-center gap-2">
                        <span className="text-xs flex-1 truncate" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#E8ECF1" }}>{f.name}</span>
                        <button
                          onClick={() => inviteFriend(f)}
                          className="px-3 py-1.5 rounded-md text-[11px] font-semibold"
                          style={{ fontFamily: "'Rajdhani', sans-serif", background: "#1C2330", color: "#47E0D2", border: "1px solid #47E0D2" }}
                        >
                          เชิญ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {profile && (
        <div>
          {sectionTitle("เลขห้อง")}
          <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "#171B22", background: "#0D1015" }}>
            <div>
              <button
                onClick={handleCreateRoom}
                className="w-full py-2.5 rounded-md text-xs font-semibold"
                style={{ fontFamily: "'Rajdhani', sans-serif", background: "#1C2330", color: "#47E0D2", border: "1px solid #232935" }}
              >
                {showRoomCode && roomCode ? "สร้างเลขห้องใหม่" : "ดูเลขห้อง"}
              </button>
              {showRoomCode && roomCode && (
                <div className="text-center mt-2 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020", letterSpacing: 2 }}>
                  {roomCode}
                </div>
              )}
            </div>
            <div className="h-px" style={{ background: "#232935" }} />
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="ใส่เลขห้องเพื่อน"
                className="flex-1 px-3 py-2 rounded-md text-xs outline-none"
                style={{ background: "#0A0C10", border: "1px solid #232935", color: "#E8ECF1", fontFamily: "'JetBrains Mono', monospace" }}
              />
              <button
                onClick={handleJoinRoom}
                className="px-3 py-2 rounded-md text-xs font-semibold"
                style={{ fontFamily: "'Rajdhani', sans-serif", background: "#123A22", color: "#8CF07A", border: "1px solid #8CF07A" }}
              >
                เข้าห้อง
              </button>
            </div>
            {joinMsg && <div className="text-xs" style={{ color: "#FF5A4E" }}>{joinMsg}</div>}
          </div>
        </div>
      )}

      <button
        onClick={() =>
          mode === "boss"
            ? onBattle(null, null, { isBoss: true })
            : mode === "endless"
            ? onBattle(null, null, { isEndless: true })
            : partyFriend
            ? onBattle(partyFriend.equipped, partyFriend.name)
            : onBattle(null, null)
        }
        className="w-full py-3.5 rounded-lg text-sm font-bold tracking-widest border"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          background: "#0D1015",
          color: mode === "boss" ? "#FF5A4E" : mode === "endless" ? "#FFB020" : "#47E0D2",
          borderColor: mode === "boss" ? "#FF5A4E" : mode === "endless" ? "#FFB020" : "#47E0D2",
        }}
      >
        {mode === "boss" ? `ท้า ${BOSS_NAME}` : mode === "endless" ? "เริ่มโหมดไร้ขีดจำกัด" : partyFriend ? `เริ่มดวลกับ ${partyFriend.name}` : "เริ่มสู้กับบอท"}
      </button>
    </div>
  );
}

/* ---------- Inventory screen: equipped loadout + full owned-part collection ---------- */
function InventoryScreen({ equipped, owned, upgrades, coins, onEquipTo, onUpgrade }) {
  const sectionTitle = (t) => (
    <div className="text-[11px] mb-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
      {t}
    </div>
  );

  const SLOT_ORDER = [
    { key: "head", label: "หัว" },
    { key: "armL", label: "แขนซ้าย" },
    { key: "armR", label: "แขนขวา" },
    { key: "legs", label: "ขา" },
    { key: "core", label: "แกนกลาง" },
    { key: "weapon", label: "อาวุธ" },
    { key: "chip", label: "ชิป" },
  ];

  const ownedItems = useMemo(() => {
    return ALL_ITEMS.filter((item) => {
      if (item.shop || item.gacha || item.codeOnly) return owned.includes(item.id);
      return true;
    });
  }, [owned]);

  const DIRECT_SLOT = { head: "head", legs: "legs", core: "core", weapon: "weapon", chip: "chip" };

  return (
    <div className="px-4 py-4 space-y-5 pb-8">
      <div>
        {sectionTitle("กำลังสวมใส่")}
        <div className="rounded-lg border divide-y" style={{ borderColor: "#171B22", background: "#0D1015", borderStyle: "solid" }}>
          {SLOT_ORDER.map((s) => {
            const item = equipped[s.key];
            return (
              <div key={s.key} className="flex items-center gap-3 px-3 py-2.5" style={{ borderColor: "#171B22" }}>
                <span className="w-16 flex-shrink-0 text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
                  {s.label}
                </span>
                {item ? (
                  <>
                    <span className="text-lg">{item.icon}</span>
                    <span className="flex-1 text-[12px] truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: "#E8ECF1" }}>
                      {item.name}
                    </span>
                    <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>
                      {"★".repeat(upgrades[item.id] || 0)}
                      {"☆".repeat(MAX_STARS - (upgrades[item.id] || 0))}
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-[12px]" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#3A4354" }}>ว่าง</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        {sectionTitle("คลังชิ้นส่วนทั้งหมด")}
        <div className="grid grid-cols-2 gap-2">
          {ownedItems.map((item) => {
            const cat = categoryOfItem(item);
            const stars = upgrades[item.id] || 0;
            const isEquippedSomewhere = Object.values(equipped).some((e) => e && e.id === item.id);
            return (
              <div key={item.id} className="rounded-lg border p-3" style={{ borderColor: isEquippedSomewhere ? "#FFB020" : "#232935", background: "#14181F" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: "#0D1015", border: "1px solid #232935" }}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: "#E8ECF1" }}>{item.name}</div>
                    <div className="text-[9px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>{CATEGORY_LABEL[cat]}</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {cat === "arms" ? (
                    <>
                      <button
                        onClick={() => onEquipTo(item, "armL")}
                        className="flex-1 py-1.5 rounded-md text-[10px] font-semibold"
                        style={{ fontFamily: "'Rajdhani', sans-serif", background: "#1C2330", color: "#47E0D2", border: "1px solid #232935" }}
                      >
                        ใส่ซ้าย
                      </button>
                      <button
                        onClick={() => onEquipTo(item, "armR")}
                        className="flex-1 py-1.5 rounded-md text-[10px] font-semibold"
                        style={{ fontFamily: "'Rajdhani', sans-serif", background: "#1C2330", color: "#47E0D2", border: "1px solid #232935" }}
                      >
                        ใส่ขวา
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onEquipTo(item, DIRECT_SLOT[cat])}
                      className="flex-1 py-1.5 rounded-md text-[10px] font-semibold"
                      style={{ fontFamily: "'Rajdhani', sans-serif", background: "#1C2330", color: "#47E0D2", border: "1px solid #232935" }}
                    >
                      สวมใส่
                    </button>
                  )}
                </div>
                <UpgradePreview item={item} stars={stars} coins={coins} onUpgrade={onUpgrade} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main App ---------- */
function MechGame({ googleUser, onSignOut }) {
  useFonts();
  const [view, setView] = useState("build"); // build | lobby | social | shop
  const [category, setCategory] = useState("head");
  const [weaponCat, setWeaponCat] = useState("melee");
  const [equipped, setEquipped] = useState(EMPTY_EQUIP);
  const [openId, setOpenId] = useState(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [battleConfig, setBattleConfig] = useState(null);

  const [profile, setProfileState] = useState(null);
  const [friends, setFriendsState] = useState([]);
  const [coins, setCoins] = useState(0);
  const [owned, setOwned] = useState([]);
  const [shards, setShards] = useState(0);
  const [frameColor, setFrameColorState] = useState("#3A4354");
  const [decal, setDecalState] = useState("none");
  const [decalPos, setDecalPosState] = useState({ x: 50, y: 69 });
  const [upgrades, setUpgrades] = useState({});
  const [battleStats, setBattleStats] = useState({ wins: 0, losses: 0, defeated: {} });
  const [achievementsClaimed, setAchievementsClaimed] = useState({});
  const [selectedTitle, setSelectedTitleState] = useState(null);
  const [garageTheme, setGarageThemeState] = useState("default");
  const [bountyClaimedDate, setBountyClaimedDate] = useState("");
  const [durability, setDurability] = useState(100);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const eq = await storage.get("equipped", false);
        if (eq && eq.value) {
          const savedIds = JSON.parse(eq.value);
          const restored = { ...EMPTY_EQUIP };
          Object.entries(savedIds).forEach(([slot, id]) => {
            restored[slot] = id ? findItemById(id) : null;
          });
          setEquipped(restored);
        }
      } catch (e) {}
      try {
        const lv = await storage.get("lastView", false);
        if (lv && lv.value) setView(lv.value);
      } catch (e) {}
      try {
        const lc = await storage.get("lastCategory", false);
        if (lc && lc.value) setCategory(lc.value);
      } catch (e) {}
      try {
        const p = await storage.get("profile", false);
        if (p && p.value) {
          setProfileState(JSON.parse(p.value));
        } else {
          const seeded = {
            name: googleUser.displayName || "นักบังคับหุ่น",
            code: "MX-" + googleUser.uid.slice(0, 6).toUpperCase(),
            photoURL: googleUser.photoURL || null,
          };
          setProfileState(seeded);
          storage.set("profile", JSON.stringify(seeded), false).catch(() => {});
        }
      } catch (e) {}
      try {
        const f = await storage.get("friends", false);
        if (f && f.value) setFriendsState(JSON.parse(f.value));
      } catch (e) {}
      try {
        const c = await storage.get("coins", false);
        setCoins(c && c.value ? parseInt(c.value, 10) || 0 : 50);
        if (!c || !c.value) storage.set("coins", "50", false).catch(() => {});
      } catch (e) {
        setCoins(50);
        storage.set("coins", "50", false).catch(() => {});
      }
      try {
        const o = await storage.get("owned", false);
        if (o && o.value) setOwned(JSON.parse(o.value));
      } catch (e) {}
      try {
        const s = await storage.get("shards", false);
        setShards(s && s.value ? parseInt(s.value, 10) || 0 : 0);
      } catch (e) {}
      try {
        const fc = await storage.get("frameColor", false);
        if (fc && fc.value) setFrameColorState(fc.value);
      } catch (e) {}
      try {
        const dc = await storage.get("decal", false);
        if (dc && dc.value) setDecalState(dc.value);
      } catch (e) {}
      try {
        const dp = await storage.get("decalPos", false);
        if (dp && dp.value) setDecalPosState(JSON.parse(dp.value));
      } catch (e) {}
      try {
        const up = await storage.get("upgrades", false);
        if (up && up.value) setUpgrades(JSON.parse(up.value));
      } catch (e) {}
      try {
        const bs = await storage.get("battleStats", false);
        if (bs && bs.value) setBattleStats(JSON.parse(bs.value));
      } catch (e) {}
      try {
        const ac = await storage.get("achievements", false);
        if (ac && ac.value) setAchievementsClaimed(JSON.parse(ac.value));
      } catch (e) {}
      try {
        const gt = await storage.get("garageTheme", false);
        if (gt && gt.value) setGarageThemeState(gt.value);
      } catch (e) {}
      try {
        const t = await storage.get("title", false);
        if (t && t.value) setSelectedTitleState(t.value);
      } catch (e) {}
      try {
        const bc = await storage.get("bountyClaimedDate", false);
        if (bc && bc.value) setBountyClaimedDate(bc.value);
      } catch (e) {}
      try {
        const dur = await storage.get("durability", false);
        setDurability(dur && dur.value ? parseInt(dur.value, 10) : 100);
      } catch (e) {}
      loadedRef.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const ids = {};
    Object.entries(equipped).forEach(([slot, item]) => {
      ids[slot] = item ? item.id : null;
    });
    storage.set("equipped", JSON.stringify(ids), false).catch(() => {});
  }, [equipped]);

  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("lastView", view, false).catch(() => {});
  }, [view]);

  useEffect(() => {
    if (!loadedRef.current) return;
    storage.set("lastCategory", category, false).catch(() => {});
  }, [category]);

  const stats = useMemo(() => {
    const base = sumStats(equipped, upgrades);
    const durMult = 0.7 + 0.3 * (durability / 100);
    return { ...base, atk: Math.round(base.atk * durMult), def: Math.round(base.def * durMult) };
  }, [equipped, upgrades, durability]);
  const legendaryCount = useMemo(
    () => owned.filter((id) => { const it = findItemById(id); return it && it.rarity === "legendary"; }).length,
    [owned]
  );

  const list = useMemo(() => {
    if (category === "weapon") return WEAPONS.filter((w) => w.cat === weaponCat);
    return CATEGORIES.find((c) => c.id === category).data;
  }, [category, weaponCat]);

  const slotKey = category;

  const handleEquip = (item) => {
    setEquipped((eq) => ({ ...eq, [slotKey]: item }));
    setPulseKey((k) => k + 1);
  };
  const handleUnequip = () => {
    setEquipped((eq) => ({ ...eq, [slotKey]: null }));
    setPulseKey((k) => k + 1);
  };
  const handleEquipTo = (item, slot) => {
    if (!slot) return;
    setEquipped((eq) => ({ ...eq, [slot]: item }));
    setPulseKey((k) => k + 1);
  };

  const setProfile = (p) => {
    setProfileState(p);
    storage.set("profile", JSON.stringify(p), false).catch(() => {});
  };
  const addFriend = (friend) => {
    setFriendsState((prev) => {
      const next = [...prev, friend];
      storage.set("friends", JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  const handleBuy = (item) => {
    if (coins < item.price) return;
    playSFX("buy");
    const newCoins = coins - item.price;
    setCoins(newCoins);
    storage.set("coins", String(newCoins), false).catch(() => {});
    const newOwned = [...owned, item.id];
    setOwned(newOwned);
    storage.set("owned", JSON.stringify(newOwned), false).catch(() => {});
  };

  const handleReward = (coinAmt, shardAmt) => {
    setCoins((c) => {
      const n = c + coinAmt;
      storage.set("coins", String(n), false).catch(() => {});
      return n;
    });
    if (shardAmt) {
      setShards((s) => {
        const n = s + shardAmt;
        storage.set("shards", String(n), false).catch(() => {});
        return n;
      });
    }
  };

  const handleBattleResult = (result, enemyName) => {
    setBattleStats((prev) => {
      const next = {
        wins: prev.wins + (result === "win" ? 1 : 0),
        losses: prev.losses + (result === "lose" ? 1 : 0),
        defeated: result === "win" ? { ...prev.defeated, [enemyName]: (prev.defeated[enemyName] || 0) + 1 } : prev.defeated,
      };
      storage.set("battleStats", JSON.stringify(next), false).catch(() => {});
      return next;
    });
    setDurability((d) => {
      const n = Math.max(0, d - 10);
      storage.set("durability", String(n), false).catch(() => {});
      return n;
    });
  };

  const handleBountyWin = () => {
    const key = getTodayKey();
    setBountyClaimedDate(key);
    storage.set("bountyClaimedDate", key, false).catch(() => {});
  };

  const handleRepair = () => {
    if (coins < 20 || durability >= 100) return;
    playSFX("upgrade");
    const newCoins = coins - 20;
    setCoins(newCoins);
    storage.set("coins", String(newCoins), false).catch(() => {});
    setDurability((d) => {
      const n = Math.min(100, d + 25);
      storage.set("durability", String(n), false).catch(() => {});
      return n;
    });
  };

  const handleGachaPull = () => {
    if (coins < GACHA_COST) return null;
    playSFX("gacha");
    const newCoins = coins - GACHA_COST;
    setCoins(newCoins);
    storage.set("coins", String(newCoins), false).catch(() => {});
    const item = gachaRoll();
    if (owned.includes(item.id)) {
      const newShards = shards + 2;
      setShards(newShards);
      storage.set("shards", String(newShards), false).catch(() => {});
      return { item, duplicate: true };
    }
    const newOwned = [...owned, item.id];
    setOwned(newOwned);
    storage.set("owned", JSON.stringify(newOwned), false).catch(() => {});
    return { item, duplicate: false };
  };

  const handleShardRedeem = (item) => {
    if (shards < 2 || owned.includes(item.id)) return;
    playSFX("claim");
    const newShards = shards - 2;
    setShards(newShards);
    storage.set("shards", String(newShards), false).catch(() => {});
    const newOwned = [...owned, item.id];
    setOwned(newOwned);
    storage.set("owned", JSON.stringify(newOwned), false).catch(() => {});
  };

  const setFrameColor = (color) => {
    setFrameColorState(color);
    storage.set("frameColor", color, false).catch(() => {});
  };

  const setDecal = (id) => {
    setDecalState(id);
    storage.set("decal", id, false).catch(() => {});
  };

  const setDecalPos = (pos) => {
    setDecalPosState(pos);
    storage.set("decalPos", JSON.stringify(pos), false).catch(() => {});
  };

  const setGarageTheme = (id) => {
    setGarageThemeState(id);
    storage.set("garageTheme", id, false).catch(() => {});
  };

  const handleUpgrade = (item) => {
    const stars = upgrades[item.id] || 0;
    if (stars >= MAX_STARS) return;
    const cost = upgradeCost(stars);
    if (coins < cost) return;
    playSFX("upgrade");
    const newCoins = coins - cost;
    setCoins(newCoins);
    storage.set("coins", String(newCoins), false).catch(() => {});
    const newUpgrades = { ...upgrades, [item.id]: stars + 1 };
    setUpgrades(newUpgrades);
    storage.set("upgrades", JSON.stringify(newUpgrades), false).catch(() => {});
  };

  const handleClaimAchievement = (ach) => {
    const ctx = { winCount: battleStats.wins, legendaryCount, atk: stats.atk };
    if (!ach.check(ctx) || achievementsClaimed[ach.id]) return;
    playSFX("claim");
    const newClaimed = { ...achievementsClaimed, [ach.id]: true };
    setAchievementsClaimed(newClaimed);
    storage.set("achievements", JSON.stringify(newClaimed), false).catch(() => {});
    if (ach.reward.coins) {
      const newCoins = coins + ach.reward.coins;
      setCoins(newCoins);
      storage.set("coins", String(newCoins), false).catch(() => {});
    }
  };

  const setSelectedTitle = (title) => {
    setSelectedTitleState(title);
    storage.set("title", title || "", false).catch(() => {});
  };

  const openBattle = (enemyEquipped, enemyName, opts) => {
    const isBoss = !!(opts && opts.isBoss);
    const isEndless = !!(opts && opts.isEndless);
    const isBounty = !!(opts && opts.isBounty);
    const bountyId = opts && opts.bountyId;
    setBattleConfig({
      enemyEquipped: enemyEquipped || null,
      enemyName: enemyName || null,
      isBotMatch: !enemyEquipped && !isBoss && !isBounty,
      isBoss,
      isEndless,
      isBounty,
      bountyId,
    });
  };

  const isOwned = (item) => !(item.shop || item.codeOnly || item.gacha) || owned.includes(item.id);

  const [redeemInput, setRedeemInput] = useState("");
  const [redeemMsg, setRedeemMsg] = useState(null);
  const submitRedeem = () => {
    const res = handleRedeemCode(redeemInput);
    setRedeemMsg(res);
    if (res.ok) setRedeemInput("");
  };

  const handleRedeemCode = (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return { ok: false, msg: "กรอกโค้ดก่อนนะ" };
    const match = WEAPONS.find((w) => w.codeOnly && w.code === code);
    if (!match) return { ok: false, msg: "โค้ดไม่ถูกต้อง ลองตรวจสอบอีกครั้ง" };
    if (owned.includes(match.id)) return { ok: false, msg: `ปลดล็อก ${match.name} ไปแล้ว` };
    const newOwned = [...owned, match.id];
    setOwned(newOwned);
    storage.set("owned", JSON.stringify(newOwned), false).catch(() => {});
    return { ok: true, msg: `ปลดล็อก ${match.name} ${match.icon} สำเร็จ!` };
  };

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "#0A0C10", color: "#E8ECF1" }}>
      <style>{`
        @keyframes mbPartIn { 0% { opacity: 0.3; transform: scale(0.94); } 100% { opacity: 1; transform: scale(1); } }
        .mb-part-in { animation: mbPartIn 0.3s ease-out; transform-origin: center; }
        @keyframes mbFloat { 0% { opacity: 0; transform: translateY(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-24px); } }
        .mb-float { position: absolute; right: 4px; top: -4px; font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 13px; animation: mbFloat 0.8s ease-out forwards; white-space: nowrap; }
        @keyframes mbShakeKf { 0%,100%{transform:translateX(0);} 20%{transform:translateX(-6px) rotate(-4deg);} 40%{transform:translateX(6px) rotate(4deg);} 60%{transform:translateX(-4px);} 80%{transform:translateX(4px);} }
        .mb-shake { animation: mbShakeKf 0.4s ease-in-out; }
        @keyframes mbLungeR { 0%{transform:translateX(0);} 40%{transform:translateX(10px) scale(1.06);} 100%{transform:translateX(0);} }
        @keyframes mbLungeL { 0%{transform:translateX(0);} 40%{transform:translateX(-10px) scale(1.06);} 100%{transform:translateX(0);} }
        .mb-lunge-r { animation: mbLungeR 0.35s ease-out; }
        .mb-lunge-l { animation: mbLungeL 0.35s ease-out; }
        @keyframes mbFlashKf { 0% { opacity: 0.55; transform: scale(0.8);} 100% { opacity: 0; transform: scale(1.5);} }
        .mb-flash { animation: mbFlashKf 0.45s ease-out forwards; }
        @keyframes mbSlashR { 0% { left: 20%; opacity: 0; transform: rotate(-20deg) scale(0.7); } 15% { opacity: 1; } 100% { left: 70%; opacity: 0; transform: rotate(20deg) scale(1.1); } }
        @keyframes mbSlashL { 0% { left: 70%; opacity: 0; transform: rotate(20deg) scale(0.7); } 15% { opacity: 1; } 100% { left: 20%; opacity: 0; transform: rotate(-20deg) scale(1.1); } }
        .mb-slash-r { animation: mbSlashR 0.42s ease-in forwards; }
        .mb-slash-l { animation: mbSlashL 0.42s ease-in forwards; }
        @keyframes mbJetPulse { 0%,100%{opacity:0.25;} 50%{opacity:0.55;} }
        .mb-jet-pulse { animation: mbJetPulse 1.4s ease-in-out infinite; }
        @keyframes mbClawDrop { 0%{transform:translateX(-50%) translateY(0);} 40%{transform:translateX(-50%) translateY(60px);} 55%{transform:translateX(-50%) translateY(60px) scale(0.85);} 100%{transform:translateX(-50%) translateY(0);} }
        .mb-claw-drop { animation: mbClawDrop 1.5s ease-in-out; }
        @keyframes mbCapsuleShake { 0%,100%{transform:translateX(-50%) rotate(0);} 25%{transform:translateX(-50%) rotate(-8deg);} 75%{transform:translateX(-50%) rotate(8deg);} }
        .mb-capsule-shake { animation: mbCapsuleShake 0.3s ease-in-out 5; }
        @keyframes mbSparkleFade { 0%{opacity:0;} 30%{opacity:1;} 100%{opacity:0;} }
        .mb-sparkle-fade { animation: mbSparkleFade 1.2s ease-out forwards; }
        @keyframes mbBob { 0%,100%{transform:translateY(0) rotate(-4deg);} 50%{transform:translateY(-4px) rotate(4deg);} }
        .mb-bob { animation: mbBob 3.2s ease-in-out infinite; }
        @keyframes mbCoinDrop { 0%{ top:-34px; opacity:1; } 85%{ top:0px; opacity:1; } 100%{ top:4px; opacity:0; } }
        .mb-coin-drop { animation: mbCoinDrop 0.55s ease-in forwards; }
        ::-webkit-scrollbar { height: 6px; }
        ::-webkit-scrollbar-thumb { background: #232935; border-radius: 3px; }
      `}</style>

      {/* top nav */}
      <div className="px-4 pt-4 grid grid-cols-3 gap-1.5">
        {[
          { id: "build", label: "🔧 ประกอบ" },
          { id: "inventory", label: "🎒 คลัง" },
          { id: "lobby", label: "🎮 ล็อบบี้" },
          { id: "social", label: "🌐 เพื่อน" },
          { id: "shop", label: "🛒 ร้านค้า" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className="py-2 rounded-lg text-[11px] font-semibold border"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              background: view === t.id ? "#1C2330" : "transparent",
              color: view === t.id ? "#47E0D2" : "#7C8494",
              borderColor: view === t.id ? "#47E0D2" : "#232935",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "build" && (
        <>
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "#171B22" }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>
                MECH BAY
              </span>
              <span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FFB020" }}>🪙 {coins}</span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
                🔧 สภาพหุ่น
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#14181F" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${durability}%`, background: durability > 50 ? "#8CF07A" : durability > 20 ? "#FFB020" : "#FF5A4E" }}
                />
              </div>
              <span className="text-[10px] flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>{durability}%</span>
              {durability < 100 && (
                <button
                  onClick={handleRepair}
                  disabled={coins < 20}
                  className="flex-shrink-0 text-[10px] px-2 py-1 rounded-md"
                  style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, background: coins < 20 ? "#171B22" : "#1C2330", color: coins < 20 ? "#3A4354" : "#47E0D2", border: "1px solid #232935" }}
                >
                  ซ่อม 🪙20
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.id); setOpenId(null); }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors"
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 600,
                    background: category === c.id ? "#FFB020" : "transparent",
                    color: category === c.id ? "#0A0C10" : "#7C8494",
                    borderColor: category === c.id ? "#FFB020" : "#232935",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {category === "weapon" && (
              <div className="flex gap-2 overflow-x-auto pt-2">
                {WEAPON_CATS.map((wc) => (
                  <button
                    key={wc.id}
                    onClick={() => { setWeaponCat(wc.id); setOpenId(null); }}
                    className="flex-shrink-0 px-3 py-1 rounded-md text-[11px] border"
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 600,
                      background: weaponCat === wc.id ? "#1C2330" : "transparent",
                      color: weaponCat === wc.id ? "#47E0D2" : "#7C8494",
                      borderColor: weaponCat === wc.id ? "#47E0D2" : "#232935",
                    }}
                  >
                    {wc.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {category === "weapon" && weaponCat === "code" && (
            <div className="px-4 pt-3">
              <div className="rounded-lg border p-3" style={{ borderColor: "#B57BFF", background: "#140F22" }}>
                <div className="text-[10px] mb-2 leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#B57BFF" }}>
                  {CODE_FORMAT_HINT}
                </div>
                <div className="flex gap-2">
                  <input
                    value={redeemInput}
                    onChange={(e) => setRedeemInput(e.target.value)}
                    placeholder="กรอกโค้ด เช่น MECH-DRAGON"
                    className="flex-1 px-3 py-2 rounded-md text-xs outline-none"
                    style={{ background: "#0A0C10", border: "1px solid #232935", color: "#E8ECF1", fontFamily: "'JetBrains Mono', monospace" }}
                  />
                  <button
                    onClick={submitRedeem}
                    className="px-3 py-2 rounded-md text-xs font-semibold"
                    style={{ fontFamily: "'Rajdhani', sans-serif", background: "#241A3A", color: "#B57BFF", border: "1px solid #B57BFF" }}
                  >
                    ใช้โค้ด
                  </button>
                </div>
                {redeemMsg && (
                  <div className="text-xs mt-2" style={{ fontFamily: "'Rajdhani', sans-serif", color: redeemMsg.ok ? "#8CF07A" : "#FF5A4E" }}>
                    {redeemMsg.msg}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="px-4 pt-3 grid grid-cols-2 gap-2">
            {list.map((item) => (
              <ItemCell
                key={item.id}
                item={item}
                isEquipped={equipped[slotKey] && equipped[slotKey].id === item.id}
                isOpen={openId === item.id}
                owned={isOwned(item)}
                coins={coins}
                upgrades={upgrades}
                onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
                onEquip={() => handleEquip(item)}
                onUnequip={handleUnequip}
                onBuy={() => handleBuy(item)}
                onUpgrade={handleUpgrade}
              />
            ))}
          </div>

          <div className="px-4 pt-4">
            <div
              onClick={(e) => {
                if (decal === "none") return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
                const y = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100));
                setDecalPos({ x, y });
              }}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "#171B22", background: "#0D1015", height: 200, cursor: decal !== "none" ? "crosshair" : "default" }}
            >
              <RobotPreview equipped={equipped} pulseKey={pulseKey} frameColor={frameColor} decal={decal} decalPos={decalPos} theme={GARAGE_THEMES.find((t) => t.id === garageTheme) || GARAGE_THEMES[0]} />
            </div>
            {decal !== "none" && (
              <div className="text-[10px] mt-1.5 text-center" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
                แตะบนตัวหุ่นเพื่อย้ายตำแหน่งลาย
              </div>
            )}
          </div>

          <div className="px-4 pt-3">
            <div className="text-[11px] mb-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
              ธีมโรงซ่อม
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {GARAGE_THEMES.map((t) => {
                const unlocked = battleStats.wins >= t.minWins;
                return (
                  <button
                    key={t.id}
                    onClick={() => unlocked && setGarageTheme(t.id)}
                    disabled={!unlocked}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs border flex items-center gap-1.5"
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 600,
                      background: garageTheme === t.id ? "#1C2330" : "transparent",
                      color: !unlocked ? "#3A4354" : garageTheme === t.id ? t.glow : "#7C8494",
                      borderColor: garageTheme === t.id ? t.glow : "#232935",
                      opacity: unlocked ? 1 : 0.6,
                    }}
                  >
                    {!unlocked && "🔒 "}
                    {t.label}
                    {!unlocked && ` (ชนะ ${t.minWins})`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 pt-3">
            <div className="text-[11px] mb-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
              สีตัวถัง
            </div>
            <div className="flex items-center gap-2">
              {FRAME_COLORS.map((clr) => (
                <button
                  key={clr}
                  onClick={() => setFrameColor(clr)}
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    background: clr,
                    border: frameColor === clr ? "2px solid #E8ECF1" : "2px solid transparent",
                    boxShadow: frameColor === clr ? `0 0 0 2px ${clr}` : "none",
                  }}
                />
              ))}
              <label
                className="relative rounded-full flex-shrink-0 flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  background: !FRAME_COLORS.includes(frameColor) ? frameColor : "#14181F",
                  border: !FRAME_COLORS.includes(frameColor) ? "2px solid #E8ECF1" : "1px dashed #3A4354",
                  cursor: "pointer",
                }}
              >
                {FRAME_COLORS.includes(frameColor) && (
                  <span style={{ fontSize: 12, color: "#7C8494" }}>🎨</span>
                )}
                <input
                  type="color"
                  value={frameColor}
                  onChange={(e) => setFrameColor(e.target.value)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                />
              </label>
            </div>
            <div className="text-[9px] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
              แตะไอคอน 🎨 เพื่อเลือกสีเองแบบ RGB อิสระ
            </div>
          </div>

          <div className="px-4 pt-3">
            <div className="text-[11px] mb-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
              ลาย/สติ๊กเกอร์
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DECALS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDecal(d.id)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs border"
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 600,
                    background: decal === d.id ? "#1C2330" : "transparent",
                    color: decal === d.id ? "#47E0D2" : "#7C8494",
                    borderColor: decal === d.id ? "#47E0D2" : "#232935",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pt-4 pb-2">
            <div className="text-[11px] mb-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A4354" }}>
              สรุปพลัง
            </div>
            <div className="rounded-lg border px-3 py-3 space-y-2.5" style={{ borderColor: "#171B22", background: "#0D1015" }}>
              {["atk", "def", "spd", "hp"].map((k) => (
                <PowerBar key={k} label={STAT_LABEL[k]} value={stats[k]} max={STAT_MAX[k]} color={STAT_COLOR[k]} />
              ))}
            </div>
          </div>

          <div className="px-4 py-4 mt-auto">
            <button
              onClick={() => openBattle(null, null)}
              className="w-full py-3.5 rounded-lg text-sm font-bold tracking-widest border"
              style={{ fontFamily: "'Rajdhani', sans-serif", background: "#0D1015", color: "#47E0D2", borderColor: "#47E0D2" }}
            >
              เข้าสู่สนามต่อสู้
            </button>
          </div>
        </>
      )}

      {view === "inventory" && (
        <InventoryScreen equipped={equipped} owned={owned} upgrades={upgrades} coins={coins} onEquipTo={handleEquipTo} onUpgrade={handleUpgrade} />
      )}
      {view === "lobby" && (
        <LobbyScreen profile={profile} friends={friends} onAddFriend={addFriend} equipped={equipped} frameColor={frameColor} decal={decal} decalPos={decalPos} onBattle={openBattle} bountyClaimedDate={bountyClaimedDate} />
      )}
      {view === "social" && (
        <SocialScreen
          profile={profile}
          onSignOut={onSignOut}
          friends={friends}
          onAddFriend={addFriend}
          equipped={equipped}
          frameColor={frameColor}
          decal={decal}
          decalPos={decalPos}
          onBattle={openBattle}
          winCount={battleStats.wins}
          battleStats={battleStats}
          legendaryCount={legendaryCount}
          atk={stats.atk}
          achievementsClaimed={achievementsClaimed}
          selectedTitle={selectedTitle}
          onClaimAchievement={handleClaimAchievement}
          onSelectTitle={setSelectedTitle}
        />
      )}
      {view === "shop" && <ShopScreen coins={coins} owned={owned} shards={shards} onBuy={handleBuy} onGachaPull={handleGachaPull} onShardRedeem={handleShardRedeem} />}

      {battleConfig && !battleConfig.isEndless && (
        <BattleOverlay
          playerEquipped={equipped}
          playerStats={stats}
          enemyEquipped={battleConfig.enemyEquipped}
          enemyName={battleConfig.enemyName}
          isBotMatch={battleConfig.isBotMatch}
          isBoss={battleConfig.isBoss}
          isBounty={battleConfig.isBounty}
          bountyId={battleConfig.bountyId}
          frameColor={frameColor}
          decal={decal}
          decalPos={decalPos}
          onReward={handleReward}
          onBattleEnd={handleBattleResult}
          onBountyWin={handleBountyWin}
          onClose={() => setBattleConfig(null)}
        />
      )}
      {battleConfig && battleConfig.isEndless && (
        <EndlessOverlay
          playerEquipped={equipped}
          playerStats={stats}
          frameColor={frameColor}
          decal={decal}
          decalPos={decalPos}
          onReward={handleReward}
          onBattleEnd={handleBattleResult}
          onClose={() => setBattleConfig(null)}
        />
      )}
    </div>
  );
}

/* ---------- Auth gate: real Google sign-in, then render the game ---------- */
function LoginGate({ onSignedIn }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onSignedIn(result.user);
    } catch (e) {
      setError(e.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 px-6" style={{ background: "#0A0C10", color: "#E8ECF1" }}>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: 1 }}>MECH BAY</div>
      <div className="text-center text-sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7C8494" }}>
        เข้าสู่ระบบด้วย Google เพื่อบันทึกความคืบหน้าและเล่นกับเพื่อนได้จริง
      </div>
      <button
        onClick={handleLogin}
        disabled={busy}
        className="py-3 px-6 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
        style={{ fontFamily: "'Rajdhani', sans-serif", background: "#1C2330", color: "#E8ECF1", border: "1px solid #232935", opacity: busy ? 0.6 : 1 }}
      >
        <span style={{ fontWeight: 800 }}>G</span> {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}
      </button>
      {error && (
        <div className="text-xs text-center" style={{ color: "#FF5A4E", fontFamily: "'JetBrains Mono', monospace" }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
    return unsub;
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#0A0C10", color: "#7C8494" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>กำลังโหลด...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginGate onSignedIn={setUser} />;
  }

  return <MechGame googleUser={user} onSignOut={handleSignOut} />;
}
