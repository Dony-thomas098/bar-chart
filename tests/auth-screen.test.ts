import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Premium Auth Screen Redesign Verification', () => {
  const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
  const globalsCssPath = path.resolve(__dirname, '../app/globals.css');
  const authCode = fs.readFileSync(authPagePath, 'utf-8');
  const cssCode = fs.readFileSync(globalsCssPath, 'utf-8');

  it('renders the header branding with squircle logo, orbital ring, and ambient backglow', () => {
    // Squircle logo container
    expect(authCode).toContain('rounded-[22px]');
    expect(authCode).toContain('src="/icon.png"');
    expect(authCode).toContain('animate-chordly-float');

    // Orbital ring SVG with elliptical path and glowing satellite bead
    expect(authCode).toContain('-rotate-[20deg]');
    expect(authCode).toContain('<ellipse');
    expect(authCode).toContain('strokeDasharray="160 25"');
    expect(authCode).toContain('animate-pulse');

    // Ambient backglow
    expect(authCode).toContain('animate-chordly-glow');
  });

  it('renders the Welcome back heading with gradient "back" and decorative line', () => {
    expect(authCode).toContain('Welcome <span className="bg-gradient-to-r from-[#FF5A00] via-[#FF3B30] to-[#FF2D55] bg-clip-text text-transparent">back</span>');
    expect(authCode).toContain('Sign in to continue to your charts');
    // Decorative line
    expect(authCode).toContain('w-9 h-[3px] rounded-full bg-gradient-to-r from-[#FF5A00] via-[#FF3B30] to-[#FF2D55]');
  });

  it('renders the segmented pill tabs for Sign In and Create Account', () => {
    expect(authCode).toContain('role="tablist"');
    expect(authCode).toContain('aria-selected={tabMode === \'signin\'}');
    expect(authCode).toContain('aria-selected={tabMode === \'signup\'}');
    expect(authCode).toContain('Sign In');
    expect(authCode).toContain('Create Account');
    expect(authCode).toContain('UserPlus');
  });

  it('renders the styled input fields with exact placeholders and focus rings', () => {
    expect(authCode).toContain('placeholder="e.g. donythomas or email@gmail.com"');
    expect(authCode).toContain('placeholder="••••••••"');
    expect(authCode).toMatch(/username or email/i);
    expect(authCode).toMatch(/password/i);
    expect(authCode).toContain('focus-within:border-[#FF5A00]');
    expect(authCode).toContain('EyeOff');
  });

  it('renders the primary gradient button with circular right arrow badge', () => {
    expect(authCode).toContain('bg-gradient-to-r from-[#FF5A00] via-[#FF2E55] to-[#E02475]');
    expect(authCode).toContain('ArrowRight');
    expect(authCode).toContain('w-8 h-8 rounded-full bg-white/20');
  });

  it('renders the alternative login options: Google and Guest mode', () => {
    expect(authCode).toContain('OR CONTINUE WITH');
    expect(authCode).toContain('Continue with Google');
    expect(authCode).toContain('Continue offline (Guest mode)');
    expect(authCode).toContain('Charts stay on this device. Sign in anytime to sync.');
    expect(authCode).toContain('handleGuestClick');
    expect(authCode).toContain('handleGoogleLogin');
  });

  it('renders background artwork with abstract flame waves and audio spectrum equalizer bars', () => {
    expect(authCode).toContain('flameLayerOuter');
    expect(authCode).toContain('flameLayerInner');
    expect(authCode).toContain('magentaLayerOuter');
    // Spectrum visualizer bars
    expect(authCode).toContain('rounded-full bg-gradient-to-t from-purple-950');
  });

  it('renders legal footer and modals for Terms, Privacy, and Forgot Password', () => {
    expect(authCode).toContain('By continuing you agree to our');
    expect(authCode).toContain('Terms');
    expect(authCode).toContain('Privacy Policy');
    expect(authCode).toContain('Reset Password');
    expect(authCode).toContain('Set New Password');
  });

  it('defines custom animations and reduced motion support in globals.css', () => {
    expect(cssCode).toContain('@keyframes chordly-float');
    expect(cssCode).toContain('@keyframes chordly-orbit');
    expect(cssCode).toContain('@keyframes chordly-glow-breathe');
    expect(cssCode).toContain('prefers-reduced-motion');
  });
});
