import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon } from "lucide-react";

import { type Settings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

const LANGUAGES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading, isError } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const [draft, setDraft] = useState<Partial<Settings>>({});

  useEffect(() => {
    if (settings) {
      setDraft({
        language: settings.language,
        audioEnabled: settings.audioEnabled,
        audioInterval: settings.audioInterval,
        refreshInterval: settings.refreshInterval,
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<Settings>) => {
      const response = await apiRequest("PUT", "/api/settings", newSettings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Saved", description: "Settings updated successfully." });
    },
    onError: (e: any) => {
      toast({ title: "Save failed", description: e?.message ?? "Try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" /> Settings
            </CardTitle>
            <CardDescription>Preferences for dashboard refresh and announcements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-10 w-72" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Could not load settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Please refresh the page.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> Settings
          </CardTitle>
          <CardDescription>Production preferences for refresh, language, and audio announcements.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label>Dashboard refresh interval (seconds)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={draft.refreshInterval ?? settings.refreshInterval}
              onChange={(e) => setDraft((d) => ({ ...d, refreshInterval: Number(e.target.value) }))}
              onBlur={() => updateSettingsMutation.mutate({ ...draft })}
              className="max-w-48"
            />
            <p className="text-xs text-muted-foreground">Controls how often the dashboard fetches new data.</p>
          </div>

          <div className="grid gap-2">
            <Label>Language</Label>
            <Select
              value={(draft.language as string) ?? settings.language}
              onValueChange={(value) => {
                const next = { ...draft, language: value };
                setDraft(next);
                updateSettingsMutation.mutate(next);
              }}
            >
              <SelectTrigger className="max-w-72">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <div className="font-medium">Audio announcements</div>
              <div className="text-sm text-muted-foreground">Automatically announce queue recommendations.</div>
            </div>
            <Switch
              checked={Boolean(draft.audioEnabled ?? settings.audioEnabled)}
              onCheckedChange={(checked) => {
                const next = { ...draft, audioEnabled: checked };
                setDraft(next);
                updateSettingsMutation.mutate(next);
              }}
            />
          </div>

          {Boolean(draft.audioEnabled ?? settings.audioEnabled) && (
            <div className="grid gap-2">
              <Label>Audio interval (seconds)</Label>
              <Input
                type="number"
                min={10}
                max={300}
                value={draft.audioInterval ?? settings.audioInterval}
                onChange={(e) => setDraft((d) => ({ ...d, audioInterval: Number(e.target.value) }))}
                onBlur={() => updateSettingsMutation.mutate({ ...draft })}
                className="max-w-48"
              />
              <p className="text-xs text-muted-foreground">How often to repeat announcements.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

