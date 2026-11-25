import { APP_CONFIG } from '../config/appConfig';

export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="64" height="64" rx="12" fill="#151b22" />
      <rect x="2.5" y="2.5" width="59" height="59" rx="10" stroke="#2a3544" strokeWidth="2" />
      <path
        d="M14 20h10v-5h-10a4 4 0 0 0-4 4v10h4v-9zm36 0v9h4v-10a4 4 0 0 0-4-4H40v5h10zm0 24H40v5h10a4 4 0 0 0 4-4V35h-4v9zm-36 0v-9h-4v10a4 4 0 0 0 4 4h10v-5H14z"
        fill="#9aa7b8"
      />
      <rect x="21" y="13" width="22" height="38" rx="3" stroke="#e59a24" strokeWidth="3.5" fill="#0e1217" />
      <path d="M29 25.5L39 32L29 38.5V25.5Z" fill="#e59a24" />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const iconSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
  const textSize = size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <LogoMark className={`${iconSize} shrink-0`} />
      <span className={`font-display ${textSize} font-bold tracking-tight leading-none`}>
        {APP_CONFIG.appName}
      </span>
    </span>
  );
}
