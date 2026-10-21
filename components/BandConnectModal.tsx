'use client';

import React, { useState, useEffect } from 'react';
import { createBand, joinBand, leaveBand, getStoredBand, Band } from '@/lib/band';
import { useAuth } from './AuthProvider';
import { Users, Plus, KeyRound, Check, X, Copy, LogOut, Sparkles, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (band: Band) => void;
}

export function BandConnectModal({ isOpen, onClose, onSuccess }: Props) {
  const { user, profile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join');
  const [currentBand, setCurrentBand] = useState<ReturnType<typeof getStoredBand>>({ id: null, name: null, code: null });

  // Form states
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [createNameInput, setCreateNameInput] = useState('');
  const [createCodeInput, setCreateCodeInput] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentBand(getStoredBand());
      setErrorMessage(null);
      setSuccessMessage(null);
      setJoinCodeInput('');
      setCreateNameInput('');
      setCreateCodeInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await joinBand(joinCodeInput.trim());
    setLoading(false);

    if (res.success && res.band) {
      setCurrentBand({ id: res.band.id, name: res.band.name, code: res.band.code });
      await updateProfile({
        band_id: res.band.id,
        band_name: res.band.name,
        band_code: res.band.code,
      });
      setSuccessMessage(`Joined "${res.band.name}" successfully!`);
      if (onSuccess) onSuccess(res.band);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setErrorMessage(res.error || 'Failed to join band. Please check the code.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.profession !== 'admin') {
      setErrorMessage('Only band admins can create a new band workspace. Please enter your band PIN to join.');
      return;
    }
    if (!createNameInput.trim() || !createCodeInput.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await createBand(createNameInput.trim(), createCodeInput.trim());
    setLoading(false);

    if (res.success && res.band) {
      setCurrentBand({ id: res.band.id, name: res.band.name, code: res.band.code });
      await updateProfile({
        profession: 'admin',
        band_id: res.band.id,
        band_name: res.band.name,
        band_code: res.band.code,
      });
      setSuccessMessage(`Created band "${res.band.name}"! You are the Admin.`);
      if (onSuccess) onSuccess(res.band);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setErrorMessage(res.error || 'Failed to create band.');
    }
  };

  const handleLeave = async () => {
    if (profile?.profession !== 'admin') {
      setErrorMessage('Only admins can manage or disconnect the band workspace.');
      return;
    }
    await leaveBand(user?.email);
    setCurrentBand({ id: null, name: null, code: null });
    await updateProfile({
      band_id: null,
      band_name: null,
      band_code: null,
    });
    setSuccessMessage('Disconnected from band.');
  };

  const copyCode = () => {
    if (currentBand.code) {
      navigator.clipboard.writeText(currentBand.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-md bg-white/75 dark:bg-[#18181d]/85 backdrop-blur-2xl saturate-[180%] rounded-[32px] p-6 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 relative text-[#1c1c1e] dark:text-[#f4f4f6]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight">Band Workspace</h3>
              <p className="text-[11px] text-text-secondary">Sync songs and folders across all devices</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* If already connected to a band */}
        {currentBand.code ? (
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
                  Connected Band
                </span>
                <p className="text-base font-extrabold text-text-primary">{currentBand.name || 'Shared Choir'}</p>
                <div className="flex items-center gap-2 mt-1">
                  {profile?.profession === 'admin' ? (
                    <>
                      <span className="text-xs font-mono font-bold bg-white/60 dark:bg-black/40 px-2 py-0.5 rounded-md border border-orange-500/20">
                        PIN: {currentBand.code}
                      </span>
                      <button
                        onClick={copyCode}
                        className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Share Code'}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-text-secondary">
                      Band Code: •••• (Admin Managed)
                    </span>
                  )}
                </div>
              </div>
              <ShieldCheck size={28} className="text-orange-500 shrink-0" />
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              All folders, charts, and lyrics created by you or your band members are synced live across all your devices.
            </p>

            {profile?.profession === 'admin' && (
              <button
                onClick={handleLeave}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut size={14} /> Leave / Switch Band
              </button>
            )}
          </div>
        ) : (
          /* Join or Create Tabs */
          <div className="pt-3">
            {/* Tab switch buttons */}
            <div className="flex p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] mb-4">
              <button
                type="button"
                onClick={() => { setActiveTab('join'); setErrorMessage(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'join'
                    ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <KeyRound size={14} /> Join Band
              </button>
              <button
                type="button"
                onClick={() => {
                  if (profile?.profession !== 'admin') {
                    setErrorMessage('Only admins can create a new band workspace. Please enter your choir PIN to join.');
                    return;
                  }
                  setActiveTab('create');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Plus size={14} /> Create Band {profile?.profession !== 'admin' && <span className="text-[10px] opacity-70">(Admin)</span>}
              </button>
            </div>

            {/* Error / Success Feedback */}
            {errorMessage && (
              <div className="mb-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                {successMessage}
              </div>
            )}

            {/* JOIN BAND TAB */}
            {activeTab === 'join' && (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                    Band Code / PIN
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={joinCodeInput}
                    onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 1234 or GW2026"
                    className="w-full px-4 py-3 bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/15 rounded-2xl text-text-primary font-mono tracking-wider text-center text-lg uppercase outline-none focus:ring-2 focus:ring-orange-500/40 transition-all shadow-inner"
                  />
                  <p className="text-[11px] text-text-secondary mt-1.5 text-center">
                    Default Choir PIN is <span className="font-bold font-mono text-orange-600 dark:text-orange-400">1234</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !joinCodeInput.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Connecting…' : 'Connect to Band'}
                </button>
              </form>
            )}

            {/* CREATE BAND TAB */}
            {activeTab === 'create' && (
              <form onSubmit={handleCreate} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block mb-1">
                    Band or Choir Name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={createNameInput}
                    onChange={e => setCreateNameInput(e.target.value)}
                    placeholder="e.g. Grace Worship Choir"
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/15 rounded-2xl text-text-primary text-sm outline-none focus:ring-2 focus:ring-orange-500/40 transition-all shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block mb-1">
                    Set Band Code / PIN (for members to join)
                  </label>
                  <input
                    type="text"
                    required
                    value={createCodeInput}
                    onChange={e => setCreateCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. GW2026 or 4321"
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/15 rounded-2xl text-text-primary font-mono tracking-wider text-center text-sm uppercase outline-none focus:ring-2 focus:ring-orange-500/40 transition-all shadow-inner"
                  />
                  <p className="text-[10px] text-text-secondary mt-1">
                    Share this code with your choir singers and musicians so they can sync with your catalog.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !createNameInput.trim() || !createCodeInput.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-purple-600 hover:brightness-110 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create Band & Become Admin'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer skip */}
        {!currentBand.code && (
          <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 mt-4 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
