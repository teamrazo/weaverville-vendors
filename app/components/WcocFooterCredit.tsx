import type { CSSProperties } from 'react';

// Standard footer credit for every Weaverville Chamber of Commerce site.
// Copy is identical across projects; each site passes its own colors and font.
const WEBASSETFX_URL = 'https://pillar.razorsharpnetworks.com/webassetfx-smart-sites';
const AUTOMATE_URL = 'https://pillar.razorsharpnetworks.com/automate-ai-agents-overview';

export default function WcocFooterCredit({
  className = '',
  textClass = 'text-white/70',
  mutedClass = 'text-white/50',
  linkClass = 'hover:text-white',
  style,
}: {
  className?: string;
  textClass?: string;
  mutedClass?: string;
  linkClass?: string;
  style?: CSSProperties;
}) {
  const link = `underline underline-offset-2 transition-colors ${linkClass}`;
  return (
    <div className={`space-y-0.5 text-center text-xs leading-snug ${className}`} style={style}>
      <p className={textClass}>&copy; 2026 Weaverville Chamber of Commerce. All rights reserved.</p>
      <p className={textClass}>Celebrating historic Western heritage and community traditions since 1909</p>
      <p className={mutedClass}>
        Powered By RazoRSharp Networks:{' '}
        <a href={WEBASSETFX_URL} target="_blank" rel="noopener noreferrer" className={link}>
          WebAssetFX
        </a>
        {' & '}
        <a href={AUTOMATE_URL} target="_blank" rel="noopener noreferrer" className={link}>
          AutoMATE&trade; AI Technology
        </a>
      </p>
    </div>
  );
}
