import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconCoin,
  IconMusic,
  IconMusicOff,
  IconDroplet,
  IconRefresh,
  IconRotate360,
  IconUpload,
  IconMoodCrazyHappy,
  IconPlayerPause,
  IconPlayerPlay,
  IconBolt,
  IconArrowBigRightLines,
  IconKarate,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

const W = 960;
const H = 540;
const FLOOR_TOP = 335;
const FLOOR_BOTTOM = 510;
const SFX = {
  hit: { file: "VideoGameBeeps_S08TE.1330.wav", vol: 0.5, ms: 260 },
  kick: { file: "VideoGameBlips_S08TE.1293.wav", vol: 0.3, ms: 180 },
  spin: { file: "VideoGameAscend_S08TE.1287.wav", vol: 0.35, ms: 700 },
  gold: { file: "VideoGameChime_S08TE.1294.wav", vol: 0.5, ms: 900 },
  shoot: { file: "VideoGameBeeps_S08TE.1327.wav", vol: 0.25, ms: 90 },
  pickup: { file: "VideoGameConsole_S08TE.1296.wav", vol: 0.45, ms: 700 },
  hurt: { file: "VideoGameDescend_S08TE.1300.wav", vol: 0.4, ms: 350 },
  death: { file: "VideoGameDescend_S011TE.100.wav", vol: 0.6, ms: 900 },
  bossDown: { file: "VideoGameArpeggio_S08TE.1_2.wav", vol: 0.6, ms: 800 },
  win: { file: "VideoGameArpeggio_S08TE.1_3.wav", vol: 0.55, ms: 1500 },
} as const;

const sfxCache: Record<string, HTMLAudioElement> = {};
const sfxLast: Record<string, number> = {};

function playSfx(name: keyof typeof SFX, minGap = 40) {
  if (typeof Audio === "undefined") return;
  const now = performance.now();
  if (now - (sfxLast[name] ?? 0) < minGap) return;
  sfxLast[name] = now;
  const s = SFX[name];
  const base = (sfxCache[s.file] ??= new Audio(`/sounds/${s.file}`));
  const a = base.cloneNode() as HTMLAudioElement;
  a.volume = s.vol;
  a.play().catch(() => {});
  setTimeout(() => a.pause(), s.ms);
}

const SPEED = 230;
const SPIN_TIME = 0.85;
const SPIN_RADIUS = 190;
const DANCE_TIME = 3.2;
const KICK_TIME = 0.32;
const WORLD_W = 3840;
const MAX_HP = 100;
const COINS_PER_PILE = 25;
const WOMAN = { x: WORLD_W - 160, y: 410 };
const TRACK_SRC = "/audio/tiptoe-wing-in-my-jawwdinz.mp3";

type Pile = { x: number; y: number; gold: boolean; seed: number };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "spark" | "coin" | "heart" | "blood";
};

const PILE_POSITIONS: [number, number][] = Array.from({ length: 16 }, (_, i) => [
  300 + i * 210 + (i % 3) * 30,
  [385, 470, 360, 440, 495][i % 5],
]);

const makePiles = (): Pile[] =>
  PILE_POSITIONS.map(([x, y], i) => ({ x, y, gold: false, seed: i + 1 }));

function drawBarn(ctx: CanvasRenderingContext2D, time: number, cam: number) {
  const first = Math.floor(cam / W);
  for (let i = first; i <= first + 1; i++) {
    ctx.save();
    ctx.translate(i * W - cam, 0);
    drawBarnTile(ctx, time);
    ctx.restore();
  }
}

