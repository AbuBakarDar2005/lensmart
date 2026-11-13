// High-Definition Canvas Eyewear Renderer with perspective, metallic sheens, and reflections
export interface GlassesDrawOptions {
  type: string;
  color: string;
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  bridgePoint: { x: number; y: number };
  scale: number;
  verticalOffset: number;
  rollAngle: number;
}

export function drawGlassesOnCanvas(ctx: CanvasRenderingContext2D, options: GlassesDrawOptions) {
  const { type, color, leftEye, rightEye, bridgePoint, scale, verticalOffset, rollAngle } = options;

  // Calculate pupillary distance in pixels
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const eyeDistance = Math.sqrt(dx * dx + dy * dy);

  // Center between eyes
  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (leftEye.y + rightEye.y) / 2 + verticalOffset;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rollAngle);

  // Base sizing proportional to eye distance
  const frameWidth = eyeDistance * 2.35 * scale;
  const frameHeight = frameWidth * 0.44;
  const lensRadius = frameWidth * 0.22;
  const bridgeWidth = frameWidth * 0.16;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (type) {
    case 'aviator':
      drawAviator(ctx, frameWidth, frameHeight, bridgeWidth, color);
      break;
    case 'cateye':
      drawCatEye(ctx, frameWidth, frameHeight, bridgeWidth, color);
      break;
    case 'rimless':
      drawRimless(ctx, frameWidth, frameHeight, bridgeWidth, color);
      break;
    case 'round':
      drawRound(ctx, frameWidth, frameHeight, bridgeWidth, color);
      break;
    case 'clubmaster':
      drawClubmaster(ctx, frameWidth, frameHeight, bridgeWidth, color);
      break;
    case 'octagon':
      drawOctagon(ctx, frameWidth, frameHeight, bridgeWidth, color);
      break;
    case 'square_acetate':
    case 'wayfarer':
    default:
      drawSquareAcetate(ctx, frameWidth, frameHeight, bridgeWidth, color);
      break;
  }

  ctx.restore();
}

function drawSquareAcetate(ctx: CanvasRenderingContext2D, w: number, h: number, bridge: number, color: string) {
  const lensW = (w - bridge) / 2;
  const r = 10;

  // Left Rim
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  roundRect(ctx, -w / 2, -h / 2, lensW, h, r);
  ctx.stroke();

  // Right Rim
  roundRect(ctx, bridge / 2, -h / 2, lensW, h, r);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Bridge
  ctx.beginPath();
  ctx.moveTo(-bridge / 2, -h / 4);
  ctx.quadraticCurveTo(0, -h / 3, bridge / 2, -h / 4);
  ctx.lineWidth = 6;
  ctx.stroke();

  // Temples
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 4);
  ctx.lineTo(-w / 2 - 14, -h / 4 - 4);
  ctx.moveTo(w / 2, -h / 4);
  ctx.lineTo(w / 2 + 14, -h / 4 - 4);
  ctx.lineWidth = 5;
  ctx.stroke();

  // Anti-reflective sheen on lenses
  drawLensSheen(ctx, -w / 2 + 8, -h / 2 + 6, lensW - 16, h - 12);
  drawLensSheen(ctx, bridge / 2 + 8, -h / 2 + 6, lensW - 16, h - 12);
}

function drawAviator(ctx: CanvasRenderingContext2D, w: number, h: number, bridge: number, color: string) {
  const lensW = (w - bridge) / 2;
  const lensH = h * 1.15;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 6;

  // Teardrop Left Lens
  drawTeardrop(ctx, -bridge / 2 - lensW / 2, 0, lensW / 2, lensH / 2);
  ctx.stroke();

  // Teardrop Right Lens
  drawTeardrop(ctx, bridge / 2 + lensW / 2, 0, lensW / 2, lensH / 2);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Double Top Bar & Bridge (Signature Aviator)
  ctx.beginPath();
  ctx.moveTo(-w * 0.38, -lensH * 0.48);
  ctx.lineTo(w * 0.38, -lensH * 0.48);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-bridge / 2, -lensH * 0.15);
  ctx.quadraticCurveTo(0, -lensH * 0.28, bridge / 2, -lensH * 0.15);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Tinted polarized gradient
  drawPolarizedGradient(ctx, -bridge / 2 - lensW, -lensH / 2, lensW, lensH);
  drawPolarizedGradient(ctx, bridge / 2, -lensH / 2, lensW, lensH);
}

