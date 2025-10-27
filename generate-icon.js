const sharp = require('sharp');
const fs = require('fs');

async function generateIcons() {
  const svgBuffer = fs.readFileSync('assets/icons/icon.svg');

  // Generate PNG at 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('assets/icons/icon.png');

  console.log('✓ Generated icon.png (512x512)');

  // Generate additional sizes for Windows
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile('assets/icons/icon-256.png');

  console.log('✓ Generated icon-256.png (256x256)');

  // For macOS
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile('assets/icons/icon-1024.png');

  console.log('✓ Generated icon-1024.png (1024x1024)');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
