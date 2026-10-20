const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function publishOta() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist-mobile');
  const zipPath = path.join(distDir, 'bundle.zip');
  const manifestPath = path.join(distDir, 'update.json');
  const apkPath = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

  console.log('\n========================================');
  console.log('   CHORDLY OVER-THE-AIR (OTA) PUBLISHER  ');
  console.log('========================================\n');

  // Step 1: Pack the OTA bundle
  console.log('[1/3] Packaging latest OTA bundle...');
  execSync('node scripts/pack-ota.js', { stdio: 'inherit', cwd: rootDir });

  if (!fs.existsSync(zipPath) || !fs.existsSync(manifestPath)) {
    console.error('Error: Bundle files missing after pack-ota.js.');
    process.exit(1);
  }

  // Step 2: Check for gh CLI
  console.log('\n[2/3] Checking GitHub CLI (gh) authentication...');
  try {
    execSync('gh auth status', { stdio: 'pipe' });
  } catch (err) {
    console.error('Error: GitHub CLI is not authenticated.');
    console.error('Please run "gh auth login" or push to GitHub to let GitHub Actions publish automatically.');
    process.exit(1);
  }

  // Step 3: Publish to GitHub Release 'ota-latest'
  console.log('\n[3/3] Uploading OTA bundle & APK to GitHub Releases (tag: ota-latest)...');
  const filesToUpload = [`"${zipPath}"`, `"${manifestPath}"`];
  if (fs.existsSync(apkPath)) {
    console.log(`[Info] Including compiled Android APK: ${apkPath}`);
    filesToUpload.push(`"${apkPath}"`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const releaseNotes = `Live OTA Update Bundle: ${manifest.bundleId}\nVersion: ${manifest.version}\nChecksum: ${manifest.checksum}\nReleased: ${manifest.releasedAt}`;

  try {
    let releaseExists = false;
    try {
      execSync('gh release view ota-latest', { stdio: 'pipe' });
      releaseExists = true;
    } catch {
      releaseExists = false;
    }

    if (releaseExists) {
      console.log('[Info] Release ota-latest exists. Updating assets...');
      const uploadCmd = `gh release upload ota-latest ${filesToUpload.join(' ')} --clobber`;
      execSync(uploadCmd, { stdio: 'inherit', cwd: rootDir });
    } else {
      console.log('[Info] Creating release ota-latest...');
      const createCmd = `gh release create ota-latest ${filesToUpload.join(' ')} --title "Chordly Live Update (${manifest.version})" --notes "${releaseNotes}" --latest`;
      execSync(createCmd, { stdio: 'inherit', cwd: rootDir });
    }
  } catch (uploadErr) {
    console.error('Failed to publish release via gh CLI:', uploadErr.message);
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('🎉 OTA LIVE UPDATE PUBLISHED SUCCESSFULLY!');
  console.log(`Bundle ID: ${manifest.bundleId}`);
  console.log('Live Manifest URL:');
  console.log('👉 https://github.com/Dony-thomas098/bar-chart/releases/latest/download/update.json');
  console.log('Live Bundle URL:');
  console.log('👉 https://github.com/Dony-thomas098/bar-chart/releases/latest/download/bundle.zip');
  if (fs.existsSync(apkPath)) {
    console.log('Android APK Download:');
    console.log('👉 https://github.com/Dony-thomas098/bar-chart/releases/latest/download/app-debug.apk');
  }
  console.log('All installed mobile apps will now auto-update over the air on next open!');
  console.log('======================================================\n');
}

publishOta().catch((err) => {
  console.error('[OTA Publish] Error:', err);
  process.exit(1);
});