function drawCatEye(ctx: CanvasRenderingContext2D, w: number, h: number, bridge: number, color: string) {
  const lensW = (w - bridge) / 2;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5.5;
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 7;

  // Left Cat-Eye Wing
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 8, -h * 0.65); // High wing
  ctx.quadraticCurveTo(-w * 0.25, -h * 0.4, -bridge / 2, -h * 0.2);
  ctx.quadraticCurveTo(-w * 0.2, h * 0.5, -w * 0.38, h * 0.45);
  ctx.quadraticCurveTo(-w / 2 - 4, h * 0.1, -w / 2 - 8, -h * 0.65);
  ctx.closePath();
  ctx.stroke();

  // Right Cat-Eye Wing
  ctx.beginPath();
  ctx.moveTo(w / 2 + 8, -h * 0.65); // High wing
  ctx.quadraticCurveTo(w * 0.25, -h * 0.4, bridge / 2, -h * 0.2);
  ctx.quadraticCurveTo(w * 0.2, h * 0.5, w * 0.38, h * 0.45);
  ctx.quadraticCurveTo(w / 2 + 4, h * 0.1, w / 2 + 8, -h * 0.65);
  ctx.closePath();
  ctx.stroke();

  // Bridge
  ctx.beginPath();
  ctx.moveTo(-bridge / 2, -h * 0.2);
  ctx.quadraticCurveTo(0, -h * 0.3, bridge / 2, -h * 0.2);
  ctx.lineWidth = 4;
  ctx.stroke();

  drawLensSheen(ctx, -w / 2 + 4, -h * 0.4, lensW - 8, h * 0.8);
  drawLensSheen(ctx, bridge / 2 + 4, -h * 0.4, lensW - 8, h * 0.8);
}

function drawRound(ctx: CanvasRenderingContext2D, w: number, h: number, bridge: number, color: string) {
  const r = (w - bridge) / 4;

  ctx.strokeStyle = color;
  ctx.lineWidth = 4.5;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 6;

  // Left Circle
  ctx.beginPath();
  ctx.arc(-bridge / 2 - r, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  // Right Circle
  ctx.beginPath();
  ctx.arc(bridge / 2 + r, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  // Keyhole Bridge
  ctx.beginPath();
  ctx.arc(0, -r * 0.3, bridge * 0.6, Math.PI * 0.8, Math.PI * 0.2, true);
  ctx.lineWidth = 3.5;
  ctx.stroke();

  drawLensSheen(ctx, -bridge / 2 - r * 1.7, -r * 0.7, r * 1.4, r * 1.4);
  drawLensSheen(ctx, bridge / 2 + r * 0.3, -r * 0.7, r * 1.4, r * 1.4);
}

function drawClubmaster(ctx: CanvasRenderingContext2D, w: number, h: number, bridge: number, color: string) {
  const lensW = (w - bridge) / 2;

  // Bold Browline Acetate Top
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 6, -h / 2);
  ctx.lineTo(-bridge / 2, -h / 2);
  ctx.lineTo(-bridge / 2, -h / 6);
  ctx.lineTo(-w / 2 - 4, -h / 6);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w / 2 + 6, -h / 2);
  ctx.lineTo(bridge / 2, -h / 2);
  ctx.lineTo(bridge / 2, -h / 6);
  ctx.lineTo(w / 2 + 4, -h / 6);
  ctx.closePath();
  ctx.fill();

  // Delicate Lower Gold Wire Rim
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2.5;

  roundRect(ctx, -w / 2, -h / 2 + 2, lensW, h * 0.9, 12);
  ctx.stroke();

  roundRect(ctx, bridge / 2, -h / 2 + 2, lensW, h * 0.9, 12);
  ctx.stroke();

  // Gold Arch Bridge
  ctx.beginPath();
  ctx.arc(0, -h / 6, bridge / 2, Math.PI * 1, 0, false);
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawRimless(ctx: CanvasRenderingContext2D, w: number, h: number, bridge: number, color: string) {
  const lensW = (w - bridge) / 2;

  // Ultra-subtle clear beveled lens outline
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -w / 2, -h / 2, lensW, h * 0.85, 8);
  ctx.stroke();

  roundRect(ctx, bridge / 2, -h / 2, lensW, h * 0.85, 8);
  ctx.stroke();

  // Titanium Bridge Mount & Screw Points
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-bridge / 2, -h / 6);
  ctx.quadraticCurveTo(0, -h / 3, bridge / 2, -h / 6);
  ctx.stroke();

  // Mount screws
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-bridge / 2 + 4, -h / 6, 2, 0, Math.PI * 2);
  ctx.arc(bridge / 2 - 4, -h / 6, 2, 0, Math.PI * 2);
  ctx.fill();

  drawLensSheen(ctx, -w / 2 + 6, -h / 2 + 4, lensW - 12, h * 0.8);
  drawLensSheen(ctx, bridge / 2 + 6, -h / 2 + 4, lensW - 12, h * 0.8);
}

