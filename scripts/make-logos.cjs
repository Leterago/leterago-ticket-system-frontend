// One-off tool: derive WebP logos from leterago-logo.png.
//   leterago-logo.webp        → original blue logo, white background keyed out (transparent)
//   leterago-logo-white.webp  → same shape recolored white, for the dark theme
//
// The source is saturated blue (0,70,167) on pure white (255,255,255). We key
// white out with "color-to-alpha against white": alpha = 255 - min(r,g,b), then
// un-premultiply the colored version so anti-aliased edges stay pure blue
// instead of washing toward white.
//
// Run:  node scripts/make-logos.cjs   (sharp must be installed)

const sharp = require("sharp");
const path = require("path");

const assets = path.join(__dirname, "..", "src", "assets");
const src = path.join(assets, "leterago-logo.png");

(async () => {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels === 4
  const colored = Buffer.alloc(data.length);
  const white = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2], srcA = data[i + 3];
    const w = Math.min(r, g, b);             // white component
    let a = 255 - w;                          // keyed alpha
    a = Math.round((a * srcA) / 255);         // respect any pre-existing alpha

    // Colored, transparent version — un-premultiply to recover pure ink color.
    if (a === 0) {
      colored[i] = colored[i + 1] = colored[i + 2] = 0;
    } else {
      const f = 255 / (255 - w); // (255 - w) === a when srcA is opaque
      colored[i]     = Math.min(255, Math.round((r - w) * f));
      colored[i + 1] = Math.min(255, Math.round((g - w) * f));
      colored[i + 2] = Math.min(255, Math.round((b - w) * f));
    }
    colored[i + 3] = a;

    // White version — same coverage (alpha), shape painted white.
    white[i] = white[i + 1] = white[i + 2] = 255;
    white[i + 3] = a;
  }

  const opts = { width, height, channels: 4 };
  // High-quality lossy WebP keeps the alpha channel and is far smaller than
  // lossless for this anti-aliased script logo, with no visible difference.
  const webp = { quality: 90, alphaQuality: 100, effort: 6 };

  await sharp(colored, { raw: opts }).webp(webp).toFile(path.join(assets, "leterago-logo.webp"));
  await sharp(white, { raw: opts }).webp(webp).toFile(path.join(assets, "leterago-logo-white.webp"));

  console.log("Wrote leterago-logo.webp and leterago-logo-white.webp", `(${width}x${height})`);
})();
