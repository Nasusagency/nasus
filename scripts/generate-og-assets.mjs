import sharp from "sharp";
import { writeFileSync } from "fs";
import { join } from "path";

const PUBLIC = join(process.cwd(), "public");

const BG = "#050508";
const GOLD = "#c4a882";
const CYAN = "#00f2ff";

// --- Favicon / app icon source (matches public/favicon.svg monogram) ---
function monogramSvg(size, radius) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="${BG}"/>
  <text x="16" y="23" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="700" fill="${GOLD}">N</text>
</svg>`;
}

// --- Open Graph / Twitter card image (1200x630) ---
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${CYAN}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${CYAN}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="0" width="1200" height="8" fill="${GOLD}"/>
  <text x="90" y="260" font-family="Georgia, 'Times New Roman', serif" font-size="88" font-weight="700" fill="${GOLD}">Nasus Agency</text>
  <text x="90" y="330" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="400" fill="#ffffff">Soluciones tecnológicas artesanales</text>
  <text x="90" y="390" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="400" fill="#ffffff">para empresas en escala</text>
  <text x="90" y="540" font-family="'Courier New', monospace" font-size="28" fill="${CYAN}">nasus.lat</text>
</svg>`;

async function main() {
  // Favicons
  await sharp(Buffer.from(monogramSvg(32, 7))).png().toFile(join(PUBLIC, "favicon-32x32.png"));
  await sharp(Buffer.from(monogramSvg(16, 3))).resize(16, 16).png().toFile(join(PUBLIC, "favicon-16x16.png"));
  await sharp(Buffer.from(monogramSvg(180, 34))).resize(180, 180).png().toFile(join(PUBLIC, "apple-touch-icon.png"));
  await sharp(Buffer.from(monogramSvg(192, 36))).resize(192, 192).png().toFile(join(PUBLIC, "android-chrome-192x192.png"));
  await sharp(Buffer.from(monogramSvg(512, 96))).resize(512, 512).png().toFile(join(PUBLIC, "android-chrome-512x512.png"));

  // .ico (single 32x32 PNG-in-ICO container; supported by browsers and Google)
  const png32 = await sharp(Buffer.from(monogramSvg(32, 7))).png().toBuffer();
  const ico = pngToIco(png32, 32);
  writeFileSync(join(PUBLIC, "favicon.ico"), ico);

  // OG / Twitter image
  await sharp(Buffer.from(ogSvg)).png().toFile(join(PUBLIC, "og-image.png"));

  console.log("Generated favicon-32x32.png, favicon-16x16.png, apple-touch-icon.png, android-chrome-192x192.png, android-chrome-512x512.png, favicon.ico, og-image.png");
}

// Minimal ICO container wrapping a single PNG image (valid per MS ICO spec).
function pngToIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image data size
  entry.writeUInt32LE(header.length + entry.length, 12); // offset

  return Buffer.concat([header, entry, pngBuffer]);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
