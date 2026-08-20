import { supabase } from "./supabaseClient";

/**
 * "I will be attending" card composer.
 *
 * Flyer designs leave a blank panel for the attendee's face — but never in the
 * same place twice. Rather than making an admin type coordinates for every new
 * flyer, this finds the blank panel itself: it scans the template for the
 * largest rectangular region that is near-white or transparent, drops the
 * photo into the upper part of it, and sets the person's details underneath.
 *
 * If detection finds nothing usable (a busy design with no clear panel), it
 * falls back to the programme's card_config, or to a sensible default.
 */

export interface CardConfig {
  photo: { cx: number; cy: number; d: number; shape: "circle" | "square" };
  name: { cx: number; cy: number; size: number; color: string };
}

export const DEFAULT_CARD_CONFIG: CardConfig = {
  photo: { cx: 0.5, cy: 0.42, d: 0.42, shape: "circle" },
  name: { cx: 0.5, cy: 0.78, size: 0.05, color: "#ffffff" },
};

export interface CardDetails {
  name: string;
  church?: string | null;
  archdeaconry?: string | null;
}

/* ============================================================
   Loading
   ============================================================ */

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";   // needed or getImageData taints the canvas
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Couldn't load an image. Check it's uploaded and public."));
    img.src = src;
  });
}

/* ============================================================
   Finding the blank panel
   ============================================================ */

interface Rect { x: number; y: number; w: number; h: number }

/**
 * Largest all-ones rectangle in a binary grid — the classic histogram sweep,
 * O(rows x cols). Anything simpler tends to pick a thin sliver of margin
 * rather than the actual panel.
 */
function largestRectangle(grid: Uint8Array, cols: number, rows: number): Rect | null {
  const heights = new Int32Array(cols);
  let best: Rect | null = null;
  let bestArea = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      heights[x] = grid[y * cols + x] ? heights[x] + 1 : 0;
    }

    const stack: number[] = [];
    for (let x = 0; x <= cols; x++) {
      const current = x < cols ? heights[x] : 0;
      while (stack.length && heights[stack[stack.length - 1]] >= current) {
        const top = stack.pop()!;
        const height = heights[top];
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = height * (x - left);
        if (area > bestArea) {
          bestArea = area;
          best = { x: left, y: y - height + 1, w: x - left, h: height };
        }
      }
      stack.push(x);
    }
  }

  return best;
}

/**
 * Scans the template for the blank panel. Works on a downsampled grid — full
 * resolution is far more precision than this needs and much slower.
 */
function findBlankPanel(img: HTMLImageElement, samples = 160): Rect | null {
  const canvas = document.createElement("canvas");
  const scale = samples / Math.max(img.width, img.height);
  const cols = Math.max(1, Math.round(img.width * scale));
  const rows = Math.max(1, Math.round(img.height * scale));

  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, cols, rows);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, cols, rows).data;
  } catch {
    return null;   // canvas tainted — fall back to the config
  }

  const grid = new Uint8Array(cols * rows);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

    // Transparent counts: many templates cut a hole rather than paint it white.
    if (a < 24) { grid[p] = 1; continue; }

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // Near-white: bright, and close to neutral so pale gold or pink doesn't
    // get mistaken for the panel.
    grid[p] = max > 232 && max - min < 22 ? 1 : 0;
  }

  const rect = largestRectangle(grid, cols, rows);
  if (!rect) return null;

  // Reject anything too small or too thin to be a portrait panel.
  const area = (rect.w * rect.h) / (cols * rows);
  const aspect = rect.w / rect.h;
  if (area < 0.035 || aspect < 0.28 || aspect > 3.6) return null;

  return {
    x: rect.x / cols,
    y: rect.y / rows,
    w: rect.w / cols,
    h: rect.h / rows,
  };
}

/* ============================================================
   Drawing
   ============================================================ */

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  // Centre horizontally, but bias the vertical crop toward the TOP so the
  // head/face is never cut off (faces sit in the upper part of most photos).
  const offsetY = (h - dh) * 0.18;  // closer to the top than dead-centre
  ctx.drawImage(img, x + (w - dw) / 2, y + offsetY, dw, dh);
}

/** Shrinks the font until the text fits, rather than letting it overflow. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight = 700,
  family = "Georgia, 'Times New Roman', serif",
): number {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  } while (size > 8);
  return size;
}

/** Is the area behind the text light or dark? Decides ink colour. */
function isLightRegion(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): boolean {
  try {
    const d = ctx.getImageData(
      Math.max(0, Math.round(x)), Math.max(0, Math.round(y)),
      Math.max(1, Math.round(w)), Math.max(1, Math.round(h)),
    ).data;

    let total = 0;
    const step = 4 * 12;                    // sample, don't read every pixel
    let n = 0;
    for (let i = 0; i < d.length; i += step) {
      total += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++;
    }
    return n > 0 && total / n > 140;
  } catch {
    return true;
  }
}

/* ============================================================
   The composer
   ============================================================ */

