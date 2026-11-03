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
  signIn: (identifier: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string; requireEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  isDemoUser: boolean;
  loginAsDemoUser: (customUsername?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const LOCAL_FALLBACK_USER_KEY = 'dompetku-local-user';
const REMEMBER_ME_KEY = 'dompetku-remember-me';
const SESSION_ACTIVE_KEY = 'dompetku-session-active';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoUser, setIsDemoUser] = useState(false);
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

        // If "Remember Me" was disabled AND the tab/browser was closed:
        // invalidate session on startup
        if (rememberMeSetting === 'false' && sessionActive !== 'true') {
          if (isSupabaseConfigured) {
            await supabase.auth.signOut().catch(() => {});
          }
          localStorage.removeItem('dompetku-supabase-auth');
          localStorage.removeItem(LOCAL_FALLBACK_USER_KEY);
          setUser(null);
          setSession(null);
          setIsLoading(false);
          return;
        }

        if (isSupabaseConfigured) {
          // getSession() restores from localStorage (100% offline auto-login)
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            setSession(data.session);
            setUser(data.session.user);
            sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

            // Cache username locally if present in metadata
            const metaUsername = data.session.user.user_metadata?.username;
            if (metaUsername && data.session.user.email) {
              saveLocalUser(metaUsername, data.session.user.email, data.session.user.id).catch(() => {});
            }
          } else {
            // Check fallback local user
            const savedLocalUser = localStorage.getItem(LOCAL_FALLBACK_USER_KEY);
            if (savedLocalUser) {
              const parsed = JSON.parse(savedLocalUser);
              setUser(parsed);
              setIsDemoUser(true);
              sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
            }
          }
        } else {
          // If Supabase is unconfigured, check demo user
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

    // Listen to Supabase auth state changes
    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, currentSession) => {
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

  // Sign In with Email OR Username
  const signIn = async (identifier: string, password: string, rememberMe = true) => {
    // Online check
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

    // If identifier is NOT an email (no '@'), look up in local IndexedDB
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
        error:
          'Supabase belum dikonfigurasi di file .env. Silakan atur VITE_SUPABASE_URL atau gunakan tombol "Masuk Mode Demo Lokal".',
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

        // Handle Remember Me preference
        localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

        // Ensure username is mapped in IndexedDB for subsequent logins
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
        error:
          'Supabase belum dikonfigurasi di file .env. Harap atur VITE_SUPABASE_URL atau gunakan "Masuk Mode Demo Lokal".',
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

      // Save username & email mapping in IndexedDB
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
      localStorage.removeItem(LOCAL_FALLBACK_USER_KEY);
      localStorage.removeItem('dompetku-supabase-auth');
      localStorage.removeItem(REMEMBER_ME_KEY);
      sessionStorage.removeItem(SESSION_ACTIVE_KEY);
    }
  };

  // Demo user helper
  const loginAsDemoUser = (customUsername = 'demo_user') => {
    const demoUser = {
      id: 'demo-user-offline-id',
      email: 'demo@dompetku.app',
      user_metadata: { username: customUsername, name: 'Pengguna Demo' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User;

    setUser(demoUser);
    setIsDemoUser(true);
    localStorage.setItem(LOCAL_FALLBACK_USER_KEY, JSON.stringify(demoUser));
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
    saveLocalUser(customUsername, 'demo@dompetku.app', 'demo-user-offline-id').catch(() => {});
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
        signIn,
        signUp,
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
