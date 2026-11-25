import { APP_CONFIG } from '../config/appConfig';

export type AdPlacement = 'sidebar' | 'below-editor' | 'footer';

interface AdSlotProps {
  placement: AdPlacement;
  className?: string;
}

const PLACEMENT_STYLES: Record<
  AdPlacement,
  { minHeight: string; label: string; slotKey: keyof typeof APP_CONFIG.adConfig.slots }
> = {
  sidebar: {
    minHeight: 'min-h-[250px]',
    label: 'Sidebar Advertisement (300×250)',
    slotKey: 'sidebar',
  },
  'below-editor': {
    minHeight: 'min-h-[90px]',
    label: 'Leaderboard Advertisement (728×90)',
    slotKey: 'belowEditor',
  },
  footer: {
    minHeight: 'min-h-[90px]',
    label: 'Footer Advertisement (728×90)',
    slotKey: 'footer',
  },
};

/**
 * Network-agnostic ad container with reserved dimensions to prevent layout shift (CLS).
 * When APP_CONFIG.adsEnabled is false, no ad scripts or ad labels load, while space remains reserved.
 */
export function AdSlot({ placement, className = '' }: AdSlotProps) {
  const meta = PLACEMENT_STYLES[placement];

  if (!APP_CONFIG.adsEnabled) {
    return (
      <div
        aria-hidden="true"
        data-ad-reserved={placement}
        className={`w-full ${meta.minHeight} ${className}`}
      />
    );
  }

  const unitId = APP_CONFIG.adConfig.slots[meta.slotKey];

  return (
    <aside
      aria-label="Sponsored placement"
      data-ad-network={APP_CONFIG.adConfig.network}
      data-ad-publisher={APP_CONFIG.adConfig.publisherId}
      data-ad-slot={unitId}
      className={`w-full rounded-md border border-[#2a3544] bg-[#151b22] flex flex-col items-center justify-center px-4 py-3 text-center ${meta.minHeight} ${className}`}
    >
      <span className="text-[11px] uppercase tracking-wider text-[#6c7a8c]">Advertisement</span>
      <span className="text-xs text-[#9aa7b8] mt-1">{meta.label}</span>
    </aside>
  );
}
