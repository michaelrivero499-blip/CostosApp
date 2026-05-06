const sharp = require('sharp');
const path = require('path');

const size = 1024;

const svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#F05B53"/>
  <text
    x="${size / 2}"
    y="${size / 2}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="580"
    font-weight="900"
    text-anchor="middle"
    dominant-baseline="central"
    fill="white"
    opacity="0.95"
  >$</text>
</svg>`;

const outPath = path.join(__dirname, '../assets/icon.png');

sharp(Buffer.from(svg))
  .png()
  .toFile(outPath)
  .then(() => console.log('✅ Icon generado en assets/icon.png'))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
