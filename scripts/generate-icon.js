const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// PromptIt icon — dark radial gradient + glowing ✦ sparkle
// Contemporary 2025/2026: premium dark, purple glow, minimal

const SIZE = 1024;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Deep dark background gradient -->
    <radialGradient id="bg" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#1A0A40"/>
      <stop offset="55%" stop-color="#0D0820"/>
      <stop offset="100%" stop-color="#050508"/>
    </radialGradient>

    <!-- Purple glow orb behind sparkle -->
    <radialGradient id="glowOrb" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#4C1D95" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#4C1D95" stop-opacity="0"/>
    </radialGradient>

    <!-- Sparkle fill: white core fading to violet -->
    <linearGradient id="sparkleFill" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="35%" stop-color="#EDE9FE"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>

    <!-- Soft glow filter for sparkle -->
    <filter id="sparkleGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Large ambient glow -->
    <filter id="ambientGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="70" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Subtle noise for premium texture -->
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feBlend in="SourceGraphic" mode="overlay" result="blend"/>
      <feComposite in="blend" in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>

  <!-- Subtle noise texture overlay -->
  <rect width="${SIZE}" height="${SIZE}" fill="#6D28D9" opacity="0.03" filter="url(#noise)"/>

  <!-- Ambient purple glow orb -->
  <circle cx="512" cy="488" r="260" fill="url(#glowOrb)" filter="url(#ambientGlow)"/>

  <!-- Secondary smaller glow -->
  <circle cx="512" cy="488" r="140" fill="#7C3AED" opacity="0.12" filter="url(#ambientGlow)"/>

  <!-- ✦ Sparkle — 4-pointed star with concave curves -->
  <!-- Center: 512, 488 | Long radius: 198 | The curved sides create the sparkle shape -->
  <path
    d="
      M 512,290
      C 535,370 560,445 710,488
      C 560,531 535,606 512,686
      C 489,606 464,531 314,488
      C 464,445 489,370 512,290
      Z
    "
    fill="url(#sparkleFill)"
    filter="url(#sparkleGlow)"
  />

  <!-- Bright center core of sparkle -->
  <circle cx="512" cy="488" r="18" fill="#FFFFFF" opacity="0.9" filter="url(#sparkleGlow)"/>

  <!-- Small accent sparkles scattered around -->
  <circle cx="355" cy="345" r="5" fill="#C4B5FD" opacity="0.7"/>
  <circle cx="672" cy="362" r="4" fill="#DDD6FE" opacity="0.6"/>
  <circle cx="695" cy="615" r="5" fill="#A78BFA" opacity="0.5"/>
  <circle cx="338" cy="632" r="4" fill="#C4B5FD" opacity="0.55"/>
  <circle cx="502" cy="278" r="3" fill="#EDE9FE" opacity="0.8"/>
  <circle cx="524" cy="700" r="3" fill="#DDD6FE" opacity="0.7"/>
  <circle cx="428" cy="298" r="2.5" fill="#A78BFA" opacity="0.5"/>
  <circle cx="608" cy="295" r="2" fill="#C4B5FD" opacity="0.4"/>
  <circle cx="718" cy="488" r="3" fill="#EDE9FE" opacity="0.5"/>
  <circle cx="308" cy="488" r="2.5" fill="#DDD6FE" opacity="0.45"/>

  <!-- Subtle horizontal light streak through center -->
  <rect x="280" y="483" width="464" height="10" rx="5"
    fill="url(#sparkleFill)" opacity="0.08"/>

  <!-- "P" monogram — subtle, bottom area -->
  <text
    x="512" y="840"
    font-family="Georgia, serif"
    font-size="72"
    font-weight="700"
    fill="#7C3AED"
    fill-opacity="0.25"
    text-anchor="middle"
    letter-spacing="18"
  >PROMPTIT</text>
</svg>`;

async function generate() {
  const outDir = path.join(__dirname, '..', 'assets', 'images');

  console.log('Generating app icon...');
  await sharp(Buffer.from(svg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(outDir, 'icon.png'));
  console.log('✓ icon.png');

  // Splash icon — same design, centered on slightly larger canvas feel
  await sharp(Buffer.from(svg))
    .resize(200, 200)
    .png()
    .toFile(path.join(outDir, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  // Favicon
  await sharp(Buffer.from(svg))
    .resize(48, 48)
    .png()
    .toFile(path.join(outDir, 'favicon.png'));
  console.log('✓ favicon.png');

  console.log('\nDone! All icons generated.');
}

generate().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
