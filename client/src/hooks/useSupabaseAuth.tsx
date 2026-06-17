import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { createClient, User, Session, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client only if environment variables are set
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

interface SupabaseAuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isConfigured: boolean;
    signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUpWithEmail: (email: string, password: string, metadata?: { first_name?: string; last_name?: string }) => Promise<{ error: Error | null }>;
    signInWithGoogle: () => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | null>(null);

interface SupabaseAuthProviderProps {
    children: ReactNode;
}

export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isConfigured = !!supabase;

    useEffect(() => {
        if (!supabase) {
            setIsLoading(false);
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            // Sync with local database if user exists
            if (session?.user) {
                syncUserWithBackend(session.user.email || '', session.user.id);
            }
            setIsLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                // Sync with local database on auth state change
                if (session?.user) {
                    await syncUserWithBackend(session.user.email || '', session.user.id);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const syncUserWithBackend = async (email: string, supabaseUserId: string) => {
        try {
            const response = await fetch('/api/auth/supabase-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, userId: supabaseUserId }),
            });
            if (!response.ok) {
                console.error('Failed to sync user with backend');
            }
        } catch (error) {
            console.error('Sync error:', error);
        }
    };


    const signInWithEmail = async (email: string, password: string) => {
        if (!supabase) {
            return { error: new Error('Supabase not configured') };
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error as Error | null };
    };

    const signUpWithEmail = async (
        email: string,
        password: string,
        metadata?: { first_name?: string; last_name?: string }
    ) => {
        if (!supabase) {
            return { error: new Error('Supabase not configured') };
        }
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
            },
        });
        return { error: error as Error | null };
    };

    const signInWithGoogle = async () => {
        if (!supabase) {
            return { error: new Error('Supabase not configured') };
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        return { error: error as Error | null };
    };

    const signOut = async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
    };

    const value: SupabaseAuthContextType = {
        user,
        session,
        isLoading,
        isConfigured,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
    };

    return (
        <SupabaseAuthContext.Provider value={value}>
            {children}
        </SupabaseAuthContext.Provider>
    );
}

export function useSupabaseAuth(): SupabaseAuthContextType {
    const context = useContext(SupabaseAuthContext);

    // If used outside provider, return a default non-authenticated state
    if (!context) {
        return {
            user: null,
            session: null,
            isLoading: false,
            isConfigured: !!supabase,
            signInWithEmail: async () => ({ error: new Error('SupabaseAuthProvider not found') }),
            signUpWithEmail: async () => ({ error: new Error('SupabaseAuthProvider not found') }),
            signInWithGoogle: async () => ({ error: new Error('SupabaseAuthProvider not found') }),
            signOut: async () => {},
        };
    }

    return context;
}