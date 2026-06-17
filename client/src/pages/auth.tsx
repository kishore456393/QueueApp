import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginSchema, insertUserSchema, LoginInput, RegisterInput } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

const supabaseLoginSchema = z.object({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

const supabaseRegisterSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type SupabaseLoginInput = z.infer<typeof supabaseLoginSchema>;
type SupabaseRegisterInput = z.infer<typeof supabaseRegisterSchema>;

export default function AuthPage() {
    const { user: legacyUser, loginMutation, registerMutation } = useAuth();
    const {
        user: supabaseUser,
        isLoading: supabaseLoading,
        isConfigured: supabaseConfigured,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle
    } = useSupabaseAuth();

    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [authMode, setAuthMode] = useState<"supabase" | "legacy">("supabase");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [, setLocation] = useLocation();

    const isAuthenticated = legacyUser || supabaseUser;

    useEffect(() => {
        if (isAuthenticated) {
            setLocation("/");
        }
    }, [isAuthenticated, setLocation]);

    const legacyLoginForm = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        defaultValues: { username: "", password: "" },
    });

    const legacyRegisterForm = useForm<RegisterInput>({
        resolver: zodResolver(insertUserSchema),
        defaultValues: { firstName: "", lastName: "", email: "", username: "", password: "" },
    });

    const supabaseLoginForm = useForm<SupabaseLoginInput>({
        resolver: zodResolver(supabaseLoginSchema),
        defaultValues: { email: "", password: "" },
    });

    const supabaseRegisterForm = useForm<SupabaseRegisterInput>({
        resolver: zodResolver(supabaseRegisterSchema),
        defaultValues: { firstName: "", lastName: "", email: "", password: "" },
    });

    if (isAuthenticated) return null;

    const onLegacyLogin = (data: LoginInput) => loginMutation.mutate(data);
    const onLegacyRegister = (data: RegisterInput) => {
        registerMutation.mutate(data, {
            onSuccess: () => { setIsLogin(true); legacyRegisterForm.reset(); },
        });
    };

    const onSupabaseLogin = async (data: SupabaseLoginInput) => {
        setIsSubmitting(true);
        await signInWithEmail(data.email, data.password);
        setIsSubmitting(false);
    };

    const onSupabaseRegister = async (data: SupabaseRegisterInput) => {
        setIsSubmitting(true);
    const { error } = await signUpWithEmail(data.email, data.password, {
            first_name: data.firstName,
            last_name: data.lastName,
        });
        if (!error) { setIsLogin(true); supabaseRegisterForm.reset(); }
        setIsSubmitting(false);
    };

    const handleGoogleSignIn = async () => {
        setIsSubmitting(true);
        await signInWithGoogle();
        setIsSubmitting(false);
    };

    const isPending = loginMutation.isPending || registerMutation.isPending || isSubmitting || supabaseLoading;

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <Card className="shadow-xl border-border/50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                                <LogIn className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold">QueueGuidance</CardTitle>
                        <CardDescription>
                            {isLogin ? "Sign in to your account" : "Create a new account"}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Auth Mode Toggle */}
                        {supabaseConfigured && (
                            <div className="flex gap-2 bg-secondary p-1 rounded-lg border border-border">
                                <Button
                                    type="button"
                                    variant={authMode === "supabase" ? "default" : "ghost"}
                                    size="sm"
                                    className="flex-1 rounded-md h-9"
                                    onClick={() => setAuthMode("supabase")}
                                >
                                    Email
                                </Button>
                                <Button
                                    type="button"
                                    variant={authMode === "legacy" ? "default" : "ghost"}
                                    size="sm"
                                    className="flex-1 rounded-md h-9"
                                    onClick={() => setAuthMode("legacy")}
                                >
                                    Username
                                </Button>
                            </div>
                        )}

                        {/* Login Forms */}
                        {isLogin ? (
                            <div className="space-y-4">
                                {authMode === "legacy" && (
                                    <form onSubmit={legacyLoginForm.handleSubmit(onLegacyLogin)} className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Username or Email</label>
                                            <Input
                                                {...legacyLoginForm.register("username")}
                                                disabled={isPending}
                                                placeholder="Enter your username or email"
                                                className="h-10 rounded-lg"
                                            />
                                            {legacyLoginForm.formState.errors.username &&
                                                <p className="text-xs text-destructive mt-1">{legacyLoginForm.formState.errors.username.message}</p>
                                            }
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Password</label>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    {...legacyLoginForm.register("password")}
                                                    disabled={isPending}
                                                    placeholder="Enter your password"
                                                    className="h-10 rounded-lg pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {legacyLoginForm.formState.errors.password &&
                                                <p className="text-xs text-destructive mt-1">{legacyLoginForm.formState.errors.password.message}</p>
                                            }
                                        </div>

                                        {loginMutation.isError &&
                                            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
                                                {loginMutation.error?.message || "Invalid credentials"}
                                            </div>
                                        }

                                        <Button
                                            type="submit"
                                            className="w-full h-10 rounded-lg"
                                            disabled={isPending}
                                        >
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                                        </Button>
                                    </form>
                                )}

                                {authMode === "supabase" && supabaseConfigured && (
                                    <form onSubmit={supabaseLoginForm.handleSubmit(onSupabaseLogin)} className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Email</label>
                                            <Input
                                                type="email"
                                                {...supabaseLoginForm.register("email")}
                                                disabled={isPending}
                                                placeholder="Enter your email"
                                                className="h-10 rounded-lg"
                                            />
                                            {supabaseLoginForm.formState.errors.email &&
                                                <p className="text-xs text-destructive mt-1">{supabaseLoginForm.formState.errors.email.message}</p>
                                            }
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Password</label>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    {...supabaseLoginForm.register("password")}
                                                    disabled={isPending}
                                                    placeholder="Enter your password"
                                                    className="h-10 rounded-lg pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {supabaseLoginForm.formState.errors.password &&
                                                <p className="text-xs text-destructive mt-1">{supabaseLoginForm.formState.errors.password.message}</p>
                                            }
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-10 rounded-lg"
                                            disabled={isPending}
                                        >
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                                        </Button>
                                    </form>
                                )}

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                                    <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted-foreground">or continue with</span></div>
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-10 rounded-lg"
                                    onClick={handleGoogleSignIn}
                                    disabled={isPending}
                                >
                                    <FcGoogle className="w-4 h-4 mr-2" />
                                    Google
                                </Button>

                                <div className="text-center pt-2 border-t border-border">
                                    <p className="text-sm text-muted-foreground">Don't have an account?</p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="text-primary hover:text-primary text-sm mt-2 h-8 font-semibold"
                                        onClick={() => setIsLogin(false)}
                                    >
                                        Create one
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {authMode === "legacy" && (
                                    <form onSubmit={legacyRegisterForm.handleSubmit(onLegacyRegister)} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-sm font-medium mb-1 block">First Name</label>
                                                <Input
                                                    {...legacyRegisterForm.register("firstName")}
                                                    disabled={isPending}
                                                    placeholder="First"
                                                    className="h-10 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium mb-1 block">Last Name</label>
                                                <Input
                                                    {...legacyRegisterForm.register("lastName")}
                                                    disabled={isPending}
                                                    placeholder="Last"
                                                    className="h-10 rounded-lg text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Email</label>
                                            <Input
                                                type="email"
                                                {...legacyRegisterForm.register("email")}
                                                disabled={isPending}
                                                placeholder="Enter your email"
                                                className="h-10 rounded-lg"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Username</label>
                                            <Input
                                                {...legacyRegisterForm.register("username")}
                                                disabled={isPending}
                                                placeholder="Choose a username"
                                                className="h-10 rounded-lg"
                                            />
                                            {legacyRegisterForm.formState.errors.username &&
                                                <p className="text-xs text-destructive mt-1">{legacyRegisterForm.formState.errors.username.message}</p>
                                            }
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Password</label>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    {...legacyRegisterForm.register("password")}
                                                    disabled={isPending}
                                                    placeholder="Create a strong password"
                                                    className="h-10 rounded-lg pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {legacyRegisterForm.formState.errors.password &&
                                                <p className="text-xs text-destructive mt-1">{legacyRegisterForm.formState.errors.password.message}</p>
                                            }
                                        </div>

                                        {registerMutation.isError &&
                                            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
                                                {registerMutation.error?.message || "Registration failed"}
                                            </div>
                                        }

                                        <Button
                                            type="submit"
                                            className="w-full h-10 rounded-lg"
                                            disabled={isPending}
                                        >
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                                        </Button>
                                    </form>
                                )}

                                {authMode === "supabase" && supabaseConfigured && (
                                    <form onSubmit={supabaseRegisterForm.handleSubmit(onSupabaseRegister)} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-sm font-medium mb-1 block">First Name</label>
                                                <Input
                                                    {...supabaseRegisterForm.register("firstName")}
                                                    disabled={isPending}
                                                    placeholder="First"
                                                    className="h-10 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium mb-1 block">Last Name</label>
                                                <Input
                                                    {...supabaseRegisterForm.register("lastName")}
                                                    disabled={isPending}
                                                    placeholder="Last"
                                                    className="h-10 rounded-lg text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Email</label>
                                            <Input
                                                type="email"
                                                {...supabaseRegisterForm.register("email")}
                                                disabled={isPending}
                                                placeholder="Enter your email"
                                                className="h-10 rounded-lg"
                                            />
                                            {supabaseRegisterForm.formState.errors.email &&
                                                <p className="text-xs text-destructive mt-1">{supabaseRegisterForm.formState.errors.email.message}</p>
                                            }
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Password</label>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    {...supabaseRegisterForm.register("password")}
                                                    disabled={isPending}
                                                    placeholder="Create a strong password"
                                                    className="h-10 rounded-lg pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {supabaseRegisterForm.formState.errors.password &&
                                                <p className="text-xs text-destructive mt-1">{supabaseRegisterForm.formState.errors.password.message}</p>
                                            }
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-10 rounded-lg"
                                            disabled={isPending}
                                        >
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                                        </Button>
                                    </form>
                                )}

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                                    <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted-foreground">or</span></div>
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-10 rounded-lg"
                                    onClick={handleGoogleSignIn}
                                    disabled={isPending}
                                >
                                    <FcGoogle className="w-4 h-4 mr-2" />
                                    Google
                                </Button>

                                <div className="text-center pt-2 border-t border-border">
                                    <p className="text-sm text-muted-foreground">Already have an account?</p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="text-primary hover:text-primary text-sm mt-2 h-8 font-semibold"
                                        onClick={() => setIsLogin(true)}
                                    >
                                        Sign in
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
