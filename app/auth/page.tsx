'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { 
  User, 
  Mail,
  Lock, 
  Eye, 
  EyeOff, 
  Zap, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft 
} from 'lucide-react';

type TabMode = 'signin' | 'signup';
type ModalView = 'none' | 'forgot' | 'recovery' | 'terms' | 'privacy';

export default function AuthPage() {
  const [tabMode, setTabMode] = useState<TabMode>('signin');
  const [modalView, setModalView] = useState<ModalView>('none');
  
  // Form fields
  const [identifier, setIdentifier] = useState(''); // Username or email (Sign in)
  const [signupUsername, setSignupUsername] = useState(''); // Username (Create Account)
  const [signupEmail, setSignupEmail] = useState(''); // Email (Create Account)
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Field validation and blur states
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [signupUsernameTouched, setSignupUsernameTouched] = useState(false);
  const [signupEmailTouched, setSignupEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [forgotEmailTouched, setForgotEmailTouched] = useState(false);

  // Status and error handling
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate limiting & lockout
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Deep-link redirection to native app when authenticated in mobile browser
  const [appRedirectUrl, setAppRedirectUrl] = useState<string | null>(null);

  // Platform detection
  const [isApplePlatform, setIsApplePlatform] = useState(false);

  const router = useRouter();
  const { user, loading, enableGuestMode } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);

  // Detect iOS / macOS platform for Apple Sign In display
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(ua);
      const isMac = /macintosh|mac os x/.test(ua);
      setIsApplePlatform(isIOS || isMac);
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          setGeneralError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  // Esc key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalView !== 'none') {
        setModalView('none');
        setGeneralError(null);
        setSuccessMessage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalView]);

  // Listen for Supabase auth state changes & handle OAuth redirects
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setModalView('recovery');
        setGeneralError(null);
        setSuccessMessage(null);
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Sync user email & username to profiles on successful sign in
        try {
          const userMeta = session.user.user_metadata || {};
          const fallbackUsername = userMeta.username || (session.user.email ? session.user.email.split('@')[0] : '');
          await supabase.from('profiles').upsert({
            id: session.user.id,
            email: session.user.email,
            username: fallbackUsername,
            display_name: userMeta.full_name || userMeta.name || fallbackUsername,
          });
          if (typeof window !== 'undefined' && fallbackUsername) {
            if (session.user.email) {
              localStorage.setItem(`cc_user_${fallbackUsername.toLowerCase()}`, session.user.email.toLowerCase());
            }
            localStorage.setItem('chord-grid-username', fallbackUsername);
            localStorage.setItem(`${session.user.id}_username`, fallbackUsername);
          }
        } catch {}

        // Check if user is in an external mobile browser (e.g. Chrome/Safari) and needs redirect back to native app
        const isMobileBrowser = typeof window !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
        let isNative = false;
        try {
          const { Capacitor } = await import('@capacitor/core');
          isNative = Capacitor.isNativePlatform();
        } catch {}

        if (isMobileBrowser && !isNative) {
          const tokens = session ? `#access_token=${session.access_token}&refresh_token=${session.refresh_token}` : '';
          const deepLink = `com.chordly.app://auth${tokens}`;
          const isAndroid = /android/i.test(navigator.userAgent);
          const targetUrl = isAndroid
            ? `intent://auth${tokens}#Intent;scheme=com.chordly.app;package=com.chordly.app;end;`
            : deepLink;

          setAppRedirectUrl(targetUrl);
          try {
            window.location.href = targetUrl;
          } catch {}
        } else {
          router.replace('/');
        }
      }
    });

    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      const searchParams = new URLSearchParams(search);
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);

      // Check if URL has OAuth error parameters
      const errorMsg = searchParams.get('error_description') || 
                       hashParams.get('error_description') || 
                       searchParams.get('error') || 
                       hashParams.get('error');

      if (errorMsg) {
        const readableError = decodeURIComponent(errorMsg.replace(/\+/g, ' '));
        if (readableError.toLowerCase().includes('external provider') || readableError.toLowerCase().includes('not enabled')) {
          setGeneralError('Google Sign-In is not enabled yet in your Supabase Dashboard. Please enable Google under Authentication -> Providers.');
        } else {
          setGeneralError(`Authentication error: ${readableError}`);
        }
      }

      // Check for PKCE authorization code in URL search
      const code = searchParams.get('code');
      if (code) {
        setIsSubmitting(true);
        supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
          setIsSubmitting(false);
          if (error) {
            console.error('[Auth] OAuth exchange error:', error);
            setGeneralError(error.message || 'Failed to complete sign-in from redirect.');
          } else if (data?.session) {
            const isMobileBrowser = typeof window !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
            let isNative = false;
            try {
              const { Capacitor } = await import('@capacitor/core');
              isNative = Capacitor.isNativePlatform();
            } catch {}

            if (isMobileBrowser && !isNative) {
              const tokens = `#access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}`;
              const isAndroid = /android/i.test(navigator.userAgent);
              const deepLink = `com.chordly.app://auth${tokens}`;
              const targetUrl = isAndroid
                ? `intent://auth${tokens}#Intent;scheme=com.chordly.app;package=com.chordly.app;end;`
                : deepLink;

              setAppRedirectUrl(targetUrl);
              try {
                window.location.href = targetUrl;
              } catch {}
            } else {
              router.replace('/');
            }
          }
        }).catch((err) => {
          setIsSubmitting(false);
          setGeneralError(err.message || 'Failed to complete sign-in from redirect.');
        });
      }

      if (hash.includes('type=recovery') || search.includes('mode=update-password')) {
        setModalView('recovery');
      }
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // If already authenticated and not in password recovery, redirect to home
  useEffect(() => {
    if (!loading && user && modalView !== 'recovery') {
      router.replace('/');
    }
  }, [user, loading, modalView, router]);

  // Inline validation helpers
  const getIdentifierError = useCallback(() => {
    if (!identifierTouched) return null;
    const val = identifier.trim();
    if (!val) return 'Please enter your username or email address.';
    return null;
  }, [identifier, identifierTouched]);

  const getSignupUsernameError = useCallback(() => {
    if (!signupUsernameTouched) return null;
    const val = signupUsername.trim();
    if (!val) return 'Please enter a username.';
    if (val.length < 3) return 'Username must be at least 3 characters.';
    if (val.includes('@')) return 'Username should not contain @. Enter your email below.';
    if (!/^[a-zA-Z0-9_.-]+$/.test(val)) return 'Username can only contain letters, numbers, underscores, hyphens, and dots.';
    return null;
  }, [signupUsername, signupUsernameTouched]);

  const getSignupEmailError = useCallback(() => {
    if (!signupEmailTouched) return null;
    const val = signupEmail.trim();
    if (!val) return 'Please enter your email address.';
    if (!val.includes('@') || !val.includes('.')) {
      return 'Please enter a valid email format (e.g. name@domain.com).';
    }
    return null;
  }, [signupEmail, signupEmailTouched]);

  const getPasswordError = useCallback(() => {
    if (!passwordTouched) return null;
    if (!password) return 'Please enter your password.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  }, [password, passwordTouched]);

  const getForgotEmailError = useCallback(() => {
    if (!forgotEmailTouched) return null;
    const val = forgotEmail.trim();
    if (!val) return 'Please enter your registered email address.';
    if (!val.includes('@') || !val.includes('.')) {
      return 'Please enter a valid email format (e.g. name@domain.com).';
    }
    return null;
  }, [forgotEmail, forgotEmailTouched]);

  // Guest Mode handler
  const handleGuestClick = () => {
    enableGuestMode();
    router.push('/');
  };

  // Google OAuth login
  const handleGoogleLogin = async () => {
    setGeneralError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      let isNative = false;
      try {
        const { Capacitor } = await import('@capacitor/core');
        isNative = Capacitor.isNativePlatform();
      } catch {}

      const redirectUrl = isNative
        ? 'com.chordly.app://auth'
        : (typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
        },
      });

      if (error) throw error;

      if (isNative && data?.url) {
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({
            url: data.url,
            windowName: '_self',
          });
        } catch {
          window.open(data.url, '_system');
        }
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Google sign-in failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Apple OAuth login (iOS / macOS App Store compliance)
  const handleAppleLogin = async () => {
    setGeneralError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      let isNative = false;
      try {
        const { Capacitor } = await import('@capacitor/core');
        isNative = Capacitor.isNativePlatform();
      } catch {}

      const redirectUrl = isNative
        ? 'com.chordly.app://auth'
        : (typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
        },
      });

      if (error) throw error;

      if (isNative && data?.url) {
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({
            url: data.url,
            windowName: '_self',
          });
        } catch {
          window.open(data.url, '_system');
        }
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Apple sign-in failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Main Form Submit (Sign In or Create Account)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;

    setGeneralError(null);
    setSuccessMessage(null);

    if (tabMode === 'signin') {
      // --- SIGN IN FLOW ---
      setIdentifierTouched(true);
      setPasswordTouched(true);

      const cleanIdentifier = identifier.trim();
      if (!cleanIdentifier || !password || password.length < 6) {
        return;
      }

      setIsSubmitting(true);

      try {
        let targetEmail = cleanIdentifier.toLowerCase();

        // Resolve username to email if no '@' present
        if (!cleanIdentifier.includes('@')) {
          // 1. Try local cached mapping first
          const cachedEmail = typeof window !== 'undefined' ? localStorage.getItem(`cc_user_${cleanIdentifier.toLowerCase()}`) : null;
          if (cachedEmail) {
            targetEmail = cachedEmail;
          } else {
            let foundEmail: string | null = null;

            // 2. Try Supabase RPC resolve_login_email (high performance, secure, case-insensitive)
            try {
              const { data: rpcEmail, error: rpcErr } = await supabase.rpc('resolve_login_email', {
                identifier: cleanIdentifier,
              });
              if (!rpcErr && rpcEmail && typeof rpcEmail === 'string' && rpcEmail.includes('@')) {
                foundEmail = rpcEmail.trim().toLowerCase();
              }
            } catch (rpcEx) {
              console.debug('[Auth] RPC lookup skipped:', rpcEx);
            }

            // 3. Fallback: Query public.profiles directly by username
            if (!foundEmail) {
              try {
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('email')
                  .ilike('username', cleanIdentifier)
                  .maybeSingle();

                if (profileData?.email && profileData.email.includes('@')) {
                  foundEmail = profileData.email.trim().toLowerCase();
                }
              } catch (profileEx) {
                console.debug('[Auth] Direct profile lookup skipped:', profileEx);
              }
            }

            // 4. Fallback: Query public.profiles where email starts with username (e.g. dony -> dony@gmail.com)
            if (!foundEmail) {
              try {
                const { data: profileByPrefix } = await supabase
                  .from('profiles')
                  .select('email')
                  .ilike('email', `${cleanIdentifier}@%`)
                  .maybeSingle();

                if (profileByPrefix?.email && profileByPrefix.email.includes('@')) {
                  foundEmail = profileByPrefix.email.trim().toLowerCase();
                }
              } catch {}
            }

            if (foundEmail) {
              targetEmail = foundEmail;
            } else {
              // 5. Fallback for legacy username-only test accounts
              targetEmail = `${cleanIdentifier.toLowerCase()}@chordcraft.app`;
            }
          }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        if (error) {
          // Increment failed attempts
          const nextFailed = failedAttempts + 1;
          setFailedAttempts(nextFailed);
          if (nextFailed >= 5) {
            setLockoutTimer(60);
            throw new Error('Too many failed attempts. For security, please wait 60 seconds.');
          }
          // Generic security error so accounts cannot be probed
          throw new Error('Incorrect username or password. Please try again.');
        }

        // Cache resolution on success so subsequent logins on this device are instant
        if (typeof window !== 'undefined') {
          localStorage.setItem(`cc_user_${cleanIdentifier.toLowerCase()}`, targetEmail);
          if (targetEmail.includes('@')) {
            const prefix = targetEmail.split('@')[0].toLowerCase();
            localStorage.setItem(`cc_user_${prefix}`, targetEmail);
          }
          const effectiveUsername = !cleanIdentifier.includes('@') 
            ? cleanIdentifier 
            : (data?.user?.user_metadata?.username || cleanIdentifier.split('@')[0]);
          localStorage.setItem('chord-grid-username', effectiveUsername);
          if (data?.user?.id) {
            localStorage.setItem(`${data.user.id}_username`, effectiveUsername);
          }
        }

        // Reset failed attempts on success
        setFailedAttempts(0);
        router.push('/');
      } catch (err: any) {
        setGeneralError(err.message || 'Authentication failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // --- CREATE ACCOUNT FLOW ---
      setSignupUsernameTouched(true);
      setSignupEmailTouched(true);
      setPasswordTouched(true);

      const cleanUsername = signupUsername.trim().toLowerCase();
      const cleanEmail = signupEmail.trim().toLowerCase();

      if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.includes('@') || !/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return;
      }
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return;
      }
      if (!password || password.length < 6) {
        return;
      }

      setIsSubmitting(true);

      try {
        // Pre-check: Check if username is already taken in profiles
        try {
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id, username')
            .ilike('username', cleanUsername)
            .maybeSingle();

          if (existingUser) {
            setGeneralError(`Username "${cleanUsername}" is already taken. Please choose another username.`);
            setIsSubmitting(false);
            return;
          }
        } catch (checkErr) {
          console.debug('[Auth] Pre-check username error:', checkErr);
        }

        // Call Supabase signUp with email, password, and custom username metadata
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              username: cleanUsername,
              display_name: cleanUsername,
            },
          },
        });

        if (error) {
          if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already in use')) {
            throw new Error('This email address is already registered. Please sign in instead.');
          }
          throw error;
        }

        // Cache mapping locally so username login works immediately on this device
        if (typeof window !== 'undefined') {
          localStorage.setItem(`cc_user_${cleanUsername}`, cleanEmail);
          localStorage.setItem(`cc_user_${cleanEmail}`, cleanEmail);
          localStorage.setItem('chord-grid-username', cleanUsername);
        }

        if (data?.user) {
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: cleanEmail,
              username: cleanUsername,
              display_name: cleanUsername,
              role: 'instrument',
            });
            if (typeof window !== 'undefined') {
              localStorage.setItem(`${data.user.id}_username`, cleanUsername);
            }
          } catch (profileErr) {
            console.warn('[Auth] Note on profile upsert:', profileErr);
          }
        }

        if (data?.session) {
          router.push('/');
        } else {
          setSuccessMessage(`Account created for @${cleanUsername}! You can now sign in with your username or email.`);
          setIdentifier(cleanUsername);
          setTabMode('signin');
        }
      } catch (err: any) {
        setGeneralError(err.message || 'Failed to create account. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Forgot Password Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotEmailTouched(true);
    setGeneralError(null);
    setSuccessMessage(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth?mode=update-password` : undefined,
      });

      if (error) throw error;
      setSuccessMessage(`Password recovery link sent to ${cleanEmail}. Please check your inbox.`);
      setForgotEmail('');
      setForgotEmailTouched(false);
    } catch (err: any) {
      setGeneralError(err.message || 'Unable to send recovery email. Please check the address.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password Recovery Submit
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setGeneralError('New password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      setSuccessMessage('Password successfully updated! Redirecting to your library...');
      setTimeout(() => {
        router.push('/');
      }, 1200);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to update password. Please request a new recovery link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || (user && modalView !== 'recovery' && !appRedirectUrl)) return null;

  const identifierError = getIdentifierError();
  const signupUsernameError = getSignupUsernameError();
  const signupEmailError = getSignupEmailError();
  const passwordError = getPasswordError();
  const forgotError = getForgotEmailError();

  return (
    <main 
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#0F1015] text-[#FFFFFF] px-4 sm:px-6 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),28px)] font-sans select-none overflow-y-auto"
      style={{
        backgroundImage: 'radial-gradient(circle at 12% 8%, rgba(255, 90, 0, 0.22) 0%, rgba(43, 23, 16, 0.48) 32%, transparent 65%)'
      }}
    >
      {/* Centered Main Card */}
      <div className="w-full max-w-[440px] my-auto rounded-[32px] bg-[#17171C] border border-[#2C2C34] p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.65),0_1px_0_rgba(255,255,255,0.05)_inset] select-auto transition-all">
        {appRedirectUrl ? (
          <div className="flex flex-col items-center text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shadow-xl shadow-orange-500/10 mb-2">
              <Zap className="w-8 h-8 animate-pulse text-[#FF5A00]" />
            </div>
            <h2 className="text-2xl font-extrabold text-white">Signed In Successfully!</h2>
            <p className="text-sm text-[#8C8A93] max-w-xs">
              Opening the Chordly app on your device...
            </p>
            <a
              href={appRedirectUrl}
              className="w-full h-12 mt-2 rounded-2xl bg-gradient-to-r from-[#FF5A00] to-[#FF5C7A] text-white font-bold text-base shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer"
            >
              Open Chordly App
            </a>
            <button
              type="button"
              onClick={() => {
                setAppRedirectUrl(null);
                router.replace('/');
              }}
              className="text-xs text-[#8C8A93] hover:text-white underline pt-2 cursor-pointer"
            >
              Or continue in this browser
            </button>
          </div>
        ) : (
          <>
            {/* 1. App Logo, Title, Subtitle */}
            <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#231816] border border-[#3E2319] flex items-center justify-center shadow-lg shadow-[#FF5A00]/10 mb-4 transition-transform hover:scale-105">
            <img 
              src="/icon.png" 
              alt="Chordly Logo" 
              className="w-9 h-9 object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight mb-1">
            {tabMode === 'signin' ? 'Welcome back' : 'Create Account'}
          </h1>
          <p className="text-sm text-[#8C8A93]">
            {tabMode === 'signin' 
              ? 'Sign in to continue to your charts' 
              : 'Create an account to sync your charts across devices'}
          </p>
        </div>

        {/* 2. Segmented Toggle: Sign In | Create Account */}
        <div 
          role="tablist" 
          aria-label="Account sign in or creation"
          className="w-full h-[50px] bg-[#121216] border border-[#2C2C34] rounded-full p-1 flex items-center mb-6 relative"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tabMode === 'signin'}
            onClick={() => {
              setTabMode('signin');
              setGeneralError(null);
              setSuccessMessage(null);
              if (!identifier && signupUsername) {
                setIdentifier(signupUsername);
              } else if (!identifier && signupEmail) {
                setIdentifier(signupEmail);
              }
            }}
            className={`flex-1 h-full rounded-full text-sm font-bold transition-all cursor-pointer flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none ${
              tabMode === 'signin'
                ? 'bg-gradient-to-r from-[#FF5A00] to-[#FF5C7A] text-white shadow-[0_2px_10px_rgba(255,90,0,0.35)]'
                : 'text-[#8C8A93] hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tabMode === 'signup'}
            onClick={() => {
              setTabMode('signup');
              setGeneralError(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 h-full rounded-full text-sm font-bold transition-all cursor-pointer flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none ${
              tabMode === 'signup'
                ? 'bg-gradient-to-r from-[#FF5A00] to-[#FF5C7A] text-white shadow-[0_2px_10px_rgba(255,90,0,0.35)]'
                : 'text-[#8C8A93] hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Global Notifications */}
        {generalError && (
          <div 
            role="alert" 
            aria-live="polite"
            className="mb-5 p-3 rounded-2xl bg-[#FF5C7A]/10 border border-[#FF5C7A]/25 text-[#FF5C7A] text-xs font-medium flex items-start gap-2.5"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {successMessage && (
          <div 
            role="status" 
            aria-live="polite"
            className="mb-5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium flex items-start gap-2.5"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form ref={formRef} onSubmit={handleAuth} noValidate className="space-y-4">
          
          {tabMode === 'signin' ? (
            /* 3. Field: Username or email (Sign In) */
            <div>
              <label 
                htmlFor="auth-identifier" 
                className="block text-[11px] font-bold tracking-wider text-[#8C8A93] uppercase mb-2"
              >
                Username or email
              </label>
              <div 
                className={`relative flex items-center bg-[#121216] border rounded-2xl h-[52px] px-3.5 transition-all ${
                  identifierError 
                    ? 'border-[#FF5C7A] ring-1 ring-[#FF5C7A]/30' 
                    : 'border-[#33333C] focus-within:border-[#FF5A00] focus-within:ring-2 focus-within:ring-[#FF5A00]/25'
                }`}
              >
                <User size={18} className="text-[#8C8A93] shrink-0" aria-hidden="true" />
                <input
                  id="auth-identifier"
                  name="username"
                  type="text"
                  required
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. donythomas or email@gmail.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onBlur={() => setIdentifierTouched(true)}
                  className="w-full bg-transparent text-white placeholder-[#5E5C64] text-sm pl-2.5 pr-2 focus:outline-none"
                />
              </div>
              {identifierError && (
                <p className="text-xs text-[#FF5C7A] mt-1.5 flex items-center gap-1.5" role="alert">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{identifierError}</span>
                </p>
              )}
            </div>
          ) : (
            /* Fields for Create Account: Username + Email Address */
            <>
              {/* Field: Username */}
              <div>
                <label 
                  htmlFor="signup-username" 
                  className="block text-[11px] font-bold tracking-wider text-[#8C8A93] uppercase mb-2"
                >
                  Username
                </label>
                <div 
                  className={`relative flex items-center bg-[#121216] border rounded-2xl h-[52px] px-3.5 transition-all ${
                    signupUsernameError 
                      ? 'border-[#FF5C7A] ring-1 ring-[#FF5C7A]/30' 
                      : 'border-[#33333C] focus-within:border-[#FF5A00] focus-within:ring-2 focus-within:ring-[#FF5A00]/25'
                  }`}
                >
                  <User size={18} className="text-[#8C8A93] shrink-0" aria-hidden="true" />
                  <input
                    id="signup-username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="e.g. donythomas"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    onBlur={() => setSignupUsernameTouched(true)}
                    className="w-full bg-transparent text-white placeholder-[#5E5C64] text-sm pl-2.5 pr-2 focus:outline-none"
                  />
                </div>
                {signupUsernameError && (
                  <p className="text-xs text-[#FF5C7A] mt-1.5 flex items-center gap-1.5" role="alert">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{signupUsernameError}</span>
                  </p>
                )}
              </div>

              {/* Field: Email address */}
              <div>
                <label 
                  htmlFor="signup-email" 
                  className="block text-[11px] font-bold tracking-wider text-[#8C8A93] uppercase mb-2"
                >
                  Email address
                </label>
                <div 
                  className={`relative flex items-center bg-[#121216] border rounded-2xl h-[52px] px-3.5 transition-all ${
                    signupEmailError 
                      ? 'border-[#FF5C7A] ring-1 ring-[#FF5C7A]/30' 
                      : 'border-[#33333C] focus-within:border-[#FF5A00] focus-within:ring-2 focus-within:ring-[#FF5A00]/25'
                  }`}
                >
                  <Mail size={18} className="text-[#8C8A93] shrink-0" aria-hidden="true" />
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="e.g. donythomas@gmail.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    onBlur={() => setSignupEmailTouched(true)}
                    className="w-full bg-transparent text-white placeholder-[#5E5C64] text-sm pl-2.5 pr-2 focus:outline-none"
                  />
                </div>
                {signupEmailError && (
                  <p className="text-xs text-[#FF5C7A] mt-1.5 flex items-center gap-1.5" role="alert">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{signupEmailError}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {/* 4. Field: Password with show/hide eye icon */}
          <div>
            <label 
              htmlFor="auth-password" 
              className="block text-[11px] font-bold tracking-wider text-[#8C8A93] uppercase mb-2"
            >
              Password
            </label>
            <div 
              className={`relative flex items-center bg-[#121216] border rounded-2xl h-[52px] px-3.5 transition-all ${
                passwordError 
                  ? 'border-[#FF5C7A] ring-1 ring-[#FF5C7A]/30' 
                  : 'border-[#33333C] focus-within:border-[#FF5A00] focus-within:ring-2 focus-within:ring-[#FF5A00]/25'
              }`}
            >
              <Lock size={18} className="text-[#8C8A93] shrink-0" aria-hidden="true" />
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={tabMode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                className="w-full bg-transparent text-white placeholder-[#5E5C64] text-sm pl-2.5 pr-10 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 p-2 text-[#8C8A93] hover:text-white transition-colors cursor-pointer rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-xs text-[#FF5C7A] mt-1.5 flex items-center gap-1.5" role="alert">
                <AlertCircle size={13} className="shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}

            {/* 5. "Forgot password?" right-aligned directly under password */}
            {tabMode === 'signin' && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalView('forgot');
                    setGeneralError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs sm:text-sm font-semibold text-[#FF6A1F] hover:text-[#ff7f3d] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none rounded"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {/* 6. Primary Button: Sign In / Create Account */}
          <button
            type="submit"
            disabled={isSubmitting || lockoutTimer > 0}
            className="w-full h-[52px] rounded-full bg-gradient-to-r from-[#FF5A00] to-[#FF5C7A] text-white font-bold text-base shadow-[0_8px_24px_rgba(255,90,0,0.35)] hover:shadow-[0_10px_28px_rgba(255,90,0,0.45)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none mt-2"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : lockoutTimer > 0 ? (
              `Locked (${lockoutTimer}s)`
            ) : tabMode === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* 7. Divider: OR CONTINUE WITH */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-[#2C2C34]" />
          <span className="text-[10px] font-bold tracking-widest text-[#8C8A93] uppercase whitespace-nowrap">
            OR CONTINUE WITH
          </span>
          <div className="flex-1 h-px bg-[#2C2C34]" />
        </div>

        {/* 8. Continue with Google */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full h-[52px] rounded-full bg-[#1C1C22] hover:bg-[#23232A] border border-[#33333C] hover:border-[#444450] text-white font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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

          {/* Continue with Apple (Included for iOS / Safari / App Store compliance) */}
          {isApplePlatform && (
            <button
              type="button"
              onClick={handleAppleLogin}
              disabled={isSubmitting}
              className="w-full h-[52px] rounded-full bg-[#000000] hover:bg-[#111111] border border-[#33333C] hover:border-[#444450] text-white font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170" aria-hidden="true">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.7-11.64-13.98-5.74-8.8-10.36-18.73-13.88-29.77-3.52-11.04-5.28-21.73-5.28-32.06 0-14.34 3.75-26.39 11.24-36.16 7.49-9.77 17.07-14.75 28.74-14.95 4.36 0 9.27 1.13 14.75 3.39 5.48 2.26 9.17 3.45 11.07 3.59 2.24-.26 6.17-1.55 11.79-3.86 5.62-2.31 10.6-3.32 14.95-3.04 12.02.58 21.6 4.75 28.74 12.5-10.45 6.32-15.54 15.13-15.27 26.43.27 8.92 3.65 16.38 10.15 22.37 6.5 5.99 14.28 9.38 23.34 10.17-2.1 6.53-4.8 13.06-8.1 19.59zM119.22 31.84c0-7.39 2.68-14.22 8.04-20.48 5.36-6.26 11.96-10.27 19.8-12.04.53 1.05.8 2.18.8 3.39 0 7.39-2.73 14.27-8.19 20.64-5.46 6.37-12.23 10.32-20.31 11.85-.09-1.12-.14-2.24-.14-3.36z" />
              </svg>
              <span>Continue with Apple</span>
            </button>
          )}
        </div>

        {/* 9. Continue offline (Guest mode) */}
        <button
          type="button"
          onClick={handleGuestClick}
          className="w-full mt-5 py-2 flex flex-col items-center justify-center text-center cursor-pointer group rounded-xl hover:bg-white/[0.03] transition-colors focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none"
        >
          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white group-hover:text-[#FF6A1F] transition-colors">
            <Zap size={16} className="text-[#FF6A1F] fill-[#FF6A1F]" />
            <span>Continue offline (Guest mode)</span>
          </div>
          <span className="text-xs text-[#8C8A93] mt-1">
            Charts stay on this device. Sign in anytime to sync.
          </span>
        </button>
          </>
        )}
      </div>

      {/* 10. Footer: Terms & Privacy Policy */}
      <footer className="mt-6 text-center text-xs text-[#8C8A93] max-w-[440px] px-4">
        <span>By continuing you agree to our </span>
        <button
          type="button"
          onClick={() => setModalView('terms')}
          className="text-[#8C8A93] hover:text-[#FF6A1F] underline underline-offset-2 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none rounded"
        >
          Terms
        </button>
        <span> and </span>
        <button
          type="button"
          onClick={() => setModalView('privacy')}
          className="text-[#8C8A93] hover:text-[#FF6A1F] underline underline-offset-2 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:outline-none rounded"
        >
          Privacy Policy
        </button>
      </footer>

      {/* --- FORGOT PASSWORD MODAL --- */}
      {modalView === 'forgot' && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="forgot-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setModalView('none')}
        >
          <div 
            className="w-full max-w-sm rounded-[28px] bg-[#17171C] border border-[#2C2C34] p-6 sm:p-7 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalView('none')}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-2 text-[#8C8A93] hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            <h2 id="forgot-title" className="text-xl font-bold text-white mb-1.5 tracking-tight">
              Reset Password
            </h2>
            <p className="text-xs text-[#8C8A93] mb-5">
              Enter your registered email address and we will send you a password recovery link.
            </p>

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label 
                  htmlFor="forgot-email" 
                  className="block text-[11px] font-bold tracking-wider text-[#8C8A93] uppercase mb-2"
                >
                  Email Address
                </label>
                <div 
                  className={`relative flex items-center bg-[#121216] border rounded-2xl h-[52px] px-3.5 transition-all ${
                    forgotError 
                      ? 'border-[#FF5C7A]' 
                      : 'border-[#33333C] focus-within:border-[#FF5A00]'
                  }`}
                >
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    onBlur={() => setForgotEmailTouched(true)}
                    className="w-full bg-transparent text-white placeholder-[#5E5C64] text-sm focus:outline-none"
                  />
                </div>
                {forgotError && (
                  <p className="text-xs text-[#FF5C7A] mt-1.5 flex items-center gap-1.5">
                    <AlertCircle size={13} />
                    <span>{forgotError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[50px] rounded-full bg-gradient-to-r from-[#FF5A00] to-[#FF5C7A] text-white font-bold text-sm shadow-[0_4px_16px_rgba(255,90,0,0.35)] hover:brightness-105 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                {isSubmitting ? 'Sending Link...' : 'Send Recovery Link'}
              </button>

              <button
                type="button"
                onClick={() => setModalView('none')}
                className="w-full py-2 text-xs font-semibold text-[#8C8A93] hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- PASSWORD RECOVERY / SET NEW PASSWORD MODAL --- */}
      {modalView === 'recovery' && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="recovery-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-[28px] bg-[#17171C] border border-[#2C2C34] p-6 sm:p-7 shadow-2xl relative">
            <h2 id="recovery-title" className="text-xl font-bold text-white mb-1.5 tracking-tight">
              Set New Password
            </h2>
            <p className="text-xs text-[#8C8A93] mb-5">
              Please enter your new password to regain access to your charts.
            </p>

            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div>
                <label 
                  htmlFor="recovery-password" 
                  className="block text-[11px] font-bold tracking-wider text-[#8C8A93] uppercase mb-2"
                >
                  New Password
                </label>
                <div className="relative flex items-center bg-[#121216] border border-[#33333C] focus-within:border-[#FF5A00] rounded-2xl h-[52px] px-3.5 transition-all">
                  <input
                    id="recovery-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-transparent text-white placeholder-[#5E5C64] text-sm pr-10 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 p-2 text-[#8C8A93] hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[50px] rounded-full bg-gradient-to-r from-[#FF5A00] to-[#FF5C7A] text-white font-bold text-sm shadow-[0_4px_16px_rgba(255,90,0,0.35)] hover:brightness-105 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Update Password & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TERMS OF SERVICE MODAL --- */}
      {modalView === 'terms' && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="terms-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setModalView('none')}
        >
          <div 
            className="w-full max-w-lg rounded-[28px] bg-[#17171C] border border-[#2C2C34] p-6 sm:p-7 shadow-2xl relative max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C34] mb-4">
              <h2 id="terms-title" className="text-lg font-bold text-white tracking-tight">
                Terms of Service
              </h2>
              <button
                type="button"
                onClick={() => setModalView('none')}
                aria-label="Close dialog"
                className="p-1.5 text-[#8C8A93] hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="overflow-y-auto text-xs text-[#8C8A93] space-y-3.5 pr-2 leading-relaxed">
              <p>Welcome to <strong className="text-white">Chordly</strong>. By accessing or using our application, whether via web, mobile (APK/iOS), or desktop, you agree to comply with and be bound by these terms.</p>
              <h3 className="text-sm font-semibold text-white pt-1">1. User Account & Offline Local Data</h3>
              <p>You can use Chordly in offline Guest Mode without an account. All your musical charts and setlists are preserved locally on your device via IndexedDB. When signing in or syncing, your charts are protected by Supabase security policies.</p>
              <h3 className="text-sm font-semibold text-white pt-1">2. Music Notation & Content Ownership</h3>
              <p>You retain full ownership of any chord charts, song arrangements, lyrics, and rehearsal notes you create in Chordly. Chordly does not claim ownership of user-generated musical scores.</p>
              <h3 className="text-sm font-semibold text-white pt-1">3. Privacy and Service Quality</h3>
              <p>We do not sell your personal data. We strive to provide reliable offline-first editing and live stage synchronization tools for musicians and performers.</p>
            </div>

            <div className="pt-4 mt-4 border-t border-[#2C2C34] flex justify-end">
              <button
                type="button"
                onClick={() => setModalView('none')}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PRIVACY POLICY MODAL --- */}
      {modalView === 'privacy' && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="privacy-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setModalView('none')}
        >
          <div 
            className="w-full max-w-lg rounded-[28px] bg-[#17171C] border border-[#2C2C34] p-6 sm:p-7 shadow-2xl relative max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C34] mb-4">
              <h2 id="privacy-title" className="text-lg font-bold text-white tracking-tight">
                Privacy Policy
              </h2>
              <button
                type="button"
                onClick={() => setModalView('none')}
                aria-label="Close dialog"
                className="p-1.5 text-[#8C8A93] hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="overflow-y-auto text-xs text-[#8C8A93] space-y-3.5 pr-2 leading-relaxed">
              <p>At <strong className="text-white">Chordly</strong>, your privacy is our top priority. We believe musician tools should work reliably without intrusive tracking.</p>
              <h3 className="text-sm font-semibold text-white pt-1">1. Local-First Storage</h3>
              <p>In Guest Mode, your charts, songs, transpositions, and setlists never leave your device. All information is safely stored locally in your browser/device database.</p>
              <h3 className="text-sm font-semibold text-white pt-1">2. Cloud Sync & Security</h3>
              <p>When you create an account or sign in with Google/Apple, your data is synced using enterprise-grade encrypted connections. Row-level security guarantees only you have access to your personal repertoire.</p>
              <h3 className="text-sm font-semibold text-white pt-1">3. Third-Party Integrations</h3>
              <p>We only use trusted, privacy-respecting providers (Supabase Authentication and official OAuth SDKs) to manage sessions securely without storing passwords in plain text.</p>
            </div>

            <div className="pt-4 mt-4 border-t border-[#2C2C34] flex justify-end">
              <button
                type="button"
                onClick={() => setModalView('none')}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