function drawBarnTile(ctx: CanvasRenderingContext2D, time: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP);
  wall.addColorStop(0, "#4a2c1a");
  wall.addColorStop(1, "#6b4128");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, FLOOR_TOP + 20);
  ctx.strokeStyle = "rgba(20,10,5,0.45)";
  ctx.lineWidth = 3;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FLOOR_TOP + 20);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 70, W, 8);
  ctx.fillRect(0, 250, W, 8);

  // hay bale stack, back right
  const bales: [number, number, number, number][] = [
    [640, 180, 150, 80],
    [790, 180, 170, 80],
    [700, 100, 150, 80],
    [850, 100, 110, 80],
    [740, 260, 190, 85],
  ];
  bales.forEach(([x, y, w, h], bi) => {
    ctx.fillStyle = bi % 2 ? "#d9a93f" : "#e3b94d";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,80,10,0.5)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      const sx = x + 8 + ((k * 37 + bi * 11) % (w - 16));
      const sy = y + 6 + ((k * 23 + bi * 7) % (h - 20));
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 14, sy + 6);
      ctx.stroke();
    }
    ctx.strokeStyle = "#7a5420";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y);
    ctx.lineTo(x + w * 0.3, y + h);
    ctx.moveTo(x + w * 0.7, y);
    ctx.lineTo(x + w * 0.7, y + h);
    ctx.stroke();
  });

  // window light
  ctx.fillStyle = "#ffe9a8";
  ctx.fillRect(110, 40, 120, 130);
  ctx.strokeStyle = "#3a2112";
  ctx.lineWidth = 8;
  ctx.strokeRect(110, 40, 120, 130);
  ctx.beginPath();
  ctx.moveTo(170, 40);
  ctx.lineTo(170, 170);
  ctx.moveTo(110, 105);
  ctx.lineTo(230, 105);
  ctx.stroke();
  const beam = ctx.createLinearGradient(170, 170, 380, 420);
  beam.addColorStop(0, "rgba(255,230,150,0.35)");
  beam.addColorStop(1, "rgba(255,230,150,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(110, 170);
  ctx.lineTo(230, 170);
  ctx.lineTo(520, 430);
  ctx.lineTo(300, 430);
  ctx.closePath();
  ctx.fill();

  // floor
  const floor = ctx.createLinearGradient(0, FLOOR_TOP, 0, H);
  floor.addColorStop(0, "#9a6b36");
  floor.addColorStop(1, "#7a4f27");
  ctx.fillStyle = floor;
  ctx.fillRect(0, FLOOR_TOP + 20, W, H);
  ctx.strokeStyle = "rgba(230,190,90,0.55)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 90; k++) {
    const sx = (k * 97) % W;
    const sy = FLOOR_TOP + 30 + ((k * 53) % (H - FLOOR_TOP - 30));
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 16, sy + (k % 3) * 3 - 3);
    ctx.stroke();
  }
  // dust motes
  ctx.fillStyle = "rgba(255,240,180,0.5)";
  for (let k = 0; k < 18; k++) {
    const mx = (k * 131 + time * 12) % W;
    const my = 60 + ((k * 71 + Math.sin(time + k) * 20) % 300);
    ctx.beginPath();
    ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawForest(ctx: CanvasRenderingContext2D, time: number, cam: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP + 20);
  sky.addColorStop(0, "#060914");
  sky.addColorStop(1, "#13232a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FLOOR_TOP + 20);

  const glow = ctx.createRadialGradient(740, 90, 10, 740, 90, 160);
  glow.addColorStop(0, "rgba(190,210,255,0.35)");
  glow.addColorStop(1, "rgba(190,210,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(540, 0, 400, 260);
  ctx.fillStyle = "#dfe8ff";
  ctx.beginPath();
  ctx.arc(740, 90, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,140,190,0.35)";
  ctx.beginPath();
  ctx.arc(728, 82, 8, 0, Math.PI * 2);
  ctx.arc(752, 104, 6, 0, Math.PI * 2);
  ctx.fill();

  // far pines
  const far = 0.25;
  const f0 = Math.floor((cam * far) / 120) - 1;
  ctx.fillStyle = "#0a1519";
  for (let i = f0; i < f0 + 10; i++) {
    const x = i * 120 - cam * far;
    const h = 150 + (Math.abs(i * 37) % 5) * 26;
    for (let t = 0; t < 4; t++) {
      const ty = FLOOR_TOP + 20 - h + t * (h / 4.5);
      const half = 20 + t * 14;
      ctx.beginPath();
      ctx.moveTo(x, ty - 30);
      ctx.lineTo(x - half, ty + 40);
      ctx.lineTo(x + half, ty + 40);
      ctx.closePath();
      ctx.fill();
    }
  }

  // fog band
  const fog = ctx.createLinearGradient(0, 230, 0, FLOOR_TOP + 30);
  fog.addColorStop(0, "rgba(150,190,200,0)");
  fog.addColorStop(1, `rgba(150,190,200,${0.16 + Math.sin(time * 0.6) * 0.04})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, 230, W, FLOOR_TOP - 200);

  // near gnarled trunks
  const near = 0.6;
  const n0 = Math.floor((cam * near) / 280) - 1;
  for (let i = n0; i < n0 + 6; i++) {
    const x = i * 280 + (Math.abs(i * 91) % 90) - cam * near;
    const w = 34 + (Math.abs(i * 13) % 20);
    ctx.fillStyle = "#050c0b";
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 8, FLOOR_TOP + 40);
    ctx.quadraticCurveTo(x - w / 2, 200, x - w / 2 + 4, -10);
    ctx.lineTo(x + w / 2 - 4, -10);
    ctx.quadraticCurveTo(x + w / 2, 200, x + w / 2 + 8, FLOOR_TOP + 40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#050c0b";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x, 150);
    ctx.quadraticCurveTo(x + 50, 110, x + 90, 120);
    ctx.moveTo(x, 80);
    ctx.quadraticCurveTo(x - 50, 50, x - 90, 62);
    ctx.stroke();
    ctx.fillStyle = "rgba(170,230,200,0.5)";
    ctx.beginPath();
    ctx.arc(x - 6, 250 + (i % 3) * 20, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ground
  const ground = ctx.createLinearGradient(0, FLOOR_TOP + 20, 0, H);
  ground.addColorStop(0, "#17261d");
  ground.addColorStop(1, "#0a130e");
  ctx.fillStyle = ground;
  ctx.fillRect(0, FLOOR_TOP + 20, W, H);
  ctx.strokeStyle = "rgba(60,110,70,0.6)";
  ctx.lineWidth = 2;
  const g0 = Math.floor(cam / 47);
  for (let k = g0; k < g0 + 22; k++) {
    const x = k * 47 - cam;
    const y = FLOOR_TOP + 35 + (Math.abs(k * 53) % 150);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y - 12);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 8, y - 10);
    ctx.stroke();
    if (k % 7 === 0) {
      ctx.fillStyle = "rgba(90,255,200,0.85)";
      ctx.beginPath();
      ctx.arc(x + 14, y - 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(90,255,200,0.15)";
      ctx.beginPath();
      ctx.arc(x + 14, y - 3, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // fireflies
  for (let k = 0; k < 26; k++) {
    const fx = (k * 181 + Math.sin(time * 0.5 + k) * 30 - cam * 0.8) % W;
    const x = fx < 0 ? fx + W : fx;
    const y = 100 + ((k * 67) % 330) + Math.cos(time * 0.7 + k) * 14;
    const a = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.5 + k * 2));
    ctx.fillStyle = `rgba(210,255,140,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const vig = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 620);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = "#ffd23f";
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#f0a800";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPile(ctx: CanvasRenderingContext2D, p: Pile, time: number, hayOnly = false) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 56, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (p.gold && !hayOnly) {
    ctx.fillStyle = "#e8a200";
    ctx.beginPath();
    ctx.ellipse(0, -6, 50, 24, 0, Math.PI, 0);
    ctx.ellipse(0, -6, 50, 8, 0, 0, Math.PI);
    ctx.fill();
    for (let k = 0; k < 16; k++) {
      const a = k * 2.4 + p.seed;
      drawCoin(ctx, Math.cos(a) * (10 + (k % 5) * 8), -8 - Math.abs(Math.sin(a)) * 22 + (k % 3) * 2, 8);
    }
    const glint = (Math.sin(time * 5 + p.seed) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + glint * 0.5})`;
    ctx.beginPath();
    ctx.arc(-14, -30, 2 + glint * 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#e3b94d";
    ctx.beginPath();
    ctx.ellipse(0, -4, 52, 30, 0, Math.PI, 0);
    ctx.ellipse(0, -4, 52, 9, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#a87a1e";
    ctx.lineWidth = 2;
    for (let k = 0; k < 18; k++) {
      const a = Math.PI + (k / 17) * Math.PI;
      const r = 20 + ((k * 7 + p.seed * 3) % 28);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, -4 + Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * r * 1.1, -4 + Math.sin(a) * r * 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWoman(ctx: CanvasRenderingContext2D, happy: boolean, time: number) {
  ctx.save();
  ctx.translate(WOMAN.x, WOMAN.y);
  const bob = Math.sin(time * (happy ? 6 : 2.2)) * (happy ? 3 : 1.2);
  // straw heap
  drawPile(ctx, { x: 0, y: 12, gold: false, seed: 40 }, time, true);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 62, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, bob);
  // dress
  ctx.fillStyle = "#6f86c9";
  ctx.beginPath();
  ctx.moveTo(-26, -70);
  ctx.quadraticCurveTo(-60, -10, -58, 8);
  ctx.lineTo(58, 8);
  ctx.quadraticCurveTo(60, -10, 26, -70);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8fa3dd";
  ctx.fillRect(-26, -72, 52, 14);
  // hair back
  ctx.fillStyle = "#e9cf8e";
  ctx.beginPath();
  ctx.ellipse(0, -100, 36, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  // face
  ctx.fillStyle = "#f6dccb";
  ctx.beginPath();
  ctx.ellipse(0, -98, 22, 27, 0, 0, Math.PI * 2);
  ctx.fill();
  // fringe
  ctx.fillStyle = "#e9cf8e";
  ctx.beginPath();
  ctx.ellipse(-8, -118, 26, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = "#3b2a22";
  const eyeH = happy ? 1.5 : 4;
  ctx.beginPath();
  ctx.ellipse(-8, -98, 3, eyeH, 0, 0, Math.PI * 2);
  ctx.ellipse(8, -98, 3, eyeH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c8776b";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (happy) {
    ctx.arc(0, -88, 8, 0.1 * Math.PI, 0.9 * Math.PI);
  } else {
    ctx.arc(0, -80, 6, 1.15 * Math.PI, 1.85 * Math.PI);
  }
  ctx.stroke();
  if (!happy) {
    ctx.fillStyle = "#7fc4ff";
    const drop = (time * 40) % 24;
    ctx.beginPath();
    ctx.ellipse(-11, -92 + drop, 2, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(11, -92 + ((drop + 12) % 24), 2, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(255,120,140,0.5)";
    ctx.beginPath();
    ctx.arc(-14, -90, 5, 0, Math.PI * 2);
    ctx.arc(14, -90, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // hands
  ctx.fillStyle = "#f6dccb";
  if (happy) {
    ctx.beginPath();
    ctx.arc(-40, -90 - Math.abs(Math.sin(time * 6)) * 10, 8, 0, Math.PI * 2);
    ctx.arc(40, -90 - Math.abs(Math.cos(time * 6)) * 10, 8, 0, Math.PI * 2);
  } else {
    ctx.beginPath();
    ctx.arc(-10, -78, 8, 0, Math.PI * 2);
    ctx.arc(10, -78, 8, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

type Hero = {
  x: number;
  y: number;
  face: number;
  phase: number;
  moving: boolean;
  danceT: number;
  spinT: number;
  kickT: number;
  inv: number;
  armed: boolean;
  fireT: number;
  deadT: number;
};

type EnemyKind = "goon" | "brute" | "rat" | "bat" | "zombie" | "skeleton" | "snowman" | "elf" | "gingerbread";
type Enemy = {
  x: number;
  y: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  state: "idle" | "walk" | "wind" | "hurt" | "dead";
  t: number;
  face: number;
  cd: number;
  frozen: boolean;
  vx: number;
  phase: number;
  spd: number;
  tx?: number;
  ty?: number;
  rt?: number;
  mvx?: number;
  mvy?: number;
  pause?: number;
  side?: number;
};

function drawRat(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 18, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (e.state === "dead") ctx.globalAlpha = Math.max(0, 1 - e.t / 0.6);
  if (e.frozen) ctx.filter = "saturate(0.25) hue-rotate(150deg) brightness(1.35)";
  ctx.scale(e.face, 1);
  if (e.state === "dead") ctx.rotate(-Math.min(1, e.t * 5) * 1.3);
  if (e.state === "hurt") ctx.translate(-4, 0);
  if (e.state === "wind") {
    const p = Math.min(1, e.t / 0.22);
    ctx.translate(p * 10, 0);
    ctx.rotate(-0.35 * p);
  }
  const run = e.state === "walk" ? Math.sin(e.phase * 1.6) : 0;
  ctx.strokeStyle = "#3d332e";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  [-8, -3, 6, 11].forEach((lx, i) => {
    ctx.beginPath();
    ctx.moveTo(lx, -6);
    ctx.lineTo(lx + run * 5 * (i % 2 ? 1 : -1), 0);
    ctx.stroke();
  });
  ctx.strokeStyle = "#e9a3a8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -9);
  ctx.quadraticCurveTo(-24, -4 + Math.sin(time * 8 + e.phase) * 4, -32, -12 + Math.sin(time * 6 + e.phase) * 4);
  ctx.stroke();
  ctx.fillStyle = "#6b5d55";
  ctx.beginPath();
  ctx.ellipse(0, -10, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a7a70";
  ctx.beginPath();
  ctx.ellipse(1, -7, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b5d55";
  ctx.beginPath();
  ctx.ellipse(15, -11, 8, 6, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e9a3a8";
  ctx.beginPath();
  ctx.arc(11, -18, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a3f39";
  ctx.beginPath();
  ctx.arc(11, -18, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8fa0";
  ctx.beginPath();
  ctx.arc(23, -11, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff2a2a";
  ctx.beginPath();
  ctx.arc(17, -13, 1.6, 0, Math.PI * 2);
  ctx.fill();
  if (e.state === "wind") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(20, -8, 2, 3);
    ctx.fillRect(23, -8, 2, 3);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(22, -11);
  ctx.lineTo(30, -14);
  ctx.moveTo(22, -10);
  ctx.lineTo(30, -9);
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  if (e.kind === "zombie") return drawZombie(ctx, e, time);
  if (e.kind === "skeleton") return drawSkeleton(ctx, e, time);
  if (e.kind === "bat") return drawBat(ctx, e, time);
  if (e.kind === "snowman") return drawSnowman(ctx, e, time);
  if (e.kind === "elf") return drawElf(ctx, e, time);
  if (e.kind === "gingerbread") return drawGingerbread(ctx, e, time);
  if (e.kind === "rat") {
    drawRat(ctx, e, time);
    return;
  }
  const brute = e.kind === "brute";
  const sc = brute ? 1.3 : 1;
  const skin = brute ? "#7d8268" : "#cdb8c8";
  const skinDark = brute ? "#4f5340" : "#8e7488";
  const robe = brute ? "#1d1a1c" : "#26252b";
  const robeHi = brute ? "#3a3538" : "#47454f";
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 3, 28 * sc, 8 * sc, 0, 0, Math.PI * 2);
  ctx.fill();
  if (e.state === "dead") ctx.globalAlpha = Math.max(0, 1 - e.t / 0.6);
  if (e.frozen) ctx.filter = "saturate(0.25) hue-rotate(150deg) brightness(1.35)";
  ctx.scale(e.face * sc, sc);
  if (e.state === "dead") ctx.rotate(-Math.min(1, e.t * 5) * 1.4);
  if (e.state === "hurt") {
    ctx.translate(-6, 0);
    ctx.rotate(-0.15);
  }
  const sw = e.state === "walk" ? Math.sin(e.phase) : 0;
  const breathe = Math.sin(time * 2 + e.phase) * 1.2;
  const hunch = brute ? 8 : 0;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // thin legs and shoes
  ctx.strokeStyle = "#0d0c10";
  ctx.lineWidth = brute ? 9 : 6;
  [-6, 6].forEach((lx, i) => {
    const off = sw * 9 * (i ? 1 : -1);
    ctx.beginPath();
    ctx.moveTo(lx, -38);
    ctx.lineTo(lx + off, -5);
    ctx.stroke();
    ctx.fillStyle = "#08070a";
    ctx.beginPath();
    ctx.ellipse(lx + off + 5, -3, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  const hand = (hx: number, hy: number) => {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 5, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(hx + k * 3, hy + 4);
      ctx.lineTo(hx + k * 4 + 2, hy + 15);
      ctx.stroke();
    }
  };
  const arm = (hx: number, hy: number, back: boolean) => {
    const sx = back ? -10 : 12;
    ctx.strokeStyle = back ? "#17161a" : robe;
    ctx.lineWidth = brute ? 11 : 8;
    ctx.beginPath();
    ctx.moveTo(sx, -84 + hunch);
    ctx.quadraticCurveTo((sx + hx) / 2 + (back ? -8 : 8), (-84 + hy) / 2 + 12, hx, hy);
    ctx.stroke();
    hand(hx, hy);
  };
  arm(-22 + sw * 6, -42, true);

  // robe with high collar and tattered hem
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-17, -90 + hunch);
  ctx.lineTo(17, -90 + hunch);
  ctx.lineTo(brute ? 28 : 22, -20);
  for (let k = 0; k < 6; k++) {
    const x = (brute ? 28 : 22) - k * ((brute ? 56 : 44) / 6);
    ctx.lineTo(x - 4, -14 - (k % 2) * 8);
  }
  ctx.lineTo(brute ? -28 : -22, -20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = robeHi;
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.moveTo(-12 + k * 6, -80 + hunch);
    ctx.lineTo(-14 + k * 7, -26);
    ctx.stroke();
  }
  ctx.fillStyle = "#111014";
  ctx.beginPath();
  ctx.moveTo(-6, -92 + hunch);
  ctx.lineTo(0, -60);
  ctx.lineTo(6, -92 + hunch);
  ctx.fill();
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-18, -88 + hunch);
  ctx.lineTo(-24, -106 + hunch);
  ctx.lineTo(-6, -92 + hunch);
  ctx.moveTo(18, -88 + hunch);
  ctx.lineTo(24, -106 + hunch);
  ctx.lineTo(6, -92 + hunch);
  ctx.fill();

  // neck
  ctx.fillStyle = skinDark;
  ctx.fillRect(-4, -104 + hunch, 8, 18);

  // head
  ctx.save();
  ctx.translate(brute ? 8 : 0, hunch ? -6 : 0);
  ctx.rotate(Math.sin(time * 1.3 + e.phase) * 0.05 + (brute ? 0.12 : 0));
  const hy0 = brute ? -100 : -122;
  const rx = brute ? 19 : 14;
  const ry = brute ? 21 : 24;
  ctx.fillStyle = skinDark;
  if (brute) {
    // huge curved horn-like ears
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(s * 15, hy0 + 2);
      ctx.bezierCurveTo(s * 40, hy0 - 6, s * 52, hy0 - 24, s * 40, hy0 - 44);
      ctx.bezierCurveTo(s * 38, hy0 - 26, s * 28, hy0 - 16, s * 14, hy0 - 12);
      ctx.closePath();
      ctx.fill();
    });
  } else {
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(s * (rx - 2), hy0 + 4);
      ctx.lineTo(s * (rx + 26), hy0 - 12);
      ctx.lineTo(s * (rx - 1), hy0 - 6);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = "#c9c9d6";
    ctx.beginPath();
    ctx.arc(rx - 1, hy0 + 10, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(-5, hy0 - 12, 2, 0, hy0, ry + 4);
  g.addColorStop(0, brute ? "#a2a88a" : "#efe0ea");
  g.addColorStop(1, skin);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, hy0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // hollow cheeks and sunken eyes
  ctx.fillStyle = "rgba(70,40,65,0.45)";
  ctx.beginPath();
  ctx.ellipse(-8, hy0 + 4, 4, 9, 0.2, 0, Math.PI * 2);
  ctx.ellipse(10, hy0 + 4, 4, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(40,20,40,0.7)";
  ctx.beginPath();
  ctx.ellipse(-5, hy0 - 3, 6.5, 5.5, 0, 0, Math.PI * 2);
  ctx.ellipse(9, hy0 - 3, 6.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = brute ? "#d9c96a" : "#d8d8e0";
  ctx.beginPath();
  ctx.ellipse(-5, hy0 - 3, 3.6, 3.2, 0, 0, Math.PI * 2);
  ctx.ellipse(9, hy0 - 3, 3.6, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#050305";
  const look = Math.sin(time * 0.9 + e.phase) * 0.8;
  ctx.beginPath();
  ctx.arc(-4 + look + 1.5, hy0 - 3, 1.5, 0, Math.PI * 2);
  ctx.arc(10 + look + 1.5, hy0 - 3, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // brow, nose, mouth
  ctx.strokeStyle = skinDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, hy0 - 10);
  ctx.quadraticCurveTo(-4, hy0 - 13, 1, hy0 - 8);
  ctx.moveTo(15, hy0 - 10);
  ctx.quadraticCurveTo(9, hy0 - 13, 4, hy0 - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, hy0 - 4);
  ctx.quadraticCurveTo(brute ? 12 : 7, hy0 + 8, brute ? 6 : 4, hy0 + 10);
  ctx.stroke();
  ctx.strokeStyle = "#3a1f33";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (brute) {
    ctx.moveTo(-6, hy0 + 15);
    ctx.quadraticCurveTo(3, hy0 + 20, 12, hy0 + 14);
    ctx.stroke();
    ctx.fillStyle = "#e4dcc0";
    ctx.beginPath();
    ctx.moveTo(-2, hy0 + 17);
    ctx.lineTo(0, hy0 + 24);
    ctx.lineTo(3, hy0 + 18);
    ctx.moveTo(6, hy0 + 18);
    ctx.lineTo(8, hy0 + 25);
    ctx.lineTo(10, hy0 + 16);
    ctx.fill();
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(-14, hy0 - 16 + k * 3);
      ctx.lineTo(14, hy0 - 15 + k * 3);
      ctx.stroke();
    }
  } else {
    const open = e.state === "wind" ? 4 : 0;
    ctx.moveTo(-3, hy0 + 14);
    ctx.quadraticCurveTo(3, hy0 + 14 + open, 10, hy0 + 13);
    ctx.stroke();
    if (open) {
      ctx.fillStyle = "#1a0a14";
      ctx.beginPath();
      ctx.ellipse(3.5, hy0 + 16, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // sheen
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(-4, hy0 - 18, 5, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (e.state === "wind") {
    const p = Math.min(1, e.t / 0.4);
    if (p < 0.75) arm(22, -112 + p * 10 + breathe, false);
    else arm(58, -64, false);
  } else {
    arm(26 - sw * 6, -42, false);
  }

  if (e.frozen) {
    ctx.fillStyle = "rgba(170,230,255,0.4)";
    ctx.strokeStyle = "rgba(220,250,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-32, -150, 64, 156, 12);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  if (e.hp < e.maxHp && e.state !== "dead") {
    const w = 46 * sc;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(e.x - w / 2, e.y - 160 * sc, w, 6);
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(e.x - w / 2, e.y - 160 * sc, (w * e.hp) / e.maxHp, 6);
  }
}

function drawTommy(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "#6b4423";
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-28, 6);
  ctx.lineTo(-4, 5);
  ctx.fill();
  ctx.fillStyle = "#2a2a2e";
  ctx.fillRect(-6, -7, 20, 12);
  ctx.fillStyle = "#1a1a1e";
  ctx.fillRect(14, -5, 20, 5);
  ctx.fillStyle = "#4a4a52";
  for (let k = 0; k < 4; k++) ctx.fillRect(16 + k * 4, -6, 2, 7);
  ctx.fillStyle = "#6b4423";
  ctx.fillRect(18, 0, 5, 10);
  ctx.fillStyle = "#15151a";
  ctx.beginPath();
  ctx.arc(4, 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5a5a64";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(4, 8, 5, 0, Math.PI * 2);
  ctx.moveTo(4, 3);
  ctx.lineTo(4, 13);
  ctx.moveTo(-1, 8);
  ctx.lineTo(9, 8);
  ctx.stroke();
  ctx.restore();
}

function drawHero(ctx: CanvasRenderingContext2D, h: Hero, time0: number) {
  const dancing = h.danceT > 0;
  const spinning = h.spinT >= 0;
  const elapsed = dancing ? DANCE_TIME - h.danceT : 0;
  const ph = h.phase;
  ctx.save();
  ctx.translate(h.x, h.y);
  if (h.inv > 0 && !dancing && Math.floor(h.inv * 20) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 3, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (h.deadT >= 0) {
    const t = h.deadT;
    let ang = Math.PI / 2;
    if (t < 0.45) ang = 0.5 * (t / 0.45) ** 2;
    else if (t < 0.9) ang = 0.5 + (Math.PI / 2 - 0.5) * ((t - 0.45) / 0.45) ** 2;
    else if (t < 1.05) ang = Math.PI / 2 - 0.12 * Math.sin(((t - 0.9) / 0.15) * Math.PI);
    ctx.translate(
      -h.face * Math.min(t, 0.9) * 55,
      -(t < 0.45 ? Math.sin((t / 0.45) * Math.PI) * 22 : 0) - (ang / (Math.PI / 2)) * 22,
    );
    ctx.rotate(-h.face * ang);
  }
  let sx = h.face;
  let hop = 0;
  if (spinning) {
    const p = h.spinT / SPIN_TIME;
    sx = Math.cos(p * Math.PI * 4);
    if (Math.abs(sx) < 0.12) sx = 0.12;
    hop = Math.sin(p * Math.PI) * 34;
  }
  ctx.translate(0, -hop);
  ctx.scale(sx, 1);

  const active = h.moving || dancing;
  const stepL = active ? Math.max(0, Math.sin(ph)) * (dancing ? 15 : 9) : 0;
  const stepR = active ? Math.max(0, -Math.sin(ph)) * (dancing ? 15 : 9) : 0;

  // legs + tiptoe shoes
  ctx.strokeStyle = "#17152b";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  const legs: [number, number][] = [
    [-8, stepL],
    [8, stepR],
  ];
  const kickExt = h.kickT >= 0 ? Math.sin((h.kickT / KICK_TIME) * Math.PI) : 0;
  legs.forEach(([lx0, lift0], idx) => {
    const kicking = idx === 1 && kickExt > 0;
    const lx = kicking ? lx0 + 46 * kickExt : lx0;
    const lift = kicking ? 32 * kickExt : lift0;
    ctx.beginPath();
    ctx.moveTo(lx0, -34);
    ctx.lineTo(lx, -10 - lift);
    ctx.stroke();
    ctx.fillStyle = "#0d0c1a";
    const sy = -5 - lift;
    ctx.beginPath();
    ctx.moveTo(lx - 7, sy - 4);
    ctx.quadraticCurveTo(lx + 6, sy - 6, lx + 38, sy - 13);
    ctx.quadraticCurveTo(lx + 22, sy + 1, lx + 8, sy + 5);
    ctx.lineTo(lx - 7, sy + 5);
    ctx.closePath();
    ctx.fill();
  });

  // head sway
  const sway = dancing ? Math.sin(ph * 0.5) * 0.18 : 0;
  const armSwing =
    h.deadT >= 0 ? (h.deadT < 0.5 ? Math.sin(h.deadT * 30) : 0.2) : dancing ? Math.sin(ph) : active ? Math.sin(ph) * 0.4 : 0;
  const shh = dancing && elapsed < 1.1;

  // back arm
  const arm = (side: number, raise: number, finger: boolean) => {
    const shx = side * 20;
    const shy = -78;
    let hx: number;
    let hy: number;
    if (finger) {
      hx = 6;
      hy = -112;
    } else {
      hx = shx + side * (18 + raise * 16);
      hy = shy + 22 - raise * 34;
    }
    ctx.strokeStyle = "#2b2749";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(shx, shy);
    ctx.lineTo(finger ? 30 : (shx + hx) / 2 + side * 4, finger ? -80 : (shy + hy) / 2 + 6);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = "#f3d3c0";
    ctx.beginPath();
    ctx.arc(hx, hy, 6.5, 0, Math.PI * 2);
    ctx.fill();
  };
  arm(-1, spinning ? 1 : -armSwing * 0.8 + (dancing ? 0.5 : 0), false);

  // tailcoat
  ctx.fillStyle = "#2b2749";
  ctx.beginPath();
  ctx.moveTo(-22, -80);
  ctx.lineTo(22, -80);
  ctx.lineTo(28, -30);
  ctx.lineTo(10, -16);
  ctx.lineTo(0, -34);
  ctx.lineTo(-10, -16);
  ctx.lineTo(-28, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(160,150,230,0.35)";
  for (let k = 0; k < 9; k++) {
    ctx.beginPath();
    ctx.ellipse(-16 + (k % 3) * 16, -72 + Math.floor(k / 3) * 17, 5, 3, k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f6e3df";
  ctx.beginPath();
  ctx.moveTo(-8, -80);
  ctx.lineTo(8, -80);
  ctx.lineTo(4, -42);
  ctx.lineTo(-4, -42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e2a9b8";
  ctx.beginPath();
  ctx.arc(0, -56, 2, 0, Math.PI * 2);
  ctx.arc(0, -47, 2, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.save();
  ctx.translate(0, -84);
  ctx.rotate(sway);
  ctx.fillStyle = "#ecd3c6";
  ctx.beginPath();
  ctx.ellipse(0, -30, 27, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-27, -28, 5, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(27, -28, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // wispy curly hair
  ctx.fillStyle = "#ecd09a";
  for (let k = 0; k < 11; k++) {
    const a = Math.PI * 1.05 + (k / 10) * Math.PI * 0.9;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 29, -30 + Math.sin(a) * 34, 8 + (k % 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#ecd09a";
  ctx.lineWidth = 2;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.moveTo(-14 + k * 7, -60);
    ctx.quadraticCurveTo(-18 + k * 9, -76 - (k % 2) * 6, -8 + k * 8, -74);
    ctx.stroke();
  }
  // face (pale, wide-eyed, long nose, too-big grin)
  ctx.fillStyle = "#e4b8a8";
  ctx.beginPath();
  ctx.ellipse(-22, -22, 9, 11, 0, 0, Math.PI * 2);
  ctx.ellipse(22, -22, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,70,80,0.28)";
  ctx.beginPath();
  ctx.ellipse(-11, -27, 9, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(11, -27, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-11, -33, 8, 7.5, 0, 0, Math.PI * 2);
  ctx.ellipse(11, -33, 8, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const stare = Math.sin(time0 * 1.7) * 1.2;
  ctx.fillStyle = "#7a5230";
  ctx.beginPath();
  ctx.arc(-10 + stare, -33, 4.4, 0, Math.PI * 2);
  ctx.arc(12 + stare, -33, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0505";
  ctx.beginPath();
  ctx.arc(-10 + stare, -33, 2, 0, Math.PI * 2);
  ctx.arc(12 + stare, -33, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-11 + stare, -35, 1, 0, Math.PI * 2);
  ctx.arc(11 + stare, -35, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a07868";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(-11, -33, 8, 7.5, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(11, -33, 8, 7.5, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.strokeStyle = "#a98860";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-20, -43);
  ctx.quadraticCurveTo(-12, -51, -3, -44);
  ctx.moveTo(20, -42);
  ctx.quadraticCurveTo(12, -52, 3, -43);
  ctx.stroke();
  ctx.strokeStyle = "rgba(140,100,90,0.5)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-14, -56);
  ctx.quadraticCurveTo(0, -60, 14, -56);
  ctx.moveTo(-10, -52);
  ctx.quadraticCurveTo(0, -55, 10, -52);
  ctx.stroke();
  ctx.strokeStyle = "#a07868";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1, -35);
  ctx.quadraticCurveTo(-5, -22, -4, -19);
  ctx.quadraticCurveTo(0, -16, 4, -19);
  ctx.stroke();
  if (shh) {
    ctx.fillStyle = "#c4616a";
    ctx.beginPath();
    ctx.ellipse(1, -10, 8, 2.6, -0.12, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#4a1018";
    ctx.beginPath();
    ctx.moveTo(-14, -15);
    ctx.quadraticCurveTo(0, -3, 16, -19);
    ctx.quadraticCurveTo(2, -13, -14, -15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f4ecd8";
    ctx.beginPath();
    ctx.moveTo(-12, -14.5);
    ctx.quadraticCurveTo(0, -9, 14, -17.5);
    ctx.lineTo(13, -15.5);
    ctx.quadraticCurveTo(0, -8, -11, -12.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#c4616a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-15, -15.5);
    ctx.quadraticCurveTo(0, -2, 17, -20);
    ctx.stroke();
  }
  if (h.deadT >= 0.45) {
    ctx.fillStyle = "#ecd3c6";
    ctx.beginPath();
    ctx.ellipse(-11, -33, 8.5, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(11, -33, 8.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a1a14";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    [-11, 11].forEach((ex) => {
      ctx.moveTo(ex - 5, -38);
      ctx.lineTo(ex + 5, -28);
      ctx.moveTo(ex + 5, -38);
      ctx.lineTo(ex - 5, -28);
    });
    ctx.stroke();
  }
  ctx.restore();

  // bow tie
  ctx.fillStyle = "#0b0a14";
  ctx.beginPath();
  ctx.moveTo(0, -80);
  ctx.lineTo(-12, -86);
  ctx.lineTo(-12, -74);
  ctx.closePath();
  ctx.moveTo(0, -80);
  ctx.lineTo(12, -86);
  ctx.lineTo(12, -74);
  ctx.closePath();
  ctx.fill();

  // front arm
  const holding = h.armed && !dancing && !spinning;
  arm(1, spinning ? 1 : holding ? 0.2 : armSwing * 0.8 + (dancing ? 0.5 : 0), shh);
  if (holding) {
    drawTommy(ctx, 26, -62, 1);
    if (h.fireT > 0) {
      ctx.fillStyle = "#fff3a0";
      ctx.beginPath();
      ctx.moveTo(60, -66);
      ctx.lineTo(78, -76);
      ctx.lineTo(70, -66);
      ctx.lineTo(80, -60);
      ctx.lineTo(60, -63);
      ctx.fill();
    }
  }

  ctx.restore();
}


type Boss = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: "dormant" | "intro" | "idle" | "tele" | "pounce" | "land" | "cast" | "dying" | "dead";
  t: number;
  face: number;
  hurtT: number;
  invT: number;
  frozen: boolean;
  atk: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  air: number;
  fired: boolean;
  kind: "cat" | "frank" | "santa";
  mode: number;
};
type Strike = { x: number; y: number; t: number; hit: boolean; gift?: boolean };
type Shot = { x: number; y: number; vx: number; kind: "orb" | "wave"; life: number };

const BOSS_MIN_X = 2960;
const BOSS_MAX_X = 3400;
const GATE_X = WOMAN.x - 250;

const makeBoss = (level = 2): Boss => ({
  kind: level === 2 ? "cat" : level === 3 ? "frank" : "santa",
  mode: 0,
  x: 3320,
  y: 430,
  hp: level === 2 ? 40 : level === 3 ? 50 : 60,
  maxHp: level === 2 ? 40 : level === 3 ? 50 : 60,
  state: "dormant",
  t: 0,
  face: -1,
  hurtT: 0,
  invT: 0,
  frozen: false,
  atk: 0,
  sx: 0,
  sy: 0,
  tx: 0,
  ty: 0,
  air: 0,
  fired: false,
});

function drawBoss(ctx: CanvasRenderingContext2D, b: Boss, time: number) {
  const ph2 = b.hp <= b.maxHp / 2;
  const asleep = b.state === "dormant";
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  const sh = Math.max(0.4, 1 - b.air / 300);
  ctx.ellipse(0, 4, 120 * sh, 24 * sh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -b.air);
  if (b.state === "dying") {
    ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8);
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(b.t * 40);
  }
  if (b.frozen) ctx.filter = "saturate(0.25) hue-rotate(150deg) brightness(1.35)";
  const squash = b.state === "tele" ? 0.86 : b.state === "land" && b.t < 0.2 ? 0.8 : 1;
  ctx.scale(b.face * 2.1, 2.1 * squash);

  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  const aura = ctx.createRadialGradient(0, -70, 20, 0, -70, 140);
  aura.addColorStop(0, `rgba(170,110,255,${0.3 + pulse * 0.15})`);
  aura.addColorStop(1, "rgba(170,110,255,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(-160, -220, 320, 260);

  // tails
  ctx.lineCap = "round";
  [0, 1].forEach((k) => {
    ctx.strokeStyle = "#2a1d55";
    ctx.lineWidth = 12;
    ctx.beginPath();
    const w = Math.sin(time * 2.2 + k) * 14;
    ctx.moveTo(-70, -70);
    ctx.bezierCurveTo(-120, -70 + w, -130 - k * 20, -140 - w, -100 - k * 25, -190 - k * 10);
    ctx.stroke();
    ctx.fillStyle = ph2 ? "#ff6a6a" : "#8fffe0";
    ctx.beginPath();
    ctx.arc(-100 - k * 25, -190 - k * 10, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // legs
  [-58, -36, 36, 58].forEach((lx, i) => {
    ctx.fillStyle = i % 2 ? "#241a4d" : "#1b1340";
    ctx.fillRect(lx - 8, -46, 16, 44);
    ctx.fillStyle = "#cbbcff";
    ctx.beginPath();
    ctx.ellipse(lx + 3, -3, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // body
  const body = ctx.createLinearGradient(0, -115, 0, -20);
  body.addColorStop(0, "#43308c");
  body.addColorStop(1, "#1a1040");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -66, 84, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7dcff";
  for (let k = 0; k < 22; k++) {
    const sx = -70 + ((k * 37) % 140);
    const sy = -100 + ((k * 23) % 60);
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 2 + k));
    ctx.fillRect(sx, sy, 2.4, 2.4);
  }
  ctx.globalAlpha = b.state === "dying" ? 0.8 : 1;
  ctx.strokeStyle = ph2 ? "#ff7a5a" : "#7dffd9";
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(-50 + k * 28, -108);
    ctx.lineTo(-44 + k * 28, -88);
    ctx.lineTo(-54 + k * 28, -78);
    ctx.stroke();
  }

  // head
  ctx.fillStyle = "#2a1d62";
  ctx.beginPath();
  ctx.moveTo(58, -124);
  ctx.lineTo(62, -156);
  ctx.lineTo(86, -128);
  ctx.moveTo(92, -126);
  ctx.lineTo(116, -152);
  ctx.lineTo(114, -112);
  ctx.fill();
  ctx.fillStyle = "#ff9ad5";
  ctx.beginPath();
  ctx.moveTo(66, -128);
  ctx.lineTo(66, -146);
  ctx.lineTo(80, -130);
  ctx.moveTo(98, -128);
  ctx.lineTo(108, -142);
  ctx.lineTo(108, -118);
  ctx.fill();
  const hg = ctx.createRadialGradient(80, -110, 5, 84, -92, 50);
  hg.addColorStop(0, "#5a43b3");
  hg.addColorStop(1, "#2a1d62");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(86, -92, 46, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd86a";
  ctx.beginPath();
  ctx.moveTo(88, -124);
  ctx.lineTo(95, -114);
  ctx.lineTo(88, -104);
  ctx.lineTo(81, -114);
  ctx.closePath();
  ctx.fill();
  const eye = ph2 ? "#ff3b3b" : "#7dffd9";
  if (asleep) {
    ctx.strokeStyle = eye;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(62, -98);
    ctx.lineTo(80, -96);
    ctx.moveTo(96, -96);
    ctx.lineTo(114, -98);
    ctx.stroke();
  } else {
    ctx.shadowColor = eye;
    ctx.shadowBlur = 14;
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.ellipse(72, -98, 11, 8, -0.25, 0, Math.PI * 2);
    ctx.ellipse(104, -98, 11, 8, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0a0518";
    ctx.beginPath();
    ctx.ellipse(73, -98, 2.4, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(105, -98, 2.4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ff8fb8";
  ctx.beginPath();
  ctx.moveTo(84, -84);
  ctx.lineTo(96, -84);
  ctx.lineTo(90, -76);
  ctx.closePath();
  ctx.fill();
  const open = b.state === "intro" || (b.state === "cast" && b.t > 0.4) || b.state === "pounce" ? 14 : 3;
  ctx.fillStyle = "#14051f";
  ctx.beginPath();
  ctx.moveTo(72, -70);
  ctx.quadraticCurveTo(90, -64 + open, 108, -70);
  ctx.quadraticCurveTo(90, -72, 72, -70);
  ctx.fill();
  if (open > 3) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(76, -70);
    ctx.lineTo(80, -58);
    ctx.lineTo(84, -70);
    ctx.moveTo(96, -70);
    ctx.lineTo(100, -58);
    ctx.lineTo(104, -70);
    ctx.fill();
  }
  if (b.state === "cast") {
    const r = Math.min(1, b.t / 0.9);
    ctx.fillStyle = `rgba(200,120,255,${0.3 + r * 0.6})`;
    ctx.beginPath();
    ctx.arc(126, -70, 6 + r * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(230,220,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  [-8, 0, 8].forEach((o) => {
    ctx.moveTo(108, -80 + o / 2);
    ctx.lineTo(140, -86 + o * 1.5);
  });
  ctx.stroke();

  if (b.hurtT > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(0, -66, 84, 46, 0, 0, Math.PI * 2);
    ctx.ellipse(86, -92, 46, 38, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (b.frozen) {
    ctx.fillStyle = "rgba(170,230,255,0.35)";
    ctx.fillRect(-100, -160, 250, 165);
  }
  ctx.restore();

  if (b.state === "land") {
    ctx.fillStyle = "#ffe46b";
    ctx.font = "900 26px sans-serif";
    ctx.textAlign = "center";
    for (let k = 0; k < 3; k++) {
      const a = time * 4 + k * 2.1;
      ctx.fillText("\u2605", b.x + b.face * 80 + Math.cos(a) * 40, b.y - 215 + Math.sin(a) * 8);
    }
  }
  if (b.state === "tele") {
    ctx.fillStyle = "#ff3b3b";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.font = "900 64px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText("!", b.x + b.face * 70, b.y - 250);
    ctx.fillText("!", b.x + b.face * 70, b.y - 250);
  }
}

function drawGraveyard(ctx: CanvasRenderingContext2D, time: number, cam: number, boltX: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP + 20);
  sky.addColorStop(0, "#0b0a1a");
  sky.addColorStop(1, "#262338");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FLOOR_TOP + 20);

  const glow = ctx.createRadialGradient(220, 100, 10, 220, 100, 190);
  glow.addColorStop(0, "rgba(220,225,255,0.4)");
  glow.addColorStop(1, "rgba(220,225,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 460, 300);
  ctx.fillStyle = "#e9ecff";
  ctx.beginPath();
  ctx.arc(220, 100, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,125,170,0.35)";
  ctx.beginPath();
  ctx.arc(206, 90, 9, 0, Math.PI * 2);
  ctx.arc(236, 116, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(20,18,36,0.75)";
  for (let k = 0; k < 4; k++) {
    const cx = ((k * 320 + time * 8 - cam * 0.05) % (W + 300)) - 150;
    ctx.beginPath();
    ctx.ellipse(cx, 60 + k * 38, 150, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 70, 52 + k * 38, 90, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (boltX >= 0) {
    ctx.strokeStyle = "rgba(235,240,255,0.95)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#bcd0ff";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    let bx = boltX;
    let by = 0;
    ctx.moveTo(bx, by);
    while (by < 300) {
      bx += (Math.random() - 0.5) * 50;
      by += 30 + Math.random() * 25;
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const c0 = Math.floor((cam * 0.35) / 1100) - 1;
  for (let i = c0; i < c0 + 3; i++) {
    const x = i * 1100 + 500 - cam * 0.35;
    ctx.fillStyle = "#0d0c18";
    ctx.fillRect(x, 170, 150, 160);
    ctx.beginPath();
    ctx.moveTo(x - 10, 172);
    ctx.lineTo(x + 75, 100);
    ctx.lineTo(x + 160, 172);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + 150, 120, 46, 210);
    ctx.beginPath();
    ctx.moveTo(x + 144, 122);
    ctx.lineTo(x + 173, 62);
    ctx.lineTo(x + 202, 122);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,170,60,${0.7 + Math.sin(time * 3 + i) * 0.15})`;
    ctx.fillRect(x + 30, 210, 22, 36);
    ctx.fillRect(x + 100, 210, 22, 36);
    ctx.fillRect(x + 164, 160, 14, 28);
  }

  const t0 = Math.floor((cam * 0.5) / 320) - 1;
  ctx.strokeStyle = "#08070f";
  ctx.lineCap = "round";
  for (let i = t0; i < t0 + 5; i++) {
    const x = i * 320 + 130 + (Math.abs(i * 71) % 80) - cam * 0.5;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_TOP + 25);
    ctx.quadraticCurveTo(x + 14, 230, x - 6, 150);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x - 4, 190);
    ctx.quadraticCurveTo(x - 50, 160, x - 80, 120);
    ctx.moveTo(x - 6, 150);
    ctx.quadraticCurveTo(x + 40, 120, x + 70, 70);
    ctx.moveTo(x - 6, 150);
    ctx.lineTo(x - 20, 90);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 60, 138);
    ctx.lineTo(x - 90, 140);
    ctx.moveTo(x + 40, 112);
    ctx.lineTo(x + 78, 112);
    ctx.stroke();
  }

  const f0 = Math.floor((cam * 0.75) / 26) - 1;
  ctx.strokeStyle = "#14121f";
  ctx.lineWidth = 4;
  for (let k = f0; k < f0 + 42; k++) {
    const x = k * 26 - cam * 0.75;
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_TOP + 24);
    ctx.lineTo(x, 262);
    ctx.stroke();
    ctx.fillStyle = "#14121f";
    ctx.beginPath();
    ctx.moveTo(x - 5, 266);
    ctx.lineTo(x, 248);
    ctx.lineTo(x + 5, 266);
    ctx.fill();
  }
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 285);
  ctx.lineTo(W, 285);
  ctx.moveTo(0, 322);
  ctx.lineTo(W, 322);
  ctx.stroke();

  const ground = ctx.createLinearGradient(0, FLOOR_TOP + 20, 0, H);
  ground.addColorStop(0, "#232a2b");
  ground.addColorStop(1, "#0f1314");
  ctx.fillStyle = ground;
  ctx.fillRect(0, FLOOR_TOP + 20, W, H);

  const g0 = Math.floor(cam / 130) - 1;
  for (let k = g0; k < g0 + 9; k++) {
    const x = k * 130 + 40 + (Math.abs(k * 53) % 50) - cam;
    const y = FLOOR_TOP + 24 + (Math.abs(k * 37) % 12);
    const kind = Math.abs(k) % 5;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a555a";
    if (kind === 0) {
      ctx.beginPath();
      ctx.roundRect(x - 18, y - 58, 36, 58, [18, 18, 2, 2]);
      ctx.fill();
    } else if (kind === 1) {
      ctx.fillRect(x - 6, y - 70, 12, 70);
      ctx.fillRect(x - 22, y - 54, 44, 11);
    } else if (kind === 2) {
      ctx.fillRect(x - 26, y - 38, 52, 38);
    } else if (kind === 3) {
      ctx.beginPath();
      ctx.moveTo(x - 14, y);
      ctx.lineTo(x - 8, y - 84);
      ctx.lineTo(x + 8, y - 84);
      ctx.lineTo(x + 14, y);
      ctx.fill();
    } else {
      const fl = 0.75 + Math.sin(time * 7 + k) * 0.15;
      ctx.fillStyle = `rgba(255,140,30,${0.25 * fl})`;
      ctx.beginPath();
      ctx.arc(x, y - 16, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e9741a";
      ctx.beginPath();
      ctx.ellipse(x, y - 16, 20, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,230,90,${fl})`;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 20);
      ctx.lineTo(x - 4, y - 26);
      ctx.lineTo(x - 2, y - 19);
      ctx.moveTo(x + 10, y - 20);
      ctx.lineTo(x + 4, y - 26);
      ctx.lineTo(x + 2, y - 19);
      ctx.moveTo(x - 10, y - 10);
      ctx.lineTo(x, y - 6);
      ctx.lineTo(x + 10, y - 10);
      ctx.lineTo(x + 6, y - 13);
      ctx.lineTo(x, y - 10);
      ctx.lineTo(x - 6, y - 13);
      ctx.fill();
      ctx.fillStyle = "#2a5a2a";
      ctx.fillRect(x - 2, y - 36, 4, 6);
    }
    if (kind < 4) {
      ctx.strokeStyle = "rgba(20,25,28,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 36);
      ctx.lineTo(x + 6, y - 36);
      ctx.moveTo(x - 6, y - 28);
      ctx.lineTo(x + 3, y - 28);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgba(70,90,80,0.7)";
  ctx.lineWidth = 2;
  const gg = Math.floor(cam / 53);
  for (let k = gg; k < gg + 20; k++) {
    const x = k * 53 - cam;
    const y = FLOOR_TOP + 40 + (Math.abs(k * 41) % 150);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y - 11);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 7, y - 9);
    ctx.stroke();
  }

  const mist = ctx.createLinearGradient(0, 300, 0, H);
  mist.addColorStop(0, "rgba(170,190,200,0)");
  mist.addColorStop(0.4, `rgba(170,190,200,${0.12 + Math.sin(time * 0.5) * 0.03})`);
  mist.addColorStop(1, "rgba(170,190,200,0)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 300, W, H - 300);

  const vig = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 620);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function enemyFrame(ctx: CanvasRenderingContext2D, e: Enemy, shadowW: number, body: () => void) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 3, shadowW, shadowW * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  if (e.state === "dead") ctx.globalAlpha = Math.max(0, 1 - e.t / 0.6);
  if (e.frozen) ctx.filter = "saturate(0.25) hue-rotate(150deg) brightness(1.35)";
  ctx.scale(e.face, 1);
  if (e.state === "dead") ctx.rotate(-Math.min(1, e.t * 5) * 1.4);
  if (e.state === "hurt") {
    ctx.translate(-6, 0);
    ctx.rotate(-0.15);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  body();
  if (e.frozen) {
    ctx.fillStyle = "rgba(170,230,255,0.4)";
    ctx.strokeStyle = "rgba(220,250,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-30, -128, 60, 132, 12);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  if (e.hp < e.maxHp && e.state !== "dead") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(e.x - 23, e.y - 140, 46, 6);
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(e.x - 23, e.y - 140, (46 * e.hp) / e.maxHp, 6);
  }
}

function armAngle(e: Enemy, sw: number, back: boolean) {
  if (e.state === "wind") return e.t / (e.kind === "zombie" || e.kind === "snowman" ? 0.55 : 0.3) < 0.7 ? -1.25 : 1.0;
  return -0.1 + sw * 0.14 * (back ? 1 : -1);
}

function drawZombie(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  enemyFrame(ctx, e, 28, () => {
    const sw = e.state === "walk" ? Math.sin(e.phase) : 0;
    const skin = "#86a67f";
    const arm = (sx: number, ang: number, color: string) => {
      const hx = sx + Math.cos(ang) * 46;
      const hy = -80 + Math.sin(ang) * 46;
      ctx.strokeStyle = color;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(sx, -80);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
    };
    arm(-8, armAngle(e, sw, true), "#3e3426");
    ctx.strokeStyle = "#2f3326";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-7, -36);
    ctx.lineTo(-7 + sw * 8, -5);
    ctx.moveTo(7, -36);
    ctx.lineTo(7 - sw * 3, -5);
    ctx.stroke();
    ctx.fillStyle = "#14130e";
    ctx.beginPath();
    ctx.ellipse(-3 + sw * 8, -3, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.ellipse(11 - sw * 3, -3, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a4b37";
    ctx.beginPath();
    ctx.moveTo(-19, -88);
    ctx.lineTo(19, -88);
    ctx.lineTo(21, -34);
    for (let k = 0; k < 5; k++) ctx.lineTo(21 - (k + 1) * 8.4, -34 + (k % 2 ? -2 : 7));
    ctx.lineTo(-21, -34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d8d2b4";
    ctx.fillRect(2, -76, 13, 20);
    ctx.strokeStyle = "#7b6f55";
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(2, -73 + k * 5);
      ctx.lineTo(15, -73 + k * 5);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(110,20,20,0.7)";
    ctx.beginPath();
    ctx.ellipse(-8, -52, 6, 9, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(0, -90);
    ctx.rotate(Math.sin(time * 1.6 + e.phase) * 0.14 + 0.1);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, -14, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3c4a38";
    ctx.beginPath();
    ctx.ellipse(-8, -8, 5, 9, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2f26";
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(-12 + k * 7, -28);
      ctx.lineTo(-10 + k * 7, -38 - (k % 2) * 4);
      ctx.lineTo(-6 + k * 7, -28);
      ctx.fill();
    }
    ctx.fillStyle = "#0b0b08";
    ctx.beginPath();
    ctx.arc(-5, -17, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "#d6ff6a";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#e8f26a";
    ctx.beginPath();
    ctx.arc(7, -17, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0b0b08";
    ctx.beginPath();
    ctx.ellipse(1, -3, 7, 4 + Math.abs(Math.sin(time * 3 + e.phase)) * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cfc9a8";
    ctx.fillRect(-4, -6, 3, 3);
    ctx.fillRect(2, -6, 3, 3);
    ctx.strokeStyle = "#3c4a38";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, -26);
    ctx.lineTo(-4, -22);
    ctx.lineTo(-10, -20);
    ctx.stroke();
    ctx.restore();
    arm(12, armAngle(e, sw, false), "#4a3a2a");
  });
}

function drawSkeleton(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  enemyFrame(ctx, e, 24, () => {
    const sw = e.state === "walk" ? Math.sin(e.phase) : 0;
    const bone = "#e8e4d4";
    ctx.strokeStyle = bone;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-6, -38);
    ctx.lineTo(-6 + sw * 9, -5);
    ctx.moveTo(6, -38);
    ctx.lineTo(6 - sw * 9, -5);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-6 + sw * 9, -4);
    ctx.lineTo(2 + sw * 9, -4);
    ctx.moveTo(6 - sw * 9, -4);
    ctx.lineTo(14 - sw * 9, -4);
    ctx.stroke();
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.ellipse(0, -38, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = bone;
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(0, -86);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(0, -52 - k * 8, 13 - k, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-16, -84);
    ctx.lineTo(16, -84);
    ctx.stroke();
    const arm = (sx: number, ang: number) => {
      const ex = sx + Math.cos(ang) * 22;
      const ey = -84 + Math.sin(ang) * 22;
      const hx = ex + Math.cos(ang + 0.4) * 22;
      const hy = ey + Math.sin(ang + 0.4) * 22;
      ctx.strokeStyle = bone;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, -84);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      return [hx, hy];
    };
    arm(-14, armAngle(e, sw, true) + 0.5);
    const [hx, hy] = arm(14, armAngle(e, sw, false) + 0.3);
    ctx.strokeStyle = "#6b4a2a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy + 8);
    ctx.lineTo(hx + 8, hy - 22);
    ctx.stroke();
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.arc(0, -102, 15, 0, Math.PI * 2);
    ctx.fill();
    const jaw = e.state === "walk" ? 2 + Math.abs(Math.sin(time * 12 + e.phase)) * 4 : e.state === "wind" ? 7 : 2;
    ctx.fillRect(-9, -91, 18, 5 + jaw);
    ctx.fillStyle = "#0b0a08";
    ctx.beginPath();
    ctx.arc(-6, -104, 4.6, 0, Math.PI * 2);
    ctx.arc(6, -104, 4.6, 0, Math.PI * 2);
    ctx.moveTo(0, -98);
    ctx.lineTo(-2.5, -93);
    ctx.lineTo(2.5, -93);
    ctx.fill();
    ctx.shadowColor = "#ff8a2a";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ff9a3a";
    ctx.beginPath();
    ctx.arc(-6, -104, 1.8, 0, Math.PI * 2);
    ctx.arc(6, -104, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#8b8672";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -6; k <= 6; k += 3) {
      ctx.moveTo(k, -91);
      ctx.lineTo(k, -86 + jaw);
    }
    ctx.stroke();
  });
}

function drawBat(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const wind = e.state === "wind" ? Math.min(1, e.t / 0.22) : 0;
  const hover = 80 + Math.sin(time * 5 + e.phase) * 8 - wind * 55;
  ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - hover / 160)})`;
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (e.state === "dead") ctx.globalAlpha = Math.max(0, 1 - e.t / 0.6);
  if (e.frozen) ctx.filter = "saturate(0.25) hue-rotate(150deg) brightness(1.35)";
  ctx.translate(wind * 14 * e.face, -hover + (e.state === "dead" ? e.t * 200 : 0));
  ctx.scale(e.face, 1);
  const flap = e.frozen ? 0.3 : Math.sin(time * 18 + e.phase * 2);
  ctx.fillStyle = "#2a1b3d";
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 5, -3);
    ctx.quadraticCurveTo(s * 22, -22 - flap * 14, s * 40, -8 - flap * 18);
    ctx.lineTo(s * 33, -2 - flap * 8);
    ctx.lineTo(s * 26, 3 - flap * 5);
    ctx.lineTo(s * 18, 0);
    ctx.lineTo(s * 11, 6);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = "#3b2650";
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(-5, -17);
  ctx.lineTo(-1, -9);
  ctx.moveTo(6, -8);
  ctx.lineTo(5, -17);
  ctx.lineTo(1, -9);
  ctx.fill();
  ctx.fillStyle = "#ff3030";
  ctx.beginPath();
  ctx.arc(-3, -3, 1.8, 0, Math.PI * 2);
  ctx.arc(3, -3, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(-3, 3);
  ctx.lineTo(-2, 7);
  ctx.lineTo(-1, 3);
  ctx.moveTo(1, 3);
  ctx.lineTo(2, 7);
  ctx.lineTo(3, 3);
  ctx.fill();
  ctx.restore();
}

function drawFrank(ctx: CanvasRenderingContext2D, b: Boss, time: number) {
  const ph2 = b.hp <= b.maxHp / 2;
  const S = 1.45;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 62, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  if (b.state === "dying") {
    ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6);
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(b.t * 40);
  }
  if (b.frozen) ctx.filter = "saturate(0.25) hue-rotate(150deg) brightness(1.35)";
  let lean = 0;
  let crouch = 0;
  let a1 = -0.05;
  let a2 = -0.05;
  const stepP = b.state === "idle" ? Math.sin(time * 5) : 0;
  const cast0 = b.state === "cast" && b.mode === 0;
  if (cast0) {
    a1 = -1.15 + Math.sin(time * 22) * 0.1;
    a2 = a1 - 0.2;
  } else if (b.state === "cast") {
    a1 = !b.fired ? -2.2 : 1.2;
    a2 = a1;
  } else if (b.state === "tele") {
    lean = 0.12;
    crouch = 8;
    a1 = 2.7;
    a2 = 2.5;
  } else if (b.state === "pounce") {
    lean = 0.25;
  } else if (b.state === "land") {
    lean = 0.3;
    crouch = 6;
    a1 = 1.4;
    a2 = 1.3;
  } else if (b.state === "dormant") {
    a1 = 1.45;
    a2 = 1.45;
  } else if (b.state === "idle") {
    a1 = -0.05 + stepP * 0.06;
    a2 = -0.05 - stepP * 0.06;
  }
  ctx.scale(b.face * S, S);
  ctx.rotate(lean);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const skin = "#9bbd96";
  const arm = (sx: number, ang: number, color: string) => {
    const hx = sx + Math.cos(ang) * 54;
    const hy = -92 + crouch + Math.sin(ang) * 54;
    ctx.strokeStyle = color;
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(sx, -92 + crouch);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 8.5, 0, Math.PI * 2);
    ctx.fill();
    return [hx, hy];
  };
  const [bhx, bhy] = arm(-14, a2, "#1c202a");
  ctx.strokeStyle = "#252a38";
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(-10, -46 + crouch);
  ctx.lineTo(-10 + stepP * 8, -10);
  ctx.moveTo(10, -46 + crouch);
  ctx.lineTo(10 - stepP * 8, -10);
  ctx.stroke();
  ctx.fillStyle = "#0b0c10";
  ctx.beginPath();
  ctx.roundRect(-22 + stepP * 8, -12, 28, 12, 3);
  ctx.roundRect(-2 - stepP * 8, -12, 28, 12, 3);
  ctx.fill();
  ctx.fillStyle = "#2b303c";
  ctx.beginPath();
  ctx.roundRect(-26, -104 + crouch, 52, 62, 5);
  ctx.fill();
  ctx.fillStyle = "#e5e0d0";
  ctx.beginPath();
  ctx.moveTo(-7, -104 + crouch);
  ctx.lineTo(7, -104 + crouch);
  ctx.lineTo(4, -52 + crouch);
  ctx.lineTo(-4, -52 + crouch);
  ctx.fill();
  ctx.strokeStyle = "#1a1d26";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-7, -104 + crouch);
  ctx.lineTo(-14, -80 + crouch);
  ctx.lineTo(-4, -56 + crouch);
  ctx.moveTo(7, -104 + crouch);
  ctx.lineTo(14, -80 + crouch);
  ctx.lineTo(4, -56 + crouch);
  ctx.stroke();
  ctx.fillStyle = "#8c9096";
  ctx.fillRect(-27, -108 + crouch, 7, 5);
  ctx.fillRect(20, -108 + crouch, 7, 5);
  ctx.fillStyle = "#5d6066";
  ctx.fillRect(-33, -110 + crouch, 6, 9);
  ctx.fillRect(27, -110 + crouch, 6, 9);
  ctx.save();
  ctx.translate(0, crouch);
  ctx.rotate(b.state === "land" ? Math.sin(time * 8) * 0.18 : 0);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.roundRect(-20, -144, 40, 42, 5);
  ctx.fill();
  ctx.fillStyle = "#0e0f12";
  ctx.beginPath();
  ctx.moveTo(-21, -142);
  ctx.lineTo(-21, -154);
  ctx.lineTo(21, -154);
  ctx.lineTo(21, -142);
  for (let k = 0; k < 6; k++) ctx.lineTo(21 - (k + 1) * 7, -142 + (k % 2 ? -3 : 5));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6e8c6a";
  ctx.fillRect(-20, -131, 40, 7);
  const eye = ph2 ? "#ff3b3b" : "#ffe36a";
  ctx.shadowColor = eye;
  ctx.shadowBlur = 8;
  ctx.fillStyle = eye;
  ctx.fillRect(-13, -123, 8, 4);
  ctx.fillRect(5, -123, 8, 4);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(-10, -123, 2.5, 4);
  ctx.fillRect(8, -123, 2.5, 4);
  ctx.strokeStyle = "#5a7557";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -122);
  ctx.lineTo(-3, -112);
  ctx.lineTo(3, -112);
  ctx.moveTo(-9, -139);
  ctx.lineTo(-3, -135);
  ctx.lineTo(-8, -133);
  ctx.lineTo(-2, -129);
  ctx.stroke();
  ctx.strokeStyle = "#2a2f28";
  ctx.lineWidth = 2.5;
  const open = b.state === "cast" || b.state === "pounce" ? 6 : 0;
  ctx.beginPath();
  ctx.moveTo(-10, -106);
  ctx.lineTo(10, -106 + open * 0.3);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let k = -8; k <= 8; k += 4) {
    ctx.beginPath();
    ctx.moveTo(k, -109);
    ctx.lineTo(k, -103 + open * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  const [fhx, fhy] = arm(14, a1, "#242833");
  if (cast0) {
    ctx.strokeStyle = "rgba(190,230,255,0.95)";
    ctx.shadowColor = "#7fd0ff";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      let px = k % 2 ? fhx : bhx;
      let py = k % 2 ? fhy : bhy;
      const tx = (fhx + bhx) / 2 + (Math.random() - 0.5) * 40;
      const ty = Math.min(fhy, bhy) - 30 - Math.random() * 40;
      ctx.moveTo(px, py);
      for (let s = 1; s <= 4; s++) {
        px += (tx - px) / (5 - s) + (Math.random() - 0.5) * 16;
        py += (ty - py) / (5 - s) + (Math.random() - 0.5) * 10;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  if (b.hurtT > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(-26, -154 + crouch, 52, 112);
  }
  ctx.restore();
  if (b.state === "land") {
    ctx.fillStyle = "#ffe46b";
    ctx.font = "900 26px sans-serif";
    ctx.textAlign = "center";
    for (let k = 0; k < 3; k++) {
      const a = time * 4 + k * 2.1;
      ctx.fillText("\u2605", b.x + Math.cos(a) * 36, b.y - 235 + Math.sin(a) * 8);
    }
  }
  if (b.state === "tele") {
    ctx.fillStyle = "#ff3b3b";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.font = "900 64px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText("!", b.x, b.y - 245);
    ctx.fillText("!", b.x, b.y - 245);
  }
}

const makeThugs = (level = 1): Enemy[] =>
  Array.from({ length: level === 1 ? 11 : 10 }, (_, i) => {
    const brute = level === 1 ? i % 4 === 3 : i % 3 === 2;
    return {
      x: 950 + i * (level === 1 ? 240 : 190) + (i % 2) * 40,
      y: [400, 470, 360, 500, 430][i % 5],
      kind: brute ? "brute" : "goon",
      hp: brute ? 6 : 3,
      maxHp: brute ? 6 : 3,
      state: "idle",
      t: 0,
      face: -1,
      cd: 0.6 + (i % 3) * 0.3,
      frozen: false,
      vx: 0,
      phase: i,
      spd: brute ? 70 : 100 + (i % 3) * 12,
    } as Enemy;
  });

function drawChristmas(ctx: CanvasRenderingContext2D, time: number, cam: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP + 20);
  sky.addColorStop(0, "#070e2b");
  sky.addColorStop(1, "#27407a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FLOOR_TOP + 20);
  for (let k = 0; k < 46; k++) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.6 * Math.abs(Math.sin(time * 1.5 + k))})`;
    ctx.fillRect((k * 211) % W, (k * 97) % 200, 2, 2);
  }
  ctx.lineCap = "round";
  [0, 1, 2].forEach((b) => {
    ctx.strokeStyle = `rgba(${b === 1 ? "140,120,255" : "80,255,180"},0.09)`;
    ctx.lineWidth = 46;
    ctx.beginPath();
    for (let x = -40; x <= W + 40; x += 40) {
      const y = 70 + b * 38 + Math.sin(x * 0.012 + time * 0.4 + b) * 26;
      if (x === -40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  const m0 = Math.floor((cam * 0.15) / 420) - 1;
  for (let i = m0; i < m0 + 4; i++) {
    const x = i * 420 - cam * 0.15;
    const peak = 140 + (Math.abs(i * 37) % 50);
    ctx.fillStyle = "#2c4478";
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_TOP + 25);
    ctx.lineTo(x + 210, peak);
    ctx.lineTo(x + 420, FLOOR_TOP + 25);
    ctx.fill();
    ctx.fillStyle = "#e8f0ff";
    ctx.beginPath();
    ctx.moveTo(x + 210, peak);
    ctx.lineTo(x + 170, peak + 55);
    ctx.lineTo(x + 250, peak + 55);
    ctx.fill();
  }
  const t0 = Math.floor((cam * 0.5) / 150) - 1;
  for (let i = t0; i < t0 + 9; i++) {
    const x = i * 150 + (Math.abs(i * 53) % 40) - cam * 0.5;
    const h = 150 + (Math.abs(i * 29) % 60);
    ctx.fillStyle = "#4a2f1a";
    ctx.fillRect(x - 6, FLOOR_TOP + 10, 12, 18);
    for (let t = 0; t < 3; t++) {
      const ty = FLOOR_TOP + 14 - h + t * (h / 3.2);
      const half = 26 + t * 18;
      ctx.fillStyle = "#0f4a35";
      ctx.beginPath();
      ctx.moveTo(x, ty - 20);
      ctx.lineTo(x - half, ty + 52);
      ctx.lineTo(x + half, ty + 52);
      ctx.fill();
      ctx.fillStyle = "#eef4ff";
      ctx.beginPath();
      ctx.moveTo(x, ty - 20);
      ctx.lineTo(x - half * 0.55, ty + 14);
      ctx.lineTo(x - half * 0.2, ty + 8);
      ctx.lineTo(x + half * 0.2, ty + 16);
      ctx.lineTo(x + half * 0.55, ty + 12);
      ctx.fill();
      const cols = ["#ff4d4d", "#ffd23f", "#4da6ff", "#5dff8a"];
      for (let b = 0; b < 3; b++) {
        ctx.fillStyle = cols[(i + t + b) % 4];
        ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(time * 3 + i + t + b));
        ctx.beginPath();
        ctx.arc(x - half * 0.45 + b * half * 0.45, ty + 38 - (b % 2) * 8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  const cane = (x: number, top: number, bottom: number, r: number, w: number) => {
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, top);
    ctx.arc(x + r, top, r, Math.PI, 0);
    ctx.lineTo(x + 2 * r, top + 24);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = w;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.strokeStyle = "#e0262c";
    ctx.setLineDash([w * 0.9, w * 0.9]);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const c0 = Math.floor((cam * 0.7) / 440) - 1;
  for (let i = c0; i < c0 + 4; i++) {
    cane(i * 440 + 120 - cam * 0.7, 120, FLOOR_TOP + 26, 34, 18);
  }
  const ground = ctx.createLinearGradient(0, FLOOR_TOP + 20, 0, H);
  ground.addColorStop(0, "#d6e3fa");
  ground.addColorStop(1, "#8aa3d2");
  ctx.fillStyle = ground;
  ctx.fillRect(0, FLOOR_TOP + 20, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  const d0 = Math.floor(cam / 170) - 1;
  for (let k = d0; k < d0 + 8; k++) {
    const x = k * 170 + 40 - cam;
    const y = FLOOR_TOP + 60 + (Math.abs(k * 71) % 130);
    ctx.beginPath();
    ctx.ellipse(x, y, 70, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const g0 = Math.floor(cam / 300) - 1;
  for (let k = g0; k < g0 + 5; k++) {
    const x = k * 300 + 90 + (Math.abs(k * 41) % 60) - cam;
    const y = FLOOR_TOP + 30;
    if (k % 2) {
      cane(x, y - 70, y, 15, 9);
    } else {
      ctx.fillStyle = ["#e0262c", "#2a9d4a", "#3b6fe0"][Math.abs(k) % 3];
      ctx.fillRect(x - 20, y - 36, 40, 36);
      ctx.fillStyle = "#ffe46b";
      ctx.fillRect(x - 4, y - 36, 8, 36);
      ctx.fillRect(x - 20, y - 22, 40, 7);
      ctx.beginPath();
      ctx.ellipse(x - 8, y - 42, 9, 6, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + 8, y - 42, 9, 6, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let k = 0; k < 24; k++) {
    const sx = (((k * 83 - cam) % W) + W) % W;
    ctx.fillRect(sx, FLOOR_TOP + 40 + ((k * 61) % 150), 2, 2);
  }
  const vig = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 640);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(5,10,40,0.4)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function drawSnow(ctx: CanvasRenderingContext2D, time: number, cam: number) {
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let k = 0; k < 110; k++) {
    const depth = 0.4 + (k % 3) * 0.3;
    const x = ((((k * 131 + time * (18 + (k % 5) * 7) - cam * depth) % W) + W) % W) + Math.sin(time * 1.3 + k) * 12;
    const y = (k * 57 + time * (55 + (k % 4) * 25)) % H;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + (k % 3) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnowman(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  enemyFrame(ctx, e, 32, () => {
    const sw = e.state === "walk" ? Math.sin(e.phase) : 0;
    ctx.rotate(sw * 0.05);
    const ball = (y: number, r: number) => {
      const g = ctx.createRadialGradient(-r * 0.3, y - r * 0.3, r * 0.1, 0, y, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#b9cdea");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const arm = (sx: number, ang: number) => {
      const hx = sx + Math.cos(ang) * 46;
      const hy = -70 + Math.sin(ang) * 46;
      ctx.strokeStyle = "#5a3a1c";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, -70);
      ctx.lineTo(hx, hy);
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(ang - 0.5) * 12, hy + Math.sin(ang - 0.5) * 12);
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(ang + 0.5) * 12, hy + Math.sin(ang + 0.5) * 12);
      ctx.stroke();
    };
    arm(-16, armAngle(e, sw, true) + 0.3);
    ball(-26, 26);
    ball(-68, 20);
    ball(-100, 15);
    ctx.fillStyle = "#0b0b0b";
    [0, 1, 2].forEach((i) => {
      ctx.beginPath();
      ctx.arc(0, -78 + i * 12, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#c8202e";
    ctx.fillRect(-14, -90, 28, 7);
    ctx.fillStyle = "#2a9d4a";
    ctx.fillRect(-14, -90, 8, 7);
    ctx.fillRect(2, -90, 8, 7);
    ctx.fillRect(10, -84, 7, 18);
    ctx.fillStyle = "#16161c";
    ctx.fillRect(-14, -118, 28, 5);
    ctx.fillRect(-9, -138, 18, 22);
    ctx.fillStyle = "#c8202e";
    ctx.fillRect(-9, -122, 18, 5);
    ctx.shadowColor = "#ff2a2a";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ff3a3a";
    ctx.beginPath();
    ctx.arc(-4, -104, 2.8, 0, Math.PI * 2);
    ctx.arc(7, -104, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff8a1e";
    ctx.beginPath();
    ctx.moveTo(8, -100);
    ctx.lineTo(28, -97);
    ctx.lineTo(8, -94);
    ctx.fill();
    ctx.fillStyle = "#0b0b0b";
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(-6 + k * 4.5, -89 + Math.abs(k - 2) * 1.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    arm(16, armAngle(e, sw, false));
  });
}

function drawElf(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  enemyFrame(ctx, e, 24, () => {
    const sw = e.state === "walk" ? Math.sin(e.phase) : 0;
    [-6, 6].forEach((lx, i) => {
      const off = sw * 9 * (i ? 1 : -1);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(lx, -36);
      ctx.lineTo(lx + off, -6);
      ctx.stroke();
      ctx.strokeStyle = "#e0262c";
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#2a9d4a";
      ctx.beginPath();
      ctx.moveTo(lx + off - 7, -4);
      ctx.quadraticCurveTo(lx + off + 6, -10, lx + off + 20, -14);
      ctx.quadraticCurveTo(lx + off + 12, 0, lx + off - 7, 2);
      ctx.fill();
    });
    ctx.fillStyle = "#2a9d4a";
    ctx.beginPath();
    ctx.moveTo(-14, -84);
    ctx.lineTo(14, -84);
    ctx.lineTo(18, -34);
    ctx.lineTo(-18, -34);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-18, -38, 36, 5);
    ctx.fillStyle = "#3a2410";
    ctx.fillRect(-16, -58, 32, 5);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(-4, -59, 8, 7);
    const arm = (sx: number, ang: number, club: boolean) => {
      const hx = sx + Math.cos(ang) * 38;
      const hy = -80 + Math.sin(ang) * 38;
      ctx.strokeStyle = "#2a9d4a";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(sx, -80);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = "#f2c3a0";
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      if (club) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + 4, hy - 30);
        ctx.arc(hx + 10, hy - 30, 6, Math.PI, 0);
        ctx.stroke();
        ctx.strokeStyle = "#e0262c";
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    arm(-12, armAngle(e, sw, true) + 0.5, false);
    ctx.fillStyle = "#f2c3a0";
    ctx.beginPath();
    ctx.moveTo(-14, -98);
    ctx.lineTo(-30, -104);
    ctx.lineTo(-12, -90);
    ctx.moveTo(14, -98);
    ctx.lineTo(30, -104);
    ctx.lineTo(12, -90);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -98, 15, 0, Math.PI * 2);
    ctx.fill();
    const bell = Math.sin(time * 4 + e.phase) * 4;
    ctx.fillStyle = "#e0262c";
    ctx.beginPath();
    ctx.moveTo(-16, -104);
    ctx.quadraticCurveTo(0, -150, 30, -138 + bell);
    ctx.lineTo(16, -104);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-17, -108, 34, 6);
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(30, -136 + bell, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "#ff2a2a";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ff3a3a";
    ctx.beginPath();
    ctx.arc(-5, -100, 2.2, 0, Math.PI * 2);
    ctx.arc(6, -100, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#4a1010";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -106);
    ctx.lineTo(-2, -103);
    ctx.moveTo(10, -106);
    ctx.lineTo(3, -103);
    ctx.stroke();
    ctx.fillStyle = "#4a0a0a";
    ctx.beginPath();
    ctx.moveTo(-8, -92);
    ctx.quadraticCurveTo(0, -84 + (e.state === "wind" ? 4 : 0), 9, -92);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-4, -92, 3, 3);
    ctx.fillRect(2, -92, 3, 3);
    arm(12, armAngle(e, sw, false) + 0.3, true);
  });
}

function drawGingerbread(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  enemyFrame(ctx, e, 16, () => {
    const sw = e.state === "walk" ? Math.sin(e.phase * 1.6) : 0;
    const wind = e.state === "wind";
    if (wind) {
      const p = Math.min(1, e.t / 0.22);
      ctx.translate(p * 10, 0);
      ctx.rotate(0.3 * p);
    }
    ctx.scale(0.55, 0.55);
    const cookie = "#b8733a";
    ctx.strokeStyle = cookie;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(-7, -26);
    ctx.lineTo(-9 + sw * 8, -2);
    ctx.moveTo(7, -26);
    ctx.lineTo(9 - sw * 8, -2);
    ctx.moveTo(-14, -50);
    ctx.lineTo(-30 + sw * 4, -38 - (wind ? 20 : 0));
    ctx.moveTo(14, -50);
    ctx.lineTo(30 - sw * 4, -38 - (wind ? 20 : 0));
    ctx.stroke();
    ctx.fillStyle = cookie;
    ctx.beginPath();
    ctx.ellipse(0, -42, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -74, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-30 + sw * 4, -38);
    ctx.lineTo(-24 + sw * 4, -42);
    ctx.lineTo(-18, -48);
    ctx.moveTo(30 - sw * 4, -38);
    ctx.lineTo(24 - sw * 4, -42);
    ctx.lineTo(18, -48);
    ctx.moveTo(-9 + sw * 8, -8);
    ctx.lineTo(-7 + sw * 8, -2);
    ctx.moveTo(9 - sw * 8, -8);
    ctx.lineTo(7 - sw * 8, -2);
    ctx.stroke();
    ctx.fillStyle = "#e0262c";
    ctx.beginPath();
    ctx.arc(0, -50, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a9d4a";
    ctx.beginPath();
    ctx.arc(0, -40, 3.2, 0, Math.PI * 2);
    ctx.arc(0, -30, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-6, -77, 3, 0, Math.PI * 2);
    ctx.arc(7, -77, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c01818";
    ctx.beginPath();
    ctx.arc(-5, -77, 1.6, 0, Math.PI * 2);
    ctx.arc(8, -77, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -67);
    ctx.quadraticCurveTo(0, -60 + (wind ? 4 : 0), 9, -67);
    ctx.moveTo(-10, -84);
    ctx.lineTo(-3, -81);
    ctx.moveTo(11, -84);
    ctx.lineTo(4, -81);
    ctx.stroke();
    void time;
  });
}

function drawSanta(ctx: CanvasRenderingContext2D, b: Boss, time: number) {
  const ph2 = b.hp <= b.maxHp / 2;
  const S = 1.75;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 82, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  if (b.state === "dying") {
    ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6);
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(b.t * 40);
  }
  if (b.frozen) ctx.filter = "saturate(0.25) hue-rotate(150deg) brightness(1.35)";
  let lean = 0;
  let crouch = 0;
  let a1 = 0.9;
  let a2 = 0.9;
  const bob = b.state === "idle" ? Math.sin(time * 5) : 0;
  const gift = b.state === "cast" && b.mode === 0 && !b.fired;
  if (b.state === "cast") {
    a1 = !b.fired ? -2.2 : 1.2;
    a2 = a1;
  } else if (b.state === "tele") {
    lean = 0.12;
    crouch = 10;
    a1 = 2.7;
    a2 = 2.5;
  } else if (b.state === "pounce") {
    lean = 0.22;
    a1 = -0.1;
    a2 = -0.1;
  } else if (b.state === "land") {
    lean = 0.28;
    crouch = 8;
    a1 = 1.4;
    a2 = 1.3;
  } else if (b.state === "idle") {
    a1 = 0.9 + bob * 0.08;
    a2 = 0.9 - bob * 0.08;
  }
  ctx.scale(b.face * S, S);
  ctx.rotate(lean);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const red = "#c8201e";
  ctx.fillStyle = "#7a4a22";
  ctx.beginPath();
  ctx.ellipse(-46, -84 + crouch, 30, 38, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0262c";
  ctx.fillRect(-58, -126 + crouch, 14, 12);
  ctx.fillStyle = "#2a9d4a";
  ctx.fillRect(-42, -122 + crouch, 12, 10);
  const arm = (sx: number, ang: number) => {
    const hx = sx + Math.cos(ang) * 56;
    const hy = -100 + crouch + Math.sin(ang) * 56;
    ctx.strokeStyle = red;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(sx, -100 + crouch);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(hx - Math.cos(ang) * 6, hy - Math.sin(ang) * 6, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#16161a";
    ctx.beginPath();
    ctx.arc(hx, hy, 10, 0, Math.PI * 2);
    ctx.fill();
    return [hx, hy];
  };
  arm(-34, a2);
  ctx.strokeStyle = red;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(-14, -48 + crouch);
  ctx.lineTo(-14 + bob * 6, -12);
  ctx.moveTo(14, -48 + crouch);
  ctx.lineTo(14 - bob * 6, -12);
  ctx.stroke();
  ctx.fillStyle = "#101014";
  ctx.beginPath();
  ctx.roundRect(-30 + bob * 6, -16, 34, 16, 4);
  ctx.roundRect(-4 - bob * 6, -16, 34, 16, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-28 + bob * 6, -22, 30, 8);
  ctx.fillRect(-2 - bob * 6, -22, 30, 8);
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.ellipse(0, -76 + crouch, 46, 42 + bob, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, -36 + crouch, 44, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-6, -112 + crouch, 12, 76);
  ctx.fillStyle = "#101014";
  ctx.fillRect(-45, -70 + crouch, 90, 11);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(-9, -73 + crouch, 18, 17);
  ctx.fillStyle = "#101014";
  ctx.fillRect(-4, -68 + crouch, 8, 7);
  ctx.save();
  ctx.translate(0, crouch);
  ctx.rotate(b.state === "land" ? Math.sin(time * 8) * 0.16 : 0);
  ctx.fillStyle = "#f1c6a5";
  ctx.beginPath();
  ctx.arc(0, -128, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,110,110,0.45)";
  ctx.beginPath();
  ctx.arc(-14, -122, 6, 0, Math.PI * 2);
  ctx.arc(14, -122, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, -108, 30, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f1c6a5";
  ctx.beginPath();
  ctx.ellipse(0, -122, 15, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e9a08c";
  ctx.beginPath();
  ctx.arc(2, -120, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-9, -113, 11, 5, 0.3, 0, Math.PI * 2);
  ctx.ellipse(9, -113, 11, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  if (b.state === "dormant") {
    ctx.strokeStyle = "#3a2a2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -132);
    ctx.lineTo(-5, -131);
    ctx.moveTo(14, -132);
    ctx.lineTo(5, -131);
    ctx.stroke();
  } else {
    const eye = ph2 ? "#ff3b3b" : "#1c1c28";
    ctx.shadowColor = eye;
    ctx.shadowBlur = ph2 ? 10 : 0;
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(-9, -131, 3.4, 0, Math.PI * 2);
    ctx.arc(9, -131, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#e8e8f0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-17, -139);
    ctx.lineTo(-3, -134);
    ctx.moveTo(17, -139);
    ctx.lineTo(3, -134);
    ctx.stroke();
  }
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(-24, -140);
  ctx.quadraticCurveTo(-4, -186, 44, -150 + Math.sin(time * 3) * 3);
  ctx.lineTo(24, -140);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(-27, -148, 54, 12, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(46, -146 + Math.sin(time * 3) * 3, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const [fhx, fhy] = arm(34, a1);
  if (gift) {
    ctx.fillStyle = "#e0262c";
    ctx.fillRect(fhx - 16, fhy - 30, 32, 28);
    ctx.fillStyle = "#ffe46b";
    ctx.fillRect(fhx - 3, fhy - 30, 6, 28);
    ctx.fillRect(fhx - 16, fhy - 18, 32, 6);
    ctx.beginPath();
    ctx.ellipse(fhx - 7, fhy - 34, 8, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(fhx + 7, fhy - 34, 8, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (b.hurtT > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(0, -76 + crouch, 46, 42, 0, 0, Math.PI * 2);
    ctx.arc(0, -128 + crouch, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.font = "900 30px sans-serif";
  ctx.textAlign = "center";
  if (b.state === "land") {
    ctx.fillStyle = "#ffe46b";
    for (let k = 0; k < 3; k++) {
      const a = time * 4 + k * 2.1;
      ctx.fillText("\u2605", b.x + Math.cos(a) * 40, b.y - 285 + Math.sin(a) * 8);
    }
  }
  if (b.state === "tele") {
    ctx.fillStyle = "#ff3b3b";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.font = "900 64px sans-serif";
    ctx.strokeText("!", b.x, b.y - 290);
    ctx.fillText("!", b.x, b.y - 290);
  }
  if (b.state === "intro" || b.state === "dormant") {
    ctx.font = "900 34px sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#5a0d0d";
    ctx.fillStyle = "#fff";
    const txt = b.state === "dormant" ? "Zzz" : "HO HO HO!";
    ctx.strokeText(txt, b.x, b.y - 300);
    ctx.fillText(txt, b.x, b.y - 300);
  }
}

const tiny = (e: Enemy) => e.kind === "rat" || e.kind === "bat" || e.kind === "gingerbread";
const dmgOf = (e: Enemy) =>
  ({ goon: 8, brute: 16, rat: 4, bat: 5, zombie: 11, skeleton: 7, snowman: 11, elf: 7, gingerbread: 4 })[e.kind];
const windupOf = (e: Enemy) =>
  ({ goon: 0.4, brute: 0.4, rat: 0.22, bat: 0.22, zombie: 0.55, skeleton: 0.3, snowman: 0.55, elf: 0.3, gingerbread: 0.22 })[e.kind];
const reachOf = (e: Enemy) =>
  ({ goon: 76, brute: 90, rat: 46, bat: 46, zombie: 82, skeleton: 76, snowman: 82, elf: 76, gingerbread: 46 })[e.kind];
const cdOf = (e: Enemy) => (tiny(e) ? 0.8 : e.kind === "zombie" || e.kind === "snowman" ? 1.6 : 1.3);

function makeCookie(x: number, y: number, i: number): Enemy {
  return { x, y, kind: "gingerbread", hp: 1, maxHp: 1, state: "walk", t: 0, face: -1, cd: 0.4, frozen: false, vx: 0, phase: i, spd: 190 };
}

const makeNorthPole = (): Enemy[] => {
  const mk = (kind: EnemyKind, x: number, y: number, hp: number, spd: number, i: number): Enemy => ({
    x,
    y,
    kind,
    hp,
    maxHp: hp,
    state: "idle",
    t: 0,
    face: -1,
    cd: 0.5 + (i % 3) * 0.3,
    frozen: false,
    vx: 0,
    phase: i,
    spd,
  });
  const ys = [400, 470, 360, 500, 430];
  return [
    ...Array.from({ length: 6 }, (_, i) => mk("snowman", 900 + i * 330 + (i % 2) * 40, ys[i % 5], 4, 55, i)),
    ...Array.from({ length: 6 }, (_, i) => mk("elf", 1000 + i * 350, ys[(i + 2) % 5], 2, 125, i)),
    ...Array.from({ length: 10 }, (_, i) => mk("gingerbread", 700 + i * 220 + (i % 3) * 40, ys[(i + 1) % 5], 1, 190, i)),
  ].sort((a, b) => a.x - b.x);
};

const makeGrave = (): Enemy[] => {
  const mk = (kind: EnemyKind, x: number, y: number, hp: number, spd: number, i: number): Enemy => ({
    x,
    y,
    kind,
    hp,
    maxHp: hp,
    state: "idle",
    t: 0,
    face: -1,
    cd: 0.5 + (i % 3) * 0.3,
    frozen: false,
    vx: 0,
    phase: i,
    spd,
  });
  const ys = [400, 470, 360, 500, 430];
  return [
    ...Array.from({ length: 7 }, (_, i) => mk("zombie", 900 + i * 300 + (i % 2) * 40, ys[i % 5], 4, 55, i)),
    ...Array.from({ length: 5 }, (_, i) => mk("skeleton", 1050 + i * 430, ys[(i + 2) % 5], 2, 120, i)),
    ...Array.from({ length: 9 }, (_, i) => mk("bat", 700 + i * 260 + (i % 3) * 40, ys[(i + 1) % 5], 1, 190, i)),
  ].sort((a, b) => a.x - b.x);
};

const makeEnemies = (level = 1): Enemy[] => {
  if (level === 3) return makeGrave();
  if (level === 4) return makeNorthPole();
  const rats: Enemy[] =
    level === 2
      ? Array.from({ length: 10 }, (_, i) => ({
          x: 800 + i * 220 + (i % 3) * 50,
          y: [380, 450, 490, 410, 470][i % 5],
          kind: "rat" as const,
          hp: 1,
          maxHp: 1,
          state: "idle" as const,
          t: 0,
          face: -1,
          cd: 0.3,
          frozen: false,
          vx: 0,
          phase: i,
          spd: 170 + (i % 3) * 20,
        }))
      : [];
  return [...makeThugs(level), ...rats].sort((a, b) => a.x - b.x);
};

const GUN_PIXELS = ["111111111", "111111100", "001111000", "001101000"];
const LEVELS = [
  { n: 1, name: "The Barn" },
  { n: 2, name: "The Dark Forest" },
  { n: 3, name: "The Graveyard" },
  { n: 4, name: "The North Pole" },
];
const HEART_PIXELS = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
const STAR_PIXELS = ["0001000", "0001000", "1111111", "0111110", "0011100", "0110110", "1100011"];

function PixelIcon({ rows, color }: { rows: string[]; color: string }) {
  return (
    <svg
      width={rows[0].length * 2}
      height={rows.length * 2}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      shapeRendering="crispEdges"
      className="block"
      style={{ imageRendering: "pixelated" }}
    >
      {rows.flatMap((row, y) =>
        row.split("").map((c, x) => (c === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)),
      )}
    </svg>
  );
}

type Status = "playing" | "won" | "lost";

export function RumpelGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const actionsRef = useRef({
    spin: () => {},
    dance: () => {},
    kick: () => {},
    restart: () => {},
    retry: () => {},
    pause: () => {},
    throwGun: () => {},
    shoot: (_on: boolean) => {},
    goLevel: (_n: number) => {},
  });
  const [armed, setArmed] = useState(false);
  const [ammo, setAmmo] = useState(100);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(1);
  const [countdown, setCountdown] = useState(5);
  const [coins, setCoins] = useState(0);
  const [hp, setHp] = useState(MAX_HP);
  const [charges, setCharges] = useState(2);
  const [status, setStatus] = useState<Status>("playing");
  const [musicOn, setMusicOn] = useState(true);
  const [bloodOn, setBloodOn] = useState(true);
  const bloodRef = useRef(true);
  const [trackMissing, setTrackMissing] = useState(false);
  const [trackSrc, setTrackSrc] = useState(TRACK_SRC);

  const playSpecial = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.volume = 0.9;
    a.play().catch(() => {});
  }, []);

  const stopSpecial = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
  }, []);

  const toggleBlood = () => {
    bloodRef.current = !bloodRef.current;
    setBloodOn(bloodRef.current);
  };

  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMusicOn(!a.muted);
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = new Set<string>();
    const hero: Hero = {
      x: 120,
      y: 440,
      face: 1,
      phase: 0,
      moving: false,
      danceT: 0,
      spinT: -1,
      kickT: -1,
      inv: 0,
      armed: false,
      fireT: 0,
      deadT: -1,
    };
    let piles = makePiles();
    let enemies = makeEnemies(1);
    let level = 1;
    let coinBase = 0;
    let transT = 0;
    let bannerT = 3;
    let lastCount = -1;
    let boss: Boss | null = null;
    let shots: Shot[] = [];
    let shake = 0;
    let strikes: Strike[] = [];
    let flashT = 0;
    let nextFlash = 2;
    let boltX = 400;
    let paused = false;
    let santaSummoned = false;
    let deathShown = false;
    let deadBounced = false;
    let hasGun = false;
    let ammo = 100;
    let ammoDrops: { x: number; y: number }[] = [];
    let dryReady = true;
    let gunItem: { x: number; y: number } | null = null;
    let pickupCd = 0;
    let gunCd = 0;
    let shootHeld = false;
    let bullets: { x: number; y: number; vx: number; life: number }[] = [];
    let thrown: { x: number; y: number; vx: number; t: number; face: number; hit: Enemy[]; bossHit: boolean } | null = null;
    let particles: Particle[] = [];
    let cam = 0;
    let hpNow = MAX_HP;
    let chargesNow = 2;
    let state: Status = "playing";
    let converted = false;
    let kickHit = true;
    let happy = false;
    let last = performance.now();
    let raf = 0;

    const sync = () => {
      setHp(Math.max(0, Math.round(hpNow)));
      setCharges(chargesNow);
      setStatus(state === "lost" && !deathShown ? "playing" : state);
      setArmed(hasGun);
      setAmmo(ammo);
    };

    const burst = (x: number, y: number, n = 18, kind?: "coin" | "spark") => {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 160;
        particles.push({
          x,
          y: y - 20,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 90,
          life: 0,
          max: 0.7 + Math.random() * 0.5,
          kind: kind ?? (k % 4 === 0 ? "coin" : "spark"),
        });
      }
    };

    const splat = (x: number, y: number, n = 10) => {
      if (!bloodRef.current) return;
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const s = 40 + Math.random() * 150;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 110,
          life: 0,
          max: 0.6 + Math.random() * 0.6,
          kind: "blood",
        });
      }
    };

    const damageEnemy = (e: Enemy, dmg: number, dir: number) => {
      e.hp -= dmg;
      e.vx = dir * 280;
      e.t = 0;
      e.state = e.hp <= 0 ? "dead" : "hurt";
      if (e.hp <= 0 && level === 3 && Math.random() < 0.25) ammoDrops.push({ x: e.x, y: e.y });
      burst(e.x, e.y - 40, 6, "spark");
      splat(e.x, e.y - 50, e.hp <= 0 ? 22 : 10);
      playSfx("hit");
    };

    const live = (e: Enemy) => e.state !== "idle" && e.state !== "dead";
    const onScreen = (e: Enemy) => e.x > cam - 40 && e.x < cam + W + 40;

    const airborne = () => {
      if (hero.spinT < 0) return false;
      const p = hero.spinT / SPIN_TIME;
      return p > 0.12 && p < 0.88;
    };
    const hurtHero = (dmg: number, dir: number) => {
      if (state !== "playing" || hero.inv > 0) return;
      hpNow -= dmg;
      hero.inv = 0.9;
      hero.x += dir * 24;
      burst(hero.x, hero.y - 60, 8, "spark");
      splat(hero.x, hero.y - 70, hpNow <= 0 ? 26 : 10);
      playSfx(hpNow <= 0 ? "death" : "hurt");
      if (hpNow <= 0) {
        hpNow = 0;
        state = "lost";
      }
      sync();
    };
    const bossActive = (b: Boss | null): b is Boss =>
      !!b && b.state !== "dormant" && b.state !== "intro" && b.state !== "dying" && b.state !== "dead";
    const hitBoss = (dmg: number, force = false) => {
      const b = boss;
      if (!bossActive(b) || (!force && (b.invT > 0 || b.air > 20))) return;
      b.hp -= !force && b.state === "land" ? dmg * 2 : dmg;
      b.invT = 0.25;
      b.hurtT = 0.2;
      burst(b.x, b.y - 100, 8, "spark");
      splat(b.x, b.y - 110, 12);
      playSfx("hit");
      if (b.hp <= 0) {
        b.hp = 0;
        playSfx("bossDown");
        b.state = "dying";
        b.t = 0;
        b.air = 0;
        b.frozen = false;
        shots = [];
        shake = 1;
        enemies.forEach((e) => {
          if (e.state !== "dead") {
            e.hp = 0;
            e.state = "dead";
            e.t = 0;
          }
        });
      }
    };
    const stepFrank = (b: Boss, ph2: boolean, dt: number) => {
      switch (b.state) {
        case "idle": {
          const dx = hero.x - b.x;
          if (Math.abs(dx) > 200) b.x += Math.sign(dx) * (ph2 ? 100 : 70) * dt;
          b.x = Math.max(BOSS_MIN_X, Math.min(BOSS_MAX_X, b.x));
          const dy = hero.y - b.y;
          if (Math.abs(dy) > 8) b.y += Math.sign(dy) * 60 * dt;
          if (b.kind === "santa" && ph2 && !santaSummoned) {
            santaSummoned = true;
            for (let k = 0; k < 4; k++) {
              enemies.push(makeCookie(Math.max(BOSS_MIN_X, Math.min(BOSS_MAX_X, b.x - 200 + k * 110)), FLOOR_TOP + 30 + k * 40, k));
            }
            shake = 0.5;
          }
          if (b.t > (ph2 ? 0.5 : 0.9)) {
            b.atk++;
            const m = b.atk % 3;
            b.state = m === 1 ? "tele" : "cast";
            b.mode = m === 2 ? 1 : 0;
            b.t = 0;
            b.fired = false;
          }
          break;
        }
        case "cast":
          if (b.mode === 0) {
            if (!b.fired && b.t > 0.5) {
              b.fired = true;
              const n = ph2 ? 4 : 3;
              for (let k = 0; k < n; k++) {
                strikes.push({
                  x: k === 0 ? hero.x : Math.max(cam + 60, Math.min(BOSS_MAX_X + 60, hero.x + (Math.random() - 0.5) * 340)),
                  y: k === 0 ? hero.y : Math.max(FLOOR_TOP + 10, Math.min(FLOOR_BOTTOM, hero.y + (Math.random() - 0.5) * 120)),
                  t: 0,
                  hit: false,
                  gift: b.kind === "santa",
                });
              }
            }
            if (b.t > 1.5) {
              b.state = "idle";
              b.t = 0;
            }
          } else {
            if (!b.fired && b.t > 0.7) {
              b.fired = true;
              shake = 0.5;
              burst(b.x + b.face * 60, b.y, 12);
              shots.push({ x: b.x + b.face * 50, y: b.y, vx: b.face * 320, kind: "wave", life: 0 });
              if (ph2) shots.push({ x: b.x - b.face * 50, y: b.y, vx: -b.face * 320, kind: "wave", life: 0 });
            }
            if (b.t > 1.3) {
              b.state = "idle";
              b.t = 0;
            }
          }
          break;
        case "tele":
          if (b.t >= (ph2 ? 0.55 : 0.8)) {
            b.sx = b.x;
            b.sy = b.y;
            b.tx = Math.max(BOSS_MIN_X, Math.min(BOSS_MAX_X, hero.x));
            b.ty = Math.max(FLOOR_TOP + 10, Math.min(FLOOR_BOTTOM, hero.y));
            b.state = "pounce";
            b.t = 0;
            b.fired = false;
          }
          break;
        case "pounce": {
          const p = Math.min(1, b.t / 0.6);
          b.x = b.sx + (b.tx - b.sx) * p;
          b.y = b.sy + (b.ty - b.sy) * p;
          if (!b.fired && Math.abs(hero.x - b.x) < 75 && Math.abs(hero.y - b.y) < 36) {
            b.fired = true;
            hurtHero(20, hero.x >= b.x ? 1 : -1);
          }
          if (p >= 1) {
            b.state = "land";
            b.t = 0;
            shake = 0.5;
            burst(b.x, b.y, 14);
          }
          break;
        }
        case "land":
          if (b.t > (ph2 ? 1.0 : 1.6)) {
            b.state = "idle";
            b.t = 0;
          }
          break;
      }
    };
    const updateBoss = (dt: number) => {
      const b = boss;
      if (!b || b.state === "dead") return;
      if (b.invT > 0) b.invT -= dt;
      if (b.hurtT > 0) b.hurtT -= dt;
      if (b.frozen) return;
      b.t += dt;
      const ph2 = b.hp <= b.maxHp / 2;
      if (b.state !== "pounce") b.face = hero.x < b.x ? -1 : 1;
      if (b.kind !== "cat" && ["idle", "tele", "pounce", "land", "cast"].includes(b.state)) {
        stepFrank(b, ph2, dt);
        return;
      }
      switch (b.state) {
        case "dormant":
          if (state === "playing" && hero.x > 2850) {
            b.state = "intro";
            b.t = 0;
            shake = 0.8;
          }
          break;
        case "intro":
          if (b.t > 1.8) {
            b.state = "idle";
            b.t = 0;
          }
          break;
        case "idle": {
          const dx = hero.x - b.x;
          if (Math.abs(dx) > 260) b.x += Math.sign(dx) * 90 * dt;
          b.x = Math.max(BOSS_MIN_X, Math.min(BOSS_MAX_X, b.x));
          const dy = hero.y - b.y;
          if (Math.abs(dy) > 8) b.y += Math.sign(dy) * 70 * dt;
          if (b.t > (ph2 ? 0.6 : 1.1)) {
            b.atk++;
            b.state = b.atk % 3 === 0 ? "cast" : "tele";
            b.t = 0;
            b.fired = false;
          }
          break;
        }
        case "tele":
          if (b.t >= (ph2 ? 0.5 : 0.75)) {
            b.sx = b.x;
            b.sy = b.y;
            b.tx = Math.max(BOSS_MIN_X, Math.min(BOSS_MAX_X, hero.x));
            b.ty = Math.max(FLOOR_TOP + 10, Math.min(FLOOR_BOTTOM, hero.y));
            b.state = "pounce";
            b.t = 0;
          }
          break;
        case "pounce": {
          const p = Math.min(1, b.t / 0.55);
          b.x = b.sx + (b.tx - b.sx) * p;
          b.y = b.sy + (b.ty - b.sy) * p;
          b.air = Math.sin(p * Math.PI) * 170;
          if (p >= 1) {
            b.air = 0;
            b.state = "land";
            b.t = 0;
            shake = 0.5;
            burst(b.x, b.y, 14);
            if (Math.hypot(hero.x - b.x, (hero.y - b.y) * 1.6) < 130 && !airborne()) {
              hurtHero(18, hero.x >= b.x ? 1 : -1);
            }
            if (ph2) {
              shots.push({ x: b.x, y: b.y, vx: 300, kind: "wave", life: 0 });
              shots.push({ x: b.x, y: b.y, vx: -300, kind: "wave", life: 0 });
            }
          }
          break;
        }
        case "land":
          if (b.t > (ph2 ? 1.0 : 1.7)) {
            b.state = "idle";
            b.t = 0;
          }
          break;
        case "cast":
          if (!b.fired && b.t > 0.9) {
            b.fired = true;
            (ph2 ? [-55, 0, 55] : [0]).forEach((off) => {
              shots.push({
                x: b.x + b.face * 110,
                y: Math.max(FLOOR_TOP, Math.min(FLOOR_BOTTOM, hero.y + off)),
                vx: b.face * (ph2 ? 300 : 230),
                kind: "orb",
                life: 0,
              });
            });
          }
          if (b.t > 1.6) {
            b.state = "idle";
            b.t = 0;
          }
          break;
        case "dying":
          if (Math.random() < 0.5) burst(b.x + (Math.random() - 0.5) * 160, b.y - Math.random() * 160, 4);
          shake = Math.max(shake, 0.4);
          if (b.t > 2.2) {
            b.state = "dead";
            burst(b.x, b.y - 80, 40, "coin");
            coinBase += 200;
            setCoins(coinBase + piles.filter((pl) => pl.gold).length * COINS_PER_PILE);
          }
          break;
      }
    };

    const throwGun = () => {
      if (!hasGun || state !== "playing" || paused) return;
      hasGun = false;
      hero.armed = false;
      shootHeld = false;
      thrown = { x: hero.x + hero.face * 30, y: hero.y, vx: hero.face * 620, t: 0, face: hero.face, hit: [], bossHit: false };
      sync();
    };
    const spin = () => {
      if (state !== "playing" || hero.spinT >= 0 || hero.danceT > 0) return;
      hero.spinT = 0;
      converted = false;
      playSfx("spin");
    };
    const kick = () => {
      if (state !== "playing" || hero.kickT >= 0 || hero.danceT > 0) return;
      hero.kickT = 0;
      kickHit = false;
      playSfx("kick");
    };
    const dance = () => {
      if (state !== "playing" || chargesNow <= 0 || hero.spinT >= 0 || hero.danceT > 0) return;
      chargesNow--;
      playSpecial();
      hero.danceT = DANCE_TIME;
      hero.inv = DANCE_TIME + 0.3;
      hero.kickT = -1;
      enemies.forEach((e) => {
        if (live(e) && onScreen(e)) e.frozen = true;
      });
      if (bossActive(boss)) boss.frozen = true;
      sync();
    };
    const loadLevel = (n: number) => {
      paused = false;
      setPaused(false);
      stopSpecial();
      level = n;
      piles = makePiles();
      enemies = makeEnemies(n);
      boss = n >= 2 ? makeBoss(n) : null;
      shots = [];
      strikes = [];
      santaSummoned = false;
      deathShown = false;
      deadBounced = false;
      hasGun = false;
      ammo = 100;
      ammoDrops = [];
      gunItem = n === 3 ? { x: 620, y: 445 } : null;
      bullets = [];
      thrown = null;
      shootHeld = false;
      pickupCd = 0;
      flashT = 0;
      nextFlash = 2;
      particles = [];
      Object.assign(hero, { x: 120, y: 440, face: 1, danceT: 0, spinT: -1, kickT: -1, inv: 0, armed: false, fireT: 0, deadT: -1 });
      cam = 0;
      state = "playing";
      happy = false;
      bannerT = 3;
      transT = 0;
      lastCount = -1;
      setLevel(n);
      setCoins(coinBase);
      sync();
    };
    const restart = () => {
      coinBase = 0;
      hpNow = MAX_HP;
      chargesNow = 2;
      loadLevel(1);
    };
    const retry = () => {
      hpNow = MAX_HP;
      chargesNow = 2;
      loadLevel(level);
    };
    const togglePause = () => {
      if (state !== "playing") return;
      paused = !paused;
      setPaused(paused);
      keys.clear();
      const a = audioRef.current;
      if (a) {
        if (paused) a.pause();
        else if (hero.danceT > 0) a.play().catch(() => {});
      }
    };
    actionsRef.current = {
      spin: () => !paused && spin(),
      dance: () => !paused && dance(),
      kick: () => !paused && kick(),
      restart,
      retry,
      pause: togglePause,
      throwGun,
      shoot: (on: boolean) => {
        shootHeld = on;
      },
      goLevel: (n: number) => {
        coinBase = 0;
        hpNow = MAX_HP;
        chargesNow = 2;
        loadLevel(n);
      },
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (k === "p") {
        if (!e.repeat) togglePause();
        return;
      }
      if (paused) return;
      if (k === " ") {
        if (!e.repeat) spin();
      } else if (k === "e") {
        if (!e.repeat) dance();
      } else if (k === "k" || k === "j") {
        shootHeld = true;
        if (!hasGun && !e.repeat) kick();
      } else if (k === "t") {
        if (!e.repeat) throwGun();
      } else {
        keys.add(k);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "k" || k === "j") shootHeld = false;
      keys.delete(k);
    };
    const onBlur = () => {
      keys.clear();
      shootHeld = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) * (state === "lost" && hero.deadT >= 0 && hero.deadT < 1.1 ? 0.4 : 1);
      last = now;
      if (paused) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const time = now / 1000;
      if (state === "lost" && hero.deadT < 0) {
        hero.deadT = 0;
        hero.inv = 0;
        hero.danceT = 0;
        hero.spinT = -1;
        hero.kickT = -1;
        shootHeld = false;
        keys.clear();
        stopSpecial();
        shake = 1;
        burst(hero.x, hero.y - 40, 24);
      }
      if (hero.deadT >= 0) {
        hero.deadT += dt;
        if (!deadBounced && hero.deadT > 0.9) {
          deadBounced = true;
          shake = 0.8;
          burst(hero.x - hero.face * 70, hero.y, 14);
        }
        if (!deathShown && hero.deadT > 1.9) {
          deathShown = true;
          setStatus("lost");
        }
      }
      const playing = state === "playing";
      const dancing = hero.danceT > 0;

      let dx = 0;
      let dy = 0;
      if (playing && !dancing) {
        if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
        if (keys.has("arrowright") || keys.has("d")) dx += 1;
        if (keys.has("arrowup") || keys.has("w")) dy -= 1;
        if (keys.has("arrowdown") || keys.has("s")) dy += 1;
      }
      hero.moving = dx !== 0 || dy !== 0;
      if (hero.moving) {
        const len = Math.hypot(dx, dy);
        const sp = hero.kickT >= 0 ? SPEED * 0.6 : SPEED;
        hero.x += (dx / len) * sp * dt;
        hero.y += (dy / len) * sp * 0.7 * dt;
        if (dx !== 0) hero.face = dx > 0 ? 1 : -1;
      }
      hero.x = Math.max(cam + 40, Math.min(Math.min(cam + W - 40, WORLD_W - 40), hero.x));
      hero.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOTTOM, hero.y));
      if (boss && boss.state !== "dead") hero.x = Math.min(hero.x, GATE_X);
      const wdx = hero.x - WOMAN.x;
      const wdy = (hero.y - WOMAN.y) * 1.6;
      const wd = Math.hypot(wdx, wdy);
      if (wd < 75) {
        hero.x = WOMAN.x + (wdx / (wd || 1)) * 75;
        hero.y = WOMAN.y + (wdy / (wd || 1) / 1.6) * 75;
      }
      if (hero.inv > 0) hero.inv = Math.max(0, hero.inv - dt);
      hero.fireT = Math.max(0, hero.fireT - dt);
      if (pickupCd > 0) pickupCd -= dt;
      if (gunCd > 0) gunCd -= dt;
      if (gunItem && !hasGun && pickupCd <= 0 && playing && Math.abs(hero.x - gunItem.x) < 46 && Math.abs(hero.y - gunItem.y) < 34) {
        hasGun = true;
        playSfx("pickup");
        hero.armed = true;
        burst(gunItem.x, gunItem.y, 10, "spark");
        gunItem = null;
        sync();
      }
      if (hasGun && ammo <= 0) {
        if (!shootHeld) dryReady = true;
        else if (dryReady && playing && !dancing && hero.spinT < 0) {
          dryReady = false;
          throwGun();
        }
      }
      ammoDrops = ammoDrops.filter((d) => {
        if (playing && Math.abs(hero.x - d.x) < 40 && Math.abs(hero.y - d.y) < 30) {
          ammo += 25;
          playSfx("pickup");
          burst(d.x, d.y, 8, "coin");
          sync();
          return false;
        }
        return true;
      });
      if (hasGun && shootHeld && playing && !dancing && hero.spinT < 0 && gunCd <= 0 && ammo > 0) {
        dryReady = false;
        gunCd = 0.075;
        ammo--;
        hero.fireT = 0.06;
        playSfx("shoot", 60);
        bullets.push({ x: hero.x + hero.face * 58, y: hero.y + (Math.random() - 0.5) * 8, vx: hero.face * 950, life: 0 });
        setAmmo(ammo);
      }

      hero.phase += dt * (dancing ? 13 : hero.moving ? 15 : 0);
      if (dancing) {
        hero.danceT = Math.max(0, hero.danceT - dt);
        if (hero.danceT === 0) {
          stopSpecial();
          if (boss && boss.frozen) {
            boss.frozen = false;
            hitBoss(10, true);
            burst(boss.x, boss.y - 100, 16);
          }
          shots = [];
          enemies.forEach((e) => {
            if (e.frozen && e.state !== "dead") {
              e.frozen = false;
              e.hp = 0;
              e.state = "dead";
              e.t = 0;
              e.vx = 0;
              burst(e.x, e.y - 40, 16);
            }
          });
        }
      }

      if (hero.kickT >= 0) {
        hero.kickT += dt;
        if (!kickHit && hero.kickT > 0.12) {
          kickHit = true;
          const airborne = hero.spinT >= 0;
          enemies.forEach((e) => {
            if (!live(e)) return;
            if (airborne) {
              if (Math.hypot(e.x - hero.x, (e.y - hero.y) * 1.6) < 125) {
                damageEnemy(e, 2, e.x >= hero.x ? 1 : -1);
              }
              return;
            }
            const fx = (e.x - hero.x) * hero.face;
            if (fx > -10 && fx < 100 && Math.abs(e.y - hero.y) < 30) damageEnemy(e, 1, hero.face);
          });
          if (airborne) burst(hero.x, hero.y - 30, 14, "spark");
          if (boss) {
            if (airborne) {
              if (Math.hypot(boss.x - hero.x, (boss.y - hero.y) * 1.6) < 190) hitBoss(2);
            } else {
              const bfx = (boss.x - hero.x) * hero.face;
              if (bfx > -30 && bfx < 190 && Math.abs(boss.y - hero.y) < 45) hitBoss(1);
            }
          }
        }
        if (hero.kickT >= KICK_TIME) hero.kickT = -1;
      }

      if (hero.spinT >= 0) {
        hero.spinT += dt;
        if (!converted && hero.spinT > SPIN_TIME * 0.4) {
          converted = true;
          let n = 0;
          piles.forEach((p) => {
            const d = Math.hypot(p.x - hero.x, (p.y - hero.y) * 1.6);
            if (!p.gold && d < SPIN_RADIUS) {
              p.gold = true;
              n++;
              burst(p.x, p.y);
            }
          });
          if (n > 0) {
            playSfx("gold");
            happy = true;
            particles.push({ x: WOMAN.x, y: WOMAN.y - 140, vx: 0, vy: -50, life: 0, max: 1.4, kind: "heart" });
          }
          setCoins(coinBase + piles.filter((p) => p.gold).length * COINS_PER_PILE);
        }
        if (hero.spinT >= SPIN_TIME) hero.spinT = -1;
      }

      // enemies
      enemies.forEach((e) => {
        if (e.state === "idle") {
          if (e.x < cam + W + 60) e.state = "walk";
          return;
        }
        if (e.frozen) return;
        if (e.state === "dead") {
          e.t += dt;
          e.x += e.vx * dt;
          e.vx *= 0.92;
          return;
        }
        e.cd -= dt;
        if (e.state === "hurt") {
          e.t += dt;
          e.x += e.vx * dt;
          e.vx *= 0.9;
          if (e.t > 0.35) e.state = "walk";
          return;
        }
        const ex = hero.x - e.x;
        const ey = hero.y - e.y;
        if (e.state === "walk") {
          if (!playing) return;
          const rat = tiny(e);
          e.rt = (e.rt ?? 0) - dt;
          if (e.rt <= 0 || e.tx === undefined || e.ty === undefined) {
            e.rt = 0.7 + Math.random() * 0.9;
            if (e.side === undefined || Math.random() < 0.2) e.side = Math.random() < 0.5 ? -1 : 1;
            const gap = rat ? 22 : 40 + Math.random() * 16;
            e.tx = hero.x + e.side * gap;
            e.ty = hero.y + (Math.random() - 0.5) * 24;
            if (Math.random() < 0.3) e.pause = 0.25 + Math.random() * 0.5;
          }
          let dvx = 0;
          let dvy = 0;
          if ((e.pause ?? 0) > 0) {
            e.pause = (e.pause ?? 0) - dt;
          } else {
            const tdx = e.tx - e.x;
            const tdy = e.ty - e.y;
            if (Math.abs(tdx) > 8) dvx = Math.max(-e.spd, Math.min(e.spd, tdx * 2.5));
            if (Math.abs(tdy) > 6) dvy = Math.max(-e.spd * 0.6, Math.min(e.spd * 0.6, tdy * 2));
          }
          const k = Math.min(1, dt * 4);
          e.mvx = (e.mvx ?? 0) + (dvx - (e.mvx ?? 0)) * k;
          e.mvy = (e.mvy ?? 0) + (dvy - (e.mvy ?? 0)) * k;
          e.x += e.mvx * dt;
          e.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOTTOM, e.y + e.mvy * dt));
          if (Math.abs(ex) > 36) e.face = ex >= 0 ? 1 : -1;
          e.phase += dt * 10 * Math.min(1, Math.hypot(e.mvx, e.mvy) / (e.spd * 0.5));
          if (Math.abs(ex) <= (rat ? 40 : 72) && Math.abs(ey) <= (rat ? 14 : 20) && e.cd <= 0) {
            e.state = "wind";
            e.t = 0;
            e.mvx = 0;
            e.mvy = 0;
          }
        } else if (e.state === "wind") {
          e.t += dt;
          if (e.t > windupOf(e)) {
            const reach = reachOf(e);
            if (playing && hero.inv <= 0 && Math.abs(ex) < reach && Math.abs(ey) < 26) {
              hpNow -= dmgOf(e);
              hero.inv = 0.9;
              hero.x += e.face * 24;
              burst(hero.x, hero.y - 60, 8, "spark");
              splat(hero.x, hero.y - 70, 10);
              playSfx(hpNow <= 0 ? "death" : "hurt");
              if (hpNow <= 0) {
                hpNow = 0;
                state = "lost";
              }
              sync();
            }
            e.cd = cdOf(e);
            e.state = "walk";
          }
        }
      });
      enemies = enemies.filter((e) => !(e.state === "dead" && e.t > 0.6));
      updateBoss(dt);
      if (shake > 0) shake = Math.max(0, shake - dt);
      if (hero.danceT <= 0) {
        shots.forEach((sh) => {
          sh.x += sh.vx * dt;
          sh.life += dt;
          if (state !== "playing") return;
          if (Math.abs(sh.x - hero.x) < 28 && Math.abs(sh.y - hero.y) < 28 && !airborne()) {
            hurtHero(sh.kind === "orb" ? 10 : 14, sh.vx > 0 ? 1 : -1);
            if (sh.kind === "orb") sh.life = 99;
          }
        });
        shots = shots.filter((sh) => sh.life < 4 && sh.x > cam - 100 && sh.x < cam + W + 100);
        strikes.forEach((st) => {
          st.t += dt;
          if (!st.hit && st.t >= 0.9) {
            st.hit = true;
            shake = Math.max(shake, 0.3);
            burst(st.x, st.y, 10, "spark");
            if (state === "playing" && Math.hypot(hero.x - st.x, (hero.y - st.y) * 1.6) < 60) {
              hurtHero(14, hero.x >= st.x ? 1 : -1);
            }
          }
        });
        strikes = strikes.filter((st) => st.t < 1.25);
      }
      bullets.forEach((bl) => {
        bl.x += bl.vx * dt;
        bl.life += dt;
        for (const e of enemies) {
          if (!live(e) || bl.life > 90) continue;
          if (Math.abs(bl.x - e.x) < 30 && Math.abs(bl.y - e.y) < 28) {
            damageEnemy(e, 1, Math.sign(bl.vx));
            bl.life = 99;
            break;
          }
        }
        if (bl.life < 90 && bossActive(boss) && Math.abs(bl.x - boss.x) < 60 && Math.abs(bl.y - boss.y) < 40 && boss.air < 20) {
          hitBoss(0.35, true);
          bl.life = 99;
        }
      });
      bullets = bullets.filter((bl) => bl.life < 1.2 && bl.x > cam - 60 && bl.x < cam + W + 60);
      if (thrown) {
        const th = thrown;
        th.t += dt;
        th.x += th.vx * dt;
        enemies.forEach((e) => {
          if (!live(e) || th.hit.includes(e)) return;
          if (Math.abs(e.x - th.x) < 42 && Math.abs(e.y - th.y) < 34) {
            th.hit.push(e);
            damageEnemy(e, 3, Math.sign(th.vx));
          }
        });
        if (!th.bossHit && bossActive(boss) && Math.abs(boss.x - th.x) < 70 && Math.abs(boss.y - th.y) < 44) {
          th.bossHit = true;
          hitBoss(3);
        }
        if (th.t >= 0.5) {
          gunItem = { x: Math.max(cam + 50, Math.min(Math.min(cam + W - 50, GATE_X), th.x)), y: th.y };
          pickupCd = 0.7;
          thrown = null;
        }
      }
      if (level === 3) {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flashT = 0.5;
          nextFlash = 4 + Math.random() * 6;
          boltX = 80 + Math.random() * (W - 160);
        }
        if (flashT > 0) flashT -= dt;
      }

      if (state === "playing" && hero.x > WOMAN.x - 120 && !(boss && boss.state !== "dead")) {
        state = "won";
        playSfx("win");
        happy = true;
        for (let k = 0; k < 8; k++) {
          particles.push({
            x: WOMAN.x - 60 + k * 18,
            y: WOMAN.y - 120,
            vx: (k - 4) * 10,
            vy: -60 - (k % 3) * 20,
            life: 0,
            max: 1.8,
            kind: "heart",
          });
        }
        if (level < 4) transT = 5;
        sync();
      }

      if (state === "won" && level < 4) {
        transT -= dt;
        const c = Math.max(0, Math.ceil(transT));
        if (c !== lastCount) {
          lastCount = c;
          setCountdown(c);
        }
        if (transT <= 0) {
          coinBase += piles.filter((p) => p.gold).length * COINS_PER_PILE;
          hpNow = Math.min(MAX_HP, hpNow + 40);
          chargesNow = 2;
          loadLevel(level + 1);
        }
      }

      const target = Math.min(WORLD_W - W, Math.max(0, hero.x - 380));
      if (target > cam) cam += (target - cam) * Math.min(1, dt * 6);

      particles.forEach((p) => {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind !== "heart") p.vy += 380 * dt;
      });
      particles = particles.filter((p) => p.life < p.max);

      ctx.save();
      if (hero.deadT >= 0) {
        const z = 1 + 0.4 * Math.min(1, hero.deadT / 1.4);
        const fx = hero.x - cam;
        const fy = hero.y - 60;
        ctx.translate(fx, fy);
        ctx.scale(z, z);
        ctx.translate(-fx, -fy);
      }
      if (level === 1) drawBarn(ctx, time, cam);
      else if (level === 2) drawForest(ctx, time, cam);
      else if (level === 3) drawGraveyard(ctx, time, cam, flashT > 0.3 ? boltX : -1);
      else drawChristmas(ctx, time, cam);
      ctx.save();
      ctx.translate(-cam + (shake > 0 ? (Math.random() - 0.5) * shake * 20 : 0), shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0);
      if (boss && boss.state !== "dead") {
        const gh = ctx.createLinearGradient(GATE_X - 20, 0, GATE_X + 20, 0);
        gh.addColorStop(0, "rgba(170,110,255,0)");
        gh.addColorStop(0.5, `rgba(190,140,255,${0.45 + Math.sin(time * 6) * 0.15})`);
        gh.addColorStop(1, "rgba(170,110,255,0)");
        ctx.fillStyle = gh;
        ctx.fillRect(GATE_X - 20, FLOOR_TOP - 90, 40, FLOOR_BOTTOM - FLOOR_TOP + 100);
        if (boss.state === "tele") {
          const mx = Math.max(BOSS_MIN_X, Math.min(BOSS_MAX_X, hero.x));
          ctx.strokeStyle = `rgba(255,70,70,${0.5 + Math.sin(time * 20) * 0.3})`;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.ellipse(mx, hero.y, 130, 130 / 1.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      strikes.forEach((st) => {
        if (st.gift) {
          if (st.t < 0.9) {
            ctx.strokeStyle = `rgba(${Math.floor(time * 6) % 2 ? "255,80,80" : "70,220,120"},${0.55 + Math.sin(time * 25) * 0.25})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(st.x, st.y, 58, 58 / 1.6, 0, 0, Math.PI * 2);
            ctx.stroke();
            const gy = st.y - (1 - st.t / 0.9) * 430;
            ctx.save();
            ctx.translate(st.x, gy - 20);
            ctx.rotate(st.t * 6);
            ctx.fillStyle = "#e0262c";
            ctx.fillRect(-16, -16, 32, 32);
            ctx.fillStyle = "#ffe46b";
            ctx.fillRect(-3, -16, 6, 32);
            ctx.fillRect(-16, -3, 32, 6);
            ctx.restore();
          } else {
            const a = 1 - (st.t - 0.9) / 0.35;
            ctx.strokeStyle = `rgba(255,230,120,${a})`;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.ellipse(st.x, st.y, 30 + (1 - a) * 60, (30 + (1 - a) * 60) / 1.6, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = `rgba(255,90,90,${a * 0.5})`;
            ctx.beginPath();
            ctx.ellipse(st.x, st.y, 50, 50 / 1.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          return;
        }
        if (st.t < 0.9) {
          ctx.strokeStyle = `rgba(120,200,255,${0.45 + Math.sin(time * 25) * 0.3})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(st.x, st.y, 58, 58 / 1.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const a = 1 - (st.t - 0.9) / 0.35;
          ctx.strokeStyle = `rgba(235,245,255,${a})`;
          ctx.shadowColor = "#7fd0ff";
          ctx.shadowBlur = 24;
          ctx.lineWidth = 7;
          ctx.beginPath();
          let bx = st.x;
          let by = st.y - 480;
          ctx.moveTo(bx, by);
          while (by < st.y) {
            by += 40;
            bx = by >= st.y ? st.x : st.x + (Math.random() - 0.5) * 36;
            ctx.lineTo(bx, Math.min(by, st.y));
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(210,235,255,${a * 0.7})`;
          ctx.beginPath();
          ctx.ellipse(st.x, st.y, 60, 60 / 1.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      if (gunItem && !hasGun) {
        const bob = Math.sin(time * 4) * 3;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(gunItem.x, gunItem.y + 2, 28, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        const gl = ctx.createRadialGradient(gunItem.x, gunItem.y - 20, 4, gunItem.x, gunItem.y - 20, 50);
        gl.addColorStop(0, "rgba(255,220,90,0.45)");
        gl.addColorStop(1, "rgba(255,220,90,0)");
        ctx.fillStyle = gl;
        ctx.fillRect(gunItem.x - 50, gunItem.y - 70, 100, 100);
        drawTommy(ctx, gunItem.x - 6, gunItem.y - 18 + bob, 1.1);
        ctx.font = "900 14px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#000";
        ctx.fillStyle = "#ffd23f";
        ctx.strokeText("TOMMY GUN", gunItem.x, gunItem.y - 56 + bob);
        ctx.fillText("TOMMY GUN", gunItem.x, gunItem.y - 56 + bob);
      }
      ammoDrops.forEach((d) => {
        const bob = Math.sin(time * 5 + d.x) * 3;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + 2, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4b5a2a";
        ctx.fillRect(d.x - 14, d.y - 24 + bob, 28, 20);
        ctx.fillStyle = "#2f3a18";
        ctx.fillRect(d.x - 14, d.y - 24 + bob, 28, 5);
        ctx.fillStyle = "#ffd23f";
        for (let k = 0; k < 4; k++) ctx.fillRect(d.x - 10 + k * 6, d.y - 17 + bob, 3, 10);
        ctx.font = "900 12px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#000";
        ctx.fillStyle = "#ffd23f";
        ctx.strokeText("+25", d.x, d.y - 32 + bob);
        ctx.fillText("+25", d.x, d.y - 32 + bob);
      });
      const bs = boss;
      type Item = { y: number; draw: () => void };
      const items: Item[] = [
        ...piles.map((p) => ({ y: p.y, draw: () => drawPile(ctx, p, time) })),
        ...(bs && bs.state !== "dead" ? [{ y: bs.y, draw: () => {
          const bhop = state === "lost" && hero.deadT > 0.35 && bossActive(bs) ? Math.abs(Math.sin(time * 8)) * 14 : 0;
          ctx.save();
          ctx.translate(0, -bhop);
          if (bs.kind === "cat") drawBoss(ctx, bs, time);
          else if (bs.kind === "frank") drawFrank(ctx, bs, time);
          else drawSanta(ctx, bs, time);
          ctx.restore();
        } }] : []),
        ...enemies.map((e) => ({
          y: e.y,
          draw: () => {
            if (!(state === "lost" && hero.deadT > 0.35 && live(e) && !e.frozen && Math.abs(e.x - hero.x) < 520)) {
              drawEnemy(ctx, e, time);
              return;
            }
            const hop = Math.abs(Math.sin(time * 9 + e.phase * 1.7)) * 20;
            ctx.save();
            ctx.translate(0, -hop);
            drawEnemy(ctx, { ...e, state: "wind", t: 0.05 }, time);
            ctx.restore();
            ctx.font = "900 18px sans-serif";
            ctx.textAlign = "center";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#000";
            ctx.fillStyle = "#fff";
            const word = ["HA HA!", "YEAH!", "LOL", "WOO!"][Math.abs(Math.floor(e.phase)) % 4];
            const by = e.y - 150 - hop * 0.5;
            ctx.strokeText(word, e.x, by);
            ctx.fillText(word, e.x, by);
          },
        })),
        { y: WOMAN.y, draw: () => drawWoman(ctx, happy, time) },
        { y: hero.y, draw: () => drawHero(ctx, hero, time) },
      ];
      items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
      if (hero.deadT > 1.1) {
        const q = hero.deadT - 1.1;
        const gx = hero.x - hero.face * 70;
        const gy = hero.y - 50 - q * 70;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - q / 1.3) * 0.8;
        ctx.fillStyle = "#cfe8ff";
        ctx.beginPath();
        ctx.arc(gx, gy - 30, 16, Math.PI, 0);
        ctx.lineTo(gx + 16, gy + 20);
        for (let k = 0; k < 4; k++) ctx.lineTo(gx + 16 - (k + 1) * 8, gy + 20 + (k % 2 ? -6 : 6));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#1a1a2a";
        ctx.beginPath();
        ctx.arc(gx - 6, gy - 30, 3, 0, Math.PI * 2);
        ctx.arc(gx + 6, gy - 30, 3, 0, Math.PI * 2);
        ctx.ellipse(gx, gy - 18, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffe46b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(gx, gy - 54, 14, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      bullets.forEach((bl) => {
        const d = Math.sign(bl.vx);
        ctx.strokeStyle = "#fff6a8";
        ctx.shadowColor = "#ffd23f";
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bl.x, bl.y - 62);
        ctx.lineTo(bl.x - d * 26, bl.y - 62);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(bl.x, bl.y + 2, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      if (thrown) {
        const th = thrown;
        ctx.save();
        ctx.translate(th.x, th.y - 55 - Math.sin((th.t / 0.5) * Math.PI) * 25);
        ctx.rotate(th.t * 24 * th.face);
        drawTommy(ctx, 0, 0, 1);
        ctx.restore();
      }
      shots.forEach((sh) => {
        if (sh.kind === "orb") {
          const g2 = ctx.createRadialGradient(sh.x, sh.y - 60, 2, sh.x, sh.y - 60, 24);
          g2.addColorStop(0, "#fff");
          g2.addColorStop(0.4, "#c58bff");
          g2.addColorStop(1, "rgba(150,80,255,0)");
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(sh.x, sh.y - 60, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath();
          ctx.ellipse(sh.x, sh.y + 2, 14, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(255,120,200,0.9)";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.ellipse(sh.x, sh.y, 14, 30, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      if (hero.spinT >= 0) {
        const p = hero.spinT / SPIN_TIME;
        ctx.strokeStyle = `rgba(255,214,70,${0.8 * (1 - p)})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(hero.x, hero.y - 6, 50 + p * SPIN_RADIUS, (50 + p * SPIN_RADIUS) / 1.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      particles.forEach((p) => {
        const a = 1 - p.life / p.max;
        if (p.kind === "coin") {
          drawCoin(ctx, p.x, p.y, 7);
        } else if (p.kind === "heart") {
          ctx.globalAlpha = a;
          ctx.fillStyle = "#ff5c8a";
          ctx.font = "bold 34px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("\u2665", p.x, p.y);
          ctx.globalAlpha = 1;
        } else if (p.kind === "blood") {
          ctx.fillStyle = `rgba(150,8,16,${Math.min(1, a * 1.6)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2 + a * 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(255,236,120,${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 + a * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();
      ctx.restore();

      if (level === 4) drawSnow(ctx, time, cam);
      if (hero.deadT >= 0) {
        const t2 = hero.deadT;
        if (t2 < 0.4) {
          ctx.fillStyle = `rgba(255,0,0,${0.35 * (1 - t2 / 0.4)})`;
          ctx.fillRect(0, 0, W, H);
        }
        if (t2 > 0.9) {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, (t2 - 0.9) * 0.5)})`;
          ctx.fillRect(0, 0, W, H);
        }
        if (t2 > 1.0 && !deathShown) {
          const sc = Math.min(1, (t2 - 1.0) * 4);
          ctx.save();
          ctx.translate(W / 2, 250);
          ctx.scale(0.6 + sc * 0.4, 0.6 + sc * 0.4);
          ctx.globalAlpha = sc;
          ctx.font = "900 120px sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 12;
          ctx.strokeStyle = "#3a0505";
          ctx.fillStyle = "#ff3b3b";
          ctx.strokeText("K.O.", 0, 0);
          ctx.fillText("K.O.", 0, 0);
          ctx.restore();
        }
      }
      if (level === 3 && flashT > 0) {
        const f = flashT / 0.5;
        const flick = f > 0.6 ? 1 : Math.sin(flashT * 70) > 0 ? 0.8 : 0.25;
        ctx.fillStyle = `rgba(215,228,255,${0.5 * f * flick})`;
        ctx.fillRect(0, 0, W, H);
      }

      if (boss && boss.state !== "dormant" && boss.state !== "dead") {
        const bw = 520;
        const bx = (W - bw) / 2;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(bx - 4, 14, bw + 8, 28);
        ctx.fillStyle = boss.hp <= boss.maxHp / 2 ? "#ff4d4d" : ({ cat: "#b27dff", frank: "#7ddc6a", santa: "#3ddc84" })[boss.kind];
        ctx.fillRect(bx, 18, (bw * boss.hp) / boss.maxHp, 20);
        ctx.fillStyle = "#fff";
        ctx.font = "900 14px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText({ cat: "MYSTIC CAT", frank: "FRANKENSTEIN", santa: "SANTA CLAUS" }[boss.kind], bx + 8, 33);
        if (boss.state === "intro") {
          ctx.globalAlpha = Math.min(1, (1.8 - boss.t) * 2);
          ctx.font = "900 56px sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 9;
          ctx.strokeStyle = "#2a0f55";
          ctx.fillStyle = "#e5ccff";
          const bossTitle = "BOSS: " + { cat: "MYSTIC CAT", frank: "FRANKENSTEIN", santa: "SANTA CLAUS" }[boss.kind];
          ctx.strokeText(bossTitle, W / 2, 200);
          ctx.fillText(bossTitle, W / 2, 200);
          ctx.globalAlpha = 1;
        }
      }

      if (hero.danceT > 0) {
        ctx.fillStyle = "rgba(90,170,255,0.22)";
        ctx.fillRect(0, 0, W, H);
        ctx.font = "900 44px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#1c2a6b";
        ctx.fillStyle = "#fff";
        ctx.strokeText("TIP TOE SPECIAL!", W / 2, 90);
        ctx.fillText("TIP TOE SPECIAL!", W / 2, 90);
      }

      if (bannerT > 0 && state === "playing") {
        bannerT -= dt;
        ctx.globalAlpha = Math.min(1, bannerT);
        ctx.font = "900 48px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#1a0f08";
        ctx.fillStyle = "#ffd23f";
        const title = ["LEVEL 1 \u00b7 THE BARN", "LEVEL 2 \u00b7 THE DARK FOREST", "LEVEL 3 \u00b7 THE GRAVEYARD", "LEVEL 4 \u00b7 THE NORTH POLE"][level - 1];
        ctx.strokeText(title, W / 2, 200);
        ctx.fillText(title, W / 2, 200);
        ctx.globalAlpha = 1;
      }

      const bossLive = !!boss && boss.state !== "dead";
      const arenaClear = level >= 2 && !bossLive && hero.x < WOMAN.x - 200;
      const threats = bossLive || enemies.some((e) => live(e) && onScreen(e)) || enemies.some((e) => e.state === "idle" && e.x < cam + W);
      if (state === "playing" && !threats && (cam < WORLD_W - W - 5 || arenaClear) && Math.floor(time * 2) % 2 === 0) {
        ctx.font = "900 46px sans-serif";
        ctx.textAlign = "right";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#5a2a10";
        ctx.fillStyle = "#ffd23f";
        ctx.strokeText("GO \u2192", W - 30, 120);
        ctx.fillText("GO \u2192", W - 30, 120);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [playSpecial, stopSpecial]);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setTrackMissing(false);
    setTrackSrc(URL.createObjectURL(f));
  };

  const press = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    fn();
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-lg font-extrabold text-primary-foreground shadow-md">
            <IconCoin className="size-6" stroke={2.5} />
            <span>{coins}</span>
          </div>
          <div className="rounded-full bg-card px-4 py-2 text-sm font-extrabold shadow-md">Level {level}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {armed ? (
            <Button
              size="lg"
              className="touch-none select-none rounded-full font-bold"
              onPointerDown={(e) => {
                e.currentTarget.blur();
                actionsRef.current.shoot(true);
              }}
              onPointerUp={() => actionsRef.current.shoot(false)}
              onPointerLeave={() => actionsRef.current.shoot(false)}
              onPointerCancel={() => actionsRef.current.shoot(false)}
            >
              <IconBolt className="size-5" /> Shoot (hold)
            </Button>
          ) : (
            <Button size="lg" className="rounded-full font-bold" onClick={press(() => actionsRef.current.kick())}>
              <IconKarate className="size-5" /> Kick
            </Button>
          )}
          {level === 3 && (
            <Button
              size="lg"
              variant="outline"
              className="rounded-full font-bold"
              disabled={!armed}
              onClick={press(() => actionsRef.current.throwGun())}
            >
              <IconArrowBigRightLines className="size-5" /> Throw gun
            </Button>
          )}
          <Button size="lg" className="rounded-full font-bold" onClick={press(() => actionsRef.current.spin())}>
            <IconRotate360 className="size-5" /> Spin
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full font-bold"
            disabled={charges <= 0}
            onClick={press(() => actionsRef.current.dance())}
          >
            <IconMoodCrazyHappy className="size-5" /> Tiptoe special ({charges})
          </Button>
          <Button size="icon" variant="outline" className="rounded-full" onClick={press(() => actionsRef.current.pause())} aria-label="Pause">
            {paused ? <IconPlayerPlay className="size-5" /> : <IconPlayerPause className="size-5" />}
          </Button>
          <Button size="icon" variant="outline" className="rounded-full" onClick={press(() => actionsRef.current.restart())} aria-label="Restart">
            <IconRefresh className="size-5" />
          </Button>
          <Button size="icon" variant="outline" className="rounded-full" onClick={press(toggleMusic)} aria-label="Toggle song sound">
            {musicOn ? <IconMusic className="size-5" /> : <IconMusicOff className="size-5" />}
          </Button>
          <Button size="icon" variant={bloodOn ? "default" : "outline"} className="rounded-full" onClick={press(toggleBlood)} aria-label={bloodOn ? "Turn blood off" : "Turn blood on"} title={bloodOn ? "Blood: on" : "Blood: off"}>
            <IconDroplet className="size-5" />
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border-4 border-primary/60 bg-card shadow-xl">
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase leading-none text-white">
          <div className="flex items-center gap-1.5 border-2 border-black bg-[#1a1020]/90 px-1.5 py-1 shadow-[2px_2px_0_#000]">
            <PixelIcon rows={HEART_PIXELS} color="#ff4d6d" />
            <div className="flex gap-px border border-black bg-black p-px" title="Health">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className="h-2 w-2"
                  style={{ background: hp > i * 10 ? (hp <= 30 ? "#ff3b3b" : "#4cff6a") : "#3a2a3f" }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 border-2 border-black bg-[#1a1020]/90 px-1.5 py-1 shadow-[2px_2px_0_#000]" title="Tiptoe specials left">
            {[0, 1].map((i) => (
              <PixelIcon key={i} rows={STAR_PIXELS} color={i < charges ? "#ffd23f" : "#4a3a50"} />
            ))}
          </div>
          {level === 3 && (
            <div className="flex items-center gap-1.5 border-2 border-black bg-[#1a1020]/90 px-1.5 py-1 shadow-[2px_2px_0_#000]" title="Tommy gun ammo">
              <PixelIcon rows={GUN_PIXELS} color={armed ? "#ffd23f" : "#4a3a50"} />
              <span>{armed ? ammo : "--"}</span>
            </div>
          )}
        </div>
        {paused && status === "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/55 text-center">
            <h2 className="text-5xl font-black text-white drop-shadow">Paused</h2>
            <Button size="lg" className="rounded-full font-bold" onClick={press(() => actionsRef.current.pause())}>
              Resume (P)
            </Button>
          </div>
        )}
        {status !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/55 px-4 text-center">
            {status === "lost" && (
              <h2 className="text-4xl font-black text-white drop-shadow sm:text-5xl">Knocked out!</h2>
            )}
            <p className="text-lg text-white/90">
              {status === "lost"
                ? "Those goblins play rough."
                : level < 4
                  ? `Whisked away to the ${["Dark Forest", "Graveyard", "North Pole"][level - 1]} in ${countdown}...`
                  : `Santa's on the naughty list now. ${coins} gold in the bag.`}
            </p>
            {status === "lost" && (
              <Button size="lg" className="rounded-full font-bold" onClick={press(() => actionsRef.current.retry())}>
                Try again
              </Button>
            )}
            {status === "won" && level === 4 && (
              <Button size="lg" className="rounded-full font-bold" onClick={press(() => actionsRef.current.restart())}>
                Play again
              </Button>
            )}
          </div>
        )}
      </div>

      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-bold">
        <span className="text-muted-foreground">Level select:</span>
        {LEVELS.map((l) => (
          <button
            key={l.n}
            type="button"
            onClick={press(() => actionsRef.current.goLevel(l.n))}
            className={`underline-offset-4 hover:underline ${level === l.n ? "text-primary" : "text-foreground"}`}
          >
            {l.n}. {l.name}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          <b className="text-foreground">Move:</b> Arrows / WASD &nbsp;·&nbsp;
          <b className="text-foreground">Kick / shoot (hold):</b> K &nbsp;·&nbsp;
          <b className="text-foreground">Spin:</b> Space (press K mid-spin for a spin kick) &nbsp;·&nbsp;
          <b className="text-foreground">Special (2 uses):</b> E &nbsp;·&nbsp;
          <b className="text-foreground">Pause:</b> P &nbsp;·&nbsp;
          <b className="text-foreground">Throw gun:</b> T
        </p>
        {trackMissing && (
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-accent px-3 py-1.5 font-medium text-accent-foreground">
            <IconUpload className="size-4" />
            Track not found. Add public/audio/tiptoe-wing-in-my-jawwdinz.mp3 or pick the song file here
            <input type="file" accept="audio/*" className="hidden" onChange={onUpload} />
          </label>
        )}
      </div>

      <audio
        ref={audioRef}
        src={trackSrc}
        preload="auto"
        onError={() => setTrackMissing(true)}
      />
    </div>
  );
}
