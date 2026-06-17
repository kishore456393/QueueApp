import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type DetectionSnapshot, type Video } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, ZAxis, ReferenceLine } from "recharts";
import { TrendingUp, Users, Clock, Activity, Download, ArrowDownRight, ArrowUpRight, Zap, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function HeatmapChart({ videoId }: { videoId?: string }) {
  const { data: heatmapData } = useQuery<Array<{ x: number, y: number, value: number }>>({
    queryKey: ['/api/analytics/heatmap', videoId],
    enabled: !!videoId,
  });

  if (!videoId) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">Select a camera to view heatmap</div>;
  if (!heatmapData || heatmapData.length === 0) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No heatmap data available</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" dataKey="x" name="X" hide />
        <YAxis type="number" dataKey="y" name="Y" hide reversed />
        <ZAxis type="number" dataKey="value" range={[50, 400]} name="Density" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-card border border-border p-2 rounded shadow-sm">
                  <p className="text-sm font-medium">Density: {payload[0].value}</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Scatter name="Traffic" data={heatmapData} fill="#ef4444" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function ForecastChart({ snapshots, serviceRate, currentTime }: { snapshots?: DetectionSnapshot[], serviceRate: number, currentTime: Date }) {
  const forecastData = useMemo(() => {
    if (!snapshots || snapshots.length < 5) return [];

    // Use last 30 snapshots (approx 1 hour if 2s interval, but usually intervals are longer)
    // We want enough data points to establish a trend
    const recentData = snapshots.slice(0, 30).reverse();

    // Simple Linear Regression (Least Squares)
    // x = index (time), y = totalPeople
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = recentData.length;

    recentData.forEach((d, i) => {
      sumX += i;
      sumY += d.totalPeople;
      sumXY += i * d.totalPeople;
      sumXX += i * i;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast for next 6 intervals (e.g., next 15-30 mins)
    // Anchor to CURRENT TIME so the chart always shows "Now" -> "Future"
    const startTime = currentTime.getTime();
    const avgInterval = (new Date(recentData[n - 1].timestamp).getTime() - new Date(recentData[0].timestamp).getTime()) / (n - 1);

    const forecast = [];

    // Add current projected point
    // We project the current value based on the trend
    const currentProjected = slope * (n - 1) + intercept;

    forecast.push({
      time: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actual: recentData[n - 1].totalPeople, // Show last actual for reference
      predicted: Math.max(0, Math.round(currentProjected)),
      range: [Math.max(0, Math.round(currentProjected)), Math.max(0, Math.round(currentProjected))]
    });

    for (let i = 1; i <= 10; i++) {
      const nextTime = new Date(startTime + i * avgInterval);
      // Predicted value y = mx + b
      // x for prediction starts at n (next index)
      let predictedCount = slope * (n - 1 + i) + intercept;
      predictedCount = Math.max(0, Math.round(predictedCount)); // Cannot have negative people

      // Add some uncertainty range expanding over time
      const uncertainty = Math.ceil(i * 0.5);

      forecast.push({
        time: nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        predicted: predictedCount,
        range: [Math.max(0, predictedCount - uncertainty), predictedCount + uncertainty],
        trend: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable'
      });
    }

    return forecast;
  }, [snapshots, currentTime]);

  if (!snapshots || snapshots.length < 5) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">Insufficient data for forecast</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={forecastData}>
        <defs>
          <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="time" stroke="hsl(var(--foreground))" fontSize={12} />
        <YAxis stroke="hsl(var(--foreground))" fontSize={12} label={{ value: 'People', angle: -90, position: 'insideLeft' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Area
          type="monotone"
          dataKey="range"
          stroke="none"
          fill="#8b5cf6"
          fillOpacity={0.1}
          name="Confidence Range"
        />
        <Area
          type="monotone"
          dataKey="predicted"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#colorPredicted)"
          name="Predicted Count"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function QueueEfficiencyChart({ snapshots }: { snapshots?: DetectionSnapshot[] }) {
  const efficiencyData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    // Calculate average occupancy per queue
    const queueStats = new Map<number, { total: number, count: number }>();

    snapshots.forEach(s => {
      s.queueCounts.forEach((count, idx) => {
        const queueNum = idx + 1;
        const current = queueStats.get(queueNum) || { total: 0, count: 0 };
        queueStats.set(queueNum, {
          total: current.total + count,
          count: current.count + 1
        });
      });
    });

    return Array.from(queueStats.entries())
      .map(([queue, stats]) => ({
        queue: `Queue ${queue}`,
        avgOccupancy: parseFloat((stats.total / stats.count).toFixed(1))
      }))
      .sort((a, b) => a.queue.localeCompare(b.queue));
  }, [snapshots]);

  if (!snapshots || snapshots.length === 0) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={efficiencyData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" stroke="hsl(var(--foreground))" fontSize={12} />
        <YAxis dataKey="queue" type="category" stroke="hsl(var(--foreground))" fontSize={12} width={80} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Bar dataKey="avgOccupancy" fill="#10b981" radius={[0, 4, 4, 0]} name="Avg People" barSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Analytics() {
  const [manualServiceRate, setManualServiceRate] = useState(2); // Minutes per person (Manual)
  const [useSmartWaitTime, setUseSmartWaitTime] = useState(true);
  const [slaTargetMinutes, setSlaTargetMinutes] = useState(5);
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(undefined);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const { data: videos } = useQuery<Video[]>({
    queryKey: ['/api/videos'],
  });

  // Live clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check for active detection on mount
  useEffect(() => {
    const checkActiveDetection = async () => {
      try {
        const res = await apiRequest('GET', '/api/detection/status');
        const status = await res.json();
        if (status.running && status.activeVideoId) {
          setSelectedVideoId(status.activeVideoId);
        }
      } catch (e) {
        console.error("Failed to check detection status", e);
      }
    };
    checkActiveDetection();
  }, []);

  const selectedVideo = videos?.find(v => v.id === selectedVideoId);

  const { data: snapshots } = useQuery<DetectionSnapshot[]>({
    queryKey: ['/api/detection-snapshots', selectedVideoId],
    enabled: !!selectedVideoId,
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws: WebSocket | null = null;

    const connectWebSocket = async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'detection_update') {
          // Invalidate query to refetch data if it's for the selected video
          if (!selectedVideoId || message.data?.videoId === selectedVideoId) {
            queryClient.invalidateQueries({ queryKey: ['/api/detection-snapshots', selectedVideoId] });
            queryClient.invalidateQueries({ queryKey: ['/api/analytics/heatmap', selectedVideoId] });
            setLastUpdated(new Date());
          }
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
      };
    };

    connectWebSocket();

    return () => { if (ws) ws.close(); };
  }, [selectedVideoId]);

  // Calculate Throughput (People per Hour estimated)
  const throughput = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return 0;

    // Sort chronologically
    const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let processedCount = 0;
    let startTime = new Date(sorted[0].timestamp).getTime();
    let endTime = new Date(sorted[sorted.length - 1].timestamp).getTime();

    // Look at last hour only if possible
    const oneHourMs = 60 * 60 * 1000;
    if (endTime - startTime > oneHourMs) {
      startTime = endTime - oneHourMs;
    }

    const relevantSnapshots = sorted.filter(s => new Date(s.timestamp).getTime() >= startTime);

    for (let i = 1; i < relevantSnapshots.length; i++) {
      const prev = relevantSnapshots[i - 1];
      const curr = relevantSnapshots[i];

      // If total people decreased, assume they were served
      // This is a lower-bound estimate as it ignores arrivals
      if (curr.totalPeople < prev.totalPeople) {
        processedCount += (prev.totalPeople - curr.totalPeople);
      }
    }

    const durationHours = Math.max(0.1, (endTime - startTime) / oneHourMs);
    return Math.round(processedCount / durationHours);
  }, [snapshots]);

  // Dynamic Service Rate Calculation (Smart Wait Time)
  const dynamicServiceRate = useMemo(() => {
    if (throughput > 0) {
      // If throughput is 60 people/hour, service rate is 1 min/person
      return 60 / throughput;
    }
    return manualServiceRate; // Fallback
  }, [throughput, manualServiceRate]);

  const activeServiceRate = useSmartWaitTime && throughput > 0 ? dynamicServiceRate : manualServiceRate;

  const chartData = snapshots?.slice(0, 50).reverse().map((snapshot) => {
    const time = new Date(snapshot.timestamp);
    const waitTime = snapshot.totalPeople * activeServiceRate;
    return {
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: snapshot.totalPeople,
      waitTime,
      ...snapshot.queueCounts.reduce((acc, count, i) => ({
        ...acc,
        [`Queue ${i + 1}`]: count,
        [`Queue ${i + 1} Wait`]: count * activeServiceRate
      }), {})
    };
  }) || [];

  // Calculate Busy Hours
  const busyHoursData = useMemo(() => {
    if (!snapshots) return [];

    const hoursMap = new Map<number, { total: number; count: number }>();

    snapshots.forEach(s => {
      const hour = new Date(s.timestamp).getHours();
      const current = hoursMap.get(hour) || { total: 0, count: 0 };
      hoursMap.set(hour, {
        total: current.total + s.totalPeople,
        count: current.count + 1
      });
    });

    return Array.from(hoursMap.entries())
      .map(([hour, data]) => ({
        hour: `${hour}:00`,
        avgPeople: Math.round(data.total / data.count)
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [snapshots]);

  // SLA Compliance Rate Calculation (Estimated wait time <= SLA Target)
  const slaComplianceRate = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return 100;
    const compliantCount = snapshots.filter(s => {
      const waitTime = s.totalPeople * activeServiceRate;
      return waitTime <= slaTargetMinutes;
    }).length;
    return Math.round((compliantCount / snapshots.length) * 100);
  }, [snapshots, activeServiceRate, slaTargetMinutes]);

  // Queue Imbalance Index Calculation
  const queueImbalanceStats = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return { score: 0, label: "Balanced", color: "text-emerald-500" };
    
    let totalDifference = 0;
    let validCount = 0;

    snapshots.forEach(s => {
      if (s.queueCounts && s.queueCounts.length > 1) {
        const max = Math.max(...s.queueCounts);
        const min = Math.min(...s.queueCounts);
        totalDifference += (max - min);
        validCount++;
      }
    });

    const avgDiff = validCount > 0 ? parseFloat((totalDifference / validCount).toFixed(1)) : 0;
    
    let label = "Balanced";
    let color = "text-emerald-500";
    if (avgDiff > 3.0) {
      label = "Imbalanced";
      color = "text-destructive";
    } else if (avgDiff > 1.5) {
      label = "Moderate";
      color = "text-orange-500";
    }

    return { score: avgDiff, label, color };
  }, [snapshots]);

  // Dynamic Operational AI Recommendations
  const operationalRecommendations = useMemo(() => {
    const recs: string[] = [];
    if (!snapshots || snapshots.length === 0) {
      return ["Start camera detection to generate operational insights."];
    }

    // 1. Staffing / Peak Hour suggestion
    if (busyHoursData.length > 0) {
      const sortedHours = [...busyHoursData].sort((a, b) => b.avgPeople - a.avgPeople);
      const peakHour = sortedHours[0];
      if (peakHour && peakHour.avgPeople > 3) {
        recs.push(`Peak traffic occurs around ${peakHour.hour} (average ${peakHour.avgPeople} people). We recommend scheduling an additional operator or staff member during this block to prevent customer bottleneck.`);
      }
    }

    // 2. Queue imbalance suggestion
    if (queueImbalanceStats.score > 1.5) {
      recs.push(`Queue load is uneven (average discrepancy of ${queueImbalanceStats.score} people between lanes). Consider adding a queue manager to guide guests, or setting up a single snake-line queue system to ensure fairness.`);
    } else {
      recs.push("Queue lines are currently well-balanced. Ensure signage remains clear to maintain this distribution.");
    }

    // 3. SLA Breach suggestion
    if (slaComplianceRate < 90) {
      recs.push(`Your SLA compliance is at ${slaComplianceRate}%, which is below the standard target of 90%. We suggest reducing transaction processing times or opening more counters to meet your SLA speed targets.`);
    } else {
      recs.push(`Excellent! Your SLA compliance is at ${slaComplianceRate}%. Your current staffing levels are meeting target wait times.`);
    }

    return recs;
  }, [snapshots, busyHoursData, queueImbalanceStats, slaComplianceRate]);

  // Real-time Alerts / Exception Log Feed
  const alertsFeed = useMemo(() => {
    const alerts: Array<{ id: string; time: string; message: string; type: "critical" | "warning" }> = [];
    if (!snapshots) return [];

    snapshots.slice(0, 30).forEach(s => {
      const timeStr = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const waitTime = s.totalPeople * activeServiceRate;

      if (waitTime > slaTargetMinutes) {
        alerts.push({
          id: `${s.id}-sla`,
          time: timeStr,
          message: `SLA Target breached: estimated wait time reached ~${Math.round(waitTime)} mins (Target: ${slaTargetMinutes} mins).`,
          type: "critical"
        });
      }

      s.queueCounts.forEach((count, idx) => {
        if (count > 5) {
          alerts.push({
            id: `${s.id}-q-${idx}`,
            time: timeStr,
            message: `Queue ${idx + 1} is overcrowded with ${count} people waiting.`,
            type: "warning"
          });
        }
      });
    });

    return alerts.slice(0, 8); // Display the 8 most recent alerts
  }, [snapshots, activeServiceRate, slaTargetMinutes]);

  const avgPeople = snapshots?.length
    ? Math.round(snapshots.reduce((sum, s) => sum + s.totalPeople, 0) / snapshots.length)
    : 0;

  const peakPeople = snapshots?.length
    ? Math.max(...snapshots.map(s => s.totalPeople))
    : 0;

  const totalSnapshots = snapshots?.length || 0;

  const currentWaitTime = snapshots?.[0]
    ? Math.round(snapshots[0].totalPeople * activeServiceRate)
    : 0;

  const { toast } = useToast();

  const handleExport = async () => {
    if (!selectedVideoId) return;

    try {
      const response = await fetch(`/api/analytics/export/${selectedVideoId}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${selectedVideoId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Analytics report has been downloaded.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Could not download the analytics report.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Analytics</h1>
            <Badge variant={wsConnected ? "default" : "destructive"} className="animate-pulse">
              {wsConnected ? "Live" : "Offline"}
            </Badge>
            <div className="flex flex-col ml-4 border-l pl-4">
              <span className="text-xl font-mono font-bold text-foreground">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Live System Clock
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <span className="text-sm">
              Insights for <span className="font-semibold text-foreground">{selectedVideo?.filename || "Active Camera"}</span>
            </span>
            <span className="text-xs px-2 py-0.5 bg-secondary rounded-full">
              Last Data: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-stretch">
          <Button variant="outline" onClick={handleExport} disabled={!selectedVideoId} className="h-10 md:self-start">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>

          <Card className="w-full md:w-[260px]">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-xs font-medium flex justify-between items-center">
                <span>Service Time</span>
                <div className="flex items-center space-x-1">
                  <Switch
                    id="smart-mode"
                    checked={useSmartWaitTime}
                    onCheckedChange={setUseSmartWaitTime}
                    className="scale-75 animate-none"
                  />
                  <Label htmlFor="smart-mode" className="text-[10px]">Smart</Label>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <label className="text-[10px] text-muted-foreground block mb-1">
                {useSmartWaitTime && throughput > 0 ? (
                  <span className="flex items-center gap-1 text-primary font-bold">
                    <Zap className="w-2.5 h-2.5" /> Rate: {activeServiceRate.toFixed(1)} m/p
                  </span>
                ) : (
                  <span>Rate: <span className="font-bold text-foreground">{manualServiceRate} m/p</span></span>
                )}
              </label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={manualServiceRate}
                onChange={(e) => setManualServiceRate(parseFloat(e.target.value))}
                disabled={useSmartWaitTime && throughput > 0}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
            </CardContent>
          </Card>

          <Card className="w-full md:w-[260px]">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-xs font-medium flex justify-between items-center">
                <span>SLA Target Limit</span>
                <Badge className="text-[10px] py-0 px-1.5">{slaTargetMinutes} mins</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <label className="text-[10px] text-muted-foreground block mb-1">
                Max allowable customer wait
              </label>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={slaTargetMinutes}
                onChange={(e) => setSlaTargetMinutes(parseInt(e.target.value))}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-card to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-bold">Avg Occupancy</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-avg-people">{avgPeople}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              Across all queues
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-bold">Est. Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">~{currentWaitTime} min</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {useSmartWaitTime && throughput > 0 ? (
                <Badge variant="outline" className="text-[10px] h-5 bg-orange-500/10 border-orange-500/20 text-orange-600">Smart Estimate</Badge>
              ) : (
                "Manual rate based"
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-bold">SLA Compliance</CardTitle>
            <CheckCircle2 className={`h-4 w-4 ${slaComplianceRate >= 90 ? 'text-emerald-500' : slaComplianceRate >= 75 ? 'text-orange-500' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${slaComplianceRate >= 90 ? 'text-emerald-600' : slaComplianceRate >= 75 ? 'text-orange-500' : 'text-destructive'}`}>
              {slaComplianceRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Under {slaTargetMinutes} min wait target
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-bold">Queue Balance</CardTitle>
            <Activity className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${queueImbalanceStats.color}`}>
              {queueImbalanceStats.label}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Discrepancy: {queueImbalanceStats.score} people
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-bold">Est. Throughput</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{throughput}</div>
            <p className="text-xs text-muted-foreground mt-1">
              People served / hour
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-bold">Peak Count</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-peak-people">{peakPeople}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum observed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SLA, Insights and Alerts Feed Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Actionable AI Recommendations */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Actionable Operational Insights
            </CardTitle>
            <CardDescription>
              Data-driven recommendations to optimize staffing and line balance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {operationalRecommendations.map((rec, idx) => (
              <div key={idx} className="flex gap-3 items-start p-3 bg-secondary/35 rounded-lg border border-border/60">
                <Badge variant="outline" className="mt-0.5 bg-primary/10 border-primary/20 text-primary font-mono text-xs">
                  Insight {idx + 1}
                </Badge>
                <p className="text-sm leading-relaxed text-foreground/90">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Real-time Alerts Feed */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-destructive" />
              Live Alerts & Exception Log
            </CardTitle>
            <CardDescription>
              Recent queue crowding and SLA breaches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[230px] overflow-y-auto pr-1">
              {alertsFeed.length > 0 ? (
                alertsFeed.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${
                      alert.type === "critical"
                        ? "bg-destructive/15 border-destructive/20 text-destructive"
                        : "bg-orange-500/10 border-orange-500/20 text-orange-600"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <Badge
                        variant={alert.type === "critical" ? "destructive" : "outline"}
                        className={`text-[9px] py-0 px-1.5 uppercase ${
                          alert.type === "warning" ? "border-orange-500/30 text-orange-600 bg-orange-500/5" : ""
                        }`}
                      >
                        {alert.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{alert.time}</span>
                    </div>
                    <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No queue alerts or exceptions recorded.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Total People Over Time</CardTitle>
            <CardDescription>Real-time queue occupancy trends</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="hsl(var(--foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    name="Total People"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No historical data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Wait Time Forecast</CardTitle>
            <CardDescription>Projected trend based on last 30 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <ForecastChart snapshots={snapshots} serviceRate={activeServiceRate} currentTime={currentTime} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Efficiency</CardTitle>
            <CardDescription>Average occupancy per queue</CardDescription>
          </CardHeader>
          <CardContent>
            <QueueEfficiencyChart snapshots={snapshots} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Traffic Heatmap</CardTitle>
            <CardDescription>High-traffic areas based on detection density</CardDescription>
          </CardHeader>
          <CardContent>
            <HeatmapChart videoId={selectedVideoId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Busy Hours</CardTitle>
            <CardDescription>Average traffic by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            {busyHoursData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={busyHoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="avgPeople" fill="#ec4899" radius={[4, 4, 0, 0]} name="Avg People" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available for hourly analysis
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
