import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** false until the stored session has been read, so the router doesn't flash the sign-in screen. */
  ready: boolean;
};

export const useAuth = create<AuthState>(() => ({ session: null, ready: false }));

let started = false;

/** Reads the persisted session once and keeps the store in sync with Supabase auth events. */
export function startAuthListener() {
  if (started) return;
  started = true;
  void supabase.auth.getSession().then(({ data }) => {
    useAuth.setState({ session: data.session, ready: true });
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ session, ready: true });
  });
}

export const useUserId = () => useAuth((s) => s.session?.user.id ?? null);
