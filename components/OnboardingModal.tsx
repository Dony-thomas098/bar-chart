'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { usePathname } from 'next/navigation';
import { Mic, Guitar, Check, ChevronRight, Sparkles, X, Music, Music2 } from 'lucide-react';

const INSTRUMENT_OPTIONS = [
  { id: 'Guitar', label: 'Guitar', icon: '🎸' },
  { id: 'Piano / Keyboard', label: 'Piano / Keyboard', icon: '🎹' },
  { id: 'Bass', label: 'Bass', icon: '🎸' },
  { id: 'Drums', label: 'Drums', icon: '🥁' },
  { id: 'Other', label: 'Other', icon: '🎷' },
];

export function OnboardingModal() {
  const { user, profile, updateProfile, loading } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedProfession, setSelectedProfession] = useState<'singing' | 'instrument' | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string>('');
  const [customInstrument, setCustomInstrument] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-open for users who haven't selected a profession yet
  useEffect(() => {
    if (loading || !user) return;
    const isAuth = !pathname || pathname === '/auth' || pathname === '/auth/' || pathname.startsWith('/auth');
    if (isAuth) return;

    // Check if onboarding completed or dismissed
    const userPrefix = user.id ? `${user.id}_` : '';
    const hasCompleted = localStorage.getItem(`${userPrefix}onboarding_completed`) === 'true' ||
      localStorage.getItem('chord-grid-onboarding-completed') === 'true';

    if (!profile.profession && !hasCompleted) {
      // Small delay for smooth entry
      const timer = setTimeout(() => {
        setIsOpen(true);
        setStep(1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, profile.profession, loading, pathname]);

  // Listen for manual trigger (e.g. from Profile page "Edit Role & Profession")
  useEffect(() => {
    const handleOpen = (e: any) => {
      setSelectedProfession(
        profile.profession === 'singing' || profile.profession === 'instrument'
          ? profile.profession
          : null
      );
      if (profile.profession === 'instrument') {
        const inst = profile.instrument || '';
        const isStandard = INSTRUMENT_OPTIONS.some(o => o.id === inst && o.id !== 'Other');
        if (isStandard) {
          setSelectedInstrument(inst);
          setCustomInstrument('');
        } else if (inst) {
          setSelectedInstrument('Other');
          setCustomInstrument(inst);
        }
      }
      setStep(1);
      setIsOpen(true);
    };

    window.addEventListener('open-profession-modal', handleOpen);
    return () => window.removeEventListener('open-profession-modal', handleOpen);
  }, [profile]);

  const isAuth = !pathname || pathname === '/auth' || pathname === '/auth/' || pathname.startsWith('/auth');
  if (!isOpen || !user || isAuth) return null;

  const handleSelectProfession = (prof: 'singing' | 'instrument') => {
    setSelectedProfession(prof);
    setStep(2);
  };

  const handleFinish = async () => {
    if (!selectedProfession) return;
    setIsSaving(true);

    try {
      let finalInstrument: string | null = null;
      if (selectedProfession === 'instrument') {
        if (selectedInstrument === 'Other') {
          finalInstrument = customInstrument.trim() || 'Other Instrument';
        } else {
          finalInstrument = selectedInstrument || 'Guitar';
        }
      }

      await updateProfile({
        profession: selectedProfession,
        instrument: finalInstrument,
      });

      const userPrefix = user.id ? `${user.id}_` : '';
      localStorage.setItem(`${userPrefix}onboarding_completed`, 'true');
      localStorage.setItem('chord-grid-onboarding-completed', 'true');

      setIsOpen(false);
    } catch (err) {
      console.error('[Onboarding] Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDismiss = () => {
    const userPrefix = user.id ? `${user.id}_` : '';
    localStorage.setItem(`${userPrefix}onboarding_completed`, 'true');
    localStorage.setItem('chord-grid-onboarding-completed', 'true');
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] rounded-3xl p-6 sm:p-7 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 relative overflow-hidden text-[#1c1c1e] dark:text-[#f4f4f6] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Subtle orange accent glow at top */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#6b7280] hover:text-[#1c1c1e] dark:text-[#9ca3af] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer z-10"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Persistent Brand Logo Header */}
        <div className="flex flex-col items-center justify-center pt-2 pb-2">
          <div className="relative group">
            <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-orange-500 to-rose-500 opacity-25 blur-md group-hover:opacity-40 transition-opacity" />
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-md border border-white/60 dark:border-white/15 bg-white/80 dark:bg-zinc-800/80 p-1 flex items-center justify-center">
              <img src="/icon.png" alt="Chordly Logo" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>

        {/* Step 1: Choose Profession */}
        {step === 1 && (
          <div className="space-y-4 pt-1">
            <div className="text-center">
              <h2 className="text-xl font-extrabold tracking-tight text-[#1c1c1e] dark:text-white">
                Welcome to Chordly
              </h2>
              <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-1">
                What is your primary musical role?
              </p>
            </div>

            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] leading-relaxed text-center max-w-xs mx-auto">
              We personalize your navigation priority based on what you do most.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {/* Option 1: Singing / Vocalist */}
              <button
                type="button"
                onClick={() => handleSelectProfession('singing')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group ${
                  selectedProfession === 'singing'
                    ? 'border-orange-500 bg-orange-500/[0.08] shadow-sm'
                    : 'border-white/60 dark:border-white/10 hover:border-orange-500/50 bg-white/40 dark:bg-white/[0.04] hover:bg-white/60'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 text-rose-500 flex items-center justify-center shrink-0 shadow-sm border border-rose-500/30 group-hover:scale-105 transition-transform">
                  <Mic size={24} className="stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm tracking-tight text-[#1c1c1e] dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      Singing / Vocalist
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                      Lyrics 1st
                    </span>
                  </div>
                  <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-1">
                    Swaps navigation order to place <strong>Lyrics Sheets</strong> as your first priority.
                  </p>
                </div>
              </button>

              {/* Option 2: Instrument / Musician */}
              <button
                type="button"
                onClick={() => handleSelectProfession('instrument')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 group ${
                  selectedProfession === 'instrument'
                    ? 'border-orange-500 bg-orange-500/[0.08] shadow-sm'
                    : 'border-white/60 dark:border-white/10 hover:border-orange-500/50 bg-white/40 dark:bg-white/[0.04] hover:bg-white/60'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 shadow-sm border border-orange-500/30 group-hover:scale-105 transition-transform">
                  <Guitar size={24} className="stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm tracking-tight text-[#1c1c1e] dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      Instrument / Musician
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
                      Chords 1st
                    </span>
                  </div>
                  <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-1">
                    Keeps <strong>Chords Library</strong> as your first priority and lets you select your instrument.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation / Instrument Selection */}
        {step === 2 && (
          <div className="space-y-4 pt-1">
            {selectedProfession === 'singing' ? (
              <>
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[11px] font-bold">
                    <Mic size={12} /> Singing Mode
                  </div>
                  <h2 className="text-lg font-extrabold tracking-tight text-[#1c1c1e] dark:text-white">
                    Singing Mode Configured
                  </h2>
                  <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">Lyrics will now be your 1st tab</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-white/60 dark:border-white/10 space-y-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                    <Check size={14} className="stroke-[3]" /> Navigation Updated
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1c1c1e] dark:text-white">
                    <span className="px-2.5 py-1 rounded-lg bg-orange-500 text-white font-bold shadow-xs">1. Lyrics</span>
                    <span className="text-[#6b7280]">→</span>
                    <span className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10">2. Setlists</span>
                    <span className="text-[#6b7280]">→</span>
                    <span className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10">3. Chords</span>
                    <span className="text-[#6b7280]">→</span>
                    <span className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10">4. Starred</span>
                  </div>
                  <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] pt-1">
                    You can switch this anytime in your Profile settings.
                  </p>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1c1c1e] dark:text-white transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={isSaving}
                    className="flex-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 text-center"
                  >
                    {isSaving ? 'Saving...' : 'Apply & Continue'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[11px] font-bold">
                    <Guitar size={12} /> Musician Setup
                  </div>
                  <h2 className="text-lg font-extrabold tracking-tight text-[#1c1c1e] dark:text-white">
                    Which instrument do you play?
                  </h2>
                  <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">Select your instrument</p>
                </div>

                {/* Instrument Options Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {INSTRUMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedInstrument(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        selectedInstrument === opt.id
                          ? 'border-orange-500 bg-orange-500/[0.12] text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                          : 'border-black/[0.08] dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 text-[#1c1c1e] dark:text-white font-medium'
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-xs truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Other instrument input if selected */}
                {selectedInstrument === 'Other' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#9ca3af] block">
                      Specify Instrument
                    </label>
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="e.g. Ukulele, Violin, Saxophone..."
                      value={customInstrument}
                      onChange={(e) => setCustomInstrument(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] text-[#1c1c1e] dark:text-white placeholder-[#9ca3af] text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all font-medium"
                    />
                  </div>
                )}

                <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/10 text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                  Navbar priority will stay on default: <strong>Chords 1st</strong>.
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1c1c1e] dark:text-white transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={isSaving || !selectedInstrument || (selectedInstrument === 'Other' && !customInstrument.trim())}
                    className="flex-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 text-center"
                  >
                    {isSaving ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