export async function composeAttendingCard(opts: {
  templateUrl: string;
  photoUrl: string;
  details: CardDetails;
  config?: CardConfig;
  size?: number;
}): Promise<Blob> {
  const [template, photo] = await Promise.all([
    load(opts.templateUrl),
    load(opts.photoUrl),
  ]);

  // Keep the flyer's own proportions — forcing a square crops the design.
  const longest = opts.size ?? 1400;
  const scale = longest / Math.max(template.width, template.height);
  const W = Math.round(template.width * scale);
  const H = Math.round(template.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser can't generate the card.");

  // 1. The flyer.
  ctx.drawImage(template, 0, 0, W, H);

  // 2. Where does the photo go?
  const panel = findBlankPanel(template);
  const cfg = opts.config ?? DEFAULT_CARD_CONFIG;

  let box: Rect;
  if (panel) {
    box = { x: panel.x * W, y: panel.y * H, w: panel.w * W, h: panel.h * H };
  } else {
    const d = cfg.photo.d * Math.min(W, H);
    box = { x: cfg.photo.cx * W - d / 2, y: cfg.photo.cy * H - d / 2, w: d, h: d };
  }

  const pad = Math.min(box.w, box.h) * 0.06;
  const inner = {
    x: box.x + pad,
    y: box.y + pad,
    w: box.w - pad * 2,
    h: box.h - pad * 2,
  };

  // 3. Split the panel: photo on top (the majority), details below.
  //    The photo should DOMINATE the panel like a passport photo — tall
  //    enough for the face to read clearly — with the name/church/archdeaconry
  //    in a compact block underneath. We give the photo ~70% of the height.
  const hasDetails = !!(opts.details.church || opts.details.archdeaconry);
  const textShare = hasDetails ? 0.30 : 0.18;  // details get the lower band
  const textHeight = inner.h * textShare;
  const photoHeight = inner.h - textHeight;

  // Fill most of the available photo area. Prefer a portrait-ish photo so a
  // face has vertical room, but never wider than the panel. We aim the photo
  // width at ~78% of the panel (leaving side margin) and let the height fill
  // the photo band; drawCover crops cleanly with a top bias so the head shows.
  const photoW = inner.w * 0.80;
  const photoH = photoHeight * 0.98;
  const photoX = inner.x + (inner.w - photoW) / 2;   // centre horizontally
  const photoY = inner.y;                             // sit at the top of the panel
  const radius = Math.min(photoW, photoH) * 0.06;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoW, photoH, radius);
  ctx.clip();
  drawCover(ctx, photo, photoX, photoY, photoW, photoH);
  ctx.restore();

  // A thin frame lifts the photo off a white panel.
  ctx.save();
  ctx.strokeStyle = "rgba(128, 0, 0, 0.85)";
  ctx.lineWidth = Math.max(2, Math.min(photoW, photoH) * 0.01);
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoW, photoH, radius);
  ctx.stroke();
  ctx.restore();

  const photoSide = photoH; // details block starts below the photo

  // 5. The details, underneath.
  const textTop = photoY + photoSide + inner.h * 0.035;
  const light = isLightRegion(ctx, inner.x, textTop, inner.w, textHeight);
  const ink = light ? "#3a0a0a" : "#ffffff";
  const inkSoft = light ? "rgba(58,10,10,0.72)" : "rgba(255,255,255,0.85)";

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const centreX = inner.x + inner.w / 2;

  if (!light) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = W * 0.008;
  }

  let cursor = textTop;

  // Name
  const nameSize = fitText(ctx, opts.details.name.toUpperCase(), inner.w,
                           textHeight * (hasDetails ? 0.40 : 0.62));
  ctx.fillStyle = ink;
  ctx.font = `800 ${nameSize}px Georgia, 'Times New Roman', serif`;
  ctx.fillText(opts.details.name.toUpperCase(), centreX, cursor);
  cursor += nameSize * 1.22;

  if (hasDetails) {
    // A short rule between the name and the parish details.
    const ruleWidth = Math.min(inner.w * 0.32, nameSize * 5);
    ctx.save();
    ctx.strokeStyle = light ? "rgba(160,123,18,0.85)" : "rgba(255,215,0,0.9)";
    ctx.lineWidth = Math.max(1.5, nameSize * 0.055);
    ctx.beginPath();
    ctx.moveTo(centreX - ruleWidth / 2, cursor);
    ctx.lineTo(centreX + ruleWidth / 2, cursor);
    ctx.stroke();
    ctx.restore();
    cursor += nameSize * 0.42;

    const lines = [opts.details.church, opts.details.archdeaconry]
      .filter(Boolean) as string[];

    const detailSize = Math.max(10, nameSize * 0.56);
    ctx.fillStyle = inkSoft;

    lines.forEach((line, i) => {
      const label = i === 1 ? `${line} Archdeaconry` : line;
      const size = fitText(ctx, label, inner.w * 0.94, detailSize, 700,
                           "Georgia, 'Times New Roman', serif");
      ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
      ctx.fillText(label, centreX, cursor);
      cursor += size * 1.28;
    });
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Card render failed."))),
      "image/png",
      0.95,
    ),
  );
}

/* ============================================================
   Saving and sharing
   ============================================================ */

export async function uploadAttendingCard(
  blob: Blob,
  registrationId: string,
): Promise<string> {
  const path = `${registrationId}.png`;
  const { error } = await supabase.storage
    .from("attending-cards")
    .upload(path, blob, { upsert: true, contentType: "image/png" });
  if (error) throw error;

  const { data } = supabase.storage.from("attending-cards").getPublicUrl(path);
  // Bust the CDN cache so a rebuilt card doesn't show the old one.
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function shareCard(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch {
      /* dismissed — fall through to a download */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}