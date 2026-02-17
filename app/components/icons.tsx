import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function RadarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 4v8l6 3" />
    </BaseIcon>
  );
}

export function BroadcastIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 12h2m12 0h2M7.2 7.2l1.4 1.4m6.8 6.8 1.4 1.4M7.2 16.8l1.4-1.4m6.8-6.8 1.4-1.4" />
      <circle cx="12" cy="12" r="2.4" />
    </BaseIcon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </BaseIcon>
  );
}

export function HostIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 19v-1.8A3.2 3.2 0 0 1 8.2 14h7.6a3.2 3.2 0 0 1 3.2 3.2V19" />
      <circle cx="12" cy="8" r="3" />
    </BaseIcon>
  );
}

export function AttendeeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 19v-1.6a2.8 2.8 0 0 1 2.8-2.8h10.4a2.8 2.8 0 0 1 2.8 2.8V19" />
      <circle cx="9" cy="8" r="2.4" />
      <path d="M15 9.4h4M17 7.4v4" />
    </BaseIcon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3l7 3v5c0 4.4-2.7 7.8-7 10-4.3-2.2-7-5.6-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </BaseIcon>
  );
}
