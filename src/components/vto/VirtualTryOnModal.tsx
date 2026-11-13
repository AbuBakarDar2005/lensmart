import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, X, RotateCcw, Download, Sparkles, Check, Eye, ShieldCheck, ShoppingBag, Sliders, Box, Layers, RefreshCw, Crosshair, Image as ImageIcon } from 'lucide-react';
import { Product, ColorVariant } from '../../types';
import { ThreeGlassesScene } from './ThreeGlassesScene';
import { FaceTracker, TrackedFace } from './faceTracker';
import { drawGlassesImageOnCanvas, VTO_PNG_MODELS, VtoPngModel } from './glassesDrawings';
import { DEFAULT_PRODUCTS } from '../../data/defaultProducts';
import { formatCurrency } from '../../utils/format';
import { trackEvent } from '../../utils/analytics';

interface VirtualTryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProduct?: Product | null;
  currency: 'PKR' | 'USD';
  exchangeRate: number;
  onAddToCart: (product: Product, color: ColorVariant) => void;
}

const SAMPLE_MODELS = [
  { id: 'm1', name: 'Oval Face', shape: 'Oval', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=640&q=80' },
  { id: 'm2', name: 'Square Jaw', shape: 'Square', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=640&q=80' },
  { id: 'm3', name: 'Round Contour', shape: 'Round', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=640&q=80' }
];

// Map product types or shapes to high-res PNG overlays
function mapProductToPng(product: Product): string {
  const shape = (product.frameShape || '').toLowerCase();
  const type = (product.vtoOverlayType || '').toLowerCase();
  const cat = (product.category || '').toLowerCase();

  if (shape.includes('aviator') || type.includes('aviator')) {
    return '/vto-glasses/02_aviator_gold.png';
  }
  if (shape.includes('cat') || type.includes('cateye')) {
    return '/vto-glasses/glass2.png';
  }
  if (shape.includes('round') || type.includes('round') || shape.includes('rimless')) {
    return '/vto-glasses/03_retro_round.png';
  }
  if (cat.includes('blue') || shape.includes('sport') || shape.includes('wrap')) {
    return '/vto-glasses/04_sport_polarized.png';
  }
  return '/vto-glasses/01_classic_wayfarer.png';
}

export const VirtualTryOnModal: React.FC<VirtualTryOnModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProduct,
  currency,
  exchangeRate,
  onAddToCart
}) => {
  const safeProducts = products && products.length > 0 ? products : DEFAULT_PRODUCTS;
  const initialFallback = initialProduct || safeProducts[0] || DEFAULT_PRODUCTS[0];

  const [selectedProduct, setSelectedProduct] = useState<Product>(initialFallback);
  const [selectedColor, setSelectedColor] = useState<ColorVariant>(
    initialFallback.colors?.[0] || { name: 'Classic Black', hex: '#121215' }
  );
  const [mode, setMode] = useState<'webcam' | 'photo'>('webcam');
  const [engineMode, setEngineMode] = useState<'png2d' | 'threejs'>('png2d');
  const [activePngModel, setActivePngModel] = useState<string>(mapProductToPng(initialFallback));
  const [showAiLandmarks, setShowAiLandmarks] = useState<boolean>(true);
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);

  const [scale, setScale] = useState<number>(initialFallback.vtoScaleMultiplier || 1.0);
  const [verticalOffset, setVerticalOffset] = useState<number>(initialFallback.vtoVerticalOffset || 0);
  const [pitch, setPitch] = useState<number>(0);
  const [yaw, setYaw] = useState<number>(0);
  const [roll, setRoll] = useState<number>(0);
  const [is360Inspect, setIs360Inspect] = useState<boolean>(false);
  const [isBeforeAfter, setIsBeforeAfter] = useState<boolean>(false);
  const [webcamActive, setWebcamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedPD, setDetectedPD] = useState<number>(63);
  const [snapshotTaken, setSnapshotTaken] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeContainerRef = useRef<HTMLDivElement | null>(null);
  const threeSceneRef = useRef<ThreeGlassesScene | null>(null);
  const photoImageRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Computer Vision Face Tracker
  const faceTrackerRef = useRef<FaceTracker>(new FaceTracker());
  const latestTrackedFaceRef = useRef<TrackedFace | null>(null);

  // Preloaded PNG Glasses Images Cache
  const pngImagesCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Preload PNG models
  useEffect(() => {
    VTO_PNG_MODELS.forEach((m) => {
      if (!pngImagesCacheRef.current.has(m.path)) {
        const img = new Image();
        img.src = m.path;
        pngImagesCacheRef.current.set(m.path, img);
      }
    });
  }, []);

  // Keep active product in sync if initialProduct or products update
  useEffect(() => {
    if (initialProduct) {
      setSelectedProduct(initialProduct);
      setSelectedColor(initialProduct.colors?.[0] || { name: 'Classic Black', hex: '#121215' });
      setScale(initialProduct.vtoScaleMultiplier || 1.0);
      setVerticalOffset(initialProduct.vtoVerticalOffset || 0);
      setActivePngModel(mapProductToPng(initialProduct));
    } else if (!selectedProduct && safeProducts.length > 0) {
      setSelectedProduct(safeProducts[0]);
      setSelectedColor(safeProducts[0].colors?.[0] || { name: 'Classic Black', hex: '#121215' });
      setActivePngModel(mapProductToPng(safeProducts[0]));
    }
  }, [initialProduct, products]);

  // Mount Three.js Scene safely
  useEffect(() => {
    if (isOpen && threeContainerRef.current && !threeSceneRef.current) {
      try {
        threeSceneRef.current = new ThreeGlassesScene(threeContainerRef.current);
      } catch (err) {
        console.warn("Could not instantiate ThreeGlassesScene:", err);
      }
    }

    return () => {
      if (threeSceneRef.current) {
        try {
          threeSceneRef.current.destroy();
        } catch (e) {}
        threeSceneRef.current = null;
      }
    };
  }, [isOpen]);

  // Update 3D Glasses Model when product or color changes
  useEffect(() => {
    if (threeSceneRef.current && selectedProduct && selectedColor) {
      try {
        threeSceneRef.current.updateGlasses({
          type: selectedProduct.vtoOverlayType || 'square_acetate',
          colorHex: selectedColor.hex || '#121215',
          scale: scale * (selectedProduct.vtoScaleMultiplier || 1.0),
          verticalOffset: verticalOffset + (selectedProduct.vtoVerticalOffset || 0),
          pitch,
          yaw,
          roll,
          lensTint: selectedProduct.category === 'Sunglasses' ? '#1c2538' : undefined
        });
      } catch (err) {
        console.warn("Could not update 3D glasses model:", err);
      }
    }
  }, [selectedProduct, selectedColor, scale, verticalOffset, pitch, yaw, roll]);

  // Toggle 360 inspect
  useEffect(() => {
    if (threeSceneRef.current) {
      try {
        threeSceneRef.current.set360Inspect(is360Inspect);
      } catch (e) {}
    }
  }, [is360Inspect]);

  useEffect(() => {
    if (isOpen) {
      trackEvent('try_on_launched', { productId: selectedProduct?.id, title: selectedProduct?.title, engine: engineMode });
      if (mode === 'webcam') {
        startCamera();
      }
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, mode]);

  // Camera Management
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Video play aborted or failed:", e));
      }
      setWebcamActive(true);
    } catch (err: any) {
      console.warn("Camera access denied or unavailable:", err);
      setCameraError("Camera unavailable. Switched to Photo Mode.");
      setMode('photo');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setWebcamActive(false);
  };

  // Real-Time Computer Vision Tracking & Rendering Loop
  const renderLoop = useCallback(async () => {
    const canvas = backgroundCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    let sourceElement: HTMLVideoElement | HTMLImageElement | null = null;

    if (mode === 'webcam' && videoRef.current && videoRef.current.readyState >= 2) {
      sourceElement = videoRef.current;
      // Draw mirrored webcam frame
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, width, height);
      ctx.restore();
    } else if (mode === 'photo' && photoImageRef.current) {
      sourceElement = photoImageRef.current;
      ctx.drawImage(photoImageRef.current, 0, 0, width, height);
    }

    if (sourceElement) {
      // 1. Run Computer Vision Face Tracking
      const face: TrackedFace = await faceTrackerRef.current.track(sourceElement, width, height);
      latestTrackedFaceRef.current = face;

      if (face.detected) {
        setIsFaceDetected(true);
        setDetectedPD(face.ipdMm);

        const effRoll = face.roll + roll;
        const effPitch = face.pitch + pitch;
        const effYaw = face.yaw + yaw;
        const effScale = (scale * (selectedProduct?.vtoScaleMultiplier || 1.0)) * (face.eyeDistance / (width * 0.22));
        const centerX = face.noseBridge.x;
        const centerY = face.noseBridge.y + verticalOffset;

        // 2. Render Glasses Overlay if not in "Before/After" preview
        if (!isBeforeAfter) {
          if (engineMode === 'threejs' && threeSceneRef.current && !is360Inspect) {
            try {
              threeSceneRef.current.setPose(centerX, centerY, effPitch, effYaw, effRoll, effScale);
            } catch (e) {}
          } else if (engineMode === 'png2d') {
            // Draw high-resolution PNG glasses directly on canvas
            const pngImg = pngImagesCacheRef.current.get(activePngModel);
            if (pngImg) {
              drawGlassesImageOnCanvas(ctx, {
                image: pngImg,
                leftEye: face.leftEye,
                rightEye: face.rightEye,
                scale: scale * (selectedProduct?.vtoScaleMultiplier || 1.0),
                verticalOffset: verticalOffset,
                rollAngle: effRoll,
                colorTintHex: selectedColor?.hex
              });
            }
          }
        }

        // 3. Optional AI Computer Vision Landmarks & Bounding Box HUD
        if (showAiLandmarks && !isBeforeAfter) {
          drawAiLandmarks(ctx, face);
        }
      } else {
        setIsFaceDetected(false);
      }
    }

    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [mode, engineMode, activePngModel, showAiLandmarks, isBeforeAfter, is360Inspect, scale, verticalOffset, pitch, yaw, roll, selectedProduct, selectedColor]);

  useEffect(() => {
    if (isOpen) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, renderLoop]);

  // Load sample photo model on photo mode
  useEffect(() => {
    if (mode === 'photo' && !photoImageRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = SAMPLE_MODELS[0].url;
      img.onload = () => { photoImageRef.current = img; };
    }
  }, [mode]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          photoImageRef.current = img;
          setMode('photo');
          stopCamera();
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // High-Resolution Snapshot Capture
  const handleCaptureSnapshot = () => {
    const bgCanvas = backgroundCanvasRef.current;
    if (!bgCanvas) return;

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = bgCanvas.width;
    compositeCanvas.height = bgCanvas.height;
    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw canvas background and any 2D overlay
    ctx.drawImage(bgCanvas, 0, 0);

    // 2. If Three.js 3D is active, composite the 3D WebGL buffer on top
    if (engineMode === 'threejs' && threeSceneRef.current) {
      const threeDataUrl = threeSceneRef.current.captureSnapshot();
      const threeImg = new Image();
      threeImg.onload = () => {
        ctx.drawImage(threeImg, 0, 0);
        // Watermark badge
        drawWatermark(ctx, compositeCanvas.width, compositeCanvas.height);
        setSnapshotTaken(compositeCanvas.toDataURL('image/jpeg', 0.95));
      };
      threeImg.src = threeDataUrl;
    } else {
      drawWatermark(ctx, compositeCanvas.width, compositeCanvas.height);
      setSnapshotTaken(compositeCanvas.toDataURL('image/jpeg', 0.95));
    }
  };

  const drawWatermark = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.fillStyle = 'rgba(11, 37, 69, 0.85)';
    ctx.fillRect(w - 210, h - 38, 200, 30);
    ctx.fillStyle = '#00c49f';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('LENS MART • AI Virtual Try-On', w - 198, h - 18);
    ctx.restore();
  };

  const downloadSnapshot = () => {
    if (!snapshotTaken) return;
    const link = document.createElement('a');
    link.download = `lens-mart-tryon-${selectedProduct.title.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    link.href = snapshotTaken;
    link.click();
  };

  // Draw futuristic cyber-cyan tracking indicators on the face
  const drawAiLandmarks = (ctx: CanvasRenderingContext2D, face: TrackedFace) => {
    ctx.save();
    const { box, leftEye, rightEye, noseBridge, ipdMm } = face;

    // Corner brackets on face bounding box
    const bracketLen = 14;
    ctx.strokeStyle = '#00b4d8';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 4;

    // Top-Left Corner
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + bracketLen);
    ctx.lineTo(box.x, box.y);
    ctx.lineTo(box.x + bracketLen, box.y);
    ctx.stroke();

    // Top-Right Corner
    ctx.beginPath();
    ctx.moveTo(box.x + box.width - bracketLen, box.y);
    ctx.lineTo(box.x + box.width, box.y);
    ctx.lineTo(box.x + box.width, box.y + bracketLen);
    ctx.stroke();

    // Bottom-Left Corner
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.height - bracketLen);
    ctx.lineTo(box.x, box.y + box.height);
    ctx.lineTo(box.x + bracketLen, box.y + box.height);
    ctx.stroke();

    // Bottom-Right Corner
    ctx.beginPath();
    ctx.moveTo(box.x + box.width - bracketLen, box.y + box.height);
    ctx.lineTo(box.x + box.width, box.y + box.height);
    ctx.lineTo(box.x + box.width, box.y + box.height - bracketLen);
    ctx.stroke();

    // Eye Crosshairs
    const drawCross = (pt: { x: number; y: number }) => {
      const s = 5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pt.x - s, pt.y);
      ctx.lineTo(pt.x + s, pt.y);
      ctx.moveTo(pt.x, pt.y - s);
      ctx.lineTo(pt.x, pt.y + s);
      ctx.stroke();
    };

    drawCross(leftEye);
    drawCross(rightEye);

    // Pupillary Distance dashed connection line
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(leftEye.x, leftEye.y);
    ctx.lineTo(rightEye.x, rightEye.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Nose Bridge alignment dot
    ctx.fillStyle = '#00c49f';
    ctx.beginPath();
    ctx.arc(noseBridge.x, noseBridge.y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Mini tracking badge above face
    ctx.fillStyle = 'rgba(11, 37, 69, 0.75)';
    ctx.fillRect(box.x, box.y - 20, 115, 16);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`AI LOCK • IPD ${ipdMm}mm`, box.x + 4, box.y - 8);

    ctx.restore();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-lens-navy/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-lens-cyan/20">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-lens-navy/10 bg-gradient-to-r from-lens-navy/5 via-white to-lens-cyan/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-lens-navy text-lens-cyan flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-lens-cyan animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-base sm:text-lg text-lens-navy">LENS MART Virtual Try-On</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-lens-cyan/10 text-lens-cyan border border-lens-cyan/30">
                  CV Face-Track
                </span>
              </div>
              <p className="text-[11px] text-gray-500">Real-time computer vision tracking, optical calibration & live mirror</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => { setMode('webcam'); startCamera(); }}
                className={`px-2.5 sm:px-3 py-1 rounded-md flex items-center gap-1.5 transition-all text-xs ${
                  mode === 'webcam' ? 'bg-lens-navy text-white shadow-sm' : 'text-gray-600 hover:text-lens-navy'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-lens-cyan" /> Live Webcam
              </button>
              <button
                onClick={() => { setMode('photo'); stopCamera(); }}
                className={`px-2.5 sm:px-3 py-1 rounded-md flex items-center gap-1.5 transition-all text-xs ${
                  mode === 'photo' ? 'bg-lens-navy text-white shadow-sm' : 'text-gray-600 hover:text-lens-navy'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-lens-cyan" /> Photo / Model
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-lens-navy hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
          
          {/* Viewport Canvas (7 Cols) */}
          <div className="lg:col-span-7 bg-lens-navy flex flex-col items-center justify-center p-3 sm:p-4 relative min-h-[340px] sm:min-h-[460px]">
            
            <video ref={videoRef} className="hidden" playsInline muted autoPlay />

            {/* Interactive Viewport Container */}
            <div className="relative w-full max-w-[560px] aspect-[4/3] rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black flex items-center justify-center">
              
              {/* Background Video / Photo & 2D Glasses Canvas */}
              <canvas
                ref={backgroundCanvasRef}
                width={640}
                height={480}
                className="w-full h-full object-cover"
              />

              {/* Three.js 3D WebGL Canvas Overlay (Only visible in 3D Mode) */}
              <div
                ref={threeContainerRef}
                className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${
                  engineMode === 'threejs' && !isBeforeAfter ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Status & IPD Metric Badge */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
                <div className="bg-lens-navy/85 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[11px] flex items-center gap-2 border border-white/10 shadow-lg">
                  <span className={`w-2 h-2 rounded-full ${isFaceDetected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span>{isFaceDetected ? 'Face Locked' : 'Scanning Face...'}</span>
                  <span className="text-gray-400">•</span>
                  <span>IPD: <strong className="text-lens-teal">{detectedPD} mm</strong></span>
                </div>
              </div>

              {/* Engine Switcher Badge */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  onClick={() => setEngineMode(engineMode === 'png2d' ? 'threejs' : 'png2d')}
                  className="bg-lens-navy/85 hover:bg-lens-navy text-white px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 border border-lens-cyan/30 shadow-md backdrop-blur-md transition-all active:scale-95"
                  title="Toggle between HD 2D Realistic and 3D WebGL Engine"
                >
                  {engineMode === 'png2d' ? (
                    <>
                      <ImageIcon className="w-3.5 h-3.5 text-lens-cyan" />
                      <span>HD Optical (2D)</span>
                    </>
                  ) : (
                    <>
                      <Box className="w-3.5 h-3.5 text-lens-mint" />
                      <span>WebGL 3D Mesh</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowAiLandmarks(!showAiLandmarks)}
                  className={`p-1.5 rounded-full border text-[10px] backdrop-blur-md transition-all ${
                    showAiLandmarks
                      ? 'bg-lens-cyan text-lens-navy border-lens-cyan shadow-sm'
                      : 'bg-lens-navy/80 text-white/80 border-white/20 hover:text-white'
                  }`}
                  title="Toggle Computer Vision AI Tracking Crosshairs"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Floating Toolbar */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsBeforeAfter(!isBeforeAfter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md transition-all ${
                      isBeforeAfter
                        ? 'bg-lens-cyan text-lens-navy shadow-md'
                        : 'bg-black/60 text-white/90 hover:bg-black/80 border border-white/10'
                    }`}
                  >
                    {isBeforeAfter ? 'Original Face' : 'Glasses On'}
                  </button>

                  {engineMode === 'threejs' && (
                    <button
                      onClick={() => setIs360Inspect(!is360Inspect)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md flex items-center gap-1 transition-all ${
                        is360Inspect
                          ? 'bg-lens-cyan text-lens-navy shadow-md'
                          : 'bg-black/60 text-white/90 hover:bg-black/80 border border-white/10'
                      }`}
                      title="Rotate 360° to inspect 3D frame details and hinges"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${is360Inspect ? 'animate-spin' : ''}`} />
                      <span>360° Spin</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleCaptureSnapshot}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-lens-cyan to-lens-teal text-lens-navy hover:brightness-110 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5 text-lens-navy" /> Save Photo
                </button>
              </div>
            </div>

            {/* Error Message */}
            {cameraError && (
              <div className="mt-2 text-xs text-amber-300 bg-amber-950/60 px-4 py-1.5 rounded-lg border border-amber-800 text-center max-w-md">
                {cameraError}
              </div>
            )}

            {/* Model Presets */}
            {mode === 'photo' && (
              <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-300">
                <span>Preset Models:</span>
                <div className="flex gap-1.5">
                  {SAMPLE_MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.src = m.url;
                        img.onload = () => { photoImageRef.current = img; };
                      }}
                      className="px-2.5 py-1 rounded bg-lens-navy/80 border border-white/10 text-white hover:bg-lens-cyan hover:text-lens-navy text-[11px] transition-colors"
                    >
                      {m.shape}
                    </button>
                  ))}
                  <label className="cursor-pointer px-2.5 py-1 rounded bg-lens-cyan text-lens-navy font-semibold hover:bg-lens-teal text-[11px] flex items-center gap-1 transition-colors">
                    <Upload className="w-3 h-3" /> Upload Face
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Right Product Controls (5 Cols) */}
          <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between bg-white overflow-y-auto">
            <div>
              {/* Product Info */}
              <div className="border-b border-gray-100 pb-3 mb-3">
                <span className="text-[11px] uppercase tracking-wider font-bold text-lens-cyan">
                  {selectedProduct.category} • {selectedProduct.frameShape}
                </span>
                <h4 className="font-serif text-xl sm:text-2xl font-bold text-lens-navy mt-0.5">
                  {selectedProduct.title}
                </h4>
                <div className="flex items-baseline gap-3 mt-1.5">
                  <span className="text-xl sm:text-2xl font-bold text-lens-navy">
                    {formatCurrency(selectedProduct.salePrice || selectedProduct.basePrice, currency, exchangeRate)}
                  </span>
                  {selectedProduct.salePrice && (
                    <span className="text-xs line-through text-gray-400">
                      {formatCurrency(selectedProduct.basePrice, currency, exchangeRate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Color Switcher */}
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Color / Finish: <span className="text-lens-navy normal-case font-bold">{selectedColor.name}</span>
                </label>
                <div className="flex items-center gap-2">
                  {selectedProduct.colors.map(color => (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                        selectedColor.name === color.name
                          ? 'border-lens-navy scale-110 shadow-md ring-2 ring-lens-cyan/30'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {selectedColor.name === color.name && (
                        <Check className={`w-3.5 h-3.5 ${color.hex === '#121215' || color.hex === '#0f0f11' ? 'text-white' : 'text-lens-navy'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optical Calibration Sliders */}
              <div className="bg-gray-50 p-3.5 rounded-xl mb-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-lens-navy flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-lens-cyan" /> Optical Size & Bridge Fit
                  </span>
                  <button
                    onClick={() => {
                      setScale(selectedProduct.vtoScaleMultiplier || 1.0);
                      setVerticalOffset(selectedProduct.vtoVerticalOffset || 0);
                      setPitch(0);
                      setYaw(0);
                      setRoll(0);
                    }}
                    className="text-[11px] text-gray-500 hover:text-lens-navy flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Frame Scale</span>
                      <span className="font-mono font-medium">{Math.round(scale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.3"
                      step="0.02"
                      value={scale}
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                      className="w-full accent-lens-cyan cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Nose Bridge Height (Y)</span>
                      <span className="font-mono font-medium">{verticalOffset > 0 ? `+${verticalOffset}px` : `${verticalOffset}px`}</span>
                    </div>
                    <input
                      type="range"
                      min="-25"
                      max="25"
                      step="1"
                      value={verticalOffset}
                      onChange={(e) => setVerticalOffset(parseInt(e.target.value))}
                      className="w-full accent-lens-cyan cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Try Different Glasses Styles */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Switch Eyewear Models:
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {VTO_PNG_MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setActivePngModel(m.path);
                        const matched = products.find(p => p.frameShape?.toLowerCase().includes(m.shape.toLowerCase()));
                        if (matched) {
                          setSelectedProduct(matched);
                          setSelectedColor(matched.colors[0]);
                        }
                      }}
                      className={`p-1 rounded-lg border text-center transition-all ${
                        activePngModel === m.path
                          ? 'border-lens-cyan bg-lens-cyan/10 shadow-sm'
                          : 'border-gray-200 hover:border-gray-400 bg-white'
                      }`}
                      title={m.name}
                    >
                      <img src={m.path} alt={m.name} className="w-full h-8 object-contain mb-0.5" />
                      <p className="text-[9px] font-semibold text-lens-navy truncate">{m.shape}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-gray-100 mt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  onAddToCart(selectedProduct, selectedColor);
                  trackEvent('add_to_cart', { productId: selectedProduct.id, title: selectedProduct.title });
                }}
                className="w-full py-3 bg-lens-navy hover:bg-lens-navy/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99]"
              >
                <ShoppingBag className="w-4 h-4 text-lens-cyan" />
                Add to Cart ({formatCurrency(selectedProduct.salePrice || selectedProduct.basePrice, currency, exchangeRate)})
              </button>
              <p className="text-center text-[10px] text-gray-400">
                100% UV Protection • Includes premium leather case & microfiber cloth
              </p>
            </div>
          </div>
        </div>

        {/* Snapshot Modal */}
        {snapshotTaken && (
          <div className="absolute inset-0 bg-lens-navy/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl max-w-md w-full shadow-2xl text-center border border-lens-cyan/30">
              <h4 className="font-serif text-xl font-bold text-lens-navy mb-1">Virtual Try-On Snapshot</h4>
              <p className="text-xs text-gray-500 mb-4">Wearing {selectedProduct.title} ({selectedColor.name})</p>
              
              <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200 mb-4">
                <img src={snapshotTaken} alt="Snapshot Preview" className="w-full object-cover" />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={downloadSnapshot}
                  className="flex-1 py-2.5 bg-lens-navy hover:bg-lens-navy/90 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4 text-lens-cyan" /> Save Photo
                </button>
                <button
                  onClick={() => setSnapshotTaken(null)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
