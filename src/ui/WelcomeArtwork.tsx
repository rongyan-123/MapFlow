import { useId } from 'react';
import paperJourney from '../assets/mapflow/welcome-paper.webp';
import './brand-art.css';

export function WelcomeArtwork({ className = '' }: { className?: string }) {
  const illustrationId = `mf-orbit-${useId().replace(/:/g, '')}`;

  return (
    <div className={`mf-welcome-art ${className}`} aria-hidden="true">
      <img className="mf-welcome-art-paper" src={paperJourney} width="1916" height="821" alt="" draggable="false" />
      <svg className="mf-welcome-art-graphite" viewBox="0 0 560 240" fill="none" focusable="false">
        <defs>
          <radialGradient id={`${illustrationId}-atmosphere`}>
            <stop stopColor="#A28AE8" stopOpacity=".16" />
            <stop offset="1" stopColor="#A28AE8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${illustrationId}-route`} x1="76" y1="195" x2="437" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8E78C6" stopOpacity="0" />
            <stop offset=".28" stopColor="#B9A5FF" stopOpacity=".37" />
            <stop offset=".65" stopColor="#D8CCFF" stopOpacity=".9" />
            <stop offset="1" stopColor="#A28AE8" stopOpacity=".12" />
          </linearGradient>
          <linearGradient id={`${illustrationId}-far-route`} x1="459" y1="42" x2="109" y2="201" gradientUnits="userSpaceOnUse">
            <stop stopColor="#B9A5FF" stopOpacity="0" />
            <stop offset=".48" stopColor="#B9A5FF" stopOpacity=".34" />
            <stop offset="1" stopColor="#B9A5FF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${illustrationId}-sphere`} cx=".29" cy=".25" r=".8">
            <stop stopColor="#F4EFFF" />
            <stop offset=".19" stopColor="#D4C5FF" />
            <stop offset=".56" stopColor="#A68BE7" />
            <stop offset=".86" stopColor="#685499" />
            <stop offset="1" stopColor="#403451" />
          </radialGradient>
          <radialGradient id={`${illustrationId}-small-sphere`} cx=".28" cy=".22" r=".85">
            <stop stopColor="#F3F0FF" />
            <stop offset=".38" stopColor="#CBC5E9" />
            <stop offset="1" stopColor="#595773" />
          </radialGradient>
          <radialGradient id={`${illustrationId}-glow`}>
            <stop stopColor="#B9A5FF" stopOpacity=".23" />
            <stop offset=".42" stopColor="#A486F3" stopOpacity=".1" />
            <stop offset="1" stopColor="#A486F3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="315" cy="112" rx="242" ry="110" fill={`url(#${illustrationId}-atmosphere)`} />
        <ellipse cx="418" cy="85" rx="67" ry="62" fill={`url(#${illustrationId}-glow)`} />
        <circle cx="169" cy="86" r="33" fill={`url(#${illustrationId}-glow)`} />
        <g strokeLinecap="round" strokeWidth=".8">
          <path d="M70 190C82 128 291 2 402 30c108 28-67 175-171 183" stroke={`url(#${illustrationId}-far-route)`} />
          <path d="M52 194C55 157 224 50 313 36c107-18 78 54-20 120C193 224 40 246 52 194Z" stroke={`url(#${illustrationId}-route)`} />
          <path d="M100 204C170 222 400 162 478 119c109-60-22-93-145-47C204 120 97 208 100 204Z" stroke={`url(#${illustrationId}-far-route)`} />
          <path d="M120 209C224 200 391 109 417 77c37-47-23-47-102-24" stroke={`url(#${illustrationId}-route)`} />
        </g>
        <circle cx="169" cy="86" r="7.5" fill={`url(#${illustrationId}-sphere)`} stroke="#DDCFFF" strokeOpacity=".45" strokeWidth=".7" />
        <circle cx="303" cy="151" r="7" fill={`url(#${illustrationId}-small-sphere)`} stroke="#E6DEFF" strokeOpacity=".6" strokeWidth=".7" />
        <circle cx="418" cy="85" r="19" fill={`url(#${illustrationId}-sphere)`} stroke="#DACAFF" strokeOpacity=".52" strokeWidth=".8" />
        <path d="m456 166 1.5 3.8 3.8 1.5-3.8 1.5-1.5 3.8-1.5-3.8-3.8-1.5 3.8-1.5 1.5-3.8Z" fill="#C3B1FF" opacity=".24" />
        <circle cx="109" cy="144" r="1.1" fill="#D4C5FF" opacity=".38" />
        <circle cx="372" cy="199" r=".9" fill="#D4C5FF" opacity=".28" />
      </svg>
    </div>
  );
}
