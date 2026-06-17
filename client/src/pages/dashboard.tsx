import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { type DetectionSnapshot, type Settings, type Video } from "@shared/schema";
import { Users, TrendingUp, TrendingDown, Clock, Volume2, RefreshCw, Video as VideoIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { t, type Language } from "@/lib/translations";
import { playTextToSpeech } from "@/lib/tts";
import { QRCodeGenerator } from "@/components/qr-code-generator";
import { Skeleton } from "@/components/ui/skeleton";

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

const ANNOUNCEMENTS = {
  'en': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `Queue ${bestQueue} is the fastest with ${bestCount} ${bestCount === 1 ? 'person' : 'people'}. People waiting in queue ${worstQueue}, which has ${worstCount} ${worstCount === 1 ? 'person' : 'people'}, can move to queue ${bestQueue} for faster service.`,

  'hi': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `कतार ${bestQueue} सबसे तेज़ है जिसमें ${bestCount} लोग हैं। कतार ${worstQueue} में ${worstCount} लोग प्रतीक्षा कर रहे हैं, वे तेज़ सेवा के लिए कतार ${bestQueue} में जा सकते हैं।`,

  'ta': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `வரிசை ${bestQueue} மிக வேகமானது, ${bestCount} பேர் உள்ளனர். வரிசை ${worstQueue} இல் ${worstCount} பேர் காத்திருக்கிறார்கள், அவர்கள் விரைவான சேவைக்காக வரிசை ${bestQueue} க்கு செல்லலாம்.`,

  'te': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `క్యూ ${bestQueue} అత్యంత వేగవంతమైనది, ${bestCount} మంది ఉన్నారు. క్యూ ${worstQueue} లో ${worstCount} మంది వేచి ఉన్నారు, వారు వేగవంతమైన సేవ కోసం క్యూ ${bestQueue} కు వెళ్ళవచ్చు.`,

  'bn': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `সারি ${bestQueue} সবচেয়ে দ্রুত, ${bestCount} জন আছেন। সারি ${worstQueue} তে ${worstCount} জন অপেক্ষা করছেন, তারা দ্রুত সেবার জন্য সারি ${bestQueue} তে যেতে পারেন।`,

  'mr': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `रांग ${bestQueue} सर्वात जलद आहे, ${bestCount} लोक आहेत। रांग ${worstQueue} मध्ये ${worstCount} लोक वाट पाहत आहेत, ते जलद सेवेसाठी रांग ${bestQueue} मध्ये जाऊ शकतात।`,

  'gu': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `કતાર ${bestQueue} સૌથી ઝડપી છે, ${bestCount} લોકો છે. કતાર ${worstQueue} માં ${worstCount} લોકો રાહ જોઈ રહ્યા છે, તેઓ ઝડપી સેવા માટે કતાર ${bestQueue} પર જઈ શકે છે.`,

  'kn': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `ಸರತಿ ${bestQueue} ಅತ್ಯಂತ ವೇಗವಾಗಿದೆ, ${bestCount} ಜನರು ಇದ್ದಾರೆ. ಸರತಿ ${worstQueue} ನಲ್ಲಿ ${worstCount} ಜನರು ಕಾಯುತ್ತಿದ್ದಾರೆ, ಅವರು ವೇಗವಾದ ಸೇವೆಗಾಗಿ ಸರತಿ ${bestQueue} ಗೆ ಹೋಗಬಹುದು.`,

  'ml': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `ക്യൂ ${bestQueue} ഏറ്റവും വേഗതയുള്ളതാണ്, ${bestCount} പേർ ഉണ്ട്. ക്യൂ ${worstQueue} ൽ ${worstCount} പേർ കാത്തിരിക്കുന്നു, അവർക്ക് വേഗത്തിലുള്ള സേവനത്തിനായി ക്യൂ ${bestQueue} ലേക്ക് പോകാം.`,

  'pa': (bestQueue: number, worstQueue: number, bestCount: number, worstCount: number) =>
    `ਕਤਾਰ ${bestQueue} ਸਭ ਤੋਂ ਤੇਜ਼ ਹੈ, ${bestCount} ਲੋਕ ਹਨ। ਕਤਾਰ ${worstQueue} ਵਿੱਚ ${worstCount} ਲੋਕ ਉਡੀਕ ਕਰ ਰਹੇ ਹਨ, ਉਹ ਤੇਜ਼ ਸੇਵਾ ਲਈ ਕਤਾਰ ${bestQueue} ਵਿੱਚ ਜਾ ਸਕਦੇ ਹਨ।`,
};

export default function Dashboard() {
  const { toast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [latestData, setLatestData] = useState<DetectionSnapshot | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(undefined);
  const [refreshInterval, setRefreshInterval] = useState(2);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const wsRef = useRef<WebSocket | null>(null);

  const { data: settings, isLoading: isSettingsLoading, isError: isSettingsError } = useQuery<Settings>({
    queryKey: ['/api/settings'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<Settings>) => {
      const response = await apiRequest('PUT', '/api/settings', newSettings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const { data: videos, isLoading: isVideosLoading, isError: isVideosError } = useQuery<Video[]>({
    queryKey: ['/api/videos'],
  });

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

  // Default to the most recently uploaded video when list loads, if nothing selected
  // REMOVED: User wants dashboard to only show active video from setup
  /*
  useEffect(() => {
    if (selectedVideoId === undefined && videos && videos.length > 0) {
      setSelectedVideoId(videos[0].id);
    }
  }, [videos, selectedVideoId]);
  */

  // Initialize refresh interval and language from settings
  useEffect(() => {
    if (settings) {
      setRefreshInterval(settings.refreshInterval || 2);
      setSelectedLanguage(settings.language || 'en');
    }
  }, [settings]);

  const { data: snapshot, refetch, isLoading: isSnapshotLoading, isError: isSnapshotError } = useQuery<DetectionSnapshot>({
    queryKey: ['/api/detection-snapshots/latest', selectedVideoId],
    enabled: !!selectedVideoId,
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  });

  useEffect(() => {
    // Use wss:// for HTTPS connections, ws:// for HTTP
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    const connectWebSocket = async () => {
      // Get auth token for WebSocket authentication
      const { supabase } = await import('@/lib/supabaseClient');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      console.log('Connecting to WebSocket (authenticated)');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'detection_update') {
          // Only accept updates for the currently selected video
          if (!selectedVideoId || message.data?.videoId === selectedVideoId) {
            setLatestData(message.data);
          }
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedVideoId]);

  // Reset latest websocket data when switching videos to avoid stale display
  useEffect(() => {
    setLatestData(null);
  }, [selectedVideoId]);

  const displayData = latestData || snapshot;

  // Use a ref to keep track of the latest data without triggering re-renders or effect re-runs
  const latestDataRef = useRef<DetectionSnapshot | null | undefined>(null);

  useEffect(() => {
    latestDataRef.current = latestData || snapshot;
  }, [latestData, snapshot]);

  // Automatic periodic announcements when audio is enabled
  useEffect(() => {
    if (!settings?.audioEnabled) {
      return;
    }

    let isPlaying = false;

    // Play announcement function that checks for data and prevents overlaps
    const playAnnouncement = async () => {
      const currentData = latestDataRef.current;
      if (!currentData || isPlaying) return;

      try {
        isPlaying = true;
        setIsAnnouncing(true);
        const text = t(selectedLanguage as Language, 'announcement' as any, {
          bestQueue: currentData.bestQueue,
          worstQueue: currentData.worstQueue,
          bestCount: currentData.queueCounts[currentData.bestQueue - 1],
          worstCount: currentData.queueCounts[currentData.worstQueue - 1],
        });
        await playTextToSpeech(text, selectedLanguage);
      } catch (error) {
        console.error('Auto-announcement error:', error);
      } finally {
        isPlaying = false;
        setIsAnnouncing(false);
      }
    };

    // Don't play immediately, wait for first interval
    // This prevents immediate playback when toggling settings

    // Play at regular intervals only
    const interval = setInterval(() => {
      playAnnouncement();
    }, (settings.audioInterval || 30) * 1000);

    return () => {
      clearInterval(interval);
      isPlaying = false;
      setIsAnnouncing(false);
    };
  }, [settings?.audioEnabled, settings?.audioInterval, selectedLanguage]);

  const getLanguageCode = (lang: string): string => {
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'bn': 'bn-IN',
      'mr': 'mr-IN',
      'gu': 'gu-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'pa': 'pa-IN',
    };
    return langMap[lang] || 'en-US';
  };

  const getAnnouncement = () => {
    if (!displayData) return '';

    const bestQueue = displayData.bestQueue;
    const worstQueue = displayData.worstQueue;
    const bestCount = displayData.queueCounts[bestQueue - 1];
    const worstCount = displayData.queueCounts[worstQueue - 1];

    const announcementFn = ANNOUNCEMENTS[selectedLanguage as keyof typeof ANNOUNCEMENTS] || ANNOUNCEMENTS['en'];
    return announcementFn(bestQueue, worstQueue, bestCount, worstCount);
  };

  const handleSpeak = async () => {
    if (!displayData || isAnnouncing) return;

    setIsAnnouncing(true);
    try {
      const text = t(selectedLanguage as Language, 'announcement' as any, {
        bestQueue: displayData.bestQueue,
        worstQueue: displayData.worstQueue,
        bestCount: displayData.queueCounts[displayData.bestQueue - 1],
        worstCount: displayData.queueCounts[displayData.worstQueue - 1],
      });

      await playTextToSpeech(text, selectedLanguage);
    } catch (error) {
      console.error('Speech error:', error);
      toast({
        title: "Speech Error",
        description: "Could not play audio announcement",
        variant: "destructive",
      });
    } finally {
      setIsAnnouncing(false);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setSelectedLanguage(newLang);
    updateSettingsMutation.mutate({
      language: newLang,
      refreshInterval,
      audioEnabled: settings?.audioEnabled || false,
      audioInterval: settings?.audioInterval || 30,
    });
  };

  const handleRefreshIntervalChange = (newInterval: number) => {
    if (newInterval >= 1 && newInterval <= 60) {
      setRefreshInterval(newInterval);
      updateSettingsMutation.mutate({
        language: selectedLanguage,
        refreshInterval: newInterval,
        audioEnabled: settings?.audioEnabled || false,
        audioInterval: settings?.audioInterval || 30,
      });
    }
  };

  const chartData = displayData?.queueCounts.map((count, index) => ({
    name: t(selectedLanguage as Language, 'queue', { number: index + 1 }),
    people: count,
    fill: index + 1 === displayData.bestQueue ? '#10b981' : index + 1 === displayData.worstQueue ? '#ef4444' : '#6366f1'
  })) || [];

  const freshnessMinutes = displayData ? Math.floor((Date.now() - new Date(displayData.timestamp).getTime()) / 1000 / 60) : null;
  const isFresh = freshnessMinutes !== null && freshnessMinutes < 1;
  const isRecent = freshnessMinutes !== null && freshnessMinutes < 5;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl mb-2">{t(selectedLanguage as Language, 'liveDashboard')}</h1>
          <p className="text-muted-foreground text-lg">
            {t(selectedLanguage as Language, 'realTimeAnalytics')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex bg-muted rounded-lg p-1 border border-border">
            <Button
              variant={viewMode === 'single' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('single')}
              className="h-8"
            >
              Single View
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8"
            >
              Grid View
            </Button>
          </div>
          <Link href="/tv-dashboard">
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <VideoIcon className="w-4 h-4" />
              TV Mode
            </Button>
          </Link>
          <QRCodeGenerator />
          <Badge variant={wsConnected ? "default" : "destructive"} data-testid="badge-websocket-status" className="tabular-nums">
            {wsConnected ? t(selectedLanguage as Language, 'live') : t(selectedLanguage as Language, 'offline')}
          </Badge>
          {freshnessMinutes !== null && (
            <Badge variant={isFresh ? "default" : isRecent ? "secondary" : "destructive"} data-testid="badge-data-freshness">
              {isFresh ? t(selectedLanguage as Language, 'fresh') : isRecent ? `${freshnessMinutes}m ago` : t(selectedLanguage as Language, 'stale')}
            </Badge>
          )}
        </div>
      </div>

      {(isSettingsError || isVideosError || isSnapshotError) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Some data failed to load</CardTitle>
            <CardDescription>Check your connection and try again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {(isSettingsLoading || isVideosLoading || (selectedVideoId && isSnapshotLoading)) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card><CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader><CardContent><Skeleton className="h-10 w-20" /><Skeleton className="mt-2 h-3 w-32" /></CardContent></Card>
          <Card><CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader><CardContent><Skeleton className="h-10 w-28" /><Skeleton className="mt-2 h-3 w-24" /></CardContent></Card>
          <Card><CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader><CardContent><Skeleton className="h-10 w-28" /><Skeleton className="mt-2 h-3 w-24" /></CardContent></Card>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos?.map((video) => (
            <Card key={video.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setSelectedVideoId(video.id); setViewMode('single'); }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg truncate">{video.filename}</CardTitle>
                <CardDescription className="text-xs">{video.sourceType}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-black rounded-md mb-2 flex items-center justify-center text-muted-foreground">
                  {/* Placeholder for preview, real implementation would fetch latest frame for each video */}
                  <div className="flex flex-col items-center">
                    <VideoIcon className="w-8 h-8 mb-1" />
                    <span className="text-xs">Click to view</span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="w-full">View Details</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Video selector REMOVED as per user request */}
          {/* 
          {videos && videos.length > 0 && (
            <div className="mb-6 flex items-center gap-3">
              <Label className="min-w-28">{t(selectedLanguage as Language, 'activeVideo')}</Label>
              <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                <SelectTrigger className="w-80" data-testid="select-active-video">
                  <SelectValue placeholder={t(selectedLanguage as Language, 'selectVideo')} />
                </SelectTrigger>
                <SelectContent>
                  {videos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t(selectedLanguage as Language, 'totalPeople')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-total-people">
                  {displayData?.totalPeople || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(selectedLanguage as Language, 'acrossQueues', { count: displayData?.totalQueues || 0 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t(selectedLanguage as Language, 'bestQueue')}</CardTitle>
                <TrendingDown className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500" data-testid="text-best-queue">
                  {t(selectedLanguage as Language, 'queue', { number: displayData?.bestQueue || '-' })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {displayData ? t(selectedLanguage as Language, displayData.queueCounts[displayData.bestQueue - 1] === 1 ? 'personWaiting' : 'peopleWaiting', { count: displayData.queueCounts[displayData.bestQueue - 1] }) : '0'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t(selectedLanguage as Language, 'busiestQueue')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500" data-testid="text-worst-queue">
                  {t(selectedLanguage as Language, 'queue', { number: displayData?.worstQueue || '-' })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {displayData ? t(selectedLanguage as Language, displayData.queueCounts[displayData.worstQueue - 1] === 1 ? 'personWaiting' : 'peopleWaiting', { count: displayData.queueCounts[displayData.worstQueue - 1] }) : '0'}
                </p>
              </CardContent>
            </Card>
          </div>

          {displayData && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{t(selectedLanguage as Language, 'recommendation')}</CardTitle>
                <CardDescription>{t(selectedLanguage as Language, 'queueGuidance')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-lg" data-testid="text-recommendation">
                    {getAnnouncement()}
                  </p>
                  <Button
                    onClick={handleSpeak}
                    variant="outline"
                    size="sm"
                    data-testid="button-speak-recommendation"
                    className="hover-elevate active-elevate-2"
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    {t(selectedLanguage as Language, 'announceIn', { language: LANGUAGES[selectedLanguage as keyof typeof LANGUAGES]?.split(' ')[1] || 'English' })}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>{t(selectedLanguage as Language, 'queueComparison')}</CardTitle>
                <CardDescription>{t(selectedLanguage as Language, 'currentPeopleCount')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="people" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t(selectedLanguage as Language, 'queueDetails')}</CardTitle>
                <CardDescription>{t(selectedLanguage as Language, 'individualStats')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {displayData?.queueCounts.map((count, index) => {
                  const queueNum = index + 1;
                  const isBest = queueNum === displayData.bestQueue;
                  const isWorst = queueNum === displayData.worstQueue;
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg border ${isBest ? 'border-green-500 bg-green-500/10' :
                        isWorst ? 'border-red-500 bg-red-500/10' :
                          'border-border'
                        }`}
                      data-testid={`card-queue-${queueNum}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isBest ? 'bg-green-500 text-white' :
                          isWorst ? 'bg-red-500 text-white' :
                            'bg-primary text-primary-foreground'
                          }`}>
                          {queueNum}
                        </div>
                        <div>
                          <p className="font-medium">{t(selectedLanguage as Language, 'queue', { number: queueNum })}</p>
                          <p className="text-sm text-muted-foreground">
                            {t(selectedLanguage as Language, 'estWait', { minutes: count * 2 })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">{t(selectedLanguage as Language, 'people')}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {displayData?.frameData && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{t(selectedLanguage as Language, 'detectionFrame')}</CardTitle>
                <CardDescription>{t(selectedLanguage as Language, 'currentVideoFrame')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                  <img
                    src={displayData.frameData}
                    alt="Detection frame"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t(selectedLanguage as Language, 'lastUpdated', { time: new Date(displayData.timestamp).toLocaleTimeString() })}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t(selectedLanguage as Language, 'dashboardSettings')}</CardTitle>
              <CardDescription>{t(selectedLanguage as Language, 'configureSettings')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-refresh">{t(selectedLanguage as Language, 'autoRefresh')}</Label>
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  data-testid="switch-auto-refresh"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="refresh-interval">{t(selectedLanguage as Language, 'refreshInterval')}</Label>
                  <span className="text-sm text-muted-foreground">{refreshInterval}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="refresh-interval"
                    type="number"
                    min="1"
                    max="60"
                    value={refreshInterval}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) setRefreshInterval(val);
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) handleRefreshIntervalChange(val);
                    }}
                    className="w-24"
                    data-testid="input-refresh-interval"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRefreshIntervalChange(refreshInterval)}
                    disabled={updateSettingsMutation.isPending}
                  >
                    {t(selectedLanguage as Language, 'apply')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(selectedLanguage as Language, 'howOftenFetch')}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="language">{t(selectedLanguage as Language, 'language')}</Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger className="w-48" data-testid="select-language">
                    <SelectValue placeholder={t(selectedLanguage as Language, 'selectLanguage')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="audio-enabled">{t(selectedLanguage as Language, 'audioAnnouncements')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t(selectedLanguage as Language, 'automaticAnnounce')}
                  </p>
                </div>
                <Switch
                  id="audio-enabled"
                  checked={settings?.audioEnabled || false}
                  onCheckedChange={(checked) => {
                    updateSettingsMutation.mutate({
                      language: selectedLanguage,
                      refreshInterval,
                      audioEnabled: checked,
                      audioInterval: settings?.audioInterval || 30,
                    });
                  }}
                  data-testid="switch-audio-enabled"
                />
              </div>

              {settings?.audioEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="audio-interval">{t(selectedLanguage as Language, 'audioInterval')}</Label>
                    <span className="text-sm text-muted-foreground">{settings.audioInterval || 30}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="audio-interval"
                      type="number"
                      min="10"
                      max="300"
                      value={settings.audioInterval || 30}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 10 && val <= 300) {
                          updateSettingsMutation.mutate({
                            language: selectedLanguage,
                            refreshInterval,
                            audioEnabled: settings.audioEnabled,
                            audioInterval: val,
                          });
                        }
                      }}
                      className="w-24"
                      data-testid="input-audio-interval"
                    />
                    <span className="text-sm text-muted-foreground">sec</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(selectedLanguage as Language, 'howOftenAnnounce')}
                  </p>
                </div>
              )}

              <Button
                onClick={() => refetch()}
                variant="outline"
                className="w-full hover-elevate active-elevate-2"
                data-testid="button-refresh-now"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t(selectedLanguage as Language, 'refreshNow')}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
