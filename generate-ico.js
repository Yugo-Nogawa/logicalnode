const icongen = require('icon-gen');

async function generateIco() {
  try {
    await icongen('assets/icons/icon.png', 'assets/icons', {
      ico: {
        name: 'icon',
        sizes: [16, 24, 32, 48, 64, 128, 256]
      }
    });
    console.log('✓ Generated icon.ico');
  } catch (err) {
    console.error('Error generating ICO:', err);
    process.exit(1);
  }
}

generateIco();
