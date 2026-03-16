import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';
import type { UserProfile } from './types';

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: boolean;
  /** ID owner apotek. Untuk kasir = pharmacy_owner_id; untuk owner = user.id. */
  effectiveUserId: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileError: false,
  effectiveUserId: null,
  refreshProfile: async () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  // Sequence counter to discard stale concurrent fetchProfile results
  const fetchSeqRef = useRef(0);

  const fetchProfile = async (userId: string) => {
    const seq = ++fetchSeqRef.current;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      // A newer fetch has superseded this one — discard result to avoid
      // a stale PGRST116 (profile not yet created) overwriting a valid profile
      if (seq !== fetchSeqRef.current) return;

      if (error) {
        if (error.code === 'PGRST116') {
          // Profil belum dibuat (user baru) — Login.tsx akan membuatnya
          setProfile(null);
          setProfileError(false);
        } else {
          // Error jaringan / server
          setProfileError(true);
        }
        return;
      }
      if (data) {
        setProfile(data as UserProfile);
        setProfileError(false);
        try { sessionStorage.setItem('medisir-profile', JSON.stringify(data)); } catch { /* ignore sessionStorage error in strict browsers */ }
      }
    } catch {
      if (seq !== fetchSeqRef.current) return;
      setProfileError(true);
    }
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || user?.id;
    if (currentUserId) {
      await fetchProfile(currentUserId);
    }
  };

  useEffect(() => {
    let initialized = false;

    let cachedProfile: UserProfile | null = null;
    try {
      const cached = sessionStorage.getItem('medisir-profile');
      if (cached) {
        cachedProfile = JSON.parse(cached);
      }
    } catch { /* ignore sessionStorage error in strict browsers */ }

    const safetyTimer = setTimeout(() => {
      if (!initialized) {
        console.warn('[MediSir] Auth timeout — memaksa loading=false');
        setLoading(false);
      }
    }, 10_000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      initialized = true;
      clearTimeout(safetyTimer);

      // Token refresh failure — session expired
      if (event === 'TOKEN_REFRESHED' && !session) {
        setUser(null);
        setProfile(null);
        try { sessionStorage.removeItem('medisir-profile'); } catch { /* ignore sessionStorage error in strict browsers */ }
        setLoading(false);
        return;
      }

      // Skip profile re-fetch on token refresh — user hasn't changed
      if (event === 'TOKEN_REFRESHED') return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        if (cachedProfile) {
          // Ada cache → tampilkan UI langsung, refresh profile di background
          setProfile(cachedProfile);
          setLoading(false);
          // Background refresh — detect role changes (kasir removed, etc.)
          fetchProfile(currentUser.id).then(() => {
            // Check if role or pharmacy link changed
            let freshProfile: UserProfile | null = null;
            try { freshProfile = JSON.parse(sessionStorage.getItem('medisir-profile') || 'null'); } catch { /* ignore sessionStorage error in strict browsers */ }
            if (freshProfile && cachedProfile &&
              (freshProfile.role !== cachedProfile.role ||
               freshProfile.pharmacy_owner_id !== cachedProfile.pharmacy_owner_id)) {
              // Role changed — force clean reload
              window.location.reload();
            }
          });
        } else {
          // Tidak ada cache → tunggu fetch selesai
          await Promise.race([
            fetchProfile(currentUser.id),
            new Promise<void>(resolve => setTimeout(resolve, 8_000)),
          ]);
          setLoading(false);
        }
      } else {
        setProfile(null);
        try { sessionStorage.removeItem('medisir-profile'); } catch { /* ignore sessionStorage error in strict browsers */ }
        setLoading(false);
        return;
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const effectiveUserId = profile?.pharmacy_owner_id ?? user?.id ?? null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, effectiveUserId, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
