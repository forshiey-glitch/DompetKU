import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { findEmailByUsername, saveLocalUser } from '../db';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userId: string;
  userEmail: string;
  username: string;
  isLoading: boolean;
  isOnline: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (identifier: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string; requireEmailConfirmation?: boolean }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (newUsername: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isDemoUser: boolean;
  loginAsDemoUser: (customUsername?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const LOCAL_FALLBACK_USER_KEY = 'uangku-local-user';
const REMEMBER_ME_KEY = 'uangku-remember-me';
const SESSION_ACTIVE_KEY = 'uangku-session-active';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash.includes('type=recovery');
    }
    return false;
  });
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize session on mount (with "Remember Me" validation & Auto-Login)
  useEffect(() => {
    async function initAuth() {
      try {
        const rememberMeSetting = localStorage.getItem(REMEMBER_ME_KEY);
        const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY);
        const isRecoveryUrl = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

        if (!isRecoveryUrl && rememberMeSetting === 'false' && sessionActive !== 'true') {
          if (isSupabaseConfigured) {
            await supabase.auth.signOut().catch(() => {});
          }
          localStorage.removeItem('uangku-supabase-auth');
          localStorage.removeItem(LOCAL_FALLBACK_USER_KEY);
          setUser(null);
          setSession(null);
          setIsLoading(false);
          return;
        }

        if (isSupabaseConfigured) {
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            setSession(data.session);
            setUser(data.session.user);
            sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

            const metaUsername = data.session.user.user_metadata?.username;
            if (metaUsername && data.session.user.email) {
              saveLocalUser(metaUsername, data.session.user.email, data.session.user.id).catch(() => {});
            }
          } else {
            const savedLocalUser = localStorage.getItem(LOCAL_FALLBACK_USER_KEY);
            if (savedLocalUser) {
              const parsed = JSON.parse(savedLocalUser);
              setUser(parsed);
              setIsDemoUser(true);
              sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
            }
          }
        } else {
          const savedLocalUser = localStorage.getItem(LOCAL_FALLBACK_USER_KEY);
          if (savedLocalUser) {
            const parsed = JSON.parse(savedLocalUser);
            setUser(parsed);
            setIsDemoUser(true);
            sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
          }
        }
      } catch (err) {
        console.warn('Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();

    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, currentSession) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
        setSession(currentSession);
        setUser(currentSession?.user || null);
        if (currentSession?.user) {
          setIsDemoUser(false);
          sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Sign In with Email OR Username
  const signIn = async (identifier: string, password: string, rememberMe = true) => {
    if (!navigator.onLine) {
      return {
        success: false,
        error: 'Proses ini memerlukan koneksi internet.',
      };
    }

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      return { success: false, error: 'Masukkan email atau username Anda.' };
    }

    let targetEmail = cleanIdentifier.toLowerCase();

    if (!cleanIdentifier.includes('@')) {
      const resolvedEmail = await findEmailByUsername(cleanIdentifier);
      if (!resolvedEmail) {
        return {
          success: false,
          error: `Username "${cleanIdentifier}" belum pernah didaftarkan di perangkat ini. Silakan masuk menggunakan alamat Email akun Anda.`,
        };
      }
      targetEmail = resolvedEmail.toLowerCase();
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Layanan autentikasi belum dikonfigurasi. Silakan gunakan tombol "Masuk sebagai Tamu".',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (error) {
        if (error.message?.toLowerCase().includes('fetch') || error.status === 0) {
          return {
            success: false,
            error: 'Proses ini memerlukan koneksi internet.',
          };
        }
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        setIsDemoUser(false);
        localStorage.removeItem(LOCAL_FALLBACK_USER_KEY);

        localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

        const metaUsername = data.user.user_metadata?.username;
        if (metaUsername) {
          await saveLocalUser(metaUsername, targetEmail, data.user.id);
        } else if (!cleanIdentifier.includes('@')) {
          await saveLocalUser(cleanIdentifier, targetEmail, data.user.id);
        }

        return { success: true };
      }

      return { success: false, error: 'Login gagal.' };
    } catch (err: any) {
      const isNet = err.message?.toLowerCase().includes('fetch') || !navigator.onLine;
      return {
        success: false,
        error: isNet ? 'Proses ini memerlukan koneksi internet.' : err.message || 'Terjadi kesalahan sistem.',
      };
    }
  };

  // Sign Up with Email, Password & Username
  const signUp = async (email: string, password: string, username: string) => {
    if (!navigator.onLine) {
      return {
        success: false,
        error: 'Proses ini memerlukan koneksi internet.',
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Layanan autentikasi belum dikonfigurasi. Silakan gunakan tombol "Masuk sebagai Tamu".',
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            name: cleanUsername,
          },
        },
      });

      if (error) {
        if (error.message?.toLowerCase().includes('fetch') || error.status === 0) {
          return {
            success: false,
            error: 'Proses ini memerlukan koneksi internet.',
          };
        }
        return { success: false, error: error.message };
      }

      await saveLocalUser(cleanUsername, cleanEmail, data.user?.id);

      if (data.user) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

        if (data.session) {
          setUser(data.user);
          setSession(data.session);
          setIsDemoUser(false);
          return { success: true };
        }

        return {
          success: true,
          requireEmailConfirmation: true,
        };
      }

      return { success: false, error: 'Pendaftaran gagal.' };
    } catch (err: any) {
      const isNet = err.message?.toLowerCase().includes('fetch') || !navigator.onLine;
      return {
        success: false,
        error: isNet ? 'Proses ini memerlukan koneksi internet.' : err.message || 'Terjadi kesalahan sistem.',
      };
    }
  };

  // Forgot Password: Request reset email
  const requestPasswordReset = async (email: string) => {
    if (!navigator.onLine) {
      return { success: false, error: 'Proses ini memerlukan koneksi internet.' };
    }
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Layanan reset password belum dikonfigurasi.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Masukkan alamat email yang valid.' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mengirim tautan reset password.' };
    }
  };

  // Reset Password: Set new password after recovery
  const updatePassword = async (newPassword: string) => {
    if (!navigator.onLine) {
      return { success: false, error: 'Proses ini memerlukan koneksi internet.' };
    }
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Layanan autentikasi belum dikonfigurasi.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Kata sandi baru minimal 6 karakter.' };
    }

    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }
      if (data.user) {
        setUser(data.user);
      }
      clearPasswordRecovery();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal memperbarui kata sandi.' };
    }
  };

  // Edit Profile: Update username
  const updateProfile = async (newUsername: string) => {
    const cleanUsername = newUsername.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return {
        success: false,
        error: 'Nama pengguna harus 3-20 karakter (huruf, angka, atau underscore).',
      };
    }

    try {
      if (!isDemoUser && isSupabaseConfigured) {
        if (!navigator.onLine) {
          return { success: false, error: 'Mengubah profil akun memerlukan koneksi internet.' };
        }
        const { data, error } = await supabase.auth.updateUser({
          data: {
            username: cleanUsername,
            name: cleanUsername,
          },
        });
        if (error) {
          return { success: false, error: error.message };
        }
        if (data.user) {
          setUser(data.user);
        }
      } else if (user) {
        const updatedDemoUser = {
          ...user,
          user_metadata: {
            ...(user.user_metadata || {}),
            username: cleanUsername,
            name: cleanUsername,
          },
        } as User;
        setUser(updatedDemoUser);
        localStorage.setItem(LOCAL_FALLBACK_USER_KEY, JSON.stringify(updatedDemoUser));
      }

      if (user?.email) {
        await saveLocalUser(cleanUsername, user.email, user.id);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal memperbarui profil.' };
    }
  };

  // Sign Out
  const signOut = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut().catch(() => {});
      }
    } finally {
      setUser(null);
      setSession(null);
      setIsDemoUser(false);
      clearPasswordRecovery();
      localStorage.removeItem(LOCAL_FALLBACK_USER_KEY);
      localStorage.removeItem('uangku-supabase-auth');
      localStorage.removeItem(REMEMBER_ME_KEY);
      sessionStorage.removeItem(SESSION_ACTIVE_KEY);
    }
  };

  // Guest mode helper
  const loginAsDemoUser = (customUsername = 'tamu') => {
    const demoUser = {
      id: 'uangku-guest-id',
      email: 'tamu@uangku.app',
      user_metadata: { username: customUsername, name: 'Pengguna Tamu' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User;

    setUser(demoUser);
    setIsDemoUser(true);
    localStorage.setItem(LOCAL_FALLBACK_USER_KEY, JSON.stringify(demoUser));
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
    saveLocalUser(customUsername, 'tamu@uangku.app', 'uangku-guest-id').catch(() => {});
  };

  const userId = user?.id || 'guest';
  const userEmail = user?.email || 'Tamu';
  const username = user?.user_metadata?.username || userEmail.split('@')[0] || 'pengguna';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userId,
        userEmail,
        username,
        isLoading,
        isOnline,
        isPasswordRecovery,
        clearPasswordRecovery,
        signIn,
        signUp,
        requestPasswordReset,
        updatePassword,
        updateProfile,
        signOut,
        isDemoUser,
        loginAsDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
