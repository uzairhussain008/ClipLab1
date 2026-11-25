import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Camera,
  CheckCircle2,
  Download,
  Film,
  Image as ImageIcon,
  Layers,
  Lock,
  MessageSquareText,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
  Type,
  Upload,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import {
  APP_CONFIG,
  ASPECT_PRESETS,
  BUNDLED_FONTS,
  PLATFORM_PRESETS,
} from '../config/appConfig';
import {
  applyTemplateToEditorState,
  cloneTemplateSnapshot,
  getTemplateById,
  LOOK_TEMPLATES,
  type LookTemplate,
  type LookTemplateId,
  type TemplateAppliedSnapshot,
} from '../config/templates';
import { useClipLab } from '../context/ClipLabContext';
import { ffmpegService, type ExportProgressInfo } from '../services/ffmpegService';
import { analyzeMediaOnDevice } from '../services/mediaAnalyzerService';
import { whisperService } from '../services/whisperService';
import { buildClipsZipBlob } from '../services/zipService';
import type {
  CaptionConfig,
  CaptionLine,
  CaptionStylePresetId,
  CaptionWord,
  ClipSegment,
  ComputeMode,
  ExportFormat,
  ExportQuality,
  ExportSettings,
  LogoCorner,
  LogoOverlayConfig,
  OverlayFontId,
  PlatformPreset,
  ReframeMode,
  SmartAnalysisResult,
  SmartMomentCandidate,
  SplitLayoutConfig,
  TextOverlayConfig,
} from '../types/editor';
import { AdSlot } from '../components/AdSlot';
import { AutoClipReviewModal } from '../components/AutoClipReviewModal';
import { AutoClipStepper } from '../components/AutoClipStepper';
import { CaptionsPanel } from '../components/CaptionsPanel';
import { PasteVideoLink } from '../components/PasteVideoLink';
import { SmartMomentsPanel } from '../components/SmartMomentsPanel';
import { Timeline } from '../components/Timeline';
import { VideoPreview } from '../components/VideoPreview';
import { CAPTION_PRESET_DEFAULTS, groupWordsIntoLines } from '../utils/captions';
import { resolveCaptionMixDecisions } from '../utils/captionStyleMix';
import { formatFileSize, isLowMemoryOrMobileDevice, validateVideoFile } from '../utils/deviceCheck';
import { getProcessingMode } from '../utils/ffmpegArgs';
import { buildSampleDemoCaptionLines, type SampleSceneId } from '../utils/sampleScenes';
import { generateSampleClipFile } from '../utils/sampleVideo';
import { enrichMomentsWithSpeechAndHooks, parseBoostKeywords } from '../utils/smartAnalysis';
import {
  clampTime,
  formatTimecode,
  MIN_CLIP_DURATION,
  normalizeTrimRange,
  sanitizeFilename,
  stepFrame,
} from '../utils/timecode';
import {
  clearRememberedGpuFailure,
  getRememberedGpuFailure,
  getSavedComputeMode,
  resolveWhisperModelId,
  saveComputeMode,
} from '../utils/whisperFallback';

interface ExportedOutput {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  durationSec: number;
  extension: 'mp4' | 'webm' | 'gif';
}

type InspectorTab = 'framing' | 'captions' | 'text' | 'logo' | 'audio';

const HOOK_TEMPLATES = [
  'WAIT FOR THE END...',
  'HOW DID THIS HAPPEN?!',
  '100 IQ PLAY RIGHT HERE',
];

const DEFAULT_SPLIT_LAYOUT: SplitLayoutConfig = {
  gameplayRatioPercent: 65,
  backgroundMode: 'blur',
  gameplayBox: { x: 0.05, y: 0.05, w: 0.9, h: 0.85 },
  facecamBox: { x: 0.72, y: 0.65, w: 0.25, h: 0.3 },
};

const INITIAL_SETTINGS: ExportSettings = {
  aspect: '9:16',
  keepOriginalFraming: true,
  verticalMode: 'fill-crop',
  reframeMode: 'smart-follow',
  lockPosition: false,
  ignoreHudEdges: true,
  foregroundSizePercent: 100,
  cropX: 0.5,
  cropY: 0.5,
  zoom: {
    punchZoom: 1,
    slowZoom: false,
    pulseOnPeaks: false,
  },
  splitLayout: DEFAULT_SPLIT_LAYOUT,
  speed: 1,
  muted: false,
  volume: 1,
  quality: 'balanced',
  format: 'mp4',
};

const INITIAL_TEXT: TextOverlayConfig = {
  enabled: false,
  text: '',
  position: 'top',
  font: 'display-bold',
  fontSize: 56,
  color: '#ffffff',
  outlineColor: '#000000',
  outlineWidth: 4,
  startTime: 0,
  endTime: 3,
  hookFade: true,
};

const INITIAL_CAPTIONS: CaptionConfig = {
  enabled: false,
  preset: 'bold-pop',
  styleMode: 'single',
  autoMixIntensity: 'balanced',
  position: 'bottom',
  offsetPercent: CAPTION_PRESET_DEFAULTS['bold-pop'].offsetPercent ?? 16,
  font: (CAPTION_PRESET_DEFAULTS['bold-pop'].font as OverlayFontId) ?? 'display-bold',
  fontSize: CAPTION_PRESET_DEFAULTS['bold-pop'].fontSize ?? 64,
  textColor: CAPTION_PRESET_DEFAULTS['bold-pop'].textColor ?? '#ffffff',
  highlightColor: CAPTION_PRESET_DEFAULTS['bold-pop'].highlightColor ?? '#e59a24',
  outlineWidth: CAPTION_PRESET_DEFAULTS['bold-pop'].outlineWidth ?? 5,
  backgroundBox: CAPTION_PRESET_DEFAULTS['bold-pop'].backgroundBox ?? false,
  wordsPerLine: 3,
  uppercase: CAPTION_PRESET_DEFAULTS['bold-pop'].uppercase ?? true,
  popIn: CAPTION_PRESET_DEFAULTS['bold-pop'].popIn ?? true,
  showSafeZoneGuide: false,
};

const INITIAL_LOGO: LogoOverlayConfig = {
  enabled: false,
  fileName: '',
  dataUrl: '',
  corner: 'top-right',
  sizePercent: 18,
  opacity: 0.85,
};

