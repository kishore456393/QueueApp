import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DetectionSnapshot } from "@shared/schema";
import { Users, TrendingUp, Clock, RefreshCw, Lightbulb } from "lucide-react";
import { t, type Language } from "@/lib/translations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LANGUAGES = {
  'en': '🇬🇧 English',
  'hi': '🇮🇳 Hindi',
  'ta': '🇮🇳 Tamil',
  'te': '🇮🇳 Telugu',
  'bn': '🇮🇳 Bengali',
  'mr': '🇮🇳 Marathi',
  'gu': '🇮🇳 Gujarati',
  'kn': '🇮🇳 Kannada',
  'ml': '🇮🇳 Malayalam',
  'pa': '🇮🇳 Punjabi',
};

export default function MobileLiveDashboard() {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const { data: snapshot, refetch, isLoading, isError } = useQuery<DetectionSnapshot>({
    queryKey: ['/api/detection/latest'],
    refetchInterval: 2000, // Auto refresh every 2 seconds
    retry: 3,
  });

  useEffect(() => {
    if (snapshot) {
      setLastUpdate(new Date());
    }
  }, [snapshot]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-base font-medium">Loading live data…</p>
            <p className="text-sm text-muted-foreground mt-2">Connecting to the detection stream.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !snapshot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-bold mb-2">No Detection Data Available</h3>
            <p className="text-sm text-muted-foreground mb-4">
              The queue detection system is not currently running or no data is available yet.
            </p>
            <div className="space-y-2 text-left bg-background p-4 rounded-lg text-sm border border-border">
              <p className="font-semibold">To start detection:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Go to Dashboard on your computer</li>
                <li>Select a video or camera feed</li>
                <li>Click "Start Detection"</li>
                <li>Wait a few seconds for data</li>
                <li>This page will auto-refresh</li>
              </ol>
            </div>
            <Button 
              onClick={() => refetch()} 
              className="mt-4 w-full"
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold tracking-tight">
            Live Queue Monitor
          </h1>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <SelectItem key={code} value={code}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span>Live</span>
          </div>
          <span>•</span>
          <span>Updated: {formatTime(lastUpdate)}</span>
        </div>
      </div>

      {/* Total People Card */}
      <Card className="mb-4">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t(selectedLanguage as Language, 'totalPeople')}
              </p>
              <p className="text-4xl font-bold mt-2">{snapshot.totalPeople}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t(selectedLanguage as Language, 'peopleInQueues', { count: snapshot.totalQueues })}
              </p>
            </div>
            <Users className="w-12 h-12 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Best Queue Recommendation */}
      <Card className="mb-4 border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg">
              {t(selectedLanguage as Language, 'recommendation')}
            </h3>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">
                {t(selectedLanguage as Language, 'fastestQueue')}:
              </span>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                Queue {snapshot.bestQueue}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {snapshot.queueCounts[snapshot.bestQueue - 1]} {t(selectedLanguage as Language, 'peopleWaiting')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Individual Queue Cards */}
      <div className="space-y-3">
        <h3 className="font-semibold mb-2">
          {t(selectedLanguage as Language, 'allQueues')}
        </h3>
        
        {snapshot.queueCounts.map((count, index) => {
          const queueNum = index + 1;
          const isBest = queueNum === snapshot.bestQueue;
          const isWorst = queueNum === snapshot.worstQueue;
          
          return (
            <Card 
              key={index} 
              className={`${
                isBest ? 'border-2 border-emerald-500/60 bg-emerald-500/5' : 
                isWorst ? 'border-2 border-destructive/50 bg-destructive/5' : 
                ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      isBest ? 'bg-emerald-600' : 
                      isWorst ? 'bg-destructive' : 
                      'bg-primary'
                    }`}>
                      {queueNum}
                    </div>
                    <div>
                      <p className="font-semibold">
                        Queue {queueNum}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {count} {count === 1 ? 'person' : 'people'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {isBest && (
                      <Badge className="bg-emerald-600 text-white mb-1">
                        Fastest
                      </Badge>
                    )}
                    {isWorst && (
                      <Badge className="bg-destructive text-white mb-1">
                        Busiest
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>~{count * 2} min</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Info */}
      <Card className="mt-6 border-dashed">
        <CardContent className="flex items-start gap-3 p-4">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {snapshot.recommendation}
          </p>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>AI-powered queue detection</p>
        <p className="mt-1">Updates every 2 seconds</p>
      </div>
    </div>
  );
}
