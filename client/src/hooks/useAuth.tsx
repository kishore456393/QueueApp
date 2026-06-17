import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, UseMutationResult } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoginInput, RegisterInput } from "@/schemas/auth";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

type AuthContextType = {
    user: User | null; // hydrated app user (role, username, etc.)
    session: Session | null;
    isLoading: boolean;
    error: Error | null;
    loginMutation: UseMutationResult<void, Error, LoginInput>;
    googleLoginMutation: UseMutationResult<void, Error, void>;
    logoutMutation: UseMutationResult<void, Error, void>;
    registerMutation: UseMutationResult<void, Error, RegisterInput>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        let isMounted = true;

        supabase.auth.getSession().then(({ data }) => {
            if (!isMounted) return;
            setSession(data.session ?? null);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession ?? null);
        });

        return () => {
            isMounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    const enabled = !!session?.access_token;
    const queryFn = useMemo(() => getQueryFn<User | null>({ on401: "returnNull" }), []);

    const {
        data: user,
        error,
        isLoading,
    } = useQuery<User | null, Error>({
        queryKey: ["/api/user"],
        queryFn,
        enabled,
        retry: false,
    });

    const loginMutation = useMutation({
        mutationFn: async (credentials: LoginInput) => {
            const emailOrUsername = credentials.username.trim();
            const email =
                emailOrUsername.includes("@") ? emailOrUsername : `${emailOrUsername}@queueguidance.local`;

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password: credentials.password,
            });
            if (error) throw new Error(error.message);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            toast({
                title: "Welcome back!",
                description: "You’re signed in.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Login failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const googleLoginMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/auth`,
                },
            });
            if (error) throw new Error(error.message);
        },
        onError: (error: Error) => {
            toast({
                title: "Google sign-in failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const registerMutation = useMutation({
        mutationFn: async (credentials: RegisterInput) => {
            const email = credentials.email.trim().toLowerCase();
            const { error } = await supabase.auth.signUp({
                email,
                password: credentials.password,
                options: {
                    data: {
                        username: credentials.username,
                        first_name: credentials.firstName ?? null,
                        last_name: credentials.lastName ?? null,
                    },
                },
            });
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast({
                title: "Account created",
                description: "Check your email to confirm, then sign in.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Registration failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const logoutMutation = useMutation({
        mutationFn: async () => {
            await supabase.auth.signOut();
        },
        onSuccess: () => {
            queryClient.clear();
            toast({
                title: "Signed out",
                description: "You have been successfully logged out.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Logout failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                session,
                isLoading,
                error,
                loginMutation,
                googleLoginMutation,
                logoutMutation,
                registerMutation,
            }
            }
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
