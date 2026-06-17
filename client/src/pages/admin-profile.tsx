import { useAuth } from "@/hooks/useAuth";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Mail, User, Calendar, Camera } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminProfile() {
    const { user: legacyUser } = useAuth();
    const { user: supabaseUser } = useSupabaseAuth();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);

    // Use either legacy user or Supabase user
    const user = legacyUser || (supabaseUser ? {
        id: 0,
        username: supabaseUser.email || 'user',
        email: supabaseUser.email,
        firstName: supabaseUser.user_metadata?.first_name,
        lastName: supabaseUser.user_metadata?.last_name,
        role: 'viewer' as const,
        password: '',
    } : null);

    if (!user) return null;

    const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || user.username[0].toUpperCase();

    const handleSave = () => {
        // In a real app, this would call a mutation to update the user
        toast({
            title: "Profile updated",
            description: "Your changes have been saved successfully.",
        });
        setIsEditing(false);
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column - Profile Card */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader className="text-center">
                        <div className="relative mx-auto mb-4">
                            <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                                <AvatarImage src="" />
                                <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <Button size="icon" variant="secondary" className="absolute bottom-0 right-0 rounded-full shadow-md">
                                <Camera className="w-4 h-4" />
                            </Button>
                        </div>
                        <CardTitle className="text-xl">{user.firstName} {user.lastName}</CardTitle>
                        <CardDescription>@{user.username}</CardDescription>
                        <div className="mt-4 flex justify-center">
                            <Badge variant="secondary" className="px-3 py-1 text-sm font-medium gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                {user.role === 'admin' ? 'Administrator' : 'Viewer'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 text-sm">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Mail className="w-4 h-4" />
                                <span>{user.email || 'No email set'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                <span>Joined {new Date().toLocaleDateString()}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column - Edit Form */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Personal Information</CardTitle>
                                <CardDescription>Update your personal details here.</CardDescription>
                            </div>
                            {!isEditing && (
                                <Button onClick={() => setIsEditing(true)} variant="outline">
                                    Edit Profile
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    defaultValue={user.firstName || ''}
                                    disabled={!isEditing}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    defaultValue={user.lastName || ''}
                                    disabled={!isEditing}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                defaultValue={user.email || ''}
                                disabled={!isEditing}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                defaultValue={user.username}
                                disabled={true} // Username usually shouldn't be changed easily
                                className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">Username cannot be changed.</p>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>Role</Label>
                            <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                <span className="font-medium capitalize">{user.role}</span>
                                <span className="text-muted-foreground text-sm ml-auto">
                                    {user.role === 'admin' ? 'Full Access' : 'Read Only'}
                                </span>
                            </div>
                        </div>

                        {isEditing && (
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button onClick={handleSave}>Save Changes</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