export function EditorPage() {
  const {
    videoFile,
    videoUrl,
    fileWarnings,
    setSourceVideo,
    transferredLogo,
    setTransferredLogo,
  } = useClipLab();

  const videoRef = useRef<HTMLVideoElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const exportedUrlsRef = useRef<string[]>([]);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const [duration, setDuration] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(
    null
  );
  const [hasAudio, setHasAudio] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [segments, setSegments] = useState<ClipSegment[]>([
    { id: 'seg-1', name: 'Clip 1', startTime: 0, endTime: 5 },
  ]);
  const [activeSegmentId, setActiveSegmentId] = useState('seg-1');

  const [settings, setSettings] = useState<ExportSettings>(INITIAL_SETTINGS);
  const [textOverlay, setTextOverlay] = useState<TextOverlayConfig>(INITIAL_TEXT);
  const [logoOverlay, setLogoOverlay] = useState<LogoOverlayConfig>(INITIAL_LOGO);
  const [activePlatform, setActivePlatform] = useState<PlatformPreset | null>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('framing');

  // Smart Moments & Crop state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutoClipping, setIsAutoClipping] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    percent: number;
    message: string;
  } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<SmartAnalysisResult | null>(null);
  const [boostKeywordsRaw, setBoostKeywordsRaw] = useState(() =>
    APP_CONFIG.smartFeatures.defaultBoostKeywords.join(', ')
  );
  const [showAutoClipConsent, setShowAutoClipConsent] = useState(false);
  const [showAutoClipReview, setShowAutoClipReview] = useState(false);
  const [hookSuggestionsBySegId, setHookSuggestionsBySegId] = useState<Record<string, string>>({});

  // Auto Captions state
  const [captionConfig, setCaptionConfig] = useState<CaptionConfig>(INITIAL_CAPTIONS);
  const [captionLines, setCaptionLines] = useState<CaptionLine[]>([]);
  const [rawCaptionWords, setRawCaptionWords] = useState<CaptionWord[]>([]);
  const [captionLanguage, setCaptionLanguage] = useState('auto');
  const [computeMode, setComputeMode] = useState<ComputeMode>(() => getSavedComputeMode());
  const [pendingAutoClipComputeMode, setPendingAutoClipComputeMode] = useState<'cpu' | 'gpu'>(() =>
    getSavedComputeMode() === 'gpu' ? 'gpu' : 'cpu'
  );
  const [useEnglishOnlyModel, setUseEnglishOnlyModel] = useState(false);
  const [rememberedGpuFailure, setRememberedGpuFailure] = useState(() => getRememberedGpuFailure());
  const [approximateWordTiming, setApproximateWordTiming] = useState(false);
  const [hasConsentedModel, setHasConsentedModel] = useState(() => whisperService.isModelReady());
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [captionProgress, setCaptionProgress] = useState<{
    percent: number;
    message: string;
  } | null>(null);
  const [captionStatusNote, setCaptionStatusNote] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [codecError, setCodecError] = useState<string | null>(null);
  const [generatingSample, setGeneratingSample] = useState(false);

  const [searchParams] = useSearchParams();
  const lastHandledTemplateParamRef = useRef<string | null>(null);
  const [isGeneratedSample, setIsGeneratedSample] = useState(false);
  const [selectedLookId, setSelectedLookId] = useState<LookTemplateId>('blur-fill-classic');
  const [appliedLookSummary, setAppliedLookSummary] = useState<{
    templateId: LookTemplateId;
    templateName: string;
    changes: string[];
  } | null>(null);
  const [lookSnapshotBeforeApply, setLookSnapshotBeforeApply] =
    useState<TemplateAppliedSnapshot | null>(null);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgressInfo | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatusNote, setExportStatusNote] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<ExportedOutput[]>([]);

  const [browserSupportsFaceDetector] = useState(() => {
    try {
      const win = window as unknown as { FaceDetector?: unknown };
      return typeof win.FaceDetector === 'function';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    return () => {
      exportedUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      analysisAbortRef.current?.abort();
    };
  }, []);

  // Pick up watermark sent from /watermark-maker
  useEffect(() => {
    if (transferredLogo) {
      setLogoOverlay((prev) => ({
        ...prev,
        enabled: true,
        dataUrl: transferredLogo.dataUrl,
        fileName: transferredLogo.fileName,
      }));
      setActiveTab('logo');
      setTransferredLogo(null);
    }
  }, [transferredLogo, setTransferredLogo]);

  // Lazy-load FFmpeg core only inside the Editor when a video is loaded
  useEffect(() => {
    if (!videoUrl) return;
    ffmpegService.ensureLoaded().catch(() => {
      // Surfacing errors clearly when user triggers analysis or export
    });
  }, [videoUrl]);

  const parsedKeywords = useMemo(
    () => parseBoostKeywords(boostKeywordsRaw),
    [boostKeywordsRaw]
  );

  // Keep existing moment cards enriched whenever captions or boost keywords change
  useEffect(() => {
    setAnalysisResult((prev) => {
      if (!prev || prev.moments.length === 0) return prev;
      return {
        ...prev,
        moments: enrichMomentsWithSpeechAndHooks(
          prev.moments,
          prev.samples,
          prev.hasAudio,
          captionLines,
          parsedKeywords
        ),
      };
    });
  }, [captionLines, parsedKeywords]);

  const activeSegment = useMemo(
    () => segments.find((s) => s.id === activeSegmentId) ?? segments[0],
    [segments, activeSegmentId]
  );

  const resolvedMixDecisions = useMemo(
    () =>
      resolveCaptionMixDecisions({
        lines: captionLines,
        config: captionConfig,
        audioSamples: analysisResult?.samples,
        keywords: parsedKeywords,
      }),
    [captionLines, captionConfig, analysisResult?.samples, parsedKeywords]
  );

  const resolvedCaptionStyleMap = useMemo(() => {
    const map: Record<string, CaptionStylePresetId> = {};
    for (const [lineId, decision] of Object.entries(resolvedMixDecisions)) {
      map[lineId] = decision.resolvedPreset;
    }
    return map;
  }, [resolvedMixDecisions]);

  const hasCaptionsActive = captionConfig.enabled && captionLines.length > 0;

  const processingMode = useMemo(
    () => getProcessingMode(settings, textOverlay, logoOverlay, hasCaptionsActive),
    [settings, textOverlay, logoOverlay, hasCaptionsActive]
  );

  const activeClipDuration = activeSegment
    ? Math.max(0, activeSegment.endTime - activeSegment.startTime)
    : 0;

  const platformDurationWarning = useMemo(() => {
    if (!activePlatform || !activeSegment) return null;
    if (activeClipDuration > activePlatform.maxDurationSec) {
      return `Active clip is ${activeClipDuration.toFixed(1)}s — ${activePlatform.name} recommends clips under ${activePlatform.maxDurationSec}s.`;
    }
    return null;
  }, [activePlatform, activeSegment, activeClipDuration]);

  // Sync HTML5 video speed & volume with controls
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = settings.speed;
    v.muted = settings.muted;
    v.volume = clampTime(settings.volume, 0, 1);
  }, [settings.speed, settings.muted, settings.volume, videoUrl]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 5;
    setDuration(dur);
    setVideoDimensions({ width: v.videoWidth || 1280, height: v.videoHeight || 720 });
    setCurrentTime(0);
    setCodecError(null);

    const vExt = v as HTMLVideoElement & {
      mozHasAudio?: boolean;
      audioTracks?: { length: number };
    };
    const detectedAudio =
      vExt.mozHasAudio === true ||
      (typeof vExt.audioTracks?.length === 'number' && vExt.audioTracks.length > 0) ||
      vExt.mozHasAudio === undefined;
    setHasAudio(detectedAudio);

    const initialEnd = Number(dur.toFixed(3));
    setSegments([{ id: 'seg-1', name: 'Clip 1', startTime: 0, endTime: initialEnd }]);
    setActiveSegmentId('seg-1');
    setTextOverlay((prev) => ({
      ...prev,
      startTime: 0,
      endTime: prev.hookFade ? Math.min(3, initialEnd) : initialEnd,
    }));
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (activeSegment && !v.paused && v.currentTime >= activeSegment.endTime) {
      v.pause();
      v.currentTime = activeSegment.startTime;
      setIsPlaying(false);
    }
  };

  const seekTo = useCallback(
    (time: number) => {
      const v = videoRef.current;
      const clamped = clampTime(time, 0, duration || 0);
      setCurrentTime(clamped);
      if (v) {
        v.currentTime = clamped;
      }
    },
    [duration]
  );

  const togglePlayPause = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (
        activeSegment &&
        (v.currentTime < activeSegment.startTime || v.currentTime >= activeSegment.endTime)
      ) {
        v.currentTime = activeSegment.startTime;
      }
      try {
        await v.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, [activeSegment]);

  const updateActiveRange = useCallback(
    (start: number, end: number) => {
      const normalized = normalizeTrimRange(start, end, duration || 5);
      setSegments((prev) =>
        prev.map((seg) =>
          seg.id === activeSegmentId
            ? { ...seg, startTime: normalized.startTime, endTime: normalized.endTime }
            : seg
        )
      );
    },
    [activeSegmentId, duration]
  );

  const handleStepFrame = useCallback(
    (dir: -1 | 1) => {
      const v = videoRef.current;
      if (v && !v.paused) {
        v.pause();
        setIsPlaying(false);
      }
      const next = stepFrame(currentTime, dir, duration, 30);
      seekTo(next);
    },
    [currentTime, duration, seekTo]
  );

  // Keyboard shortcuts: Space, I, O, Left/Right
  useEffect(() => {
    if (!videoUrl) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (ev.code === 'Space') {
        ev.preventDefault();
        togglePlayPause();
      } else if (ev.key === 'i' || ev.key === 'I') {
        ev.preventDefault();
        if (activeSegment) {
          updateActiveRange(
            clampTime(currentTime, 0, activeSegment.endTime - MIN_CLIP_DURATION),
            activeSegment.endTime
          );
        }
      } else if (ev.key === 'o' || ev.key === 'O') {
        ev.preventDefault();
        if (activeSegment) {
          updateActiveRange(
            activeSegment.startTime,
            clampTime(currentTime, activeSegment.startTime + MIN_CLIP_DURATION, duration)
          );
        }
      } else if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        handleStepFrame(-1);
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        handleStepFrame(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    videoUrl,
    togglePlayPause,
    updateActiveRange,
    activeSegment,
    currentTime,
    duration,
    handleStepFrame,
  ]);

  const resetSmartAndCaptionState = () => {
    analysisAbortRef.current?.abort();
    setIsAnalyzing(false);
    setIsAutoClipping(false);
    setAnalysisProgress(null);
    setAnalysisError(null);
    setAnalysisResult(null);
    setShowAutoClipReview(false);
    setShowAutoClipConsent(false);
    setHookSuggestionsBySegId({});
    setCaptionLines([]);
    setRawCaptionWords([]);
    setCaptionError(null);
    setCaptionStatusNote(null);
  };

  const applyLookTemplate = useCallback(
    (template: LookTemplate, options?: { fromSampleLoader?: boolean }) => {
      if (!lookSnapshotBeforeApply) {
        setLookSnapshotBeforeApply(
          cloneTemplateSnapshot(
            appliedLookSummary?.templateId ?? null,
            settings,
            captionConfig,
            textOverlay,
            activePlatform
          )
        );
      }

      const { nextSettings, nextCaptions, nextTextOverlay, changedSummary } =
        applyTemplateToEditorState(template, {
          settings,
          captionConfig,
          textOverlay,
        });

      setSettings(nextSettings);
      setCaptionConfig(nextCaptions);
      setTextOverlay(nextTextOverlay);
      setActivePlatform(null);
      setSelectedLookId(template.id);
      setAppliedLookSummary({
        templateId: template.id,
        templateName: template.name,
        changes: changedSummary,
      });
      setTemplateLoadError(null);

      // Only add demo "Sample caption" lines when using the generated sample clip (never on user's own video)
      if (
        (options?.fromSampleLoader || isGeneratedSample) &&
        template.includesSampleCaptions &&
        captionLines.length === 0
      ) {
        setCaptionLines(buildSampleDemoCaptionLines());
      }
    },
    [
      lookSnapshotBeforeApply,
      appliedLookSummary,
      settings,
      captionConfig,
      textOverlay,
      activePlatform,
      isGeneratedSample,
      captionLines.length,
    ]
  );

  const handleResetLook = () => {
    if (!lookSnapshotBeforeApply) return;
    setSettings(lookSnapshotBeforeApply.settings);
    setCaptionConfig(lookSnapshotBeforeApply.captionConfig);
    setTextOverlay(lookSnapshotBeforeApply.textOverlay);
    setActivePlatform(lookSnapshotBeforeApply.activePlatform);
    setAppliedLookSummary(null);
    setLookSnapshotBeforeApply(null);
  };

  const handleUploadNewVideo = (file: File) => {
    const check = validateVideoFile(file);
    if (!check.valid) {
      setUploadError(check.error || 'Unsupported file.');
      return;
    }
    setUploadError(null);
    setCodecError(null);
    setExportError(null);
    setExportStatusNote(null);
    setIsGeneratedSample(false);
    resetSmartAndCaptionState();
    setSourceVideo(file, check.warnings);
  };

  const handleLoadSample = async (sceneId: SampleSceneId = 'night-city') => {
    setUploadError(null);
    setGeneratingSample(true);
    resetSmartAndCaptionState();
    try {
      const file = await generateSampleClipFile(sceneId);
      setIsGeneratedSample(true);
      setSourceVideo(file, []);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to generate a sample clip in this browser.'
      );
    } finally {
      setGeneratingSample(false);
    }
  };

  const applyLookTemplateRef = useRef(applyLookTemplate);
  applyLookTemplateRef.current = applyLookTemplate;
  const setSourceVideoRef = useRef(setSourceVideo);
  setSourceVideoRef.current = setSourceVideo;

  // Load sample clip and apply template when arriving via /editor?template=<id>
  useEffect(() => {
    const templateParam = searchParams.get('template');
    if (!templateParam) {
      lastHandledTemplateParamRef.current = null;
      return;
    }
    if (lastHandledTemplateParamRef.current === templateParam) return;
    lastHandledTemplateParamRef.current = templateParam;

    const tpl = getTemplateById(templateParam);
    if (!tpl) {
      setTemplateLoadError(
        `Unknown template "${templateParam}". Select one of the four built-in Looks in the editor.`
      );
      return;
    }

    const controller = new AbortController();
    let settled = false;
    setTemplateLoadError(null);
    setSelectedLookId(tpl.id);
    setGeneratingSample(true);
    resetSmartAndCaptionState();

    generateSampleClipFile(tpl.sampleScene, controller.signal)
      .then((file) => {
        if (controller.signal.aborted) return;
        settled = true;
        setIsGeneratedSample(true);
        setSourceVideoRef.current(file, []);
        applyLookTemplateRef.current(tpl, { fromSampleLoader: true });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        settled = true;
        setUploadError(
          err instanceof Error ? err.message : 'Unable to generate the sample scene in this browser.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setGeneratingSample(false);
        }
      });

    return () => {
      controller.abort();
      if (!settled) {
        lastHandledTemplateParamRef.current = null;
      }
    };
  }, [searchParams]);

  const handleRunSmartAnalysis = async (rangeOnly = false) => {
    if (!videoFile || isAnalyzing || isAutoClipping || duration <= 0.5) return;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress({ percent: 3, message: 'Preparing on-device smart analysis...' });

    const scanRange =
      rangeOnly && activeSegment
        ? { start: activeSegment.startTime, end: activeSegment.endTime }
        : { start: 0, end: duration };

    try {
      const res = await analyzeMediaOnDevice({
        file: videoFile,
        totalDuration: duration,
        range: scanRange,
        ignoreHudEdges: settings.ignoreHudEdges,
        targetClipSec: activePlatform?.targetClipSec ?? 25,
        preferFaceDetection: settings.reframeMode === 'face-aware' || browserSupportsFaceDetector,
        captionLines: captionLines.length > 0 ? captionLines : undefined,
        boostKeywords: parsedKeywords,
        signal: controller.signal,
        onProgress: (percent, message) => setAnalysisProgress({ percent, message }),
      });

      setAnalysisResult(res);
      if (!res.hasAudio) {
        setHasAudio(false);
      }
      // Automatically use Smart follow framing if user switched to a vertical/square/portrait frame
      setSettings((prev) => {
        if (!prev.keepOriginalFraming && prev.reframeMode !== 'split-layout' && prev.reframeMode !== 'blur-bg') {
          return {
            ...prev,
            verticalMode: 'fill-crop',
            reframeMode:
              prev.reframeMode === 'face-aware' && res.faceDetectionUsed
                ? 'face-aware'
                : 'smart-follow',
            lockPosition: false,
          };
        }
        return prev;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Smart analysis failed.';
      if (msg !== 'Analysis cancelled.') {
        setAnalysisError(msg);
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const runAutoClipPipeline = async (
    includeSpeechCaptions: boolean,
    overrideComputeMode?: ComputeMode
  ) => {
    if (!videoFile || isAnalyzing || isAutoClipping || duration <= 0.5) return;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    const willRunCaptions =
      APP_CONFIG.ENABLE_AUTO_CAPTIONS && includeSpeechCaptions && captionLines.length === 0;
    const totalSteps = willRunCaptions ? 3 : 2;

    setIsAutoClipping(true);
    setAnalysisError(null);
    setCaptionError(null);
    setAnalysisProgress({
      percent: 5,
      message: `Auto clip step 1/${totalSteps}: finding best moments...`,
    });

    try {
      let generatedLines = captionLines;

      // Step A: Find best moments first
      const res = await analyzeMediaOnDevice({
        file: videoFile,
        totalDuration: duration,
        range: { start: 0, end: duration },
        ignoreHudEdges: settings.ignoreHudEdges,
        targetClipSec: activePlatform?.targetClipSec ?? 25,
        preferFaceDetection: browserSupportsFaceDetector,
        captionLines: generatedLines.length > 0 ? generatedLines : undefined,
        boostKeywords: parsedKeywords,
        signal: controller.signal,
        onProgress: (percent, message) =>
          setAnalysisProgress({
            percent: Math.min(willRunCaptions ? 48 : 85, Math.round(percent * (willRunCaptions ? 0.48 : 0.85))),
            message: `Finding best moments: ${message}`,
          }),
      });

      if (!res.hasAudio) {
        setHasAudio(false);
      }

      if (!res.hasStrongMoments || res.moments.length === 0) {
        setAnalysisResult(res);
        setAnalysisError(
          'No strong moments found (video appears mostly quiet or static). Use the timeline handles to trim highlights manually.'
        );
        return;
      }

      // Step B: Generate on-device captions if enabled, requested, and not yet generated
      if (willRunCaptions && generatedLines.length === 0) {
        setHasConsentedModel(true);
        setAnalysisProgress({
          percent: 52,
          message: 'Auto clip step 2/3: loading speech model & transcribing captions...',
        });

        try {
          const capStart = 0;
          const capEnd = Math.min(duration, 180);
          const speechRes = await whisperService.transcribeVideoRange({
            file: videoFile,
            startTime: capStart,
            endTime: capEnd,
            language: captionLanguage,
            computeMode: overrideComputeMode ?? computeMode,
            useEnglishOnlyModel,
            onProgress: (pct, msg) =>
              setAnalysisProgress({
                percent: Math.min(88, Math.round(52 + pct * 0.36)),
                message: `Auto captions: ${msg}`,
              }),
          });

          setRememberedGpuFailure(getRememberedGpuFailure());

          if (controller.signal.aborted) {
            throw new Error('Analysis cancelled.');
          }

          if (speechRes.words.length > 0) {
            setRawCaptionWords(speechRes.words);
            setApproximateWordTiming(speechRes.approximateWordTiming);
            generatedLines = groupWordsIntoLines(
              speechRes.words,
              captionConfig.wordsPerLine,
              captionConfig.uppercase
            );
            setCaptionLines(generatedLines);
            setCaptionConfig((prev) => ({ ...prev, enabled: true }));
            const backendLabel = speechRes.backend === 'webgpu' ? 'WebGPU' : 'CPU (WASM)';
            const fallbackNote = speechRes.switchedFromGpu
              ? ' GPU unavailable — switched to CPU (slower).'
              : '';
            const approxNote = speechRes.approximateWordTiming
              ? ' Word timing is approximate.'
              : '';
            setCaptionStatusNote(
              `Generated ${generatedLines.length} caption lines locally via ${backendLabel}.${fallbackNote}${approxNote}`
            );
          }
        } catch (capErr) {
          setRememberedGpuFailure(getRememberedGpuFailure());
          const rawMsg = capErr instanceof Error ? capErr.message : String(capErr);
          if (rawMsg.toLowerCase().includes('cancel')) {
            throw new Error('Analysis cancelled.');
          }
          // Preserve stage-classified error directly without mislabeling GPU/model errors as download failures
          throw capErr instanceof Error ? capErr : new Error(rawMsg);
        }
      }

      if (controller.signal.aborted) {
        throw new Error('Analysis cancelled.');
      }

      setAnalysisProgress({
        percent: 94,
        message: `Auto clip step ${totalSteps}/${totalSteps}: applying Smart follow framing & assembling review...`,
      });

      const enrichedMoments = enrichMomentsWithSpeechAndHooks(
        res.moments,
        res.samples,
        res.hasAudio,
        generatedLines,
        parsedKeywords
      ).slice(0, APP_CONFIG.smartFeatures.maxCandidateMoments);

      const finalAnalysis: SmartAnalysisResult = {
        ...res,
        moments: enrichedMoments,
      };
      setAnalysisResult(finalAnalysis);

      const created: ClipSegment[] = enrichedMoments.map((m, idx) => ({
        id: `autoclip-${Date.now()}-${idx}`,
        name: `Highlight ${idx + 1} (${m.activityLevel})`,
        startTime: m.startTime,
        endTime: m.endTime,
      }));

      const hookMap: Record<string, string> = {};
      enrichedMoments.forEach((m, idx) => {
        if (m.hookSuggestion && created[idx]) {
          hookMap[created[idx].id] = m.hookSuggestion;
        }
      });

      setSegments(created);
      setActiveSegmentId(created[0].id);
      setHookSuggestionsBySegId(hookMap);
      seekTo(created[0].startTime);

      // Apply Smart follow framing (keeping chosen vertical/square aspect or defaulting to 9:16)
      setSettings((prev) => ({
        ...prev,
        keepOriginalFraming: false,
        aspect: prev.keepOriginalFraming || prev.aspect === '16:9' ? '9:16' : prev.aspect,
        verticalMode: 'fill-crop',
        reframeMode: res.faceDetectionUsed ? 'face-aware' : 'smart-follow',
        lockPosition: false,
      }));

      if (generatedLines.length > 0) {
        setCaptionConfig((prev) => ({ ...prev, enabled: true }));
      }

      setShowAutoClipReview(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto clip everything failed.';
      if (!msg.toLowerCase().includes('cancel')) {
        setAnalysisError(msg);
      }
    } finally {
      setIsAutoClipping(false);
      setAnalysisProgress(null);
    }
  };

  const handleAutoClipEverythingClick = () => {
    if (!videoFile || isAnalyzing || isAutoClipping || duration <= 0.5) return;
    if (!APP_CONFIG.ENABLE_AUTO_CAPTIONS) {
      void runAutoClipPipeline(false);
      return;
    }
    if (hasConsentedModel || captionLines.length > 0) {
      void runAutoClipPipeline(captionLines.length === 0);
    } else {
      setPendingAutoClipComputeMode(computeMode === 'gpu' ? 'gpu' : 'cpu');
      setShowAutoClipConsent(true);
    }
  };

  const handleCancelAnalysis = () => {
    analysisAbortRef.current?.abort();
    ffmpegService.cancel();
    whisperService.cancel();
    setIsAnalyzing(false);
    setIsAutoClipping(false);
    setAnalysisProgress(null);
  };

  const handlePreviewMoment = async (moment: SmartMomentCandidate) => {
    const v = videoRef.current;
    seekTo(moment.startTime);
    if (v) {
      try {
        await v.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const handleAddMomentAsClip = (moment: SmartMomentCandidate) => {
    const nextIdx = segments.length + 1;
    const id = `seg-${Date.now()}-${nextIdx}`;
    const newSeg: ClipSegment = {
      id,
      name: `Moment ${nextIdx - 1 || 1} (${moment.activityLevel})`,
      startTime: moment.startTime,
      endTime: moment.endTime,
    };
    setSegments((prev) => [...prev, newSeg]);
    setActiveSegmentId(id);
    if (moment.hookSuggestion) {
      setHookSuggestionsBySegId((prev) => ({ ...prev, [id]: moment.hookSuggestion! }));
    }
    seekTo(newSeg.startTime);
  };

  const handleAddAllMoments = (moments: SmartMomentCandidate[]) => {
    if (moments.length === 0) return;
    const created: ClipSegment[] = moments.map((m, idx) => ({
      id: `seg-${Date.now()}-${idx}`,
      name: `Highlight ${idx + 1} (${m.activityLevel})`,
      startTime: m.startTime,
      endTime: m.endTime,
    }));
    const hookMap: Record<string, string> = {};
    moments.forEach((m, idx) => {
      if (m.hookSuggestion && created[idx]) {
        hookMap[created[idx].id] = m.hookSuggestion;
      }
    });
    setSegments((prev) => [...prev, ...created]);
    setHookSuggestionsBySegId((prev) => ({ ...prev, ...hookMap }));
    setActiveSegmentId(created[0].id);
    seekTo(created[0].startTime);
  };

  const handleApplyHookSuggestion = (startTime: number, endTime: number, hookText: string) => {
    const cleaned = hookText.trim();
    if (!cleaned) return;
    setTextOverlay((prev) => ({
      ...prev,
      enabled: true,
      text: cleaned,
      position: 'top',
      startTime: Number(startTime.toFixed(2)),
      endTime: Number(Math.min(endTime, startTime + 3).toFixed(2)),
      hookFade: true,
    }));
    setActiveTab('text');
  };

  const handleGenerateCaptions = async (overrideComputeMode?: ComputeMode) => {
    if (!APP_CONFIG.ENABLE_AUTO_CAPTIONS) return;
    if (!videoFile || isGeneratingCaptions || duration <= 0.3) return;
    setHasConsentedModel(true);
    setIsGeneratingCaptions(true);
    setCaptionError(null);
    setCaptionStatusNote(null);
    setCaptionProgress({ percent: 3, message: 'Preparing 16 kHz audio for speech recognition...' });

    const rangeStart = activeSegment ? activeSegment.startTime : 0;
    const rangeEnd = activeSegment ? activeSegment.endTime : duration;

    try {
      const res = await whisperService.transcribeVideoRange({
        file: videoFile,
        startTime: rangeStart,
        endTime: rangeEnd,
        language: captionLanguage,
        computeMode: overrideComputeMode ?? computeMode,
        useEnglishOnlyModel,
        onProgress: (percent, message) => setCaptionProgress({ percent, message }),
      });

      setRememberedGpuFailure(getRememberedGpuFailure());

      if (!res.hasAudio) {
        setCaptionStatusNote('No audio track detected in this video — import an .srt file or add lines manually.');
        setCaptionLines([]);
        setRawCaptionWords([]);
        setApproximateWordTiming(false);
        return;
      }

      if (res.words.length === 0) {
        setCaptionStatusNote(
          'No speech detected in the selected clip range. Add lines manually or import an .srt file.'
        );
        setCaptionLines([]);
        setRawCaptionWords([]);
        setApproximateWordTiming(false);
        return;
      }

      setRawCaptionWords(res.words);
      setApproximateWordTiming(res.approximateWordTiming);
      const grouped = groupWordsIntoLines(
        res.words,
        captionConfig.wordsPerLine,
        captionConfig.uppercase
      );
      setCaptionLines(grouped);
      setCaptionConfig((prev) => ({ ...prev, enabled: true }));
      const backendLabel = res.backend === 'webgpu' ? 'WebGPU' : 'CPU (WASM)';
      const fallbackNote = res.switchedFromGpu ? ' GPU unavailable — switched to CPU (slower).' : '';
      const approxNote = res.approximateWordTiming ? ' Word timing is approximate.' : '';
      setCaptionStatusNote(
        `Generated ${grouped.length} caption lines locally via ${backendLabel}.${fallbackNote}${approxNote} Review and edit any line below.`
      );
    } catch (err) {
      setRememberedGpuFailure(getRememberedGpuFailure());
      const msg = err instanceof Error ? err.message : 'Caption generation failed.';
      if (msg !== 'Caption generation cancelled.') {
        setCaptionError(msg);
      } else {
        setCaptionStatusNote('Caption generation cancelled.');
      }
    } finally {
      setIsGeneratingCaptions(false);
      setCaptionProgress(null);
    }
  };

  const handleCancelCaptions = () => {
    whisperService.cancel();
    setIsGeneratingCaptions(false);
    setCaptionProgress(null);
    setCaptionStatusNote('Caption generation cancelled.');
  };

  const handleChangeCaptionConfig = (updater: (prev: CaptionConfig) => CaptionConfig) => {
    setCaptionConfig((prev) => {
      const next = updater(prev);
      if (
        rawCaptionWords.length > 0 &&
        (next.wordsPerLine !== prev.wordsPerLine || next.uppercase !== prev.uppercase)
      ) {
        setCaptionLines(
          groupWordsIntoLines(rawCaptionWords, next.wordsPerLine, next.uppercase)
        );
      }
      return next;
    });
  };

  const handleAddSegment = () => {
    const nextIdx = segments.length + 1;
    const baseStart = activeSegment ? activeSegment.endTime : 0;
    const proposedStart = baseStart + 0.5 < duration ? baseStart : 0;
    const proposedEnd = Math.min(duration, proposedStart + Math.min(5, Math.max(1, duration / 2)));
    const normalized = normalizeTrimRange(proposedStart, proposedEnd, duration || 5);
    const id = `seg-${Date.now()}-${nextIdx}`;
    const newSeg: ClipSegment = {
      id,
      name: `Clip ${nextIdx}`,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
    };
    setSegments((prev) => [...prev, newSeg]);
    setActiveSegmentId(id);
    seekTo(newSeg.startTime);
  };

  const handleSelectSegment = (id: string) => {
    const target = segments.find((s) => s.id === id);
    if (!target) return;
    setActiveSegmentId(id);
    seekTo(target.startTime);
  };

  const handleDeleteSegment = (id: string) => {
    if (segments.length <= 1) return;
    const remaining = segments.filter((s) => s.id !== id);
    setSegments(remaining);
    if (activeSegmentId === id) {
      setActiveSegmentId(remaining[0].id);
      seekTo(remaining[0].startTime);
    }
  };

  const applyPlatformPreset = (preset: PlatformPreset) => {
    setActivePlatform(preset);
    const hasSmartAnalysis = Boolean(analysisResult?.cropPath.length);
    setSettings((prev) => ({
      ...prev,
      aspect: preset.aspect,
      keepOriginalFraming: false,
      verticalMode: hasSmartAnalysis ? 'fill-crop' : preset.verticalMode,
      reframeMode: hasSmartAnalysis
        ? 'smart-follow'
        : preset.verticalMode === 'blur-bg'
          ? 'blur-bg'
          : 'manual',
      lockPosition: false,
      quality: preset.quality,
      format: 'mp4',
    }));
  };

  const applyReframeMode = (mode: ReframeMode) => {
    setSettings((prev) => ({
      ...prev,
      keepOriginalFraming: false,
      reframeMode: mode,
      verticalMode: mode === 'blur-bg' ? 'blur-bg' : 'fill-crop',
      lockPosition: mode === 'manual' ? true : false,
    }));
  };

  const handleLogoUpload = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoOverlay((prev) => ({
          ...prev,
          enabled: true,
          fileName: file.name,
          dataUrl: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveFramePng = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0 || v.videoHeight === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(activeSegment?.name || 'frame')}-${Math.round(currentTime * 100)}.png`;
    a.click();
    setExportStatusNote('Saved current frame as PNG.');
  };

  const zipAbortRef = useRef<AbortController | null>(null);

  const runExportForSegments = async (
    targetSegments: ClipSegment[],
    options?: { bundleZip?: boolean; sequentialDownload?: boolean }
  ) => {
    if (!videoFile || isExporting || targetSegments.length === 0) return;
    setIsExporting(true);
    setExportError(null);
    setExportStatusNote(null);

    zipAbortRef.current?.abort();
    const zipController = new AbortController();
    zipAbortRef.current = zipController;

    let fallbackUsed = false;
    const exportedBlobs: { name: string; url: string; blob: Blob }[] = [];

    try {
      for (let i = 0; i < targetSegments.length; i++) {
        if (zipController.signal.aborted) {
          throw new Error('Export cancelled.');
        }
        const seg = targetSegments[i];
        const prefix =
          targetSegments.length > 1 ? `[${i + 1}/${targetSegments.length} ${seg.name}] ` : '';

        const result = await ffmpegService.exportClip({
          file: videoFile,
          segment: seg,
          settings,
          textOverlay,
          logoOverlay,
          captions:
            captionConfig.enabled && captionLines.length > 0
              ? {
                  config: captionConfig,
                  lines: captionLines,
                  resolvedStyleMap: resolvedCaptionStyleMap,
                }
              : undefined,
          cropPath: analysisResult?.cropPath,
          peakTimes: analysisResult?.peakTimes,
          hasAudio,
          onProgress: (info) => {
            setExportProgress({
              ...info,
              message: `${prefix}${info.message}`,
            });
          },
        });

        if (result.usedDrawtextFallback) {
          fallbackUsed = true;
        }

        const fileName = `${sanitizeFilename(seg.name)}.${result.extension}`;
        const url = URL.createObjectURL(result.blob);
        exportedUrlsRef.current.push(url);
        exportedBlobs.push({ name: fileName, url, blob: result.blob });

        const outItem: ExportedOutput = {
          id: `out-${Date.now()}-${i}`,
          name: fileName,
          url,
          sizeBytes: result.blob.size,
          durationSec: Math.max(0.2, seg.endTime - seg.startTime),
          extension: result.extension,
        };

        setOutputs((prev) => [outItem, ...prev]);
      }

      if (options?.bundleZip && exportedBlobs.length > 0) {
        try {
          const zipBlob = await buildClipsZipBlob({
            entries: exportedBlobs.map((e) => ({ name: e.name, blob: e.blob })),
            signal: zipController.signal,
            onProgress: (percent, message) =>
              setExportProgress({ phase: 'finalizing', percent, message }),
          });
          const zipUrl = URL.createObjectURL(zipBlob);
          exportedUrlsRef.current.push(zipUrl);
          const zipName = `${sanitizeFilename(APP_CONFIG.appName.toLowerCase())}-clips-${Date.now()}.zip`;
          const link = document.createElement('a');
          link.href = zipUrl;
          link.download = zipName;
          link.click();

          setOutputs((prev) => [
            {
              id: `zip-${Date.now()}`,
              name: zipName,
              url: zipUrl,
              sizeBytes: zipBlob.size,
              durationSec: exportedBlobs.length,
              extension: 'mp4',
            },
            ...prev,
          ]);
          setExportStatusNote(
            `Exported ${exportedBlobs.length} clips into ${zipName}.${
              fallbackUsed ? ' (Basic drawtext captions used.)' : ''
            }`
          );
          return;
        } catch (zipErr) {
          const zipMsg = zipErr instanceof Error ? zipErr.message : '';
          if (zipMsg === 'Export cancelled.') throw zipErr;
          // Automatic sequential download fallback when fflate fails
          for (const item of exportedBlobs) {
            const a = document.createElement('a');
            a.href = item.url;
            a.download = item.name;
            a.click();
          }
          setExportStatusNote(
            `ZIP packager failed — downloaded ${exportedBlobs.length} clips individually instead.`
          );
          return;
        }
      }

      if (options?.sequentialDownload && exportedBlobs.length > 0) {
        for (const item of exportedBlobs) {
          const a = document.createElement('a');
          a.href = item.url;
          a.download = item.name;
          a.click();
        }
      }

      const baseMsg =
        targetSegments.length > 1
          ? `Exported ${targetSegments.length} clips. Download them below.`
          : 'Clip ready for download below.';
      setExportStatusNote(
        fallbackUsed
          ? `${baseMsg} (Basic static drawtext fallback used — ASS caption animations, tilt, blur glow, and per-word sticker box colors were skipped.)`
          : baseMsg
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      if (msg === 'Export cancelled.') {
        setExportStatusNote('Export cancelled cleanly.');
      } else {
        setExportError(msg);
      }
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleCancelExport = () => {
    zipAbortRef.current?.abort();
    ffmpegService.cancel();
    setIsExporting(false);
    setExportProgress(null);
    setExportError(null);
    setExportStatusNote('Export cancelled cleanly.');
  };

  // Empty state when no video is selected yet
  if (!videoUrl || !videoFile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">
            Clip Editor
          </h1>
          <p className="text-sm text-[#9aa7b8]">
            Load an MP4, MOV, or WebM file from your device. Processing runs locally inside your
            browser.
          </p>
        </div>

        <div className="rounded-md border border-[#39475a] bg-[#151b22] p-8 sm:p-12 text-center space-y-5">
          <input
            ref={replaceInputRef}
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadNewVideo(f);
            }}
            className="sr-only"
            aria-label="Choose video file"
          />

          <div className="w-14 h-14 mx-auto rounded-md border border-[#39475a] bg-[#0e1217] flex items-center justify-center text-[#e59a24]">
            <Upload className="w-7 h-7" />
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-[#eef2f6]">
              {generatingSample
                ? `Building browser sample scene (${getTemplateById(selectedLookId)?.name ?? 'Sample'})...`
                : 'No video loaded yet'}
            </h2>
            <p className="text-xs text-[#9aa7b8] mt-1">
              Your video never leaves your device · Recommended under {APP_CONFIG.largeFileWarningMB}{' '}
              MB
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-sm cursor-pointer"
            >
              <Film className="w-4 h-4" />
              <span>Choose Video File</span>
            </button>

            <button
              type="button"
              disabled={generatingSample}
              onClick={() => void handleLoadSample('night-city')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#39475a] bg-[#1c242e] hover:border-[#6c7a8c] text-[#eef2f6] text-sm font-medium cursor-pointer disabled:opacity-60"
            >
              <Play className="w-4 h-4 text-[#e59a24]" />
              <span>{generatingSample ? 'Building Sample...' : 'Try Sample Clip'}</span>
            </button>
          </div>

          <div className="max-w-lg mx-auto">
            <PasteVideoLink
              onVideoLoaded={(file, warnings) => {
                setUploadError(null);
                setIsGeneratedSample(false);
                setSourceVideo(file, warnings);
              }}
            />
            <p className="text-left text-[11px] text-[#6c7a8c] leading-relaxed pt-2">
              {APP_CONFIG.ownershipNotice} {APP_CONFIG.platformDisclaimer}
            </p>
          </div>

          {(uploadError || templateLoadError) && (
            <p role="alert" className="text-xs text-[#f8d7da]">
              {templateLoadError || uploadError}
            </p>
          )}
        </div>

        {/* Crawlable overview & privacy section for /editor */}
        <section className="rounded-md border border-[#2a3544] bg-[#151b22] p-6 space-y-4">
          <h2 className="font-display text-2xl font-bold text-[#eef2f6]">
            About the {APP_CONFIG.appName} In-Browser Editor
          </h2>
          <p className="text-sm text-[#9aa7b8] leading-relaxed">
            {APP_CONFIG.entitySentence} It supports MP4, MOV, and WebM recordings with instant
            stream-copy cuts or full H.264 reframing to 9:16, 1:1, 4:5, and 16:9 for YouTube Shorts,
            TikTok, Instagram Reels, and Facebook Reels.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#9aa7b8] pt-1">
            <div>
              <h3 className="font-semibold text-[#eef2f6] mb-1">Supported Formats</h3>
              <p>MP4 (H.264/AAC), MOV, and WebM inputs; MP4, WebM copy, GIF, and PNG frame outputs.</p>
            </div>
            <div>
              <h3 className="font-semibold text-[#eef2f6] mb-1">On-Device Smart Tools</h3>
              <p>
                Find best moments via audio loudness and motion, Smart follow reframe, Gameplay +
                {APP_CONFIG.ENABLE_AUTO_CAPTIONS
                  ? ' Facecam split layout, and optional Whisper captions.'
                  : ' Facecam split layout, and styled SRT/manual captions.'}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[#eef2f6] mb-1">Zero Video Uploads</h3>
              <p>
                Processing runs inside single-threaded FFmpeg WebAssembly in your tab. Files stay in
                local memory and never upload anywhere.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Workspace Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-md border border-[#2a3544] bg-[#151b22] px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#9aa7b8]">
            <h1 className="font-display text-xl font-bold text-[#eef2f6] truncate max-w-[260px] sm:max-w-md">
              {videoFile.name}
            </h1>
            {videoDimensions && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">
                  {videoDimensions.width}×{videoDimensions.height}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{formatFileSize(videoFile.size)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-[#eef2f6]">
              <Lock className="w-3 h-3 text-[#e59a24]" />
              Local only
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={replaceInputRef}
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadNewVideo(f);
            }}
            className="sr-only"
            aria-label="Replace video file"
          />

          <button
            type="button"
            onClick={handleSaveFramePng}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#2a3544] bg-[#0e1217] hover:border-[#39475a] text-xs font-medium text-[#eef2f6] whitespace-nowrap cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-[#e59a24]" />
            <span>Save Frame PNG</span>
          </button>

          <button
            type="button"
            onClick={() => replaceInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#2a3544] bg-[#0e1217] hover:border-[#39475a] text-xs font-medium text-[#eef2f6] whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Change Video</span>
          </button>
        </div>
      </div>

      {/* Optional Auto Clip Quick Stepper */}
      {APP_CONFIG.smartFeatures.enabled && (
        <AutoClipStepper
          activePlatform={activePlatform}
          hasAnalysis={Boolean(analysisResult)}
          isAnalyzing={isAnalyzing}
          isAutoClipping={isAutoClipping}
          segmentCount={segments.length}
          captionCount={captionLines.length}
          onSelectPlatform={applyPlatformPreset}
          onFindMoments={() => handleRunSmartAnalysis(false)}
          onAutoClipEverything={handleAutoClipEverythingClick}
          onGoCaptions={() => setActiveTab('captions')}
          onExportActive={() => activeSegment && runExportForSegments([activeSegment])}
        />
      )}

      {/* Warnings (Large File / Mobile / Codec / Platform Duration / Template fallback) */}
      {(fileWarnings.length > 0 ||
        codecError ||
        uploadError ||
        templateLoadError ||
        platformDurationWarning) && (
        <div className="space-y-2">
          {fileWarnings.map((w, i) => (
            <div
              key={i}
              role="status"
              className="rounded-md border border-[#e59a24]/50 bg-[#e59a24]/10 px-4 py-2.5 text-xs text-[#eef2f6] flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-[#e59a24] shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
          {platformDurationWarning && (
            <div
              role="status"
              className="rounded-md border border-[#e59a24]/50 bg-[#e59a24]/10 px-4 py-2.5 text-xs text-[#eef2f6] flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-[#e59a24] shrink-0 mt-0.5" />
              <span>{platformDurationWarning}</span>
            </div>
          )}
          {(codecError || uploadError || templateLoadError) && (
            <div
              role="alert"
              className="rounded-md border border-[#dc3545]/60 bg-[#dc3545]/10 px-4 py-2.5 text-xs text-[#f8d7da] flex items-start gap-2"
            >
              <XCircle className="w-4 h-4 text-[#dc3545] shrink-0 mt-0.5" />
              <span>{templateLoadError || codecError || uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Preview + Transport + Timeline + Smart Moments + Multi-Clip Segments */}
        <div className="lg:col-span-7 space-y-4">
          <VideoPreview
            videoRef={videoRef}
            videoUrl={videoUrl}
            currentTime={currentTime}
            segmentStart={activeSegment?.startTime ?? 0}
            segmentEnd={activeSegment?.endTime ?? duration}
            settings={settings}
            textOverlay={textOverlay}
            logoOverlay={logoOverlay}
            captions={{
              config: captionConfig,
              lines: captionLines,
              resolvedStyleMap: resolvedCaptionStyleMap,
            }}
            cropPath={analysisResult?.cropPath}
            peakTimes={analysisResult?.peakTimes}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            onVideoError={() =>
              setCodecError(
                'Browser could not decode this video track. Standard H.264 MP4 or VP8/VP9 WebM files work best.'
              )
            }
            onChangeCrop={(cropX, cropY) =>
              setSettings((prev) => ({
                ...prev,
                cropX,
                cropY,
                lockPosition:
                  prev.reframeMode === 'smart-follow' || prev.reframeMode === 'face-aware'
                    ? true
                    : prev.lockPosition,
              }))
            }
            onChangeSplitLayout={(splitLayout) =>
              setSettings((prev) => ({ ...prev, splitLayout }))
            }
          />

          {/* Transport + Timeline + Activity Score Graph */}
          <div className="rounded-md border border-[#2a3544] bg-[#151b22] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Pause video' : 'Play video'}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-sm cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <span className="font-mono-num text-sm text-[#eef2f6]">
                  {formatTimecode(currentTime)}{' '}
                  <span className="text-[#6c7a8c]">/ {formatTimecode(duration)}</span>
                </span>
              </div>

              <p className="text-[11px] text-[#9aa7b8] hidden sm:block">
                Shortcuts: Space Play/Pause · I/O In/Out · ←/→ Frame Step
              </p>
            </div>

            {activeSegment && (
              <Timeline
                duration={duration}
                currentTime={currentTime}
                startTime={activeSegment.startTime}
                endTime={activeSegment.endTime}
                segments={segments}
                activeSegmentId={activeSegment.id}
                activitySamples={analysisResult?.samples}
                suggestedMoments={analysisResult?.moments}
                onSeek={seekTo}
                onChangeRange={updateActiveRange}
                onStepFrame={handleStepFrame}
                onSelectSegment={handleSelectSegment}
              />
            )}
          </div>

          {/* Smart Moments Panel */}
          {APP_CONFIG.smartFeatures.enabled && activeSegment && (
            <SmartMomentsPanel
              duration={duration}
              activeRange={{ start: activeSegment.startTime, end: activeSegment.endTime }}
              ignoreHudEdges={settings.ignoreHudEdges}
              boostKeywordsRaw={boostKeywordsRaw}
              isAnalyzing={isAnalyzing}
              isAutoClipping={isAutoClipping}
              progress={analysisProgress}
              error={analysisError}
              result={analysisResult}
              onToggleIgnoreHud={(ignoreHudEdges) =>
                setSettings((prev) => ({ ...prev, ignoreHudEdges }))
              }
              onChangeBoostKeywords={setBoostKeywordsRaw}
              onRunAnalysis={handleRunSmartAnalysis}
              onAutoClipEverything={handleAutoClipEverythingClick}
              onCancelAnalysis={handleCancelAnalysis}
              onPreviewMoment={handlePreviewMoment}
              onAddMoment={handleAddMomentAsClip}
              onAddAllMoments={handleAddAllMoments}
              onApplyHookSuggestion={(moment, hookText) =>
                handleApplyHookSuggestion(moment.startTime, moment.endTime, hookText)
              }
            />
          )}

          {/* Multi-Clip Segments Panel */}
          <div className="rounded-md border border-[#2a3544] bg-[#151b22] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#e59a24]" />
                <h2 className="font-display text-lg font-bold text-[#eef2f6]">
                  Clip Segments ({segments.length})
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddSegment}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#39475a] bg-[#1c242e] hover:border-[#e59a24] text-xs font-medium text-[#eef2f6] whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#e59a24]" />
                  <span>Add Clip</span>
                </button>
                {segments.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => runExportForSegments(segments, { sequentialDownload: true })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#232d3a] hover:bg-[#2c3848] border border-[#39475a] text-xs font-medium text-[#eef2f6] whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <span>Export All ({segments.length})</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => runExportForSegments(segments, { bundleZip: true })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-xs font-semibold text-[#0e1217] whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Export All (.ZIP)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="divide-y divide-[#2a3544] border border-[#2a3544] rounded bg-[#0e1217]">
              {segments.map((seg) => {
                const isActive = seg.id === activeSegment?.id;
                return (
                  <div
                    key={seg.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 ${
                      isActive ? 'bg-[#1c242e]' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleSelectSegment(seg.id)}
                        aria-label={`Focus ${seg.name}`}
                        className={`px-2 py-1 rounded text-[11px] font-semibold shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-[#e59a24] text-[#0e1217]'
                            : 'border border-[#2a3544] text-[#9aa7b8] hover:text-[#eef2f6]'
                        }`}
                      >
                        {isActive ? 'Active' : 'Select'}
                      </button>

                      <input
                        type="text"
                        value={seg.name}
                        aria-label={`Rename segment ${seg.name}`}
                        onChange={(e) =>
                          setSegments((prev) =>
                            prev.map((item) =>
                              item.id === seg.id ? { ...item, name: e.target.value } : item
                            )
                          )
                        }
                        className="min-w-[100px] flex-1 max-w-[180px] rounded border border-transparent hover:border-[#2a3544] focus:border-[#e59a24] bg-transparent px-2 py-1 text-xs font-medium text-[#eef2f6] focus:outline-none"
                      />

                      <span className="font-mono-num text-[11px] text-[#9aa7b8] whitespace-nowrap">
                        {formatTimecode(seg.startTime)} – {formatTimecode(seg.endTime)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => runExportForSegments([seg])}
                        aria-label={`Export ${seg.name}`}
                        className="px-2.5 py-1 rounded border border-[#2a3544] hover:border-[#e59a24] text-[11px] font-medium text-[#eef2f6] disabled:opacity-50 cursor-pointer"
                      >
                        Export
                      </button>
                      {segments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSegment(seg.id)}
                          aria-label={`Delete ${seg.name}`}
                          className="p-1.5 rounded text-[#9aa7b8] hover:text-[#dc3545] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Looks Selector + Inspector Tabs + Export */}
        <div className="lg:col-span-5 space-y-4">
          {/* Looks (Templates) Selector */}
          <section
            aria-label="Looks templates"
            className="rounded-md border border-[#2a3544] bg-[#151b22] p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="editor-look-select" className="text-xs font-semibold text-[#eef2f6]">
                Looks
              </label>
              <span className="text-[11px] text-[#9aa7b8]">
                Styling &amp; framing only · keeps your trim &amp; logo
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                id="editor-look-select"
                value={selectedLookId}
                onChange={(e) => setSelectedLookId(e.target.value as LookTemplateId)}
                className="flex-1 min-w-0 rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-2 text-xs text-[#eef2f6]"
              >
                {LOOK_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.tagline}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const tpl = getTemplateById(selectedLookId);
                  if (tpl) applyLookTemplate(tpl);
                }}
                className="px-3.5 py-2 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Apply
              </button>

              {lookSnapshotBeforeApply && (
                <button
                  type="button"
                  onClick={handleResetLook}
                  className="px-3 py-2 rounded border border-[#39475a] bg-[#0e1217] hover:border-[#e59a24] text-[#eef2f6] text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {appliedLookSummary && (
              <div className="rounded border border-[#2a3544] bg-[#0e1217] p-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#e59a24]">
                    Applied Look: {appliedLookSummary.templateName}
                  </span>
                  {textOverlay.enabled && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('text')}
                        className="text-[#eef2f6] underline hover:text-[#e59a24] cursor-pointer"
                      >
                        Edit hook
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTextOverlay((prev) => ({ ...prev, enabled: false }))
                        }
                        className="text-[#9aa7b8] underline hover:text-[#eef2f6] cursor-pointer"
                      >
                        Turn off hook
                      </button>
                    </div>
                  )}
                </div>
                <ul className="space-y-0.5 text-[#9aa7b8]">
                  {appliedLookSummary.changes.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Inspector Card */}
          <div className="rounded-md border border-[#2a3544] bg-[#151b22] overflow-hidden">
            {/* Tab Bar */}
            <div
              role="tablist"
              aria-label="Editor tools"
              className="grid grid-cols-5 border-b border-[#2a3544] bg-[#0e1217]"
            >
              {(
                [
                  { id: 'framing', label: 'Framing', Icon: Scissors },
                  { id: 'captions', label: 'Captions', Icon: MessageSquareText },
                  { id: 'text', label: 'Hook', Icon: Type },
                  { id: 'logo', label: 'Logo', Icon: ImageIcon },
                  { id: 'audio', label: 'Speed', Icon: Volume2 },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center justify-center gap-1 py-2.5 px-1.5 text-[11px] sm:text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'border-[#e59a24] text-[#e59a24] bg-[#151b22]'
                        : 'border-transparent text-[#9aa7b8] hover:text-[#eef2f6]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 space-y-4">
              {activeTab === 'framing' && (
                <div className="space-y-4">
                  {/* One-click Platform Presets */}
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-[#eef2f6]">
                      One-Click Platform Presets
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PLATFORM_PRESETS.map((preset) => {
                        const selected =
                          activePlatform?.id === preset.id && !settings.keepOriginalFraming;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyPlatformPreset(preset)}
                            className={`px-2.5 py-2 rounded border text-xs font-medium transition-colors cursor-pointer ${
                              selected
                                ? 'border-[#e59a24] bg-[#e59a24]/15 text-[#e59a24]'
                                : 'border-[#2a3544] bg-[#0e1217] text-[#eef2f6] hover:border-[#39475a]'
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      })}
                    </div>
                    {activePlatform && !settings.keepOriginalFraming && (
                      <p className="text-[11px] text-[#9aa7b8]">{activePlatform.note}</p>
                    )}
                  </div>

                  {/* Aspect Ratios */}
                  <div className="space-y-2 border-t border-[#2a3544] pt-3">
                    <span className="block text-xs font-medium text-[#eef2f6]">Aspect Ratio</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePlatform(null);
                          setSettings((prev) => ({ ...prev, keepOriginalFraming: true }));
                        }}
                        className={`px-2.5 py-2 rounded border text-xs font-medium text-left cursor-pointer ${
                          settings.keepOriginalFraming
                            ? 'border-[#e59a24] bg-[#e59a24]/15 text-[#e59a24]'
                            : 'border-[#2a3544] bg-[#0e1217] text-[#eef2f6] hover:border-[#39475a]'
                        }`}
                      >
                        <div>Original</div>
                        <div className="text-[10px] text-[#9aa7b8]">Fast Copy</div>
                      </button>

                      {ASPECT_PRESETS.map((preset) => {
                        const selected =
                          !settings.keepOriginalFraming && settings.aspect === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setActivePlatform(null);
                              const hasSmart = Boolean(analysisResult?.cropPath.length);
                              setSettings((prev) => ({
                                ...prev,
                                keepOriginalFraming: false,
                                aspect: preset.id,
                                reframeMode:
                                  preset.id !== '9:16' && prev.reframeMode === 'split-layout'
                                    ? hasSmart
                                      ? 'smart-follow'
                                      : 'manual'
                                    : hasSmart && prev.reframeMode === 'manual' && !prev.lockPosition
                                      ? 'smart-follow'
                                      : prev.reframeMode,
                              }));
                            }}
                            className={`px-2.5 py-2 rounded border text-xs font-medium text-left cursor-pointer ${
                              selected
                                ? 'border-[#e59a24] bg-[#e59a24]/15 text-[#e59a24]'
                                : 'border-[#2a3544] bg-[#0e1217] text-[#eef2f6] hover:border-[#39475a]'
                            }`}
                          >
                            <div>{preset.label}</div>
                            <div className="text-[10px] text-[#9aa7b8] font-mono-num">
                              {preset.width}×{preset.height}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reframe Mode Selector for 9:16, 4:5, 1:1 */}
                  {!settings.keepOriginalFraming && settings.aspect !== '16:9' && (
                    <div className="space-y-2.5 border-t border-[#2a3544] pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="reframe-mode" className="text-xs font-medium text-[#eef2f6]">
                          Reframe Mode ({settings.aspect})
                        </label>
                        {(settings.reframeMode === 'smart-follow' ||
                          settings.reframeMode === 'face-aware') && (
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-[#9aa7b8] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.lockPosition}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  lockPosition: e.target.checked,
                                }))
                              }
                              className="accent-[#e59a24] w-3.5 h-3.5"
                            />
                            <span>Lock position</span>
                          </label>
                        )}
                      </div>

                      <select
                        id="reframe-mode"
                        value={settings.reframeMode}
                        onChange={(e) => applyReframeMode(e.target.value as ReframeMode)}
                        className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-2 text-xs text-[#eef2f6]"
                      >
                        <option value="smart-follow">
                          Smart follow (motion/audio center)
                        </option>
                        <option value="face-aware">
                          {browserSupportsFaceDetector
                            ? 'Face-aware (browser FaceDetector)'
                            : 'Face-aware (falls back to Smart follow)'}
                        </option>
                        <option value="manual">Manual crop (drag preview)</option>
                        <option value="blur-bg">Blurred background fill</option>
                        {settings.aspect === '9:16' && (
                          <option value="split-layout">
                            Split layout (Gameplay + Facecam)
                          </option>
                        )}
                      </select>

                      {(settings.reframeMode === 'smart-follow' ||
                        settings.reframeMode === 'face-aware') &&
                        !analysisResult && (
                          <p className="text-[11px] text-[#9aa7b8]">
                            Click{' '}
                            <button
                              type="button"
                              onClick={() => handleRunSmartAnalysis(false)}
                              className="text-[#e59a24] underline cursor-pointer"
                            >
                              Find best moments
                            </button>{' '}
                            to compute a smooth motion crop path, or drag preview to set a manual
                            crop.
                          </p>
                        )}

                      {settings.reframeMode === 'face-aware' && !browserSupportsFaceDetector && (
                        <p className="text-[11px] text-[#9aa7b8]">
                          This browser does not expose FaceDetector API — falling back cleanly to
                          motion-based Smart follow.
                        </p>
                      )}

                      {settings.reframeMode === 'blur-bg' && (
                        <div className="space-y-1 pt-1">
                          <label
                            htmlFor="fg-size"
                            className="block text-[11px] text-[#9aa7b8]"
                          >
                            Foreground size ({settings.foregroundSizePercent}%)
                          </label>
                          <input
                            id="fg-size"
                            type="range"
                            min={100}
                            max={140}
                            value={settings.foregroundSizePercent}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                foregroundSizePercent: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#e59a24]"
                          />
                        </div>
                      )}

                      {settings.reframeMode === 'split-layout' && settings.aspect === '9:16' && (
                        <div className="rounded border border-[#2a3544] bg-[#0e1217] p-3 space-y-2.5">
                          <div className="space-y-1">
                            <label
                              htmlFor="split-ratio"
                              className="block text-[11px] text-[#9aa7b8]"
                            >
                              Gameplay height ({settings.splitLayout.gameplayRatioPercent}% top /{' '}
                              {100 - settings.splitLayout.gameplayRatioPercent}% facecam bottom)
                            </label>
                            <input
                              id="split-ratio"
                              type="range"
                              min={50}
                              max={80}
                              value={settings.splitLayout.gameplayRatioPercent}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  splitLayout: {
                                    ...prev.splitLayout,
                                    gameplayRatioPercent: Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full accent-[#e59a24]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-[#9aa7b8]">Split scaling:</span>
                            <div className="flex items-center gap-1.5">
                              {(['blur', 'fill'] as const).map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() =>
                                    setSettings((prev) => ({
                                      ...prev,
                                      splitLayout: { ...prev.splitLayout, backgroundMode: m },
                                    }))
                                  }
                                  className={`px-2 py-1 rounded border text-[11px] capitalize cursor-pointer ${
                                    settings.splitLayout.backgroundMode === m
                                      ? 'border-[#e59a24] bg-[#e59a24]/15 text-[#eef2f6]'
                                      : 'border-[#2a3544] text-[#9aa7b8]'
                                  }`}
                                >
                                  {m === 'blur' ? 'Fit + Blur' : 'Fill Crop'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dynamic Zoom & Polish */}
                  {!settings.keepOriginalFraming && settings.format !== 'gif' && (
                    <div className="space-y-2 border-t border-[#2a3544] pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <label htmlFor="punch-zoom" className="font-medium text-[#eef2f6]">
                          Punch-in Zoom ({settings.zoom.punchZoom.toFixed(2)}×)
                        </label>
                        {(settings.zoom.slowZoom || settings.zoom.pulseOnPeaks) && (
                          <span className="text-[10px] text-[#e59a24]">Animated zoompass</span>
                        )}
                      </div>
                      <input
                        id="punch-zoom"
                        type="range"
                        min={1.0}
                        max={1.5}
                        step={0.05}
                        value={settings.zoom.punchZoom}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            zoom: { ...prev.zoom, punchZoom: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-[#e59a24]"
                      />
                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#9aa7b8]">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.zoom.slowZoom}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                zoom: { ...prev.zoom, slowZoom: e.target.checked },
                              }))
                            }
                            className="accent-[#e59a24] w-3.5 h-3.5"
                          />
                          <span>Slow zoom in</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.zoom.pulseOnPeaks}
                            disabled={!analysisResult || analysisResult.peakTimes.length === 0}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                zoom: { ...prev.zoom, pulseOnPeaks: e.target.checked },
                              }))
                            }
                            className="accent-[#e59a24] w-3.5 h-3.5 disabled:opacity-40"
                          />
                          <span>Pulse on loud peaks</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'captions' && activeSegment && (
                <CaptionsPanel
                  duration={duration}
                  activeRange={{ start: activeSegment.startTime, end: activeSegment.endTime }}
                  config={captionConfig}
                  lines={captionLines}
                  resolvedMixDecisions={resolvedMixDecisions}
                  hasAudioAnalysisSamples={Boolean(analysisResult?.samples?.length)}
                  language={captionLanguage}
                  computeMode={computeMode}
                  useEnglishOnlyModel={useEnglishOnlyModel}
                  rememberedGpuFailure={rememberedGpuFailure}
                  approximateWordTiming={approximateWordTiming}
                  isGenerating={isGeneratingCaptions}
                  progress={captionProgress}
                  statusNote={captionStatusNote}
                  error={captionError}
                  hasConsentedModel={hasConsentedModel}
                  onChangeLanguage={setCaptionLanguage}
                  onChangeComputeMode={(mode) => {
                    setComputeMode(mode);
                    saveComputeMode(mode);
                  }}
                  onChangeUseEnglishOnlyModel={setUseEnglishOnlyModel}
                  onClearGpuFailureMemory={() => {
                    clearRememberedGpuFailure();
                    setRememberedGpuFailure(false);
                  }}
                  onChangeConfig={handleChangeCaptionConfig}
                  onChangeLines={(nextLines) => {
                    setCaptionLines(nextLines);
                    if (nextLines.length === 0) {
                      setApproximateWordTiming(false);
                    }
                  }}
                  onGenerateWithConsent={handleGenerateCaptions}
                  onCancelGeneration={handleCancelCaptions}
                  onSeek={seekTo}
                />
              )}

              {activeTab === 'text' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[#eef2f6] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={textOverlay.enabled}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                        className="accent-[#e59a24] w-4 h-4"
                      />
                      <span>Enable Hook Title Overlay</span>
                    </label>

                    <label className="inline-flex items-center gap-1.5 text-[11px] text-[#9aa7b8] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(textOverlay.hookFade)}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({ ...prev, hookFade: e.target.checked }))
                        }
                        className="accent-[#e59a24] w-3.5 h-3.5"
                      />
                      <span>Fade in/out</span>
                    </label>
                  </div>

                  {/* 3 Editable 3-second Hook Templates */}
                  <div className="space-y-1">
                    <span className="block text-[11px] text-[#9aa7b8]">
                      Quick 3-second hook templates (editable):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {HOOK_TEMPLATES.map((tpl) => {
                        const s = activeSegment?.startTime ?? 0;
                        const e = Math.min(duration || s + 3, s + 3);
                        return (
                          <button
                            key={tpl}
                            type="button"
                            onClick={() =>
                              setTextOverlay((prev) => ({
                                ...prev,
                                enabled: true,
                                text: tpl,
                                position: 'top',
                                startTime: Number(s.toFixed(2)),
                                endTime: Number(e.toFixed(2)),
                                hookFade: true,
                              }))
                            }
                            className="px-2 py-1 rounded border border-[#2a3544] bg-[#0e1217] hover:border-[#e59a24] text-[10px] text-[#eef2f6] cursor-pointer"
                          >
                            {tpl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="txt-caption" className="block text-xs text-[#9aa7b8]">
                      Hook Title Text
                    </label>
                    <input
                      id="txt-caption"
                      type="text"
                      maxLength={80}
                      value={textOverlay.text}
                      onChange={(e) =>
                        setTextOverlay((prev) => ({
                          ...prev,
                          text: e.target.value,
                          enabled: e.target.value.trim().length > 0 ? true : prev.enabled,
                        }))
                      }
                      placeholder="Wait for the final shot..."
                      className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-3 py-2 text-sm text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="txt-pos" className="block text-xs text-[#9aa7b8]">
                        Position
                      </label>
                      <select
                        id="txt-pos"
                        value={textOverlay.position}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({
                            ...prev,
                            position: e.target.value as 'top' | 'bottom',
                          }))
                        }
                        className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-2 text-xs text-[#eef2f6]"
                      >
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="txt-font" className="block text-xs text-[#9aa7b8]">
                        Bundled Font
                      </label>
                      <select
                        id="txt-font"
                        value={textOverlay.font}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({
                            ...prev,
                            font: e.target.value as TextOverlayConfig['font'],
                          }))
                        }
                        className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-2 text-xs text-[#eef2f6]"
                      >
                        {(Object.keys(BUNDLED_FONTS) as OverlayFontId[]).map((fid) => (
                          <option key={fid} value={fid}>
                            {BUNDLED_FONTS[fid].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label htmlFor="txt-size" className="block text-xs text-[#9aa7b8]">
                        Size ({textOverlay.fontSize})
                      </label>
                      <input
                        id="txt-size"
                        type="range"
                        min={28}
                        max={84}
                        value={textOverlay.fontSize}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({ ...prev, fontSize: Number(e.target.value) }))
                        }
                        className="w-full accent-[#e59a24]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="txt-color" className="block text-xs text-[#9aa7b8]">
                        Color ({textOverlay.color})
                      </label>
                      <input
                        id="txt-color"
                        type="color"
                        value={textOverlay.color}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({ ...prev, color: e.target.value }))
                        }
                        className="w-full h-8 p-0.5 rounded border border-[#2a3544] bg-[#0e1217] cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="txt-outline" className="block text-xs text-[#9aa7b8]">
                        Outline ({textOverlay.outlineWidth}px)
                      </label>
                      <input
                        id="txt-outline"
                        type="range"
                        min={0}
                        max={8}
                        value={textOverlay.outlineWidth}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({
                            ...prev,
                            outlineWidth: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#e59a24]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label htmlFor="txt-start" className="block text-xs text-[#9aa7b8]">
                        Show From (s)
                      </label>
                      <input
                        id="txt-start"
                        type="number"
                        step="0.1"
                        min={0}
                        max={duration}
                        value={textOverlay.startTime}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({
                            ...prev,
                            startTime: clampTime(Number(e.target.value), 0, duration),
                          }))
                        }
                        className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-1.5 text-xs font-mono-num text-[#eef2f6]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="txt-end" className="block text-xs text-[#9aa7b8]">
                        Hide At (s)
                      </label>
                      <input
                        id="txt-end"
                        type="number"
                        step="0.1"
                        min={0}
                        max={duration}
                        value={textOverlay.endTime}
                        onChange={(e) =>
                          setTextOverlay((prev) => ({
                            ...prev,
                            endTime: clampTime(Number(e.target.value), 0, duration),
                          }))
                        }
                        className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-1.5 text-xs font-mono-num text-[#eef2f6]"
                      />
                    </div>
                  </div>

                  {activeSegment && (
                    <button
                      type="button"
                      onClick={() =>
                        setTextOverlay((prev) => ({
                          ...prev,
                          startTime: activeSegment.startTime,
                          endTime: activeSegment.endTime,
                        }))
                      }
                      className="text-xs text-[#e59a24] hover:underline cursor-pointer"
                    >
                      Match active clip range ({formatTimecode(activeSegment.startTime)} –{' '}
                      {formatTimecode(activeSegment.endTime)})
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'logo' && (
                <div className="space-y-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/*"
                    onChange={handleLogoUpload}
                    className="sr-only"
                    aria-label="Upload PNG logo watermark"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#39475a] bg-[#0e1217] hover:border-[#e59a24] text-xs font-medium text-[#eef2f6] cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#e59a24]" />
                      <span>Upload PNG Logo</span>
                    </button>

                    <Link
                      to="/watermark-maker"
                      className="text-xs text-[#e59a24] hover:underline"
                    >
                      Or build one in Watermark Maker →
                    </Link>
                  </div>

                  {logoOverlay.dataUrl ? (
                    <>
                      <div className="flex items-center justify-between rounded border border-[#2a3544] bg-[#0e1217] px-3 py-2">
                        <label className="inline-flex items-center gap-2 text-xs text-[#eef2f6] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={logoOverlay.enabled}
                            onChange={(e) =>
                              setLogoOverlay((prev) => ({ ...prev, enabled: e.target.checked }))
                            }
                            className="accent-[#e59a24] w-4 h-4"
                          />
                          <span className="truncate max-w-[180px]">{logoOverlay.fileName}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setLogoOverlay(INITIAL_LOGO)}
                          className="text-xs text-[#9aa7b8] hover:text-[#dc3545] cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="logo-corner" className="block text-xs text-[#9aa7b8]">
                          Corner Position
                        </label>
                        <select
                          id="logo-corner"
                          value={logoOverlay.corner}
                          onChange={(e) =>
                            setLogoOverlay((prev) => ({
                              ...prev,
                              corner: e.target.value as LogoCorner,
                            }))
                          }
                          className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-2 text-xs text-[#eef2f6]"
                        >
                          <option value="top-left">Top Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="bottom-right">Bottom Right</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label htmlFor="logo-size" className="block text-xs text-[#9aa7b8]">
                            Width ({logoOverlay.sizePercent}%)
                          </label>
                          <input
                            id="logo-size"
                            type="range"
                            min={8}
                            max={45}
                            value={logoOverlay.sizePercent}
                            onChange={(e) =>
                              setLogoOverlay((prev) => ({
                                ...prev,
                                sizePercent: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#e59a24]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="logo-opacity" className="block text-xs text-[#9aa7b8]">
                            Opacity ({Math.round(logoOverlay.opacity * 100)}%)
                          </label>
                          <input
                            id="logo-opacity"
                            type="range"
                            min={10}
                            max={100}
                            value={Math.round(logoOverlay.opacity * 100)}
                            onChange={(e) =>
                              setLogoOverlay((prev) => ({
                                ...prev,
                                opacity: Number(e.target.value) / 100,
                              }))
                            }
                            className="w-full accent-[#e59a24]"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-[#9aa7b8]">
                      No PNG watermark attached yet. Upload a transparent PNG or generate one in the
                      Watermark Maker.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'audio' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="clip-speed" className="block text-xs font-medium text-[#eef2f6]">
                      Playback &amp; Export Speed ({settings.speed.toFixed(2)}×)
                    </label>
                    <input
                      id="clip-speed"
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={settings.speed}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, speed: Number(e.target.value) }))
                      }
                      className="w-full accent-[#e59a24]"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setSettings((prev) => ({ ...prev, speed: spd }))}
                          className={`px-2 py-1 rounded border text-xs font-mono-num cursor-pointer ${
                            Math.abs(settings.speed - spd) < 0.01
                              ? 'border-[#e59a24] bg-[#e59a24]/15 text-[#e59a24]'
                              : 'border-[#2a3544] bg-[#0e1217] text-[#9aa7b8]'
                          }`}
                        >
                          {spd}×
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#2a3544] pt-3 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, muted: !prev.muted }))}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded border border-[#2a3544] bg-[#0e1217] text-xs font-medium text-[#eef2f6] cursor-pointer"
                    >
                      {settings.muted ? (
                        <VolumeX className="w-4 h-4 text-[#dc3545]" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-[#e59a24]" />
                      )}
                      <span>{settings.muted ? 'Audio Muted' : 'Audio Enabled'}</span>
                    </button>

                    {!settings.muted && (
                      <div className="space-y-1">
                        <label htmlFor="clip-vol" className="block text-xs text-[#9aa7b8]">
                          Audio Volume ({Math.round(settings.volume * 100)}%)
                        </label>
                        <input
                          id="clip-vol"
                          type="range"
                          min={0}
                          max={150}
                          value={Math.round(settings.volume * 100)}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              volume: Number(e.target.value) / 100,
                            }))
                          }
                          className="w-full accent-[#e59a24]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Export Panel */}
          <div className="rounded-md border border-[#2a3544] bg-[#151b22] p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-[#eef2f6]">Export Clip</h2>
              <span
                className={`text-xs font-medium ${
                  processingMode === 'fast-copy' ? 'text-[#2ea043]' : 'text-[#e59a24]'
                }`}
              >
                {processingMode === 'fast-copy'
                  ? 'Fast Mode (-c copy)'
                  : 'Re-encode (H.264 + AAC)'}
              </span>
            </div>

            <p className="text-xs text-[#9aa7b8] leading-relaxed">
              {processingMode === 'fast-copy'
                ? 'Original framing with no overlays, captions, zoom, or speed edits: streams copy directly in seconds.'
                : 'Framing, captions, hook title, zoom, logo, speed, quality, or GIF format active: re-encoding locally in one single-pass filtergraph.'}
            </p>

            {processingMode === 're-encode' && activeClipDuration > 45 && (
              <div className="rounded border border-[#e59a24]/50 bg-[#e59a24]/10 px-3 py-2 text-[11px] text-[#eef2f6] flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#e59a24] shrink-0 mt-0.5" />
                <span>
                  Single-threaded WebAssembly re-encoding on a {activeClipDuration.toFixed(0)}s clip
                  may take 1–3+ minutes depending on resolution and filters. Keep this tab open or
                  use Small file (720p) for faster exports.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="exp-format" className="block text-xs text-[#9aa7b8]">
                  Format
                </label>
                <select
                  id="exp-format"
                  value={settings.format}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, format: e.target.value as ExportFormat }))
                  }
                  className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-2 text-xs text-[#eef2f6]"
                >
                  <option value="mp4">MP4 (H.264 + AAC)</option>
                  <option value="gif">Animated GIF</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="exp-quality" className="block text-xs text-[#9aa7b8]">
                  Quality Preset
                </label>
                <select
                  id="exp-quality"
                  disabled={settings.format === 'gif'}
                  value={settings.quality}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, quality: e.target.value as ExportQuality }))
                  }
                  className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-2 text-xs text-[#eef2f6] disabled:opacity-50"
                >
                  <option value="shorts">Shorts / TikTok / Reels (1080×1920)</option>
                  <option value="balanced">Balanced (CRF 23)</option>
                  <option value="small">Small file (CRF 28 · 720p)</option>
                </select>
              </div>
            </div>

            {isExporting && exportProgress ? (
              <div className="space-y-2.5 rounded border border-[#39475a] bg-[#0e1217] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#eef2f6]">{exportProgress.message}</span>
                  <span className="font-mono-num text-[#e59a24]">{exportProgress.percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#1c242e] overflow-hidden">
                  <div
                    style={{ width: `${exportProgress.percent}%` }}
                    className="h-full bg-[#e59a24] transition-all duration-150"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCancelExport}
                  className="w-full py-2 rounded border border-[#dc3545]/70 bg-[#dc3545]/15 hover:bg-[#dc3545]/25 text-xs font-semibold text-[#f8d7da] cursor-pointer"
                >
                  Cancel Export
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!activeSegment}
                onClick={() => activeSegment && runExportForSegments([activeSegment])}
                className="w-full py-3 px-4 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  Export {activeSegment?.name || 'Clip'} ({formatTimecode(activeClipDuration)})
                </span>
              </button>
            )}

            {exportError && (
              <div
                role="alert"
                className="rounded border border-[#dc3545]/60 bg-[#dc3545]/10 px-3 py-2 text-xs text-[#f8d7da]"
              >
                {exportError}
              </div>
            )}

            {exportStatusNote && !exportError && (
              <p role="status" className="text-xs text-[#9aa7b8] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2ea043] shrink-0" />
                <span>{exportStatusNote}</span>
              </p>
            )}

            {/* Finished Downloads */}
            {outputs.length > 0 && (
              <div className="border-t border-[#2a3544] pt-3 space-y-2">
                <span className="block text-xs font-medium text-[#eef2f6]">Ready to Download</span>
                <div className="space-y-2">
                  {outputs.map((out) => (
                    <div
                      key={out.id}
                      className="flex items-center justify-between gap-2 rounded border border-[#2a3544] bg-[#0e1217] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#eef2f6] truncate">{out.name}</div>
                        <div className="text-[11px] font-mono-num text-[#9aa7b8]">
                          {formatFileSize(out.sizeBytes)} · {out.durationSec.toFixed(1)}s
                        </div>
                      </div>
                      <a
                        href={out.url}
                        download={out.name}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2ea043] hover:bg-[#38b850] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monetization-ready slots well away from Export / Download actions */}
      <div className="pt-4 space-y-4">
        <AdSlot placement="below-editor" />
        <div className="max-w-sm">
          <AdSlot placement="sidebar" />
        </div>
      </div>

      {/* Crawlable bottom summary for /editor SEO */}
      <section className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 space-y-2 text-xs text-[#9aa7b8]">
        <h2 className="font-display text-lg font-bold text-[#eef2f6]">
          In-Browser Video Clipper Features &amp; Privacy
        </h2>
        <p className="leading-relaxed">
          {APP_CONFIG.appName} processes MP4, MOV, and WebM recordings locally in browser memory
          using WebAssembly. Trim fast with <code className="font-mono-num text-[#eef2f6]">-c copy</code>,
          reframe to 9:16 Shorts, TikTok, Instagram Reels, or Facebook Reels with Smart follow or
          blurred backgrounds,{' '}
          {APP_CONFIG.ENABLE_AUTO_CAPTIONS
            ? 'generate optional Whisper captions'
            : 'style and burn in manual or .SRT captions'}
          , and export single clips or a ZIP archive without uploading files.
        </p>
      </section>

      {/* Auto Clip Everything Speech Model Consent Modal */}
      {APP_CONFIG.ENABLE_AUTO_CAPTIONS && showAutoClipConsent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="autoclip-consent-title"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-md border border-[#39475a] bg-[#151b22] p-5 space-y-4 shadow-xl">
            <h3 id="autoclip-consent-title" className="font-display text-xl font-bold text-[#eef2f6]">
              Include On-Device Auto Captions?
            </h3>
            <p className="text-xs text-[#eef2f6] leading-relaxed">
              Runs on your device. Your video is not uploaded. Model weights are downloaded once and
              cached locally. Any earlier <code className="font-mono-num">whisper-tiny</code> cache
              is not reused.
            </p>
            <fieldset className="space-y-2">
              <legend className="text-[11px] font-medium text-[#9aa7b8] mb-1">
                Choose speech mode
              </legend>

              <label
                className={`flex items-start gap-2.5 rounded border p-2.5 cursor-pointer transition-colors ${
                  pendingAutoClipComputeMode === 'cpu'
                    ? 'border-[#e59a24] bg-[#e59a24]/10'
                    : 'border-[#2a3544] bg-[#0e1217] hover:border-[#39475a]'
                }`}
              >
                <input
                  type="radio"
                  name="autoclip-consent-mode"
                  value="cpu"
                  checked={pendingAutoClipComputeMode === 'cpu'}
                  onChange={() => setPendingAutoClipComputeMode('cpu')}
                  className="mt-0.5 accent-[#e59a24]"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#eef2f6]">
                    Light (CPU, about {APP_CONFIG.captions.estimatedModelSizeMB} MB)
                  </div>
                  <div className="text-[11px] text-[#9aa7b8]">
                    Default · Smaller quantized q8 download. Works without WebGPU; runs slower in
                    chunks.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 rounded border p-2.5 cursor-pointer transition-colors ${
                  pendingAutoClipComputeMode === 'gpu'
                    ? 'border-[#e59a24] bg-[#e59a24]/10'
                    : 'border-[#2a3544] bg-[#0e1217] hover:border-[#39475a]'
                }`}
              >
                <input
                  type="radio"
                  name="autoclip-consent-mode"
                  value="gpu"
                  checked={pendingAutoClipComputeMode === 'gpu'}
                  onChange={() => setPendingAutoClipComputeMode('gpu')}
                  className="mt-0.5 accent-[#e59a24]"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#eef2f6]">
                    Fast (GPU, about {APP_CONFIG.captions.estimatedGpuModelSizeMB} MB, only if
                    WebGPU works)
                  </div>
                  <div className="text-[11px] text-[#9aa7b8]">
                    Full fp32 weights for WebGPU. Automatically falls back to CPU if WebGPU fails or
                    is unavailable.
                  </div>
                </div>
              </label>
            </fieldset>

            <div className="rounded border border-[#2a3544] bg-[#0e1217] p-3 text-[11px] text-[#9aa7b8] space-y-1 font-mono-num">
              <div>
                Model:{' '}
                {resolveWhisperModelId({
                  defaultModelId: APP_CONFIG.captions.MODEL_ID,
                  englishModelId: APP_CONFIG.captions.ENGLISH_MODEL_ID,
                  language: captionLanguage,
                  useEnglishOnlyModel,
                })}
              </div>
              <div>
                Selected size: ~
                {pendingAutoClipComputeMode === 'gpu'
                  ? APP_CONFIG.captions.estimatedGpuModelSizeMB
                  : APP_CONFIG.captions.estimatedModelSizeMB}{' '}
                MB ({pendingAutoClipComputeMode === 'gpu' ? 'Fast · WebGPU fp32' : 'Light · CPU q8'})
              </div>
              <div className="truncate">Host: {APP_CONFIG.captions.MODEL_BASE_URL}</div>
            </div>

            {pendingAutoClipComputeMode === 'gpu' && rememberedGpuFailure && (
              <div className="rounded border border-[#e59a24]/40 bg-[#e59a24]/10 p-2.5 text-[11px] text-[#eef2f6]">
                Note: WebGPU failed on an earlier run in this browser. If GPU fails again,
                transcription automatically falls back to CPU.
              </div>
            )}

            {isLowMemoryOrMobileDevice() && (
              <div className="rounded border border-[#e59a24]/50 bg-[#e59a24]/10 p-2.5 text-xs text-[#eef2f6] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#e59a24] shrink-0 mt-0.5" />
                <span>
                  Mobile / low-memory device detected. Generating captions plus multi-clip analysis
                  may be slow; you can also run motion/audio detection without captions.
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAutoClipConsent(false)}
                className="px-3 py-2 rounded border border-[#39475a] bg-[#0e1217] hover:bg-[#1c242e] text-xs font-medium text-[#eef2f6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAutoClipConsent(false);
                  void runAutoClipPipeline(false);
                }}
                className="px-3 py-2 rounded border border-[#39475a] bg-[#1c242e] hover:border-[#e59a24] text-xs font-medium text-[#eef2f6] cursor-pointer"
              >
                Moments Only (Skip Model)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAutoClipConsent(false);
                  setComputeMode(pendingAutoClipComputeMode);
                  saveComputeMode(pendingAutoClipComputeMode);
                  void runAutoClipPipeline(true, pendingAutoClipComputeMode);
                }}
                className="px-3.5 py-2 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-xs font-semibold text-[#0e1217] cursor-pointer"
              >
                Download Model &amp; Auto Clip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Clip Everything Review Modal */}
      <AutoClipReviewModal
        isOpen={showAutoClipReview}
        duration={duration}
        segments={segments}
        moments={analysisResult?.moments ?? []}
        hookSuggestionsBySegmentId={hookSuggestionsBySegId}
        hasCaptions={captionConfig.enabled && captionLines.length > 0}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportError={exportError}
        exportStatusNote={exportStatusNote}
        onClose={() => setShowAutoClipReview(false)}
        onUpdateSegment={(id, patch) =>
          setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
        }
        onDeleteSegment={handleDeleteSegment}
        onFocusSegment={handleSelectSegment}
        onApplyHookSuggestion={(seg, hookText) =>
          handleApplyHookSuggestion(seg.startTime, seg.endTime, hookText)
        }
        onExportSingle={(seg) => runExportForSegments([seg])}
        onExportAllZip={(segs) => runExportForSegments(segs, { bundleZip: true })}
        onExportAllSequential={(segs) => runExportForSegments(segs, { sequentialDownload: true })}
        onCancelExport={handleCancelExport}
      />
    </div>
  );
}
