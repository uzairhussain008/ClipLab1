import React, { createContext, useContext, useEffect, useState } from 'react';
import type { TransferredLogo } from '../types/editor';

interface ClipLabContextValue {
  videoFile: File | null;
  videoUrl: string | null;
  fileWarnings: string[];
  setSourceVideo: (file: File, warnings?: string[]) => void;
  clearSourceVideo: () => void;
  transferredLogo: TransferredLogo | null;
  setTransferredLogo: (logo: TransferredLogo | null) => void;
  cookieConsent: 'pending' | 'accepted' | 'essential';
  setCookieConsent: (status: 'accepted' | 'essential') => void;
  reopenCookieBanner: () => void;
}

const ClipLabContext = createContext<ClipLabContextValue | null>(null);

const CONSENT_STORAGE_KEY = 'cliplab_cookie_consent_v1';

export function ClipLabProvider({ children }: { children: React.ReactNode }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [transferredLogo, setTransferredLogo] = useState<TransferredLogo | null>(null);
  const [cookieConsent, setCookieConsentState] = useState<'pending' | 'accepted' | 'essential'>(() => {
    if (typeof window === 'undefined') return 'pending';
    try {
      const saved = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (saved === 'accepted' || saved === 'essential') return saved;
    } catch {
      // ignore storage failure
    }
    return 'pending';
  });

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const setSourceVideo = (file: File, warnings: string[] = []) => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(nextUrl);
    setFileWarnings(warnings);
  };

  const clearSourceVideo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl(null);
    setFileWarnings([]);
  };

  const setCookieConsent = (status: 'accepted' | 'essential') => {
    setCookieConsentState(status);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, status);
    } catch {
      // ignore storage failure
    }
  };

  const reopenCookieBanner = () => {
    setCookieConsentState('pending');
  };

  return (
    <ClipLabContext.Provider
      value={{
        videoFile,
        videoUrl,
        fileWarnings,
        setSourceVideo,
        clearSourceVideo,
        transferredLogo,
        setTransferredLogo,
        cookieConsent,
        setCookieConsent,
        reopenCookieBanner,
      }}
    >
      {children}
    </ClipLabContext.Provider>
  );
}

export function useClipLab(): ClipLabContextValue {
  const ctx = useContext(ClipLabContext);
  if (!ctx) {
    throw new Error('useClipLab must be used inside ClipLabProvider');
  }
  return ctx;
}
