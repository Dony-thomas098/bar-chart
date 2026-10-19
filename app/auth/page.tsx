'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Eye, EyeOff, User, Mail, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery';

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState(''); // for Sign In (username or email)
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user, loading, enableGuestMode } = useAuth();

  // Listen for Supabase password recovery link redirection
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('recovery');
        setError(null);
        setSuccessMessage(null);
      }
    });

    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes('type=recovery') || search.includes('mode=update-password')) {
        setAuthMode('recovery');
      }
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && user && authMode !== 'recovery') {
      router.replace('/');
    }
  }, [user, loading, authMode, router]);

  // Permanently lock document and body scrolling while on the Auth screen
  useEffect(() => {
    const origHtmlOverflow = document.documentElement.style.overflow;
    const origHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const origBodyOverflow = document.body.style.overflow;
    const origBodyOverscroll = document.body.style.overscrollBehavior;
    const origBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.style.height = '100dvh';

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.height = '100dvh';
    document.body.style.touchAction = 'none';

    return () => {
      document.documentElement.style.overflow = origHtmlOverflow;
      document.documentElement.style.overscrollBehavior = origHtmlOverscroll;
      document.documentElement.style.height = '';

      document.body.style.overflow = origBodyOverflow;
      document.body.style.overscrollBehavior = origBodyOverscroll;
      document.body.style.height = '';
      document.body.style.touchAction = origBodyTouchAction;
    };
  }, []);

  if (loading || (user && authMode !== 'recovery')) return null;

  const handleGuestClick = () => {
    enableGuestMode();
    router.push('/');
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setIsSubmitting(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'signup') {
        // --- SIGN UP FLOW ---
        const cleanUsername = username.trim().toLowerCase();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanUsername) {
          setError('Please choose a username.');
          setIsSubmitting(false);
          return;
        }

        if (!cleanEmail || !cleanEmail.includes('@')) {
          setError('Please enter a valid email address for verification.');
          setIsSubmitting(false);
          return;
        }

        // Store local username to email mapping for fast username login
        if (typeof window !== 'undefined') {
          localStorage.setItem(`cc_user_${cleanUsername}`, cleanEmail);
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              username: cleanUsername,
            }
          }
        });

        if (error) throw error;

        // Ensure a profile record exists for username lookup
        if (data?.user) {
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              username: cleanUsername,
              display_name: cleanUsername,
              role: 'instrument',
            });
          } catch (profileErr) {
            console.warn('[Auth] Note on profile upsert:', profileErr);
          }
        }

        setSuccessMessage(`Account created! A verification link has been sent to ${cleanEmail}. Please check your email to verify.`);
      } else if (authMode === 'signin') {
        // --- SIGN IN FLOW ---
        const cleanIdentifier = identifier.trim().toLowerCase();
        if (!cleanIdentifier) {
          setError('Please enter your username or email address.');
          setIsSubmitting(false);
          return;
        }

        let targetEmail = cleanIdentifier;

        // If the user typed a username (no @ symbol)
        if (!cleanIdentifier.includes('@')) {
          const cachedEmail = typeof window !== 'undefined' ? localStorage.getItem(`cc_user_${cleanIdentifier}`) : null;
          if (cachedEmail) {
            targetEmail = cachedEmail;
          } else {
            // Check public.profiles in Supabase to resolve across devices
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', cleanIdentifier)
                .maybeSingle();

              // Fallback to chordcraft standard synthetic address if not direct email
              targetEmail = `${cleanIdentifier}@chordcraft.app`;
            } catch {
              targetEmail = `${cleanIdentifier}@chordcraft.app`;
            }
          }
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password
        });

        if (error) throw error;
        router.push('/');
      } else if (authMode === 'forgot') {
        // --- FORGOT PASSWORD FLOW ---
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          setError('Please enter your valid registered email address.');
          setIsSubmitting(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth?mode=update-password` : undefined,
        });

        if (error) throw error;
        setSuccessMessage(`Password recovery link sent to ${cleanEmail}. Please check your email inbox!`);
      } else if (authMode === 'recovery') {
        // --- UPDATE PASSWORD FLOW ---
        if (!password || password.length < 6) {
          setError('New password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({
          password,
        });

        if (error) throw error;
        setSuccessMessage('Password successfully updated! Redirecting to home...');
        setTimeout(() => {
          router.push('/');
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div 
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full overflow-hidden flex flex-col items-center justify-center px-4 pt-[max(env(safe-area-inset-top),8px)] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overscroll-none select-none z-30"
      style={{ touchAction: 'none' }}
    >
      <div 
        className="w-full max-w-sm rounded-3xl bg-white/75 dark:bg-[#18181d]/80 backdrop-blur-2xl saturate-[180%] p-5 sm:p-7 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 text-text-primary dark:text-white max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain select-auto"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="flex justify-center mb-2.5 sm:mb-3">
          <div className="p-0.5 rounded-2xl shadow-popover overflow-hidden flex items-center justify-center">
            <img src="/icon.png" alt="Chordly Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-xl shadow-md" />
          </div>
        </div>
        
        <h2 className="mb-0.5 text-center text-xl sm:text-2xl font-bold text-text-primary dark:text-white tracking-tight">
          {authMode === 'signup'
            ? 'Create an Account'
            : authMode === 'forgot'
            ? 'Reset Password'
            : authMode === 'recovery'
            ? 'Set New Password'
            : (
              <span>
                Welcome to chord<span className="text-chordly-orange font-black">ly</span>
              </span>
            )}
        </h2>
        <p className="mb-2.5 sm:mb-3 text-center text-[11px] sm:text-xs text-text-secondary dark:text-gray-400">
          {authMode === 'signup'
            ? 'Choose your username, email, and password to get started'
            : authMode === 'forgot'
            ? 'Enter your email and we will send a password recovery link'
            : authMode === 'recovery'
            ? 'Enter your new password below'
            : 'Sign in using your username or email'}
        </p>

        {/* Auth Mode Tabs (only shown for signin/signup) */}
        {(authMode === 'signin' || authMode === 'signup') && (
          <>
            {/* Google One-Click Login */}
            <div className="mb-2 sm:mb-2.5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full py-2 sm:py-2.5 px-4 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-xs font-bold shadow-sm border border-black/10 dark:border-white/15 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="w-full flex items-center my-2 sm:my-2.5">
                <div className="flex-1 border-t border-black/10 dark:border-white/10" />
                <span className="px-2 text-[9px] sm:text-[10px] text-text-secondary dark:text-gray-400 uppercase tracking-widest font-semibold">Or with password</span>
                <div className="flex-1 border-t border-black/10 dark:border-white/10" />
              </div>
            </div>

            <div className="flex bg-black/5 dark:bg-white/10 p-0.5 sm:p-1 rounded-xl mb-2.5 sm:mb-3 border border-white/60 dark:border-white/10">
              <button
                type="button"
                onClick={() => { setAuthMode('signin'); setError(null); setSuccessMessage(null); }}
                className={`flex-1 py-1.5 sm:py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'signin' ? 'bg-orange-500 text-white shadow-sm' : 'text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setError(null); setSuccessMessage(null); }}
                className={`flex-1 py-1.5 sm:py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'signup' ? 'bg-orange-500 text-white shadow-sm' : 'text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          </>
        )}

        <form onSubmit={handleAuth} className="space-y-2 sm:space-y-2.5">
          {authMode === 'signup' && (
            <>
              {/* Username Input for Signup */}
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-300 mb-0.5">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-500">
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. donythomas"
                    className="block w-full pl-8 pr-3 py-2 sm:py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-xs sm:text-sm transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              {/* Real Email Input for Signup */}
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-300 mb-0.5">
                  Email Address (For Verification)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-500">
                    <Mail size={15} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="e.g. name@example.com"
                    className="block w-full pl-8 pr-3 py-2 sm:py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-xs sm:text-sm transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {authMode === 'signin' && (
            <div>
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-300 mb-0.5">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-500">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. donythomas or email@gmail.com"
                  className="block w-full pl-8 pr-3 py-2 sm:py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-xs sm:text-sm transition-all"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>
          )}

          {authMode === 'forgot' && (
            <div>
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-300 mb-0.5">
                Registered Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-500">
                  <Mail size={15} />
                </div>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@example.com"
                  className="block w-full pl-8 pr-3 py-2 sm:py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-xs sm:text-sm transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          {(authMode === 'signin' || authMode === 'signup' || authMode === 'recovery') && (
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-300">
                  {authMode === 'recovery' ? 'New Password' : 'Password'}
                </label>
                {authMode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setError(null); setSuccessMessage(null); }}
                    className="text-[10px] sm:text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-500">
                  <Lock size={15} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="block w-full pl-8 pr-9 py-2 sm:py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-xs sm:text-sm transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-white transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2 sm:p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-2 sm:p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-400 font-medium flex items-start space-x-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-accent-gradient font-bold text-xs sm:text-sm text-white shadow-md hover:brightness-110 focus:outline-none transition-all disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {isSubmitting
              ? 'Processing...'
              : authMode === 'signup'
              ? 'Sign Up'
              : authMode === 'forgot'
              ? 'Send Recovery Link'
              : authMode === 'recovery'
              ? 'Update Password & Sign In'
              : 'Sign In'}
          </button>

          {authMode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setError(null); setSuccessMessage(null); }}
              className="w-full py-1.5 text-xs font-semibold text-text-secondary dark:text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={13} /> Back to Sign In
            </button>
          )}
        </form>

        {(authMode === 'signin' || authMode === 'signup') && (
          <div className="mt-2.5 sm:mt-3 flex flex-col items-center space-y-1.5 sm:space-y-2">
            <button
              type="button"
              onClick={() => { 
                setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); 
                setError(null); 
                setSuccessMessage(null); 
              }}
              className="text-[11px] sm:text-xs font-bold text-accent-start hover:underline transition-all cursor-pointer"
            >
              {authMode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
            
            <div className="w-full flex items-center my-1">
              <div className="flex-1 border-t border-gray-800" />
              <span className="px-2 text-[9px] text-gray-500 uppercase tracking-widest">Or</span>
              <div className="flex-1 border-t border-gray-800" />
            </div>

            <button
              type="button"
              onClick={handleGuestClick}
              className="w-full py-2 sm:py-2.5 px-4 bg-gray-800 border border-gray-700 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-700 transition-all flex items-center justify-center cursor-pointer active:scale-95"
            >
              ⚡ Continue Offline (Guest Mode)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
