import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Brain, BarChart3, Languages, Volume2, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-[1.4fr_0.6fr] md:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            QueueGuidance
          </h1>
          <p className="mt-2 text-base text-muted-foreground md:text-lg">
            AI-powered queue detection, live monitoring, and analytics—built for real operations.
          </p>
        </div>
        <div className="flex gap-3 md:justify-end">
          <Link href="/setup">
            <Button data-testid="button-get-started" className="hover-elevate active-elevate-2">
              Setup
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" data-testid="button-view-dashboard" className="hover-elevate active-elevate-2">
              Queue Monitoring
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-white" />
            </div>
            <CardTitle>Upload & Process</CardTitle>
            <CardDescription>
              Upload queue videos and define custom zones using an intuitive polygon tool.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <CardTitle>AI Detection</CardTitle>
            <CardDescription>
              YOLO-powered detection feeds real-time counts, recommendations, and heatmaps.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-red-600 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <CardTitle>Real-time Monitoring</CardTitle>
            <CardDescription>
              WebSocket-driven dashboards with clean charts, latency-aware freshness, and alerts.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-4">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <CardTitle>Multi-Language</CardTitle>
            <CardDescription>
              Announcements and UI labels support multiple languages for on-site guidance.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
              <Volume2 className="w-6 h-6 text-white" />
            </div>
            <CardTitle>Audio Announcements</CardTitle>
            <CardDescription>
              Hands-free guidance on a schedule, aligned with your refresh and language settings.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <CardTitle>Operational Ready</CardTitle>
            <CardDescription>
              Designed for production: auth, role gating, and a scalable data layer.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>Three steps from video to live monitoring.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium">1. Setup</div>
            <div className="mt-1 text-sm text-muted-foreground">Upload a video or add a camera stream and draw queue zones.</div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium">2. Start detection</div>
            <div className="mt-1 text-sm text-muted-foreground">Run YOLO detection and publish snapshots in real time.</div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium">3. Monitor</div>
            <div className="mt-1 text-sm text-muted-foreground">Use Queue Monitoring + Analytics to optimize flow and staffing.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
