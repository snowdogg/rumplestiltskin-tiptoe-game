import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconCoin,
  IconMusic,
  IconMusicOff,
  IconRefresh,
  IconRotate360,
  IconUpload,
  IconMoodCrazyHappy,
  IconHeart,
  IconKarate,
  IconStarFilled,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

const W = 960;
const H = 540;
const FLOOR_TOP = 335;
const FLOOR_BOTTOM = 510;
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
  kind: "spark" | "coin" | "heart";
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
};

type EnemyKind = "goon" | "brute";
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
};

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
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
  const armSwing = dancing ? Math.sin(ph) : active ? Math.sin(ph) * 0.4 : 0;
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
  arm(1, spinning ? 1 : armSwing * 0.8 + (dancing ? 0.5 : 0), shh);

  ctx.restore();
}


const makeEnemies = (level = 1): Enemy[] =>
  Array.from({ length: level === 1 ? 11 : 15 }, (_, i) => {
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
  });
  const [level, setLevel] = useState(1);
  const [countdown, setCountdown] = useState(5);
  const [coins, setCoins] = useState(0);
  const [hp, setHp] = useState(MAX_HP);
  const [charges, setCharges] = useState(2);
  const [status, setStatus] = useState<Status>("playing");
  const [musicOn, setMusicOn] = useState(true);
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
    };
    let piles = makePiles();
    let enemies = makeEnemies(1);
    let level = 1;
    let coinBase = 0;
    let transT = 0;
    let bannerT = 3;
    let lastCount = -1;
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
      setStatus(state);
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

    const damageEnemy = (e: Enemy, dmg: number, dir: number) => {
      e.hp -= dmg;
      e.vx = dir * 280;
      e.t = 0;
      e.state = e.hp <= 0 ? "dead" : "hurt";
      burst(e.x, e.y - 40, 6, "spark");
    };

    const live = (e: Enemy) => e.state !== "idle" && e.state !== "dead";
    const onScreen = (e: Enemy) => e.x > cam - 40 && e.x < cam + W + 40;

    const spin = () => {
      if (state !== "playing" || hero.spinT >= 0 || hero.danceT > 0) return;
      hero.spinT = 0;
      converted = false;
    };
    const kick = () => {
      if (state !== "playing" || hero.kickT >= 0 || hero.danceT > 0) return;
      hero.kickT = 0;
      kickHit = false;
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
      sync();
    };
    const loadLevel = (n: number) => {
      stopSpecial();
      level = n;
      piles = makePiles();
      enemies = makeEnemies(n);
      particles = [];
      Object.assign(hero, { x: 120, y: 440, face: 1, danceT: 0, spinT: -1, kickT: -1, inv: 0 });
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
    actionsRef.current = { spin, dance, kick, restart, retry };

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (k === " ") {
        if (!e.repeat) spin();
      } else if (k === "e") {
        if (!e.repeat) dance();
      } else if (k === "k" || k === "j") {
        if (!e.repeat) kick();
      } else {
        keys.add(k);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = now / 1000;
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
      const wdx = hero.x - WOMAN.x;
      const wdy = (hero.y - WOMAN.y) * 1.6;
      const wd = Math.hypot(wdx, wdy);
      if (wd < 75) {
        hero.x = WOMAN.x + (wdx / (wd || 1)) * 75;
        hero.y = WOMAN.y + (wdy / (wd || 1) / 1.6) * 75;
      }
      if (hero.inv > 0) hero.inv = Math.max(0, hero.inv - dt);

      hero.phase += dt * (dancing ? 13 : hero.moving ? 15 : 0);
      if (dancing) {
        hero.danceT = Math.max(0, hero.danceT - dt);
        if (hero.danceT === 0) {
          stopSpecial();
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
          enemies.forEach((e) => {
            if (!live(e)) return;
            if (Math.hypot(e.x - hero.x, (e.y - hero.y) * 1.6) < 120) {
              damageEnemy(e, 2, e.x >= hero.x ? 1 : -1);
            }
          });
          if (n > 0) {
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
        e.face = ex >= 0 ? 1 : -1;
        if (e.state === "walk") {
          if (!playing) return;
          if (Math.abs(ex) > 58) e.x += Math.sign(ex) * e.spd * dt;
          if (Math.abs(ey) > 6) e.y += Math.sign(ey) * e.spd * 0.7 * dt;
          e.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOTTOM, e.y));
          e.phase += dt * 10;
          if (Math.abs(ex) <= 66 && Math.abs(ey) <= 18 && e.cd <= 0) {
            e.state = "wind";
            e.t = 0;
          }
        } else if (e.state === "wind") {
          e.t += dt;
          if (e.t > 0.4) {
            const reach = e.kind === "brute" ? 90 : 76;
            if (playing && hero.inv <= 0 && Math.abs(ex) < reach && Math.abs(ey) < 26) {
              hpNow -= e.kind === "brute" ? 16 : 8;
              hero.inv = 0.9;
              hero.x += e.face * 24;
              burst(hero.x, hero.y - 60, 8, "spark");
              if (hpNow <= 0) {
                hpNow = 0;
                state = "lost";
              }
              sync();
            }
            e.cd = 1.3;
            e.state = "walk";
          }
        }
      });
      enemies = enemies.filter((e) => !(e.state === "dead" && e.t > 0.6));

      if (state === "playing" && hero.x > WOMAN.x - 120) {
        state = "won";
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
        if (level === 1) transT = 5;
        sync();
      }

      if (state === "won" && level === 1) {
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
          loadLevel(2);
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

      if (level === 1) drawBarn(ctx, time, cam);
      else drawForest(ctx, time, cam);
      ctx.save();
      ctx.translate(-cam, 0);
      type Item = { y: number; draw: () => void };
      const items: Item[] = [
        ...piles.map((p) => ({ y: p.y, draw: () => drawPile(ctx, p, time) })),
        ...enemies.map((e) => ({ y: e.y, draw: () => drawEnemy(ctx, e, time) })),
        { y: WOMAN.y, draw: () => drawWoman(ctx, happy, time) },
        { y: hero.y, draw: () => drawHero(ctx, hero, time) },
      ];
      items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());

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
        } else {
          ctx.fillStyle = `rgba(255,236,120,${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 + a * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();

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
        const title = level === 1 ? "LEVEL 1 \u00b7 THE BARN" : "LEVEL 2 \u00b7 THE DARK FOREST";
        ctx.strokeText(title, W / 2, 200);
        ctx.fillText(title, W / 2, 200);
        ctx.globalAlpha = 1;
      }

      const threats = enemies.some((e) => live(e) && onScreen(e)) || enemies.some((e) => e.state === "idle" && e.x < cam + W);
      if (state === "playing" && !threats && cam < WORLD_W - W - 5 && Math.floor(time * 2) % 2 === 0) {
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
          <div className="flex items-center gap-2 rounded-full bg-card px-3 py-2 shadow-md">
            <IconHeart className="size-5 text-secondary" stroke={2.5} />
            <div className="h-3.5 w-32 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${hp}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-card px-3 py-2 shadow-md" title="Tiptoe specials left">
            {[0, 1].map((i) => (
              <IconStarFilled key={i} className={i < charges ? "size-5 text-primary" : "size-5 text-muted-foreground/30"} />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" className="rounded-full font-bold" onClick={press(() => actionsRef.current.kick())}>
            <IconKarate className="size-5" /> Kick
          </Button>
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
          <Button size="icon" variant="outline" className="rounded-full" onClick={press(() => actionsRef.current.restart())} aria-label="Restart">
            <IconRefresh className="size-5" />
          </Button>
          <Button size="icon" variant="outline" className="rounded-full" onClick={press(toggleMusic)} aria-label="Toggle song sound">
            {musicOn ? <IconMusic className="size-5" /> : <IconMusicOff className="size-5" />}
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border-4 border-primary/60 bg-card shadow-xl">
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
        {status !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/55 px-4 text-center">
            <h2 className="text-4xl font-black text-white drop-shadow sm:text-5xl">
              {status === "lost" ? "Knocked out!" : "She kisses him. Prince!"}
            </h2>
            <p className="text-lg text-white/90">
              {status === "lost"
                ? "Those goblins play rough."
                : level === 1
                  ? `Whisked away to the Dark Forest in ${countdown}...`
                  : `The forest is tamed. ${coins} gold in the bag.`}
            </p>
            {status === "lost" && (
              <Button size="lg" className="rounded-full font-bold" onClick={press(() => actionsRef.current.retry())}>
                Try again
              </Button>
            )}
            {status === "won" && level === 2 && (
              <Button size="lg" className="rounded-full font-bold" onClick={press(() => actionsRef.current.restart())}>
                Play again
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          <b className="text-foreground">Move:</b> Arrows / WASD &nbsp;·&nbsp;
          <b className="text-foreground">Kick:</b> K &nbsp;·&nbsp;
          <b className="text-foreground">Spin:</b> Space (press K mid-spin for a spin kick) &nbsp;·&nbsp;
          <b className="text-foreground">Special (2 uses):</b> E
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
