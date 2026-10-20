const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function packOta() {
  const rootDir = path.resolve(__dirname, '..');
  const outDir = path.join(rootDir, 'out');
  const distDir = path.join(rootDir, 'dist-mobile');

  if (!fs.existsSync(outDir) || !fs.existsSync(path.join(outDir, 'index.html'))) {
    console.error('Error: "out/" directory does not exist or is missing index.html.');
    console.error('Please run "npm run build:cap" first to generate the static web export.');
    process.exit(1);
  }

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  let AdmZip;
  try {
    AdmZip = require('adm-zip');
  } catch (err) {
    console.error('Error: adm-zip is required to package OTA bundles. Run npm install --save-dev adm-zip');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const version = pkg.version || '1.0.0';
  const bundleId = `bundle-v${version}-${timestamp}`;
  const zipPath = path.join(distDir, 'bundle.zip');

  console.log(`[OTA Pack] Archiving ${outDir} -> ${zipPath}...`);
  const zip = new AdmZip();
  zip.addLocalFolder(outDir);
  zip.writeZip(zipPath);

  // Compute SHA-256 Checksum
  const fileBuffer = fs.readFileSync(zipPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const checksum = hashSum.digest('hex');

  const manifest = {
    version: version,
    bundleId: bundleId,
    url: 'https://chordly.vercel.app/bundle.zip', // Replace or override with actual hosting URL / release URL
    checksum: checksum,
    fileSize: fileBuffer.length,
    releasedAt: new Date().toISOString(),
    notes: `OTA update package for Chordly v${version}`
  };

  const manifestPath = path.join(distDir, 'update.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // Also copy manifest to public/ so Next.js static export serves it
  const publicDir = path.join(rootDir, 'public');
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'update.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  }

  console.log('\n=== OTA Bundle Successfully Packaged ===');
  console.log(`Bundle ID:   ${bundleId}`);
  console.log(`Archive:     ${zipPath} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Checksum:    ${checksum}`);
  console.log(`Manifest:    ${manifestPath}`);
  console.log('========================================\n');
}

packOta().catch((e) => {
  console.error('[OTA Pack] Failed:', e);
  process.exit(1);
});
