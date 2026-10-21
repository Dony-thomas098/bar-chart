'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, UserProfession } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { 
  User, 
  Mail, 
  CreditCard, 
  LogOut, 
  CornerLeftUp, 
  Mic, 
  Guitar, 
  Sliders, 
  Edit3, 
  CheckCircle2, 
  Sparkles, 
  X, 
  Save,
  ShieldCheck,
  KeyRound,
  Lock,
  Users
} from 'lucide-react';
import { verifyAdminPasscode, setAdminPasscode } from '@/lib/adminAuth';
import { BandConnectModal } from '@/components/BandConnectModal';
import { getStoredBand } from '@/lib/band';

const INSTRUMENT_OPTIONS = [
  { id: 'Guitar', label: 'Guitar', icon: '🎸' },
  { id: 'Piano / Keyboard', label: 'Piano / Keyboard', icon: '🎹' },
  { id: 'Bass', label: 'Bass', icon: '🎸' },
  { id: 'Drums', label: 'Drums', icon: '🥁' },
  { id: 'Other', label: 'Other', icon: '🎷' },
];

interface SettingsRowProps {
  icon: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  label: string;
  value: string;
  hint?: string;
  action?: React.ReactNode;
}

function SettingsRow({
  icon,
  iconBgColor = 'bg-orange-500/10 dark:bg-orange-500/15',
  iconColor = 'text-orange-600 dark:text-orange-400',
  label,
  value,
  hint,
  action,
}: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-white/40 dark:bg-white/[0.03] border border-white/60 dark:border-white/10 rounded-2xl min-w-0 w-full transition-colors hover:bg-white/60 dark:hover:bg-white/[0.05]">
      {/* Icon */}
      <div className={`w-10 h-10 min-w-[40px] rounded-xl ${iconBgColor} ${iconColor} flex items-center justify-center shrink-0`}>
        {icon}
      </div>

      {/* Text Column */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <p className="text-[11px] text-text-secondary dark:text-zinc-400 font-semibold tracking-wide truncate">
          {label}
        </p>
        <p className="text-sm font-bold text-text-primary dark:text-white truncate">
          {value}
        </p>
        {hint && (
          <p className="text-[11px] text-text-secondary dark:text-zinc-400 truncate mt-0.5">
            {hint}
          </p>
        )}
      </div>

      {/* Action */}
      {action && (
        <div className="shrink-0 flex items-center">
          {action}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, updateProfile, loading, signOut } = useAuth();
  const router = useRouter();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editProfession, setEditProfession] = useState<UserProfession>(null);
  const [editInstrument, setEditInstrument] = useState('');
  const [customInstrument, setCustomInstrument] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Admin PIN prompt state (for unlocking Admin role)
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  // Change PIN modal state (for existing Admins)
  const [changePinModalOpen, setChangePinModalOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [changePinSuccess, setChangePinSuccess] = useState(false);

  // Band Workspace Modal state
  const [bandModalOpen, setBandModalOpen] = useState(false);
  const [bandInfo, setBandInfo] = useState<{ id: string | null; name: string | null; code: string | null }>({ id: null, name: null, code: null });
  const effectiveBandName = profile?.band_name || bandInfo.name;
  const effectiveBandCode = profile?.band_code || bandInfo.code;

  useEffect(() => {
    const updateBand = () => setBandInfo(getStoredBand());
    updateBand();
    window.addEventListener('band-joined', updateBand);
    window.addEventListener('band-left', updateBand);
    return () => {
      window.removeEventListener('band-joined', updateBand);
      window.removeEventListener('band-left', updateBand);
    };
  }, [profile?.band_name, profile?.band_code]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username || (user?.email ? user.email.split('@')[0] : ''));
      setEditProfession(profile.profession || null);
      
      const currentInst = profile.instrument || '';
      const isStandard = INSTRUMENT_OPTIONS.some(o => o.id === currentInst && o.id !== 'Other');
      if (isStandard) {
        setEditInstrument(currentInst);
        setCustomInstrument('');
      } else if (currentInst) {
        setEditInstrument('Other');
        setCustomInstrument(currentInst);
      } else {
        setEditInstrument('Guitar');
        setCustomInstrument('');
      }
    }
  }, [profile, user]);

  if (loading || !user) {
    return (
      <div className="min-h-dvh h-dvh bg-[var(--bg-canvas)] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
  };

  const handleOpenEdit = () => {
    setEditUsername(profile.username || (user?.email ? user.email.split('@')[0] : ''));
    setEditProfession(profile.profession || 'instrument');
    
    const currentInst = profile.instrument || '';
    const isStandard = INSTRUMENT_OPTIONS.some(o => o.id === currentInst && o.id !== 'Other');
    if (isStandard) {
      setEditInstrument(currentInst);
      setCustomInstrument('');
    } else if (currentInst) {
      setEditInstrument('Other');
      setCustomInstrument(currentInst);
    } else {
      setEditInstrument('Guitar');
      setCustomInstrument('');
    }
    setSaveSuccess(false);
    setEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let finalInstrument: string | null = null;
      if (editProfession === 'instrument') {
        if (editInstrument === 'Other') {
          finalInstrument = customInstrument.trim() || 'Other Instrument';
        } else {
          finalInstrument = editInstrument || 'Guitar';
        }
      }

      await updateProfile({
        username: editUsername.trim(),
        profession: editProfession,
        instrument: finalInstrument,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setEditModalOpen(false);
      }, 700);
    } catch (err) {
      console.error('[Profile] Error updating profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = profile.username || (user.email ? user.email.split('@')[0] : 'Musician');
  const initial = (displayName.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase();

  return (
    <div className="min-h-dvh h-dvh flex flex-col safe-area-screen bg-[var(--bg-canvas)] text-[#1c1c1e] dark:text-[#f4f4f6]">
      <Header />
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full px-4 pt-4 pb-[calc(7.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)))]">
        <div className="mx-auto w-full max-w-[430px] flex flex-col gap-4">
          
          {/* Top Bar Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => router.push('/')}
                className="hidden lg:flex w-10 h-10 min-w-[40px] min-h-[40px] rounded-2xl items-center justify-center text-text-secondary hover:text-text-primary dark:hover:text-white bg-white/70 dark:bg-zinc-800/70 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-xs transition-all cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 shrink-0"
                aria-label="Back to charts"
                title="Back to Charts"
              >
                <CornerLeftUp size={18} />
              </button>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-text-primary dark:text-white truncate">
                Profile
              </h1>
            </div>

            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-2xl bg-white/70 dark:bg-zinc-800/70 backdrop-blur-md border border-white/60 dark:border-white/10 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <Edit3 size={14} className="shrink-0" />
              <span>Edit Profile</span>
            </button>
          </div>

          {/* User Identity Card */}
          <div className="bg-white/70 dark:bg-[#18181d]/70 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-3xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] flex items-center gap-4 min-w-0 w-full">
            {/* Avatar */}
            <div className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-gradient-to-br from-orange-500 via-rose-500 to-amber-500 p-0.5 shrink-0 shadow-md shadow-orange-500/20">
              <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-xl font-extrabold text-orange-600 dark:text-orange-400">
                {initial}
              </div>
            </div>

            {/* Info Column */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-text-primary dark:text-white tracking-tight truncate">
                  {displayName}
                </h2>
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25">
                  Free plan
                </span>
              </div>
              <p className="text-xs text-text-secondary dark:text-zinc-400 truncate">
                {user.email}
              </p>

              {/* Role Pill */}
              <div className="pt-0.5 min-w-0">
                {profile.profession === 'singing' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 truncate max-w-full">
                    <Mic size={12} className="shrink-0" />
                    <span className="truncate">Singer / Vocalist • Lyrics access</span>
                  </span>
                ) : profile.profession === 'instrument' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 truncate max-w-full">
                    <Guitar size={12} className="shrink-0" />
                    <span className="truncate">Instrumentalist • {profile.instrument || 'Guitar'}</span>
                  </span>
                ) : profile.profession === 'admin' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 truncate max-w-full">
                    <ShieldCheck size={12} className="shrink-0" />
                    <span className="truncate">Admin • Full Access</span>
                  </span>
                ) : (
                  <button
                    onClick={handleOpenEdit}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer truncate max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <Sparkles size={12} className="shrink-0" />
                    <span className="truncate">Set musical role</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grouped Settings Card */}
          <div className="bg-white/70 dark:bg-[#18181d]/70 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-3xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] space-y-5 min-w-0 w-full">
            
            {/* Account Section */}
            <section className="space-y-2 min-w-0 w-full">
              <h3 className="text-xs font-bold text-text-secondary dark:text-zinc-400 px-1">
                Account
              </h3>
              <div className="space-y-2.5 min-w-0 w-full">
                <SettingsRow
                  icon={<User size={18} />}
                  iconBgColor="bg-orange-500/10 dark:bg-orange-500/15"
                  iconColor="text-orange-600 dark:text-orange-400"
                  label="Username"
                  value={profile.username || 'Not set'}
                  action={
                    <button
                      type="button"
                      onClick={handleOpenEdit}
                      className="min-h-[44px] min-w-[44px] px-2.5 py-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 flex items-center justify-center"
                    >
                      Change
                    </button>
                  }
                />
                <SettingsRow
                  icon={<Mail size={18} />}
                  iconBgColor="bg-blue-500/10 dark:bg-blue-500/15"
                  iconColor="text-blue-600 dark:text-blue-400"
                  label="Email address"
                  value={user.email || '—'}
                  action={
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
                      <CheckCircle2 size={12} className="shrink-0" /> Verified
                    </span>
                  }
                />
              </div>
            </section>

            {/* Preferences Section */}
            <section className="space-y-2 min-w-0 w-full">
              <h3 className="text-xs font-bold text-text-secondary dark:text-zinc-400 px-1">
                Preferences
              </h3>
              <div className="space-y-2.5 min-w-0 w-full">
                <SettingsRow
                  icon={profile.profession === 'admin' ? <ShieldCheck size={18} /> : profile.profession === 'singing' ? <Mic size={18} /> : <Guitar size={18} />}
                  iconBgColor={profile.profession === 'admin' ? 'bg-purple-500/10 dark:bg-purple-500/15' : profile.profession === 'singing' ? 'bg-rose-500/10 dark:bg-rose-500/15' : 'bg-orange-500/10 dark:bg-orange-500/15'}
                  iconColor={profile.profession === 'admin' ? 'text-purple-600 dark:text-purple-400' : profile.profession === 'singing' ? 'text-rose-600 dark:text-rose-400' : 'text-orange-600 dark:text-orange-400'}
                  label="Profession / role"
                  value={
                    profile.profession === 'singing'
                      ? 'Singer / Vocalist'
                      : profile.profession === 'instrument'
                      ? 'Instrumentalist'
                      : profile.profession === 'admin'
                      ? 'Admin / Band Leader'
                      : 'Not selected yet'
                  }
                  action={
                    <button
                      type="button"
                      onClick={handleOpenEdit}
                      className="min-h-[44px] min-w-[44px] px-2.5 py-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 flex items-center justify-center"
                    >
                      Edit
                    </button>
                  }
                />
                {profile.profession === 'instrument' && (
                  <SettingsRow
                    icon={<Guitar size={18} />}
                    iconBgColor="bg-amber-500/10 dark:bg-amber-500/15"
                    iconColor="text-amber-600 dark:text-amber-400"
                    label="Instrument"
                    value={profile.instrument || 'Guitar'}
                    action={
                      <button
                        type="button"
                        onClick={handleOpenEdit}
                        className="min-h-[44px] min-w-[44px] px-2.5 py-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 flex items-center justify-center"
                      >
                        Change
                      </button>
                    }
                  />
                )}
                <SettingsRow
                  icon={<Sliders size={18} />}
                  iconBgColor="bg-purple-500/10 dark:bg-purple-500/15"
                  iconColor="text-purple-600 dark:text-purple-400"
                  label="Navigation layout"
                  value={profile.profession === 'singing' ? 'Lyrics first' : 'Chords first'}
                  hint={
                    profile.profession === 'singing'
                      ? 'Lyrics, Setlists, Chords, Starred'
                      : 'Chords, Setlists, Lyrics, Starred'
                  }
                />
                {profile.profession === 'admin' && (
                  <SettingsRow
                    icon={<KeyRound size={18} />}
                    iconBgColor="bg-purple-500/10 dark:bg-purple-500/15"
                    iconColor="text-purple-600 dark:text-purple-400"
                    label="Band Leader Passcode"
                    value="•••• (Protected)"
                    hint="Passcode to authorize Admin on other devices"
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPinInput('');
                          setNewPinInput('');
                          setChangePinError(null);
                          setChangePinSuccess(false);
                          setChangePinModalOpen(true);
                        }}
                        className="min-h-[44px] min-w-[44px] px-2.5 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors cursor-pointer rounded-xl flex items-center justify-center"
                      >
                        Change PIN
                      </button>
                    }
                  />
                )}
              </div>
            </section>

            {/* Band Workspace Section */}
            <section className="space-y-2 min-w-0 w-full">
              <h3 className="text-xs font-bold text-text-secondary dark:text-zinc-400 px-1">
                Band Workspace
              </h3>
              <div className="space-y-2.5 min-w-0 w-full">
                <SettingsRow
                  icon={<Users size={18} />}
                  iconBgColor="bg-orange-500/10 dark:bg-orange-500/15"
                  iconColor="text-orange-600 dark:text-orange-400"
                  label="Choir / Band Workspace"
                  value={effectiveBandName ? `${effectiveBandName} (${effectiveBandCode || ''})` : 'Not Connected'}
                  hint={effectiveBandName ? 'All songs and folders are synced live with this band' : 'Connect with your choir PIN to sync songs'}
                  action={
                    <button
                      type="button"
                      onClick={() => setBandModalOpen(true)}
                      className="min-h-[44px] px-3.5 py-2 bg-white/70 dark:bg-zinc-800/70 border border-white/60 dark:border-white/10 hover:bg-orange-500/10 hover:border-orange-500/30 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                    >
                      {effectiveBandName ? 'Manage Band' : 'Join / Create'}
                    </button>
                  }
                />
              </div>
            </section>

            {/* Subscription Section */}
            <section className="space-y-2 min-w-0 w-full">
              <h3 className="text-xs font-bold text-text-secondary dark:text-zinc-400 px-1">
                Subscription
              </h3>
              <div className="space-y-2.5 min-w-0 w-full">
                <SettingsRow
                  icon={<CreditCard size={18} />}
                  iconBgColor="bg-emerald-500/10 dark:bg-emerald-500/15"
                  iconColor="text-emerald-600 dark:text-emerald-400"
                  label="Current plan"
                  value="Free tier"
                  hint="Unlimited local charts & setlists"
                  action={
                    <button
                      type="button"
                      className="min-h-[44px] px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 flex items-center justify-center shrink-0"
                    >
                      Upgrade
                    </button>
                  }
                />
              </div>
            </section>
          </div>

          {/* Destructive Log Out Button */}
          <div className="pt-1">
            <button 
              type="button"
              onClick={handleLogout}
              className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/25 hover:bg-red-500/20 active:scale-[0.99] text-red-600 dark:text-red-400 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 shadow-xs"
            >
              <LogOut size={18} className="shrink-0" />
              <span>Log out</span>
            </button>
          </div>

        </div>
      </main>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setEditModalOpen(false)}
        >
          <div 
            className="w-full max-w-[430px] max-h-[90dvh] overflow-y-auto bg-white/75 dark:bg-[#18181d]/75 backdrop-blur-2xl saturate-[180%] rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 relative text-[#1c1c1e] dark:text-[#f4f4f6] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.06] dark:border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <Edit3 size={18} className="text-orange-500 shrink-0" />
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight truncate">Edit Profile &amp; Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-3.5">
              
              {/* Username Input */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary dark:text-zinc-400 block mb-1.5">
                  Display Name / Username
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  placeholder="e.g. donythomas"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/60 dark:border-white/15 bg-white/50 dark:bg-white/[0.04] text-[#1c1c1e] dark:text-white placeholder-[#9ca3af] text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 font-medium transition-all"
                />
              </div>

              {/* Profession Radio Buttons */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary dark:text-zinc-400 block mb-2">
                  Musical Profession &amp; Access Level
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditProfession('singing')}
                    className={`min-h-[64px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      editProfession === 'singing'
                        ? 'border-rose-500 bg-rose-500/[0.14] text-rose-600 dark:text-rose-400 font-bold shadow-xs'
                        : 'border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] hover:bg-white/60 text-[#1c1c1e] dark:text-white font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm truncate">
                      <Mic size={15} className="shrink-0" /> Singer / Vocalist
                    </span>
                    <span className="text-[10px] text-text-secondary dark:text-zinc-400 truncate">View chords • Edit lyrics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditProfession('instrument')}
                    className={`min-h-[64px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                      editProfession === 'instrument'
                        ? 'border-orange-500 bg-orange-500/[0.14] text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                        : 'border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] hover:bg-white/60 text-[#1c1c1e] dark:text-white font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm truncate">
                      <Guitar size={15} className="shrink-0" /> Instrumentalist
                    </span>
                    <span className="text-[10px] text-text-secondary dark:text-zinc-400 truncate">Edit chords • View lyrics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (profile.profession === 'admin' || editProfession === 'admin') {
                        setEditProfession('admin');
                      } else {
                        setAdminPinInput('');
                        setAdminPinError(null);
                        setAdminPinModalOpen(true);
                      }
                    }}
                    className={`col-span-2 min-h-[54px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                      editProfession === 'admin'
                        ? 'border-purple-500 bg-purple-500/[0.14] text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                        : 'border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] hover:bg-white/60 text-[#1c1c1e] dark:text-white font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ShieldCheck size={18} className="shrink-0 text-purple-500" />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold truncate">Admin / Band Leader</span>
                          {profile.profession !== 'admin' && editProfession !== 'admin' && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
                              <Lock size={9} /> PIN Protected
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-secondary dark:text-zinc-400 truncate">Full editing access to Chords &amp; Lyrics</span>
                      </div>
                    </div>
                    {editProfession === 'admin' && (
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 shrink-0">Selected</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Instrument Selection if Instrumentalist */}
              {editProfession === 'instrument' && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary dark:text-zinc-400 block">
                    Select Your Instrument
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {INSTRUMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditInstrument(opt.id)}
                        className={`min-h-[44px] p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                          editInstrument === opt.id
                            ? 'border-orange-500 bg-orange-500/[0.14] text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                            : 'border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] hover:bg-white/60 text-[#1c1c1e] dark:text-white font-medium'
                        }`}
                      >
                        <span className="shrink-0">{opt.icon}</span>
                        <span className="text-xs truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  {editInstrument === 'Other' && (
                    <div className="pt-1">
                      <input
                        type="text"
                        required
                        placeholder="Type instrument (e.g. Ukulele, Violin)..."
                        value={customInstrument}
                        onChange={e => setCustomInstrument(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-white/60 dark:border-white/15 bg-white/50 dark:bg-white/[0.04] text-[#1c1c1e] dark:text-white placeholder-[#9ca3af] text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 font-medium transition-all"
                      />
                    </div>
                  )}
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" /> Profile &amp; navbar layout saved!
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1c1c1e] dark:text-white transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || (editProfession === 'instrument' && editInstrument === 'Other' && !customInstrument.trim())}
                  className="flex-2 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <Save size={14} className="shrink-0" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Admin Passcode Modal (Unlock Admin Role) */}
      {adminPinModalOpen && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setAdminPinModalOpen(false)}
        >
          <div 
            className="w-full max-w-sm bg-white/80 dark:bg-[#18181d]/85 backdrop-blur-2xl saturate-[180%] rounded-3xl p-6 shadow-[0_8px_32px_rgba(31,38,135,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 relative text-[#1c1c1e] dark:text-[#f4f4f6] animate-in zoom-in-95 duration-200 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 shadow-sm border border-purple-500/25">
              <ShieldCheck size={28} className="stroke-[2.2]" />
            </div>

            <h3 className="text-base font-extrabold text-[#1c1c1e] dark:text-white tracking-tight mb-1">
              Band Leader Passcode
            </h3>
            <p className="text-xs text-text-secondary dark:text-zinc-400 mb-5 font-medium px-2 leading-relaxed">
              Admin privileges allow creating, editing, and deleting all charts and lyrics. Please enter the authorization passcode.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (verifyAdminPasscode(adminPinInput)) {
                setEditProfession('admin');
                setAdminPinModalOpen(false);
                setAdminPinError(null);
              } else {
                setAdminPinError('Incorrect passcode. Please check with your band leader.');
              }
            }} className="space-y-4">
              <input
                type="password"
                autoFocus
                placeholder="Enter Passcode (Default: 1234)"
                value={adminPinInput}
                onChange={e => {
                  setAdminPinInput(e.target.value);
                  setAdminPinError(null);
                }}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-white/60 dark:border-white/15 bg-white/60 dark:bg-white/[0.06] text-center tracking-widest font-mono text-base font-bold text-[#1c1c1e] dark:text-white placeholder:text-xs placeholder:font-sans placeholder:tracking-normal placeholder-[#9ca3af] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner"
              />

              {adminPinError && (
                <p className="text-xs font-semibold text-rose-500 animate-in fade-in duration-150">
                  {adminPinError}
                </p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setAdminPinModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-text-secondary bg-white/40 dark:bg-white/5 hover:bg-white/60 rounded-full transition-all cursor-pointer border border-white/60 dark:border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Unlock Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Admin PIN Modal (For Active Admins) */}
      {changePinModalOpen && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setChangePinModalOpen(false)}
        >
          <div 
            className="w-full max-w-sm bg-white/80 dark:bg-[#18181d]/85 backdrop-blur-2xl saturate-[180%] rounded-3xl p-6 shadow-[0_8px_32px_rgba(31,38,135,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 relative text-[#1c1c1e] dark:text-[#f4f4f6] animate-in zoom-in-95 duration-200 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 shadow-sm border border-purple-500/25">
              <KeyRound size={28} className="stroke-[2.2]" />
            </div>

            <h3 className="text-base font-extrabold text-[#1c1c1e] dark:text-white tracking-tight mb-1">
              Change Band Leader PIN
            </h3>
            <p className="text-xs text-text-secondary dark:text-zinc-400 mb-5 font-medium px-2 leading-relaxed">
              Set a new passcode required for band members to unlock Admin access on other devices.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!verifyAdminPasscode(currentPinInput)) {
                setChangePinError('Current passcode is incorrect.');
                return;
              }
              if (!newPinInput.trim() || newPinInput.trim().length < 4) {
                setChangePinError('New passcode must be at least 4 characters.');
                return;
              }
              setAdminPasscode(newPinInput.trim());
              setChangePinSuccess(true);
              setTimeout(() => {
                setChangePinSuccess(false);
                setChangePinModalOpen(false);
              }, 1200);
            }} className="space-y-3.5 text-left">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary dark:text-zinc-400 block mb-1">
                  Current Passcode
                </label>
                <input
                  type="password"
                  required
                  placeholder="Current passcode"
                  value={currentPinInput}
                  onChange={e => {
                    setCurrentPinInput(e.target.value);
                    setChangePinError(null);
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/60 dark:border-white/15 bg-white/60 dark:bg-white/[0.06] text-sm font-medium text-[#1c1c1e] dark:text-white placeholder-[#9ca3af] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary dark:text-zinc-400 block mb-1">
                  New Passcode (Min 4 chars)
                </label>
                <input
                  type="password"
                  required
                  placeholder="New secret passcode"
                  value={newPinInput}
                  onChange={e => {
                    setNewPinInput(e.target.value);
                    setChangePinError(null);
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/60 dark:border-white/15 bg-white/60 dark:bg-white/[0.06] text-sm font-medium text-[#1c1c1e] dark:text-white placeholder-[#9ca3af] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner"
                />
              </div>

              {changePinError && (
                <p className="text-xs font-semibold text-rose-500">
                  {changePinError}
                </p>
              )}

              {changePinSuccess && (
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={16} /> Passcode successfully updated!
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePinModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-text-secondary bg-white/40 dark:bg-white/5 hover:bg-white/60 rounded-full transition-all cursor-pointer border border-white/60 dark:border-white/10 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePinSuccess}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  Save Passcode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Band Workspace Modal */}
      <BandConnectModal
        isOpen={bandModalOpen}
        onClose={() => setBandModalOpen(false)}
      />
    </div>
  );
}
