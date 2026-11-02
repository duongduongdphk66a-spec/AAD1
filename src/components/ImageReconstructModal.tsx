import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Sparkles,
  Mountain,
  Layers,
  Check,
  X,
  Sliders,
  Compass,
} from 'lucide-react';
import {
  BiomeId,
  BIOMES,
  GRID_SIZE,
  PlacedObject,
  PrefabId,
  PREFAB_CATALOG,
  WORLD_SIZE,
} from '../world/registry';
import { getGroundHeightAt } from '../world/sculpting';
import {
  reconstructFromRgbaBuffer,
  ReconstructedWorldData,
} from '../world/generation';
import {
  SAMPLE_PHOTO_PRESETS,
  SamplePhotoPreset,
  renderSamplePresetToDataUrl,
} from '../world/samplePhotos';

interface ImageReconstructModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyReconstruction: (payload: {
    heightMap: Float32Array;
    splatMap: Uint8Array;
    colorMap: Float32Array;
    biomeId: BiomeId;
    placedObjects: PlacedObject[];
    regionTitle: string;
    summaryText: string;
  }) => void;
}

export const ImageReconstructModal: React.FC<ImageReconstructModalProps> = ({
  isOpen,
  onClose,
  onApplyReconstruction,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('island_volcano_ref');
  const [customImageName, setCustomImageName] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [heightmapPreviewUrl, setHeightmapPreviewUrl] = useState<string>('');
  const [mode, setMode] = useState<'both' | 'terrain' | 'object'>('both');
  const [cropMode, setCropMode] = useState<'fill' | 'fit'>('fill');
  const [reliefScale, setReliefScale] = useState<number>(1.35);
  const [terraceSteps, setTerraceSteps] = useState<number>(0);
  const [overrideBiome, setOverrideBiome] = useState<BiomeId | 'auto'>('auto');

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiSourceLabel, setAiSourceLabel] = useState<string>('Pixel Depth + AI Vision');
  const [regionTitle, setRegionTitle] = useState<string>('Thung Lũng Thảo Nguyên Phong Khởi');
  const [summaryText, setSummaryText] = useState<string>(
    'Hệ thống đã trích xuất bản đồ độ cao 161×161 đỉnh, phân tách vùng nước, sườn cỏ ngọc lục bảo và tự động đặt 9 vật thể 3D khớp với bố cục bức ảnh.'
  );
  const [reconstructed, setReconstructed] = useState<ReconstructedWorldData | null>(null);

  const rgbaBufferRef = useRef<{
    rgba: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);
  const loadedImageElementRef = useRef<HTMLImageElement | null>(null);
  const aiImageDataUrlRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const cancelPendingAiRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
  };

  // Helper to draw an image onto a square canvas using either 'fill' (center-crop) or 'fit' (proportional full frame with edge-clamped margins)
  const drawImageWithCropMode = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    targetSize: number,
    activeCropMode: 'fill' | 'fit',
    padWithEdgePixels = true
  ) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, targetSize, targetSize);
    const iw = Math.max(1, img.naturalWidth || img.width);
    const ih = Math.max(1, img.naturalHeight || img.height);
    if (activeCropMode === 'fit') {
      const scale = Math.min(targetSize / iw, targetSize / ih);
      const dw = Math.max(1, Math.round(iw * scale));
      const dh = Math.max(1, Math.round(ih * scale));
      const dx = Math.floor((targetSize - dw) * 0.5);
      const dy = Math.floor((targetSize - dh) * 0.5);
      if (padWithEdgePixels) {
        if (dy > 0) {
          ctx.drawImage(img, 0, 0, iw, 1, dx, 0, dw, dy);
          ctx.drawImage(img, 0, ih - 1, iw, 1, dx, dy + dh, dw, targetSize - (dy + dh));
        }
        if (dx > 0) {
          ctx.drawImage(img, 0, 0, 1, ih, 0, 0, dx, targetSize);
          ctx.drawImage(img, iw - 1, 0, 1, ih, dx + dw, 0, targetSize - (dx + dw), targetSize);
        }
      }
      ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
      return;
    }
    const scale = Math.max(targetSize / iw, targetSize / ih);
    const sw = targetSize / scale;
    const sh = targetSize / scale;
    const sx = (iw - sw) * 0.5;
    const sy = (ih - sh) * 0.5;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
  };

  // Helper to encode a high-resolution (up to 896px) JPEG matching the active cropMode for both preview & Gemini Vision
  const buildMatchedPreviewAndAiUrl = (
    img: HTMLImageElement,
    activeCropMode: 'fill' | 'fit',
    maxDimension = 896
  ): string => {
    const iw = Math.max(1, img.naturalWidth || img.width);
    const ih = Math.max(1, img.naturalHeight || img.height);
    if (activeCropMode === 'fit') {
      const scale = Math.min(1, maxDimension / Math.max(iw, ih));
      const outW = Math.max(1, Math.round(iw * scale));
      const outH = Math.max(1, Math.round(ih * scale));
      const aiCanvas = document.createElement('canvas');
      aiCanvas.width = outW;
      aiCanvas.height = outH;
      const aiCtx = aiCanvas.getContext('2d');
      if (!aiCtx) return '';
      aiCtx.fillStyle = '#0f172a';
      aiCtx.fillRect(0, 0, outW, outH);
      aiCtx.drawImage(img, 0, 0, iw, ih, 0, 0, outW, outH);
      return aiCanvas.toDataURL('image/jpeg', 0.86);
    }
    const targetDim = Math.max(1, Math.min(maxDimension, Math.max(iw, ih)));
    const aiCanvas = document.createElement('canvas');
    aiCanvas.width = targetDim;
    aiCanvas.height = targetDim;
    const aiCtx = aiCanvas.getContext('2d');
    if (!aiCtx) return '';
    drawImageWithCropMode(aiCtx, img, targetDim, 'fill', false);
    return aiCanvas.toDataURL('image/jpeg', 0.86);
  };

  // Render smooth vector-interpolated heightmap + contour preview to a 2D data URL
  const buildHeightmapPreview = (data: ReconstructedWorldData): string => {
    const srcSize = GRID_SIZE + 1;
    const offscreen = document.createElement('canvas');
    offscreen.width = srcSize;
    offscreen.height = srcSize;
    const offCtx = offscreen.getContext('2d')!;
    const imgData = offCtx.createImageData(srcSize, srcSize);

    for (let i = 0; i < srcSize * srcSize; i++) {
      const r = Math.round((data.colorMap[i * 3] ?? 0.3) * 255);
      const g = Math.round((data.colorMap[i * 3 + 1] ?? 0.6) * 255);
      const b = Math.round((data.colorMap[i * 3 + 2] ?? 0.3) * 255);
      imgData.data[i * 4] = r;
      imgData.data[i * 4 + 1] = g;
      imgData.data[i * 4 + 2] = b;
      imgData.data[i * 4 + 3] = 255;
    }
    offCtx.putImageData(imgData, 0, 0);

    const outSize = 320;
    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreen, 0, 0, outSize, outSize);

    // Overlay clean vector metric grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      const pos = (outSize / 4) * g;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, outSize);
      ctx.moveTo(0, pos);
      ctx.lineTo(outSize, pos);
      ctx.stroke();
    }

    return canvas.toDataURL('image/png');
  };

  const runLocalReconstruction = (
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    nextRelief: number,
    nextTerrace: number,
    nextBiome: BiomeId | 'auto',
    nextMode: 'both' | 'terrain' | 'object'
  ) => {
    const result = reconstructFromRgbaBuffer(rgba, width, height, {
      reliefScale: nextRelief,
      terraceSteps: nextTerrace,
      overrideBiome: nextBiome === 'auto' ? undefined : nextBiome,
      mode: nextMode,
    });
    setReconstructed(result);
    setHeightmapPreviewUrl(buildHeightmapPreview(result));
    return result;
  };

  const loadPresetWithOptionalImage = (
    preset: SamplePhotoPreset,
    nextRelief: number,
    nextTerrace: number,
    nextBiome: BiomeId | 'auto',
    nextMode: 'both' | 'terrain' | 'object'
  ) => {
    cancelPendingAiRequest();
    loadedImageElementRef.current = null;
    setUploadError(null);
    setAiNotice(null);
    const rendered = renderSamplePresetToDataUrl(preset, 160);
    rgbaBufferRef.current = {
      rgba: rendered.rgba,
      width: rendered.width,
      height: rendered.height,
    };
    aiImageDataUrlRef.current = rendered.dataUrl;
    setPreviewDataUrl(preset.imageUrl || rendered.dataUrl);
    setRegionTitle(preset.title);
    setSummaryText(preset.description);
    runLocalReconstruction(
      rendered.rgba,
      rendered.width,
      rendered.height,
      nextRelief,
      nextTerrace,
      nextBiome,
      nextMode
    );

    if (preset.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImageElementRef.current = img;
        const canvas = document.createElement('canvas');
        const targetSize = 160;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        drawImageWithCropMode(ctx, img, targetSize, cropMode);
        const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
        rgbaBufferRef.current = {
          rgba: imgData.data,
          width: targetSize,
          height: targetSize,
        };
        const highResUrl = buildMatchedPreviewAndAiUrl(img, cropMode, 896);
        if (highResUrl) {
          aiImageDataUrlRef.current = highResUrl;
          setPreviewDataUrl(highResUrl);
        }
        runLocalReconstruction(
          imgData.data,
          targetSize,
          targetSize,
          nextRelief,
          nextTerrace,
          nextBiome,
          nextMode
        );
      };
      img.onerror = () => {
        // Keep procedural fallback already rendered above
      };
      img.src = preset.imageUrl;
    }
  };

  // Load initial preset when modal opens, and cancel pending AI requests on close/unmount
  useEffect(() => {
    if (!isOpen) {
      cancelPendingAiRequest();
      return;
    }
    const preset =
      SAMPLE_PHOTO_PRESETS.find((p) => p.id === selectedPresetId) || SAMPLE_PHOTO_PRESETS[0];
    loadPresetWithOptionalImage(preset, reliefScale, terraceSteps, overrideBiome, mode);
    return () => {
      cancelPendingAiRequest();
    };
  }, [isOpen]);

  // Re-run local pixel heightfield whenever sliders change
  const handleParamChange = (
    nextRelief: number,
    nextTerrace: number,
    nextBiome: BiomeId | 'auto',
    nextMode: 'both' | 'terrain' | 'object'
  ) => {
    setReliefScale(nextRelief);
    setTerraceSteps(nextTerrace);
    setOverrideBiome(nextBiome);
    setMode(nextMode);
    if (rgbaBufferRef.current) {
      runLocalReconstruction(
        rgbaBufferRef.current.rgba,
        rgbaBufferRef.current.width,
        rgbaBufferRef.current.height,
        nextRelief,
        nextTerrace,
        nextBiome,
        nextMode
      );
    }
  };

  const handleSelectSample = (preset: SamplePhotoPreset) => {
    setSelectedPresetId(preset.id);
    setCustomImageName(null);
    setMode(preset.mode);
    loadPresetWithOptionalImage(
      preset,
      reliefScale,
      terraceSteps,
      overrideBiome,
      preset.mode
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    cancelPendingAiRequest();
    setUploadError(null);
    setAiNotice(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Định dạng tệp không hỗ trợ. Vui lòng chọn ảnh .JPG, .PNG, .WEBP hoặc .GIF.');
      return;
    }
    const maxBytes = 10 * 1024 * 1024; // 10 MB client source file limit (resized to 896px JPEG before upload)
    if (file.size > maxBytes) {
      setUploadError('Dung lượng ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError('Không thể đọc tệp ảnh từ thiết bị. Vui lòng thử lại.');
    };
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => {
        setUploadError('Tệp ảnh bị lỗi hoặc không thể giải mã. Vui lòng chọn ảnh khác.');
      };
      img.onload = () => {
        loadedImageElementRef.current = img;
        const canvas = document.createElement('canvas');
        const targetSize = 256;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        drawImageWithCropMode(ctx, img, targetSize, cropMode);
        const imgData = ctx.getImageData(0, 0, targetSize, targetSize);

        rgbaBufferRef.current = {
          rgba: imgData.data,
          width: targetSize,
          height: targetSize,
        };
        const highResAiUrl = buildMatchedPreviewAndAiUrl(img, cropMode, 896);
        aiImageDataUrlRef.current = highResAiUrl || canvas.toDataURL('image/jpeg', 0.92);
        setCustomImageName(file.name);
        setSelectedPresetId('custom');
        setPreviewDataUrl(aiImageDataUrlRef.current);

        const localResult = runLocalReconstruction(
          imgData.data,
          targetSize,
          targetSize,
          reliefScale,
          terraceSteps,
          overrideBiome,
          mode
        );
        setRegionTitle(`Vùng Đất Tái Tạo: ${file.name.replace(/\.[^.]+$/, '')}`);
        setSummaryText(
          `Đã phân tích ảnh "${file.name}" — phát hiện ${Math.round(
            localResult.metrics.greenRatio * 100
          )}% thảm thực vật, ${Math.round(
            localResult.metrics.waterRatio * 100
          )}% mặt nước và tạo ${localResult.detectedObjects.length} vật thể 3D.`
        );
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCropModeChange = (nextCropMode: 'fill' | 'fit') => {
    cancelPendingAiRequest();
    setCropMode(nextCropMode);
    const img = loadedImageElementRef.current;
    if (!img) return;
    const targetSize = selectedPresetId === 'custom' ? 256 : 160;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawImageWithCropMode(ctx, img, targetSize, nextCropMode);
    const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
    rgbaBufferRef.current = {
      rgba: imgData.data,
      width: targetSize,
      height: targetSize,
    };
    const highResAiUrl = buildMatchedPreviewAndAiUrl(img, nextCropMode, 896);
    if (highResAiUrl) {
      aiImageDataUrlRef.current = highResAiUrl;
      setPreviewDataUrl(highResAiUrl);
    }
    runLocalReconstruction(
      imgData.data,
      targetSize,
      targetSize,
      reliefScale,
      terraceSteps,
      overrideBiome,
      mode
    );
  };

  const handleRunDeepAiScan = async () => {
    const payloadDataUrl = aiImageDataUrlRef.current || previewDataUrl;
    if (!rgbaBufferRef.current || !payloadDataUrl) return;
    cancelPendingAiRequest();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsAnalyzing(true);
    setUploadError(null);
    setAiNotice(null);

    try {
      const localResult = runLocalReconstruction(
        rgbaBufferRef.current.rgba,
        rgbaBufferRef.current.width,
        rgbaBufferRef.current.height,
        reliefScale,
        terraceSteps,
        overrideBiome,
        mode
      );

      const detectedMime = payloadDataUrl.startsWith('data:image/jpeg')
        ? 'image/jpeg'
        : payloadDataUrl.startsWith('data:image/webp')
        ? 'image/webp'
        : 'image/png';

      const response = await fetch('/api/reconstruct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          imageBase64: payloadDataUrl,
          mimeType: detectedMime,
          mode,
          clientMetrics: localResult.metrics,
        }),
      });

      const data = await response.json().catch(() => null);
      if (controller.signal.aborted) return;

      if (!response.ok) {
        const errMsg =
          data && typeof data.error === 'string'
            ? data.error
            : `Lỗi máy chủ (${response.status}) — đã giữ kết quả Pixel Depth Engine cục bộ.`;
        setAiNotice(errMsg);
        setAiSourceLabel('Pixel Depth & Chroma Engine');
        return;
      }

      if (data?.analysis) {
        const ai = data.analysis;
        const aiBiome: BiomeId =
          typeof ai.biome === 'string' && Object.hasOwn(BIOMES, ai.biome)
            ? (ai.biome as BiomeId)
            : localResult.metrics.suggestedBiome;

        const nextRelief =
          typeof ai.reliefScale === 'number' && Number.isFinite(ai.reliefScale)
            ? Math.max(0.6, Math.min(2.2, ai.reliefScale))
            : reliefScale;
        const nextTerrace =
          typeof ai.terraceSteps === 'number' && Number.isFinite(ai.terraceSteps)
            ? Math.max(0, Math.min(8, ai.terraceSteps))
            : terraceSteps;

        const updatedLocal = runLocalReconstruction(
          rgbaBufferRef.current.rgba,
          rgbaBufferRef.current.width,
          rgbaBufferRef.current.height,
          nextRelief,
          nextTerrace,
          aiBiome,
          mode
        );

        const validPrefabs = PREFAB_CATALOG.map((p) => p.id);
        const MAX_VILLAGE_COORD_M = 48;
        if (Array.isArray(ai.detectedObjects) && ai.detectedObjects.length > 0) {
          const aiPlaced: PlacedObject[] = ai.detectedObjects
            .slice(0, 16)
            .map((item: Record<string, unknown>, i: number) => {
              const pId = validPrefabs.includes(item.prefabId as PrefabId)
                ? (item.prefabId as PrefabId)
                : 'windmill_cottage';
              const rawX = Number(item.x);
              const rawZ = Number(item.z);
              const safeX = Number.isFinite(rawX) ? rawX : 0;
              const safeZ = Number.isFinite(rawZ) ? rawZ : 0;
              const wx = Math.max(-MAX_VILLAGE_COORD_M, Math.min(MAX_VILLAGE_COORD_M, safeX));
              const wz = Math.max(-MAX_VILLAGE_COORD_M, Math.min(MAX_VILLAGE_COORD_M, safeZ));
              const wy = getGroundHeightAt(
                updatedLocal.heightMap,
                GRID_SIZE,
                WORLD_SIZE,
                wx,
                wz
              );
              return {
                id: `ai-${i}-${pId}`,
                prefabId: pId,
                label: String(item.label || pId),
                x: Number(wx.toFixed(1)),
                y: Number(wy.toFixed(2)),
                z: Number(wz.toFixed(1)),
                scale: Math.max(0.75, Math.min(1.6, Number(item.scale) || 1.05)),
                rotationY: Number(item.rotationY) || 0,
              };
            });
          updatedLocal.detectedObjects = aiPlaced;
        }
        setReconstructed({ ...updatedLocal });

        setReliefScale(nextRelief);
        setTerraceSteps(nextTerrace);
        setOverrideBiome(aiBiome);
        setAiSourceLabel('Gemini Vision 3D + Pixel Heightfield');
        if (ai.regionName) setRegionTitle(ai.regionName);
        if (ai.summary) setSummaryText(ai.summary);
      } else {
        setAiSourceLabel('Pixel Depth & Chroma Engine');
        if (data && typeof data.warning === 'string') {
          setAiNotice(data.warning);
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setAiSourceLabel('Pixel Depth & Chroma Engine');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsAnalyzing(false);
      }
    }
  };

  const handleConfirmApply = () => {
    if (!reconstructed) return;
    const chosenBiome: BiomeId =
      overrideBiome === 'auto' ? reconstructed.metrics.suggestedBiome : overrideBiome;
    onApplyReconstruction({
      heightMap: new Float32Array(reconstructed.heightMap),
      splatMap: new Uint8Array(reconstructed.splatMap),
      colorMap: new Float32Array(reconstructed.colorMap),
      biomeId: chosenBiome,
      placedObjects: reconstructed.detectedObjects.map((o) => ({ ...o })),
      regionTitle,
      summaryText,
    });
    onClose();
  };

  if (!isOpen) return null;

  const activeBiomeId: BiomeId =
    overrideBiome === 'auto'
      ? reconstructed?.metrics.suggestedBiome || 'mondstadt_meadow'
      : overrideBiome;
  const activeBiome = BIOMES[activeBiomeId];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tái Tạo Địa Hình & Vật Thể 3D Từ Ảnh Thực Tế"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#111927] border border-slate-700/80 shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1420]">
          <div>
            <h2
              className="text-lg font-bold tracking-tight text-white flex items-center gap-2"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              <Sparkles className="w-5 h-5 text-amber-400" />
              Tái Tạo Địa Hình & Vật Thể 3D Từ Ảnh Thực Tế (10×10 km · Cao 1 km)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tải ảnh phong cảnh hoặc vật thể thực tế — tự động kiến tạo vùng lục địa 10×10km (100 km²) với độ cao tới 1.000m
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ tái tạo ảnh"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image Upload + Sample Real-World Presets */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                1. Tải Ảnh Thực Tế Của Bạn Lên
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="terrain-photo-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-dashed border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">
                  {customImageName
                    ? `Đã tải: ${customImageName} (Nhấn để đổi ảnh)`
                    : 'Chọn Ảnh Vùng Đất / Vật Thể (.JPG, .PNG)'}
                </span>
              </button>
              {uploadError && (
                <p
                  role="alert"
                  className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-[11px] text-amber-200"
                >
                  {uploadError}
                </p>
              )}
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-2">
                Hoặc Chọn Nhanh Mẫu Ảnh Phong Cảnh & Vật Thể:
              </span>
              <div className="grid grid-cols-1 gap-2">
                {SAMPLE_PHOTO_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectSample(preset)}
                      className={`text-left p-3 rounded-xl border transition-colors ${
                        isSelected
                          ? 'bg-slate-800/90 border-amber-400 text-white'
                          : 'bg-[#162032] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {preset.title}
                        </span>
                        <span className="text-[11px] text-amber-300 shrink-0">
                          {preset.mode === 'object' ? 'Vật thể' : 'Địa hình + Vật thể'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {preset.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reconstruction Parameters */}
            <div className="p-3.5 rounded-xl bg-[#162032] border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  Thông Số Chuyển Đổi 3D (10×10km)
                </span>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                  Trần 1.000m (1km)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-[#0d1420] p-1 rounded-lg">
                {(
                  [
                    { id: 'both', label: 'Đầy Đủ 3D' },
                    { id: 'terrain', label: 'Chỉ Địa Hình' },
                    { id: 'object', label: 'Đài Vật Thể' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      handleParamChange(reliefScale, terraceSteps, overrideBiome, m.id)
                    }
                    className={`py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      mode === m.id
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <label htmlFor="relief-slider">Độ Cao Đồi Núi (Tối đa 1km)</label>
                  <span className="font-mono tabular-nums text-amber-300">
                    {reliefScale.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="relief-slider"
                  type="range"
                  min={0.6}
                  max={2.2}
                  step={0.05}
                  value={reliefScale}
                  onChange={(e) =>
                    handleParamChange(
                      parseFloat(e.target.value),
                      terraceSteps,
                      overrideBiome,
                      mode
                    )
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <label htmlFor="terrace-slider">Bậc Thang Địa Chất (Terracing)</label>
                  <span className="font-mono tabular-nums text-cyan-300">
                    {terraceSteps === 0 ? 'Đồi Mượt' : `${terraceSteps} Bậc`}
                  </span>
                </div>
                <input
                  id="terrace-slider"
                  type="range"
                  min={0}
                  max={8}
                  step={2}
                  value={terraceSteps}
                  onChange={(e) =>
                    handleParamChange(
                      reliefScale,
                      parseInt(e.target.value, 10),
                      overrideBiome,
                      mode
                    )
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live 2D Heightmap + Splat Preview & Detected 3D Objects */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Source Photo */}
              <div className="p-3 rounded-xl bg-[#162032] border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-2 gap-1">
                  <span className="font-semibold">Ảnh Gốc Đầu Vào</span>
                  <div className="flex items-center gap-1 bg-[#0d1420] p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => handleCropModeChange('fill')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        cropMode === 'fill'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Cắt giữa vuông 1:1 khớp chính xác với lưới 10×10km"
                    >
                      Cắt 1:1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCropModeChange('fit')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        cropMode === 'fit'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Co giãn toàn bộ khung ảnh vào lưới 10×10km"
                    >
                      Nguyên Khung
                    </button>
                  </div>
                </div>
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt="Ảnh thực tế đầu vào"
                      referrerPolicy="no-referrer"
                      className={`w-full h-full ${
                        cropMode === 'fit' ? 'object-contain' : 'object-cover'
                      }`}
                    />
                  ) : (
                    <Mountain className="w-8 h-8 text-slate-600" />
                  )}
                </div>
              </div>

              {/* Extracted Vector Heightmap & Biome Splat */}
              <div className="p-3 rounded-xl bg-[#162032] border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                  <span className="font-semibold">Bản Đồ Vector 10×10km</span>
                  <span className="text-[11px] text-emerald-400 font-mono tabular-nums">
                    Lưới 161×161 (25.921 Đỉnh · 62,5m/ô)
                  </span>
                </div>
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center">
                  {heightmapPreviewUrl ? (
                    <img
                      src={heightmapPreviewUrl}
                      alt="Bản đồ kết cấu địa hình Vector tái tạo"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Layers className="w-8 h-8 text-slate-600" />
                  )}
                </div>
              </div>
            </div>

            {/* AI Analysis Summary Card */}
            <div className="p-4 rounded-xl bg-[#162032] border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">{regionTitle}</h3>
                  <p className="text-xs text-amber-300 mt-0.5">
                    Phong cách màu sắc: {activeBiome.name} · {activeBiome.inspiration}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunDeepAiScan}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAnalyzing ? 'Đang Quét AI...' : 'Phân Tích Sâu AI'}
                </button>
              </div>

              {aiNotice && (
                <p
                  role="status"
                  data-testid="ai-fallback-notice"
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-400/40 text-[11px] text-indigo-200"
                >
                  {aiNotice}
                </p>
              )}

              <p className="text-xs text-slate-300 leading-relaxed">{summaryText}</p>

              {/* Metrics Breakdown */}
              {reconstructed && (
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Thảm Thực Vật</span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-400">
                      {Math.round(reconstructed.metrics.greenRatio * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mặt Nước / Sông</span>
                    <span className="font-mono tabular-nums font-semibold text-cyan-400">
                      {Math.round(reconstructed.metrics.waterRatio * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Đỉnh Cao Nhất</span>
                    <span className="font-mono tabular-nums font-semibold text-amber-300">
                      {reconstructed.metrics.peakElevationMeters}m / 1km
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Vật Thể 3D Phát Hiện</span>
                    <span className="font-mono tabular-nums font-semibold text-pink-400">
                      {reconstructed.detectedObjects.length} mô hình
                    </span>
                  </div>
                </div>
              )}

              {/* Detected 3D Objects List */}
              {reconstructed && reconstructed.detectedObjects.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-amber-400" />
                      Các Vật Thể 3D Sẽ Được Dựng Tự Động ({aiSourceLabel}):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
                    {reconstructed.detectedObjects.slice(0, 8).map((obj, idx) => (
                      <span key={obj.id} className="whitespace-nowrap">
                        {idx > 0 && <span className="text-slate-600 mr-2">·</span>}
                        <strong className="text-white font-medium">{obj.label}</strong>{' '}
                        <span className="text-slate-400 font-mono text-[11px]">
                          ({Math.round(obj.x)}, {Math.round(obj.z)})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#0d1420]">
          <span className="text-xs text-slate-400">
            Mọi vật thể (nhà, núi, cây) sẽ tự động khớp độ cao mặt đất 3D sau khi tái tạo.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmApply}
              className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Áp Dụng Tái Tạo Lên Bản Đồ 3D
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
