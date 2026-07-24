import { supabase } from "./supabaseClient";

export interface CardConfig {
  photo: { cx: number; cy: number; d: number; shape: "circle" | "square" };
  name: { cx: number; cy: number; size: number; color: string };
}

export const DEFAULT_CARD_CONFIG: CardConfig = {
  photo: { cx: 0.5, cy: 0.44, d: 0.44, shape: "circle" },
  name: { cx: 0.5, cy: 0.8, size: 0.055, color: "#ffffff" },
};

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";      // Supabase storage sends permissive CORS
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load image: ${src}`));
    img.src = src;
  });
}

/** Draws `img` to fill a square box without squashing it. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, size: number,
) {
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
}

/**
 * Composes the member's photo and name onto the programme's
 * "I will be attending" template and returns a PNG blob.
 */
export async function composeAttendingCard(opts: {
  templateUrl: string;
  photoUrl: string;
  name: string;
  config?: CardConfig;
  size?: number;
}): Promise<Blob> {
  const cfg = opts.config ?? DEFAULT_CARD_CONFIG;
  const S = opts.size ?? 1200;

  const [template, photo] = await Promise.all([
    load(opts.templateUrl),
    load(opts.photoUrl),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't generate the card.");

  // 1. Photo underneath, clipped to the shape the design expects.
  const d = cfg.photo.d * S;
  const x = cfg.photo.cx * S - d / 2;
  const y = cfg.photo.cy * S - d / 2;

  ctx.save();
  ctx.beginPath();
  if (cfg.photo.shape === "circle") {
    ctx.arc(cfg.photo.cx * S, cfg.photo.cy * S, d / 2, 0, Math.PI * 2);
  } else {
    ctx.rect(x, y, d, d);
  }
  ctx.clip();
  drawCover(ctx, photo, x, y, d);
  ctx.restore();

  // 2. Frame on top — its transparent window reveals the face.
  ctx.drawImage(template, 0, 0, S, S);

  // 3. Name, shrunk to fit rather than overflowing the frame.
  if (opts.name) {
    const maxWidth = S * 0.8;
    let fontSize = cfg.name.size * S;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = cfg.name.color;

    do {
      ctx.font = `700 ${fontSize}px Georgia, 'Times New Roman', serif`;
      fontSize -= 2;
    } while (ctx.measureText(opts.name).width > maxWidth && fontSize > 12);

    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = S * 0.012;
    ctx.fillText(opts.name.toUpperCase(), cfg.name.cx * S, cfg.name.cy * S);
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Card render failed."))),
      "image/png",
      0.92,
    ),
  );
}

/** Saves the card to storage and returns its public URL. */
export async function uploadAttendingCard(
  blob: Blob,
  registrationId: string,
): Promise<string> {
  const path = `${registrationId}.png`;
  const { error } = await supabase.storage
    .from("attending-cards")
    .upload(path, blob, { upsert: true, contentType: "image/png" });
  if (error) throw error;

  return supabase.storage.from("attending-cards").getPublicUrl(path).data.publicUrl;
}

/** Native share sheet on phones, plain download on desktop. */
export async function shareCard(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch {
      /* user dismissed — fall through to download */
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