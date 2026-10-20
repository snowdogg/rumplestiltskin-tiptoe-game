import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconCoin,
  IconMusic,
  IconMusicOff,
  IconRefresh,
  IconRotate360,
  IconUpload,
  IconMoodCrazyHappy,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

const W = 960;
const H = 540;
const FLOOR_TOP = 335;
const FLOOR_BOTTOM = 510;
const SPEED = 230;
const SPIN_TIME = 0.85;
const SPIN_RADIUS = 190;
const DANCE_TIME = 4.2;
const COINS_PER_PILE = 25;
const WOMAN = { x: 165, y: 410 };
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

const PILE_POSITIONS: [number, number][] = [
  [330, 385],
  [480, 360],
  [640, 400],
  [800, 372],
  [300, 480],
  [570, 485],
  [735, 492],
  [885, 450],
  [440, 435],
];

const makePiles = (): Pile[] =>
  PILE_POSITIONS.map(([x, y], i) => ({ x, y, gold: false, seed: i + 1 }));

function drawBarn(ctx: CanvasRenderingContext2D, time: number) {
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
};

function drawHero(ctx: CanvasRenderingContext2D, h: Hero) {
  const dancing = h.danceT > 0;
  const spinning = h.spinT >= 0;
  const elapsed = dancing ? DANCE_TIME - h.danceT : 0;
  const ph = h.phase;
  ctx.save();
  ctx.translate(h.x, h.y);
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
  legs.forEach(([lx, lift]) => {
    ctx.beginPath();
    ctx.moveTo(lx, -34);
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
  ctx.fillStyle = "#f3d3c0";
  ctx.beginPath();
  ctx.ellipse(0, -30, 28, 33, 0, 0, Math.PI * 2);
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
  // face
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-10, -34, 6, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(10, -34, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1a14";
  ctx.beginPath();
  ctx.arc(-9, -34, 2.6, 0, Math.PI * 2);
  ctx.arc(11, -34, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8c6a4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-17, -43);
  ctx.lineTo(-5, -41);
  ctx.moveTo(17, -43);
  ctx.lineTo(5, -40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(-3, -22);
  ctx.lineTo(2, -21);
  ctx.stroke();
  ctx.strokeStyle = "#b34a4a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (shh) {
    ctx.moveTo(-5, -12);
    ctx.lineTo(7, -13);
  } else {
    ctx.arc(1, -17, 10, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  ctx.stroke();
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

export function RumpelGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const actionsRef = useRef<{ spin: () => void; dance: () => void; reset: () => void }>({
    spin: () => {},
    dance: () => {},
    reset: () => {},
  });
  const [coins, setCoins] = useState(0);
  const [musicOn, setMusicOn] = useState(false);
  const [trackMissing, setTrackMissing] = useState(false);
  const [trackSrc, setTrackSrc] = useState(TRACK_SRC);
  const musicWanted = useRef(true);

  const startMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a || !musicWanted.current || !a.paused) return;
    a.volume = 0.8;
    a.play()
      .then(() => setMusicOn(true))
      .catch(() => {});
  }, []);

  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      musicWanted.current = true;
      a.play()
        .then(() => setMusicOn(true))
        .catch(() => {});
    } else {
      musicWanted.current = false;
      a.pause();
      setMusicOn(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = new Set<string>();
    const hero: Hero = { x: 480, y: 440, face: 1, phase: 0, moving: false, danceT: 0, spinT: -1 };
    let piles = makePiles();
    let particles: Particle[] = [];
    let converted = false;
    let happy = false;
    let last = performance.now();
    let raf = 0;

    const burst = (x: number, y: number) => {
      for (let k = 0; k < 18; k++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 160;
        particles.push({
          x,
          y: y - 20,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 90,
          life: 0,
          max: 0.7 + Math.random() * 0.5,
          kind: k % 4 === 0 ? "coin" : "spark",
        });
      }
    };

    const spin = () => {
      if (hero.spinT >= 0) return;
      hero.spinT = 0;
      hero.danceT = 0;
      converted = false;
    };
    const dance = () => {
      if (hero.spinT >= 0 || hero.danceT > 0) return;
      hero.danceT = DANCE_TIME;
    };
    const reset = () => {
      piles = makePiles();
      happy = false;
      setCoins(0);
    };
    actionsRef.current = { spin, dance, reset };

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      startMusic();
      if (k === " ") {
        if (!e.repeat) spin();
      } else if (k === "e") {
        if (!e.repeat) dance();
      } else {
        keys.add(k);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerdown", startMusic, { once: true });

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = now / 1000;

      let dx = 0;
      let dy = 0;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;
      hero.moving = dx !== 0 || dy !== 0;
      if (hero.moving) {
        const len = Math.hypot(dx, dy);
        hero.x += (dx / len) * SPEED * dt;
        hero.y += (dy / len) * SPEED * 0.7 * dt;
        if (dx !== 0) hero.face = dx > 0 ? 1 : -1;
        if (hero.danceT > 0) hero.danceT = 0;
      }
      hero.x = Math.max(40, Math.min(W - 40, hero.x));
      hero.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOTTOM, hero.y));
      const wdx = hero.x - WOMAN.x;
      const wdy = (hero.y - WOMAN.y) * 1.6;
      const wd = Math.hypot(wdx, wdy);
      if (wd < 75) {
        hero.x = WOMAN.x + (wdx / (wd || 1)) * 75;
        hero.y = WOMAN.y + (wdy / (wd || 1) / 1.6) * 75;
      }

      hero.phase += dt * (hero.danceT > 0 ? 13 : hero.moving ? 15 : 0);
      if (hero.danceT > 0) hero.danceT = Math.max(0, hero.danceT - dt);

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
            happy = true;
            particles.push({ x: WOMAN.x, y: WOMAN.y - 140, vx: 0, vy: -50, life: 0, max: 1.4, kind: "heart" });
          }
          setCoins(piles.filter((p) => p.gold).length * COINS_PER_PILE);
        }
        if (hero.spinT >= SPIN_TIME) hero.spinT = -1;
      }

      particles.forEach((p) => {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind !== "heart") p.vy += 380 * dt;
      });
      particles = particles.filter((p) => p.life < p.max);

      drawBarn(ctx, time);
      type Item = { y: number; draw: () => void };
      const items: Item[] = [
        ...piles.map((p) => ({ y: p.y, draw: () => drawPile(ctx, p, time) })),
        { y: WOMAN.y, draw: () => drawWoman(ctx, happy, time) },
        { y: hero.y, draw: () => drawHero(ctx, hero) },
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

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", startMusic);
    };
  }, [startMusic]);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setTrackMissing(false);
    setTrackSrc(URL.createObjectURL(f));
    musicWanted.current = true;
    setTimeout(startMusic, 50);
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-lg font-extrabold text-primary-foreground shadow-md">
          <IconCoin className="size-6" stroke={2.5} />
          <span>{coins} gold</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" className="rounded-full font-bold" onClick={() => { startMusic(); actionsRef.current.spin(); }}>
            <IconRotate360 className="size-5" /> Spin: hay to gold
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full font-bold"
            onClick={() => { startMusic(); actionsRef.current.dance(); }}
          >
            <IconMoodCrazyHappy className="size-5" /> Tiptoe dance
          </Button>
          <Button size="lg" variant="outline" className="rounded-full font-bold" onClick={() => actionsRef.current.reset()}>
            <IconRefresh className="size-5" /> Refill hay
          </Button>
          <Button size="icon" variant="outline" className="rounded-full" onClick={toggleMusic} aria-label="Toggle music">
            {musicOn ? <IconMusic className="size-5" /> : <IconMusicOff className="size-5" />}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border-4 border-primary/60 bg-card shadow-xl">
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          <b className="text-foreground">Move:</b> Arrows / WASD &nbsp;·&nbsp;
          <b className="text-foreground">Spin:</b> Space &nbsp;·&nbsp;
          <b className="text-foreground">Dance:</b> E
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
        loop
        preload="auto"
        onError={() => setTrackMissing(true)}
        onPlay={() => setMusicOn(true)}
        onPause={() => setMusicOn(false)}
      />
    </div>
  );
}
