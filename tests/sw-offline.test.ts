import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Service Worker Offline Generation and Resilience', () => {
  const rootDir = path.resolve(__dirname, '..');
  const swGeneratorPath = path.join(rootDir, 'scripts', 'generate-sw.js');
  const generatorContent = fs.readFileSync(swGeneratorPath, 'utf-8');

  it('uses CACHE_NAME chordly-v9 to bust stale caches across deployments', () => {
    expect(generatorContent).toContain("const CACHE_NAME = 'chordly-v9'");
  });

  it('includes all critical offline routes in baseRoutes with both slash and non-slash variants', () => {
    const requiredRoutes = [
      '/chart',
      '/chart/',
      '/lyrics',
      '/lyrics/',
      '/lyrics/view',
      '/lyrics/view/',
      '/perform',
      '/perform/',
      '/perform/stage',
      '/perform/stage/',
      '/trash',
      '/trash/',
      '/settings',
      '/settings/',
      '/profile',
      '/profile/',
      '/bookmarks',
      '/bookmarks/',
      '/setlists',
      '/setlists/',
      '/folder',
      '/folder/'
    ];

    for (const route of requiredRoutes) {
      expect(generatorContent).toContain(`'${route}'`);
    }
  });

  it('implements dynamic script chunk and stylesheet harvesting in install event', () => {
    expect(generatorContent).toContain('scriptRegex');
    expect(generatorContent).toContain('cssRegex');
  });

  it('handles Next.js RSC flight payloads during soft navigation', () => {
    expect(generatorContent).toContain("request.headers.get('RSC') === '1'");
    expect(generatorContent).toContain("url.searchParams.has('_rsc')");
    expect(generatorContent).toContain('/trash/index.txt');
    expect(generatorContent).toContain('/chart/index.txt');
    expect(generatorContent).toContain('/lyrics/view/index.txt');
    expect(generatorContent).toContain('/perform/stage/index.txt');
  });

  it('provides chunk prefix fallback for offline chunk load resilience', () => {
    expect(generatorContent).toContain('/_next/static/chunks/');
    expect(generatorContent).toContain('offline chunk placeholder');
  });

  it('executes generate-sw.js and produces valid sw.js in public/ and out/', () => {
    // Run generator directly
    require('../scripts/generate-sw.js');

    const publicSw = fs.readFileSync(path.join(rootDir, 'public', 'sw.js'), 'utf-8');
    expect(publicSw).toContain("const CACHE_NAME = 'chordly-v9'");
    expect(publicSw).toContain('/trash/index.html');
    expect(publicSw).toContain('/profile/index.html');
    expect(publicSw).toContain('/settings/index.html');
    expect(publicSw).toContain('/perform/stage/index.html');
    expect(publicSw).toContain('/lyrics/view/index.html');
    expect(publicSw).toContain('/chart/index.html');
  });
});
