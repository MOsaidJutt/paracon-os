import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const iconsDir = join(publicDir, "icons");
mkdirSync(iconsDir, { recursive: true });

const INK = "#1C1B17";
const WORDMARK = join(publicDir, "logo-white-transparent.png");

async function squareIcon(size, padRatio = 0.18) {
  const pad = Math.round(size * padRatio);
  const innerW = size - pad * 2;

  const wordmark = await sharp(WORDMARK)
    .resize({ width: innerW, fit: "inside" })
    .toBuffer();
  const meta = await sharp(wordmark).metadata();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: INK,
    },
  })
    .composite([
      {
        input: wordmark,
        top: Math.round((size - (meta.height ?? innerW)) / 2),
        left: Math.round((size - (meta.width ?? innerW)) / 2),
      },
    ])
    .png()
    .toBuffer();
}

const sizes = [192, 512];
for (const size of sizes) {
  const buf = await squareIcon(size);
  await sharp(buf).toFile(join(iconsDir, `icon-${size}.png`));
  console.log(`Wrote icons/icon-${size}.png`);
}

// Maskable icon (more padding so OS-applied masks don't clip the wordmark)
const maskable = await squareIcon(512, 0.28);
await sharp(maskable).toFile(join(iconsDir, "icon-512-maskable.png"));
console.log("Wrote icons/icon-512-maskable.png");

// Favicon
const favicon = await squareIcon(48, 0.16);
await sharp(favicon).toFile(join(publicDir, "favicon.png"));
console.log("Wrote favicon.png");

// Apple touch icon
const apple = await squareIcon(180, 0.2);
await sharp(apple).toFile(join(publicDir, "apple-touch-icon.png"));
console.log("Wrote apple-touch-icon.png");
