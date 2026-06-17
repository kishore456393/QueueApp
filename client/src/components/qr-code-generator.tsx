import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Smartphone, X, Copy, Check } from "lucide-react";
import QRCode from "react-qr-code";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";

export function QRCodeGenerator() {
  const [showQR, setShowQR] = useState(false);
  const [mobileUrl, setMobileUrl] = useState("");
  const [networkIP, setNetworkIP] = useState("");
  const [usePublicUrl, setUsePublicUrl] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch network IP and check for ngrok URL
    const fetchNetworkIP = async () => {
      try {
        const response = await fetch(getApiUrl('/api/network-ip'));
        const data = await response.json();
        setNetworkIP(data.ip);
        // Point to guest login endpoint which redirects to mobile-live
        const url = `http://${data.ip}:${data.port}/api/auth/guest-login`;
        setMobileUrl(url);

        // Check if we're accessing via a public URL (ngrok, cloudflare, etc.)
        const currentHost = window.location.host;
        if (!currentHost.includes('localhost') && !currentHost.match(/^\d+\.\d+\.\d+\.\d+/)) {
          // We're on a public domain
          const publicUrl = `${window.location.protocol}//${window.location.host}/api/auth/guest-login`;
          setPublicUrl(publicUrl);
          setUsePublicUrl(true);
        } else {
          // Try to fetch ngrok URL from ngrok API
          try {
            const ngrokResponse = await fetch('http://127.0.0.1:4040/api/tunnels');
            const ngrokData = await ngrokResponse.json();
            if (ngrokData.tunnels && ngrokData.tunnels.length > 0) {
              // Find HTTPS tunnel
              const httpsTunnel = ngrokData.tunnels.find((t: any) => t.proto === 'https');
              if (httpsTunnel) {
                const ngrokUrl = `${httpsTunnel.public_url}/api/auth/guest-login`;
                setPublicUrl(ngrokUrl);
                setUsePublicUrl(true); // Auto-select ngrok URL
                console.log('✅ Ngrok URL detected and auto-selected:', ngrokUrl);
              }
            }
          } catch (ngrokError) {
            // Ngrok not running, ignore
            console.log('⚠️ Ngrok not detected - using local network URL');
          }
        }
      } catch (error) {
        console.error('Failed to fetch network IP:', error);
        // Fallback to current host
        const protocol = window.location.protocol;
        const host = window.location.host;
        const url = `${protocol}//${host}/api/auth/guest-login`;
        setMobileUrl(url);
      }
    };

    fetchNetworkIP();
  }, []);

  const currentUrl = usePublicUrl && publicUrl ? publicUrl : mobileUrl;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast({
        title: "URL Copied!",
        description: "Mobile dashboard URL copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  };

  const handleShowQR = async () => {
    setShowQR(true);
    setLoading(true);

    // Fetch fresh ngrok URL via backend proxy
    try {
      console.log('🔍 Fetching Ngrok tunnels via /api/ngrok-tunnels');
      const ngrokResponse = await fetch(getApiUrl('/api/ngrok-tunnels'));

      console.log('📡 Ngrok response status:', ngrokResponse.status);

      if (!ngrokResponse.ok) {
        throw new Error(`Ngrok API returned status: ${ngrokResponse.status}`);
      }

      const ngrokData = await ngrokResponse.json();
      console.log('📦 Ngrok data received:', ngrokData);

      if (ngrokData.tunnels && ngrokData.tunnels.length > 0) {
        console.log('🔗 Found tunnels:', ngrokData.tunnels.length);

        // Find HTTPS tunnel
        const httpsTunnel = ngrokData.tunnels.find((t: any) => t.proto === 'https');

        if (httpsTunnel) {
          const ngrokUrl = `${httpsTunnel.public_url}/mobile-live`;
          setPublicUrl(ngrokUrl);
          setUsePublicUrl(true);
          console.log('✅ Ngrok HTTPS URL set:', ngrokUrl);
          toast({
            title: "🌍 Ngrok URL Loaded",
            description: "QR code ready for worldwide access",
          });
        } else {
          console.log('⚠️ No HTTPS tunnel found, checking HTTP...');
          // Try HTTP tunnel as fallback
          const httpTunnel = ngrokData.tunnels.find((t: any) => t.proto === 'http');
          if (httpTunnel) {
            const ngrokUrl = `${httpTunnel.public_url}/mobile-live`;
            setPublicUrl(ngrokUrl);
            setUsePublicUrl(true);
            console.log('✅ Ngrok HTTP URL set:', ngrokUrl);
            toast({
              title: "🌍 Ngrok URL Loaded",
              description: "Using HTTP tunnel",
            });
          } else {
            console.log('⚠️ No suitable tunnel found');
            toast({
              title: "📡 Local Network Only",
              description: "No accessible Ngrok tunnels",
            });
          }
        }
      } else {
        console.log('⚠️ No tunnels found in response');
        toast({
          title: "📡 Local Network Only",
          description: "Ngrok has no active tunnels",
        });
      }
    } catch (error) {
      console.error('❌ Error fetching Ngrok URL:', error);
      toast({
        title: "📡 Local Network Only",
        description: "Could not connect to Ngrok",
      });
    }
    setLoading(false);
  };

  return (
    <>
      <Button
        onClick={handleShowQR}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <QrCode className="w-4 h-4" />
        Show QR Code
      </Button>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-sm bg-card border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Mobile Live Dashboard
            </DialogTitle>
            <DialogDescription>
              Scan this QR code with your mobile device to view live queue updates
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* URL Type Selector - Always visible */}
            <div className="flex gap-2 p-1 bg-muted/50 rounded-lg border border-border">
              <Button
                size="sm"
                variant={usePublicUrl ? "default" : "ghost"}
                onClick={() => setUsePublicUrl(true)}
                className="flex-1 font-medium h-8 text-xs"
                disabled={!publicUrl}
              >
                🌍 Public
              </Button>
              <Button
                size="sm"
                variant={!usePublicUrl ? "default" : "ghost"}
                onClick={() => setUsePublicUrl(false)}
                className="flex-1 font-medium h-8 text-xs"
              >
                📡 Local
              </Button>
            </div>

            {/* Status Badge */}
            {publicUrl ? (
              <div className="text-center p-2 bg-green-100 dark:bg-green-900/20 rounded-lg border border-green-300 dark:border-green-800">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  ✅ Ngrok Active - Public URL Available
                </span>
              </div>
            ) : (
              <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-800">
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  ⚠️ Ngrok Not Detected - Using Local Network Only
                </span>
              </div>
            )}

            {/* QR Code Display */}
            <div className="bg-white p-4 rounded-xl border border-border flex items-center justify-center shadow-sm">
              <QRCode
                value={currentUrl}
                size={180}
                level="H"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>

            {/* URL Display */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {usePublicUrl ? "Public URL (Works Anywhere):" : "Local Network URL:"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="text-xs text-muted-foreground text-center">
              {usePublicUrl ? (
                <p>Scan to access from anywhere via Ngrok</p>
              ) : (
                <p>Connect to same WiFi to scan</p>
              )}
            </div>

            <Button
              onClick={() => setShowQR(false)}
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
