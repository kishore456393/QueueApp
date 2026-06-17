import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getApiUrl } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { type Video, type QueueZone } from "@shared/schema";
import { Upload, Edit3, Play, CheckCircle2, Camera, Video as VideoIcon, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Point = { x: number; y: number };
type Polygon = Point[];

export default function Setup() {
  const { toast } = useToast();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<Video | null>(null);
  const [polygons, setPolygons] = useState<Polygon[]>([]);
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Camera stream states
  const [cameraName, setCameraName] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [streamType, setStreamType] = useState<string>("rtsp");
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);

  const colors = [
    '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
    '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#a855f7'
  ];

  const { data: videos } = useQuery<Video[]>({
    queryKey: ['/api/videos'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      
      // Get auth token for the request
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      
      const response = await fetch(getApiUrl('/api/videos'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      loadVideoAndZones(data);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const saveZonesMutation = useMutation({
    mutationFn: async (zones: { videoId: string; polygons: Polygon[] }) => {
      try {
        // First delete existing zones to avoid duplicates
        await apiRequest('DELETE', `/api/queue-zones/${zones.videoId}`);

        // Save new zones
        const savePromises = zones.polygons.map((polygon, index) =>
          apiRequest('POST', '/api/queue-zones', {
            videoId: zones.videoId,
            queueNumber: index + 1,
            polygonPoints: polygon,
          })
        );

        // Wait for all zone saves to complete
        await Promise.all(savePromises);

        // Start detection after zones are saved
        await apiRequest('POST', `/api/detection/start/${zones.videoId}`);
      } catch (error) {
        console.error('Error saving zones:', error);
        throw error;
      }
    },
    onSuccess: async () => {
      toast({
        title: "Success!",
        description: "Queue zones saved and detection started",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/queue-zones'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Failed to save queue zones',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const startDetectionMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return apiRequest('POST', `/api/detection/start/${videoId}`);
    },
    onSuccess: () => {
      toast({
        title: "Detection Started",
        description: "Go to the Dashboard to view live results.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Failed to start detection',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const addCameraMutation = useMutation({
    mutationFn: async (data: { name: string; streamUrl: string; sourceType: string }) => {
      const response = await apiRequest('POST', '/api/cameras', data);
      return response.json();
    },
    onSuccess: (camera) => {
      // Check if we got an existing camera (it will have an ID and potentially zones)
      loadVideoAndZones(camera);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Cannot connect to camera';
      toast({
        title: "Failed to add camera",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      try {
        const response = await apiRequest('DELETE', `/api/videos/${videoId}`);
        return await response.json();
      } catch (error) {
        console.error('Delete error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      setUploadedVideo(null);
      setPolygons([]);
      queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
      toast({
        title: "Feed deleted",
        description: "Video source removed successfully",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not remove video source';
      console.error('Delete failed:', message);
      toast({
        title: "Delete failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const captureFrame = async (cameraId: string) => {
    try {
      const response = await apiRequest('GET', `/api/cameras/${cameraId}/frame`);
      const data = await response.json();
      setCapturedFrame(data.frameData);
    } catch (error) {
      toast({
        title: "Failed to capture frame",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const loadVideoAndZones = async (video: Video) => {
    setUploadedVideo(video);
    queryClient.invalidateQueries({ queryKey: ['/api/videos'] });

    try {
      const res = await apiRequest('GET', `/api/queue-zones/${video.id}`);
      const zones: QueueZone[] = await res.json();
      const loadedPolygons = zones.map(z =>
        typeof z.polygonPoints === 'string'
          ? JSON.parse(z.polygonPoints as unknown as string)
          : z.polygonPoints
      ) as Point[][];
      setPolygons(loadedPolygons);

      if (loadedPolygons.length > 0) {
        toast({
          title: "Configuration Restored",
          description: `Loaded ${video.filename} with ${loadedPolygons.length} existing queue zones`,
        });
      } else {
        toast({
          title: "Feed Loaded",
          description: `Loaded ${video.filename}`,
        });
      }

      // If it's a camera, capture a fresh frame
      if (video.sourceType !== 'file') {
        captureFrame(video.id);
      }
    } catch (e) {
      console.error("Failed to load zones", e);
      toast({
        title: "Warning",
        description: "Could not load saved zones",
        variant: "destructive"
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
    }
  };

  const handleUpload = () => {
    if (videoFile) {
      uploadMutation.mutate(videoFile);
    }
  };

  const handleAddCamera = () => {
    if (!cameraName || !streamUrl) {
      toast({
        title: "Missing information",
        description: "Please provide camera name and stream URL",
        variant: "destructive",
      });
      return;
    }

    addCameraMutation.mutate({
      name: cameraName,
      streamUrl: streamUrl,
      sourceType: streamType,
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setCurrentPolygon([...currentPolygon, { x, y }]);
  };

  const handleCanvasRightClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent context menu
    if (!isDrawing) return;

    // Complete the polygon on right-click
    if (currentPolygon.length >= 3) {
      completePolygon();
    } else {
      toast({
        title: "Not enough points",
        description: "Need at least 3 points to complete a queue zone",
        variant: "destructive",
      });
    }
  };

  const completePolygon = () => {
    if (currentPolygon.length >= 3) {
      setPolygons([...polygons, currentPolygon]);
      setCurrentPolygon([]);
      toast({
        title: `Queue ${polygons.length + 1} defined`,
        description: `Added polygon with ${currentPolygon.length} points`,
      });
    }
  };

  const undoLastPoint = () => {
    if (currentPolygon.length > 0) {
      setCurrentPolygon(currentPolygon.slice(0, -1));
    }
  };

  const clearLastPolygon = () => {
    if (polygons.length > 0) {
      setPolygons(polygons.slice(0, -1));
      toast({
        title: "Removed last queue",
        description: `${polygons.length - 1} queues remaining`,
      });
    }
  };

  const saveZones = () => {
    if (uploadedVideo && polygons.length > 0) {
      saveZonesMutation.mutate({
        videoId: uploadedVideo.id,
        polygons,
      });
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = () => {
      // If we have a captured frame (from camera), draw that
      if (capturedFrame) {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          drawPolygons(ctx, canvas);
        };
        img.src = capturedFrame;
        return;
      }

      // Otherwise draw from video element
      if (!video) return;
      // Only draw when we have current frame data
      if (video.readyState < 2 || video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawPolygons(ctx, canvas);
    };

    const drawPolygons = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      // Draw saved polygons (filled with semi-transparent color)
      polygons.forEach((polygon, i) => {
        const color = colors[i % colors.length];
        ctx.fillStyle = color + '40';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        polygon.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Label (Q1, Q2, ...)
        const centerX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
        const centerY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`Q${i + 1}`, centerX - 15, centerY + 8);

        // Draw corner dots for saved polygon
        polygon.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffffcc';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.stroke();
        });
      });

      // Draw in-progress polygon path and points (dashed yellow)
      if (currentPolygon.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y);
        for (let i = 1; i < currentPolygon.length; i++) {
          const p = currentPolygon[i];
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        ctx.restore();

        // Draw visible dots for each clicked point
        currentPolygon.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
          ctx.strokeStyle = '#a16207';
          ctx.stroke();
        });
      }
    };

    const interval = setInterval(drawFrame, 100);
    return () => clearInterval(interval);
  }, [polygons, currentPolygon, capturedFrame]);

  // When a new video is uploaded, force the hidden video element to load metadata
  // so videoWidth/videoHeight become available for canvas drawing and draw once on load
  useEffect(() => {
    if (!uploadedVideo) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v) return;
    const onLoadedMetadata = () => {
      try {
        // Nudge currentTime to trigger decode in some browsers
        v.currentTime = Math.max(0.01, v.currentTime);
      } catch { }
    };
    const onLoadedData = () => {
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      if (v.videoWidth && v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, c.width, c.height);
      }
    };
    const onError = () => {
      // Optional: surface a toast if desired
      // toast({ title: 'Video failed to load', description: 'Try H.264 MP4/WebM.', variant: 'destructive' });
    };
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('loadeddata', onLoadedData);
    v.addEventListener('error', onError as any);
    // Force reload to ensure metadata is fetched even if element is visually hidden
    v.load();
    // Try to start playback silently to ensure frames are decoded
    v.play().catch(() => { });
    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('loadeddata', onLoadedData);
      v.removeEventListener('error', onError as any);
    };
  }, [uploadedVideo]);

  const progress = uploadedVideo ? (polygons.length > 0 ? 100 : 50) : videoFile ? 25 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Setup</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Upload video, define queue zones, and start AI detection
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>Complete these steps to begin queue monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-4" data-testid="progress-setup" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              {uploadedVideo ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
              <span className={uploadedVideo ? "text-foreground font-medium" : "text-muted-foreground"}>
                1. Upload Video
              </span>
            </div>
            <div className="flex items-center gap-3">
              {polygons.length > 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Edit3 className="w-5 h-5 text-muted-foreground" />}
              <span className={polygons.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
                2. Draw Queue Zones
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Play className="w-5 h-5 text-muted-foreground" />
              <span className="text-muted-foreground">3. Start Detection</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Add Video Source</CardTitle>
            <CardDescription>Upload a video file or connect to a live camera</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="video" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="video">
                  <VideoIcon className="w-4 h-4 mr-2" />
                  Video File
                </TabsTrigger>
                <TabsTrigger value="camera">
                  <Camera className="w-4 h-4 mr-2" />
                  Live Camera
                </TabsTrigger>
                <TabsTrigger value="saved">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Saved Feeds
                </TabsTrigger>
              </TabsList>

              <TabsContent value="video" className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="video-upload"
                    data-testid="input-video-file"
                  />
                  <label htmlFor="video-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {videoFile ? videoFile.name : 'Click to select video file'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supported formats: MP4, AVI, MOV, MKV, WebM
                    </p>
                  </label>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={!videoFile || uploadMutation.isPending}
                  className="w-full hover-elevate active-elevate-2"
                  data-testid="button-upload-video"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload Video'}
                </Button>
              </TabsContent>

              <TabsContent value="camera" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="camera-name">Camera Name</Label>
                    <Input
                      id="camera-name"
                      placeholder="e.g., Main Entrance"
                      value={cameraName}
                      onChange={(e) => setCameraName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="stream-type">Stream Type</Label>
                    <Select value={streamType} onValueChange={setStreamType}>
                      <SelectTrigger id="stream-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rtsp">RTSP</SelectItem>
                        <SelectItem value="http">HTTP/MJPEG</SelectItem>
                        <SelectItem value="webcam">Webcam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="stream-url">Stream URL</Label>
                    <Input
                      id="stream-url"
                      placeholder={streamType === 'rtsp' ? 'rtsp://username:password@ip:port/stream' : streamType === 'webcam' ? '0 (device index)' : 'http://ip:port/stream'}
                      value={streamUrl}
                      onChange={(e) => setStreamUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {streamType === 'rtsp' && 'Example: rtsp://admin:password@192.168.1.100:554/stream1'}
                      {streamType === 'http' && 'Example: http://192.168.1.100:8080/video'}
                      {streamType === 'webcam' && 'Enter device index (usually 0 for default webcam)'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAddCamera}
                  disabled={addCameraMutation.isPending}
                  className="w-full hover-elevate active-elevate-2"
                >
                  {addCameraMutation.isPending ? 'Connecting...' : 'Add Camera'}
                </Button>
              </TabsContent>

              <TabsContent value="saved" className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Saved Feed</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {videos?.map((video) => (
                      <div
                        key={video.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent ${uploadedVideo?.id === video.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                        onClick={() => loadVideoAndZones(video)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full">
                              {video.sourceType === 'file' ? <VideoIcon className="w-4 h-4 text-primary" /> : <Camera className="w-4 h-4 text-primary" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{video.filename}</p>
                              <p className="text-xs text-muted-foreground capitalize">{video.sourceType}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {uploadedVideo?.id === video.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this feed?')) {
                                  deleteVideoMutation.mutate(video.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!videos || videos.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No saved feeds found.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>


            </Tabs>
            {uploadedVideo && uploadedVideo.sourceType === 'file' && (
              <video
                ref={videoRef}
                src={uploadedVideo.filepath.startsWith('http') ? uploadedVideo.filepath : `/uploads/${uploadedVideo.filename}`}
                className="absolute opacity-0 -z-10 w-px h-px"
                controls
                preload="auto"
                muted
                playsInline
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Draw Queue Zones</CardTitle>
            <CardDescription>Click on the video to define queue boundaries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setIsDrawing(!isDrawing)}
                variant={isDrawing ? "default" : "outline"}
                disabled={!uploadedVideo}
                data-testid="button-toggle-drawing"
                className="hover-elevate active-elevate-2"
              >
                {isDrawing ? 'Stop Drawing' : 'Start Drawing'}
              </Button>
              <Button
                onClick={completePolygon}
                disabled={currentPolygon.length < 3}
                variant="outline"
                data-testid="button-complete-polygon"
                className="hover-elevate active-elevate-2"
              >
                Complete Queue
              </Button>
              <Button
                onClick={undoLastPoint}
                disabled={currentPolygon.length === 0}
                variant="outline"
                data-testid="button-undo-point"
                className="hover-elevate active-elevate-2"
              >
                Undo Point
              </Button>
              <Button
                onClick={clearLastPolygon}
                disabled={polygons.length === 0}
                variant="outline"
                data-testid="button-clear-polygon"
                className="hover-elevate active-elevate-2"
              >
                Clear Last Queue
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Left-click to add points to define queue boundary</p>
              <p>• Right-click to complete queue (min 3 points)</p>
              <p>• Queues defined: {polygons.length}</p>
            </div>
            <Button
              onClick={saveZones}
              disabled={polygons.length === 0 || saveZonesMutation.isPending}
              className="w-full hover-elevate active-elevate-2 mb-2"
              data-testid="button-save-zones"
            >
              {saveZonesMutation.isPending ? 'Saving...' : `Save ${polygons.length} Queue Zone${polygons.length !== 1 ? 's' : ''}`}
            </Button>

            {uploadedVideo && polygons.length > 0 && (
              <Button
                onClick={() => startDetectionMutation.mutate(uploadedVideo.id)}
                disabled={startDetectionMutation.isPending}
                variant="secondary"
                className="w-full hover-elevate active-elevate-2"
                data-testid="button-start-detection"
              >
                {startDetectionMutation.isPending ? 'Starting...' : 'Start Detection (Use Saved Zones)'}
              </Button>
            )}

            {polygons.length > 0 && (
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  className="w-full hover-elevate active-elevate-2 mt-2"
                  data-testid="button-go-dashboard"
                >
                  Go to Dashboard
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {
        uploadedVideo && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Video Canvas</CardTitle>
              <CardDescription>Click to draw queue zone polygons</CardDescription>
            </CardHeader>
            <CardContent>
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleCanvasClick}
                onContextMenu={handleCanvasRightClick}
                className="w-full rounded-lg border border-border cursor-crosshair"
                style={{ maxHeight: '600px' }}
                data-testid="canvas-polygon-draw"
              />
            </CardContent>
          </Card>
        )
      }
    </div >
  );
}
