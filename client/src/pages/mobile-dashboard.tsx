import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { type DetectionSnapshot, type Settings, type Video } from "@shared/schema";
import { Users, TrendingUp, TrendingDown, Volume2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { t, type Language } from "@/lib/translations";

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

export default function MobileDashboard() {
    const [wsConnected, setWsConnected] = useState(false);
    const [latestData, setLatestData] = useState<DetectionSnapshot | null>(null);
    const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(undefined);
    const [selectedLanguage, setSelectedLanguage] = useState('en');

    const { data: settings } = useQuery<Settings>({
        queryKey: ['/api/settings'],
    });

    const { data: videos } = useQuery<Video[]>({
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

    // Default to the most recently uploaded video if no active detection
    useEffect(() => {
        if (!selectedVideoId && videos && videos.length > 0) {
            setSelectedVideoId(videos[0].id);
        }
    }, [videos, selectedVideoId]);

    // Initialize language from settings
    useEffect(() => {
        if (settings) {
            setSelectedLanguage(settings.language || 'en');
        }
    }, [settings]);

    const { data: snapshot } = useQuery<DetectionSnapshot>({
        queryKey: ['/api/detection-snapshots/latest', selectedVideoId],
        enabled: !!selectedVideoId,
        refetchInterval: 2000, // Fixed refresh interval for mobile
    });

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
                    if (!selectedVideoId || message.data?.videoId === selectedVideoId) {
                        setLatestData(message.data);
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

    // Reset latest websocket data when switching videos
    useEffect(() => {
        setLatestData(null);
    }, [selectedVideoId]);

    const displayData = latestData || snapshot;

    const getAnnouncement = () => {
        if (!displayData) return '';

        const bestQueue = displayData.bestQueue;
        const worstQueue = displayData.worstQueue;
        const bestCount = displayData.queueCounts[bestQueue - 1];
        const worstCount = displayData.queueCounts[worstQueue - 1];

        const announcementFn = ANNOUNCEMENTS[selectedLanguage as keyof typeof ANNOUNCEMENTS] || ANNOUNCEMENTS['en'];
        return announcementFn(bestQueue, worstQueue, bestCount, worstCount);
    };

    const chartData = displayData?.queueCounts.map((count, index) => ({
        name: t(selectedLanguage as Language, 'queue', { number: index + 1 }),
        people: count,
        fill: index + 1 === displayData.bestQueue ? '#10b981' : index + 1 === displayData.worstQueue ? '#ef4444' : '#6366f1'
    })) || [];

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold tracking-tight mb-1">{t(selectedLanguage as Language, 'liveDashboard')}</h1>
                        <p className="text-muted-foreground text-sm">
                            {t(selectedLanguage as Language, 'realTimeAnalytics')}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                        <Badge variant={wsConnected ? "default" : "destructive"} className="tabular-nums">
                            {wsConnected ? t(selectedLanguage as Language, 'live') : t(selectedLanguage as Language, 'offline')}
                        </Badge>
                    </div>
                </div>

                <div className="w-full">
                    <Select
                        value={selectedLanguage}
                        onValueChange={setSelectedLanguage}
                    >
                        <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder={t(selectedLanguage as Language, 'selectLanguage')} />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(LANGUAGES).map(([code, name]) => (
                                <SelectItem key={code} value={code}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Video selector if multiple videos exist */}
            {videos && videos.length > 0 && (
                <div>
                    <Label className="mb-2 block text-muted-foreground">{t(selectedLanguage as Language, 'activeVideo')}</Label>
                    <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                        <SelectTrigger className="w-full h-10">
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

            <div className="grid grid-cols-1 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t(selectedLanguage as Language, 'totalPeople')}</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {displayData?.totalPeople || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t(selectedLanguage as Language, 'acrossQueues', { count: displayData?.totalQueues || 0 })}
                        </p>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                            <CardTitle className="text-sm font-medium">{t(selectedLanguage as Language, 'bestQueue')}</CardTitle>
                            <TrendingDown className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-emerald-600">
                                {t(selectedLanguage as Language, 'queue', { number: displayData?.bestQueue || '-' })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                            <CardTitle className="text-sm font-medium">{t(selectedLanguage as Language, 'busiestQueue')}</CardTitle>
                            <TrendingUp className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-destructive">
                                {t(selectedLanguage as Language, 'queue', { number: displayData?.worstQueue || '-' })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {displayData && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Volume2 className="w-5 h-5" />
                            {t(selectedLanguage as Language, 'recommendation')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-medium leading-relaxed">
                            {getAnnouncement()}
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t(selectedLanguage as Language, 'queueComparison')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Bar dataKey="people" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t(selectedLanguage as Language, 'queueDetails')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {displayData?.queueCounts.map((count, index) => {
                            const queueNum = index + 1;
                            const isBest = queueNum === displayData.bestQueue;
                            const isWorst = queueNum === displayData.worstQueue;
                            return (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between rounded-lg border p-3 ${isBest ? 'border-emerald-500/60 bg-emerald-500/5' :
                                        isWorst ? 'border-destructive/50 bg-destructive/5' :
                                            'border-border'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isBest ? 'bg-emerald-600 text-white' :
                                            isWorst ? 'bg-destructive text-destructive-foreground' :
                                                'bg-primary text-primary-foreground'
                                            }`}>
                                            {queueNum}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{t(selectedLanguage as Language, 'queue', { number: queueNum })}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {t(selectedLanguage as Language, 'estWait', { minutes: count * 2 })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold">{count}</p>
                                        <p className="text-[10px] text-muted-foreground">{t(selectedLanguage as Language, 'people')}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
            </div>
        </div>
    );
}
