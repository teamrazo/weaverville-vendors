import { ImageResponse } from 'next/og';
import { CHAMBER_NAME, FEATURED_EVENT, SHARE_SUBTITLE, SHARE_TITLE } from './lib/site';
import { formatFee } from './lib/events';

export const alt = `${SHARE_TITLE}. ${SHARE_SUBTITLE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Load brand fonts from Google Fonts. Falls back to the default font if
// Google is unreachable at build time, so the card always renders.
async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function Image() {
  const [cinzel, sans, sansBold] = await Promise.all([
    loadFont('Cinzel', 700),
    loadFont('Open Sans', 400),
    loadFont('Open Sans', 700),
  ]);
  const titleFont = cinzel ? 'Cinzel' : 'serif';
  const bodyFont = sans ? 'Open Sans' : 'sans-serif';
  const fonts = [
    cinzel && { name: 'Cinzel', data: cinzel, weight: 700 as const, style: 'normal' as const },
    sans && { name: 'Open Sans', data: sans, weight: 400 as const, style: 'normal' as const },
    sansBold && { name: 'Open Sans', data: sansBold, weight: 700 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#161513',
          color: '#fdfbf5',
          fontFamily: bodyFont,
          padding: '56px 72px',
          borderBottom: '14px solid #f0d397',
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(240,211,151,0.14) 0, transparent 45%), radial-gradient(circle at 85% 80%, rgba(240,211,151,0.10) 0, transparent 45%)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 5, color: '#f0d397', textTransform: 'uppercase' }}>
            {`${CHAMBER_NAME} · Est. 1909`}
          </div>
          <div style={{ display: 'flex', width: 96, height: 3, background: '#f0d397', marginTop: 22 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: titleFont,
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.08,
              color: '#fdfbf5',
            }}
          >
            {SHARE_TITLE}
          </div>
          <div style={{ display: 'flex', fontSize: 34, lineHeight: 1.35, color: '#e9e2d0', marginTop: 22, maxWidth: 1000 }}>
            {SHARE_SUBTITLE}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              background: '#f0d397',
              color: '#161513',
              fontSize: 28,
              fontWeight: 700,
              padding: '16px 30px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              borderRadius: 10,
            }}
          >
            Apply at vendors.weavervilleca.org
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#f0d397', whiteSpace: 'nowrap', marginLeft: 24 }}>
            {`${FEATURED_EVENT.date.replace(' (TBD)', '')} · ${formatFee(FEATURED_EVENT.feeCents)} fee`}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length ? fonts : undefined,
    }
  );
}
