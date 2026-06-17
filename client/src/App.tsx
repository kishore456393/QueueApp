import { Switch, Route, Link, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Home as HomeIcon, Video, BarChart3, Activity, LogOut, User } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Loader2 } from "lucide-react";
import { Titlebar } from "@/components/titlebar";

import HomePage from "@/pages/home";
import Setup from "@/pages/setup";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import AuthPage from "@/pages/auth";
import NotFound from "@/pages/not-found";
import MobileDashboard from "@/pages/mobile-dashboard";
import TvDashboard from "@/pages/tv-dashboard";
import AdminProfile from "@/pages/admin-profile";

// Combined auth hook that checks both legacy and Supabase auth
function useCombinedAuth() {
  const legacyAuth = useAuth();
  const supabaseAuth = useSupabaseAuth();

  // User is authenticated if either method succeeds
  const user = legacyAuth.user || (supabaseAuth.user ? {
    id: 0,
    username: supabaseAuth.user.email || 'user',
    email: supabaseAuth.user.email,
    firstName: supabaseAuth.user.user_metadata?.first_name,
    lastName: supabaseAuth.user.user_metadata?.last_name,
    role: 'admin' as const, // Supabase users get admin by default
    password: '',
  } : null);

  const isLoading = legacyAuth.isLoading || supabaseAuth.isLoading;

  const logout = async () => {
    // Clear all React Query caches before logout
    await queryClient.invalidateQueries();
    queryClient.clear();

    if (supabaseAuth.user) {
      await supabaseAuth.signOut();
    }
    if (legacyAuth.user) {
      legacyAuth.logoutMutation.mutate();
    }
  };

  return {
    user,
    isLoading,
    logout,
    logoutMutation: legacyAuth.logoutMutation,
    isSupabaseUser: !!supabaseAuth.user,
    isLegacyUser: !!legacyAuth.user,
  };
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoading } = useCombinedAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (adminOnly && user.role !== "admin") {
    return <div className="flex items-center justify-center min-h-screen">Access Denied</div>;
  }

  return <Component />;
}

function Router() {
  const [isMobileLive] = useRoute("/mobile-live");
  const { user, logout, logoutMutation, isSupabaseUser } = useCombinedAuth();

  // Mobile-only view without header/footer
  if (isMobileLive) {
    return (
      <div className="min-h-screen bg-background">
        <ProtectedRoute component={MobileDashboard} />
      </div>
    );
  }

  // Desktop view with full navigation
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <Link href="/">
              <h1 className="text-xl font-bold gradient-text cursor-pointer transition-opacity hover:opacity-80">
                QueueGuidance
              </h1>
            </Link>
            <nav className="flex gap-1 items-center">
              <ThemeToggle />
              {user && (
                <>
                  <div className="hidden md:flex items-center gap-1 ml-2">
                    <Link href="/">
                      <Button variant="ghost" size="sm" data-testid="link-home" className="h-9 px-3 text-sm font-medium">
                        <HomeIcon className="w-4 h-4 mr-2" />
                        Home
                      </Button>
                    </Link>
                    {user.role === "admin" && (
                      <Link href="/setup">
                        <Button variant="ghost" size="sm" data-testid="link-setup" className="h-9 px-3 text-sm font-medium">
                          <Video className="w-4 h-4 mr-2" />
                          Setup
                        </Button>
                      </Link>
                    )}
                    <Link href="/dashboard">
                      <Button variant="ghost" size="sm" data-testid="link-dashboard" className="h-9 px-3 text-sm font-medium">
                        <Activity className="w-4 h-4 mr-2" />
                        Dashboard
                      </Button>
                    </Link>
                    <Link href="/analytics">
                      <Button variant="ghost" size="sm" data-testid="link-analytics" className="h-9 px-3 text-sm font-medium">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Analytics
                      </Button>
                    </Link>
                  </div>
                  <div className="h-6 w-px bg-border mx-2 hidden md:block" />
                  <Link href="/admin/profile">
                    <Button variant="ghost" size="sm" className="h-9 px-3">
                      <User className="w-4 h-4" />
                      <span className="hidden md:inline ml-2">Profile</span>
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isSupabaseUser) {
                        logout();
                      } else {
                        logoutMutation.mutate();
                      }
                    }}
                    disabled={logoutMutation.isPending}
                    className="h-9 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden md:inline ml-2">Logout</span>
                  </Button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-background overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Switch>
            <Route path="/auth" component={AuthPage} />
            <Route path="/">
              {() => <ProtectedRoute component={HomePage} />}
            </Route>
            <Route path="/setup">
              {() => <ProtectedRoute component={Setup} />}
            </Route>
            <Route path="/dashboard">
              {() => <ProtectedRoute component={Dashboard} />}
            </Route>
            <Route path="/analytics">
              {() => <ProtectedRoute component={Analytics} />}
            </Route>
            <Route path="/tv-dashboard">
              {() => <ProtectedRoute component={TvDashboard} />}
            </Route>
            <Route path="/admin/profile">
              {() => <ProtectedRoute component={AdminProfile} />}
            </Route>
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>

      <footer className="border-t border-border/50 bg-card/50 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground">
              © 2025 QueueGuidance. AI-Powered Queue Management
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Real-time Analytics
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Multi-language
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                WebSocket
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
  return (
    <ThemeProvider defaultTheme="system" storageKey="queueguidance-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SupabaseAuthProvider>
            <TooltipProvider>
              <Toaster />
              {isElectron ? (
                <div className="flex flex-col h-screen overflow-hidden">
                  <Titlebar />
                  <div className="flex-1 overflow-auto">
                    <Router />
                  </div>
                </div>
              ) : (
                <Router />
              )}
            </TooltipProvider>
          </SupabaseAuthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