function drawOctagon(ctx: CanvasRenderingContext2D, w: number, h: number, bridge: number, color: string) {
  const lensW = (w - bridge) / 2;
  const radius = lensW / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;

  drawPolygon(ctx, -bridge / 2 - radius, 0, radius, 8);
  ctx.stroke();

  drawPolygon(ctx, bridge / 2 + radius, 0, radius, 8);
  ctx.stroke();

  // Bridge
  ctx.beginPath();
  ctx.moveTo(-bridge / 2, -h / 6);
  ctx.quadraticCurveTo(0, -h / 3, bridge / 2, -h / 6);
  ctx.stroke();

  drawLensSheen(ctx, -bridge / 2 - radius * 1.5, -radius * 0.6, radius * 1.2, radius * 1.2);
  drawLensSheen(ctx, bridge / 2 + radius * 0.5, -radius * 0.6, radius * 1.2, radius * 1.2);
}

function drawLensSheen(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.08)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.0)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.restore();
}

function drawPolarizedGradient(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(18, 24, 38, 0.65)');
  grad.addColorStop(0.5, 'rgba(32, 45, 68, 0.45)');
  grad.addColorStop(1, 'rgba(55, 75, 105, 0.25)');

  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTeardrop(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

function drawPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 8;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export interface GlassesImageDrawOptions {
  image: HTMLImageElement;
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  scale: number;
  verticalOffset: number;
  rollAngle: number;
  colorTintHex?: string;
}

export function drawGlassesImageOnCanvas(ctx: CanvasRenderingContext2D, options: GlassesImageDrawOptions) {
  const { image, leftEye, rightEye, scale, verticalOffset, rollAngle, colorTintHex } = options;
  if (!image || !image.complete || image.naturalWidth === 0) return;

  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const eyeDistance = Math.sqrt(dx * dx + dy * dy);

  // Position at midpoint between eyes with vertical offset
  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (leftEye.y + rightEye.y) / 2 + verticalOffset;

  // Compute width relative to pupillary distance
  const frameWidth = eyeDistance * 2.35 * scale;
  const aspectRatio = image.naturalHeight / image.naturalWidth;
  const frameHeight = frameWidth * aspectRatio;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rollAngle);

  // Subtle drop shadow for realistic 3D depth against the face
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  ctx.drawImage(image, -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);

  // Optional color tint overlay if specified and not default dark
  if (colorTintHex && colorTintHex !== '#121215' && colorTintHex !== '#0f0f11') {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = colorTintHex;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
    ctx.restore();
  }

  ctx.restore();
}

export interface VtoPngModel {
  id: string;
  name: string;
  shape: string;
  path: string;
}

export const VTO_PNG_MODELS: VtoPngModel[] = [
  { id: 'wayfarer', name: 'Classic Wayfarer', shape: 'Square', path: '/vto-glasses/01_classic_wayfarer.png' },
  { id: 'aviator', name: 'Aviator Horizon Gold', shape: 'Aviator', path: '/vto-glasses/02_aviator_gold.png' },
  { id: 'retro-round', name: 'Retro Round Titan', shape: 'Round', path: '/vto-glasses/03_retro_round.png' },
  { id: 'sport', name: 'Sport Polarized Shield', shape: 'Wrap', path: '/vto-glasses/04_sport_polarized.png' },
  { id: 'cateye', name: 'Solstice Cat-Eye', shape: 'Cat-Eye', path: '/vto-glasses/glass2.png' },
];

