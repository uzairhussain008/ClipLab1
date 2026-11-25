import { APP_CONFIG } from '../config/appConfig';

const BUILDINGS = [
  { x: 0, w: 74, h: 170, layer: 'back' },
  { x: 64, w: 96, h: 255, layer: 'back' },
  { x: 150, w: 68, h: 195, layer: 'back' },
  { x: 205, w: 120, h: 315, layer: 'back' },
  { x: 312, w: 84, h: 225, layer: 'back' },
  { x: 390, w: 138, h: 345, layer: 'back' },
  { x: 515, w: 92, h: 265, layer: 'back' },
  { x: 595, w: 148, h: 380, layer: 'back' },
  { x: 730, w: 105, h: 280, layer: 'back' },
  { x: 822, w: 134, h: 350, layer: 'back' },
  { x: 944, w: 88, h: 240, layer: 'back' },
  { x: 1020, w: 152, h: 330, layer: 'back' },
  { x: 1158, w: 98, h: 260, layer: 'back' },
  { x: 1246, w: 126, h: 310, layer: 'back' },
  { x: 1360, w: 95, h: 215, layer: 'back' },
  { x: 18, w: 112, h: 190, layer: 'front' },
  { x: 142, w: 86, h: 145, layer: 'front' },
  { x: 244, w: 116, h: 245, layer: 'front' },
  { x: 378, w: 94, h: 175, layer: 'front' },
  { x: 486, w: 132, h: 270, layer: 'front' },
  { x: 632, w: 96, h: 215, layer: 'front' },
  { x: 744, w: 126, h: 260, layer: 'front' },
  { x: 886, w: 108, h: 185, layer: 'front' },
  { x: 1010, w: 118, h: 240, layer: 'front' },
  { x: 1144, w: 130, h: 200, layer: 'front' },
  { x: 1288, w: 155, h: 165, layer: 'front' },
];

const WINDOWS = (() => {
  const dots: Array<{ x: number; y: number; amber: boolean }> = [];
  BUILDINGS.filter((b) => b.layer === 'front').forEach((b, bIdx) => {
    const topY = 420 - b.h;
    for (let y = topY + 18; y < 395; y += 20) {
      for (let x = b.x + 12; x < b.x + b.w - 14; x += 16) {
        const hash = (x * 13 + y * 29 + bIdx * 17) % 19;
        if (hash < 4) {
          dots.push({ x, y, amber: hash === 0 || hash === 1 });
        }
      }
    }
  });
  return dots;
})();

const SCENE_CLASSES = ['hero-scene-1', 'hero-scene-2', 'hero-scene-3', 'hero-scene-4'] as const;

export function CitySkylineBackdrop() {
  const customImages = APP_CONFIG.HERO_IMAGES;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Concrete dusk gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #0b0f14 0%, #141c26 48%, #1d2733 82%, #11171f 100%)',
        }}
      />

      {customImages.length > 0 ? (
        customImages.slice(0, 4).map((img, idx) => (
          <img
            key={img.src}
            src={img.src}
            alt=""
            width={img.width}
            height={img.height}
            loading={idx === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className={`absolute inset-0 w-full h-full object-cover ${
              SCENE_CLASSES[idx % SCENE_CLASSES.length]
            }`}
          />
        ))
      ) : (
        <>
          {/* Scene 1: Midnight City Skyline Towers (initial LCP layer at opacity 1) */}
          <div className="hero-scene-1 absolute inset-0">
            <div
              className="absolute inset-x-0 bottom-0 h-56"
              style={{
                background:
                  'radial-gradient(ellipse 75% 60% at 50% 100%, rgba(229, 154, 36, 0.15) 0%, rgba(229, 154, 36, 0.03) 55%, transparent 100%)',
              }}
            />
            <svg
              viewBox="0 0 1440 420"
              preserveAspectRatio="xMidYMax slice"
              className="absolute inset-x-0 bottom-0 w-full h-[300px] sm:h-[360px]"
            >
              {BUILDINGS.filter((b) => b.layer === 'back').map((b, idx) => (
                <rect
                  key={`back-${idx}`}
                  x={b.x}
                  y={420 - b.h}
                  width={b.w}
                  height={b.h}
                  fill="#101720"
                />
              ))}
              <line x1="668" y1="16" x2="668" y2="90" stroke="#283546" strokeWidth="2" />
              <circle cx="668" cy="16" r="3" fill="#e59a24" opacity="0.85" />
              {BUILDINGS.filter((b) => b.layer === 'front').map((b, idx) => (
                <rect
                  key={`front-${idx}`}
                  x={b.x}
                  y={420 - b.h}
                  width={b.w}
                  height={b.h}
                  fill="#090d12"
                  stroke="#18212c"
                  strokeWidth="1"
                />
              ))}
              {WINDOWS.map((w, idx) => (
                <rect
                  key={`win-${idx}`}
                  x={w.x}
                  y={w.y}
                  width="6"
                  height="9"
                  fill={w.amber ? '#e59a24' : '#3a4a5e'}
                  opacity={w.amber ? 0.72 : 0.55}
                />
              ))}
              <rect x="0" y="410" width="1440" height="10" fill="#070a0e" />
            </svg>
          </div>

          {/* Scene 2: Elevated Metro Viaduct & River Overpass */}
          <div className="hero-scene-2 absolute inset-0">
            <div
              className="absolute inset-x-0 bottom-0 h-56"
              style={{
                background:
                  'radial-gradient(ellipse 68% 58% at 68% 95%, rgba(229, 154, 36, 0.16) 0%, transparent 72%)',
              }}
            />
            <svg
              viewBox="0 0 1440 420"
              preserveAspectRatio="xMidYMax slice"
              className="absolute inset-x-0 bottom-0 w-full h-[300px] sm:h-[360px]"
            >
              {/* Suspension towers & cables */}
              <rect x="330" y="65" width="22" height="355" fill="#101720" />
              <rect x="970" y="55" width="24" height="365" fill="#101720" />
              <line x1="341" y1="75" x2="60" y2="255" stroke="#263241" strokeWidth="2" />
              <line x1="341" y1="75" x2="650" y2="255" stroke="#263241" strokeWidth="2" />
              <line x1="982" y1="65" x2="670" y2="255" stroke="#263241" strokeWidth="2" />
              <line x1="982" y1="65" x2="1380" y2="255" stroke="#263241" strokeWidth="2" />
              {/* Elevated deck */}
              <rect x="0" y="255" width="1440" height="16" fill="#090d12" stroke="#263241" />
              {[120, 260, 440, 620, 800, 1040, 1220, 1360].map((px) => (
                <g key={`pillar-${px}`}>
                  <rect x={px} y="271" width="18" height="100" fill="#0b1016" />
                  <circle cx={px + 9} cy="249" r="3" fill="#e59a24" opacity="0.8" />
                </g>
              ))}
              {/* Water shimmer */}
              <rect x="0" y="365" width="1440" height="55" fill="#070b10" />
              {[180, 340, 560, 740, 980, 1180].map((rx, idx) => (
                <rect
                  key={`shimmer-${rx}`}
                  x={rx}
                  y={380 + (idx % 2) * 12}
                  width="58"
                  height="2"
                  fill="#e59a24"
                  opacity="0.38"
                />
              ))}
            </svg>
          </div>

          {/* Scene 3: Rooftop Water Towers & Downtown Alley Studio */}
          <div className="hero-scene-3 absolute inset-0">
            <div
              className="absolute inset-x-0 bottom-0 h-56"
              style={{
                background:
                  'radial-gradient(ellipse 65% 55% at 32% 95%, rgba(229, 154, 36, 0.14) 0%, transparent 72%)',
              }}
            />
            <svg
              viewBox="0 0 1440 420"
              preserveAspectRatio="xMidYMax slice"
              className="absolute inset-x-0 bottom-0 w-full h-[300px] sm:h-[360px]"
            >
              {/* Background blocks */}
              <rect x="0" y="190" width="290" height="230" fill="#101720" />
              <rect x="330" y="150" width="240" height="270" fill="#0c1219" />
              <rect x="610" y="210" width="320" height="210" fill="#111821" />
              <rect x="970" y="130" width="270" height="290" fill="#0c1219" />
              <rect x="1260" y="200" width="180" height="220" fill="#101720" />
              {/* Rooftop water tower silhouettes */}
              <line x1="410" y1="115" x2="398" y2="150" stroke="#263241" strokeWidth="3" />
              <line x1="450" y1="115" x2="462" y2="150" stroke="#263241" strokeWidth="3" />
              <rect x="396" y="72" width="68" height="44" rx="4" fill="#090d12" stroke="#283546" />
              <polygon points="392,72 430,52 468,72" fill="#0e141c" />
              {/* Billboard truss */}
              <rect x="700" y="140" width="140" height="48" fill="#090d12" stroke="#e59a24" strokeOpacity="0.45" />
              <line x1="720" y1="188" x2="720" y2="210" stroke="#283546" strokeWidth="3" />
              <line x1="820" y1="188" x2="820" y2="210" stroke="#283546" strokeWidth="3" />
              <rect x="720" y="156" width="84" height="5" fill="#e59a24" opacity="0.65" />
              <rect x="720" y="168" width="52" height="4" fill="#3a4a5e" />
              {/* Studio vents & beacons */}
              <circle cx="1095" cy="116" r="3" fill="#e59a24" opacity="0.85" />
              <rect x="0" y="408" width="1440" height="12" fill="#070a0e" />
            </svg>
          </div>

          {/* Scene 4: Industrial Harbor Cranes & Beacon Docks */}
          <div className="hero-scene-4 absolute inset-0">
            <div
              className="absolute inset-x-0 bottom-0 h-56"
              style={{
                background:
                  'radial-gradient(ellipse 72% 55% at 75% 100%, rgba(229, 154, 36, 0.14) 0%, transparent 72%)',
              }}
            />
            <svg
              viewBox="0 0 1440 420"
              preserveAspectRatio="xMidYMax slice"
              className="absolute inset-x-0 bottom-0 w-full h-[300px] sm:h-[360px]"
            >
              {/* Warehouses */}
              <rect x="40" y="290" width="230" height="130" fill="#0e141c" />
              <rect x="290" y="260" width="210" height="160" fill="#111821" />
              <rect x="1110" y="270" width="280" height="150" fill="#0e141c" />
              {/* Port gantry cranes */}
              {[630, 870].map((cx) => (
                <g key={`crane-${cx}`}>
                  <rect x={cx} y="120" width="14" height="270" fill="#090d12" stroke="#263241" />
                  <rect x={cx + 68} y="120" width="14" height="270" fill="#090d12" stroke="#263241" />
                  <line x1={cx - 50} y1="145" x2={cx + 150} y2="115" stroke="#283546" strokeWidth="6" />
                  <line x1={cx + 40} y1="90" x2={cx + 145} y2="115" stroke="#39475a" strokeWidth="2" />
                  <circle cx={cx + 40} cy="90" r="3" fill="#e59a24" opacity="0.9" />
                </g>
              ))}
              {/* Dockyard lamps */}
              {[150, 420, 740, 1020, 1260].map((lx) => (
                <g key={`lamp-${lx}`}>
                  <line x1={lx} y1="320" x2={lx} y2="395" stroke="#263241" strokeWidth="2" />
                  <circle cx={lx} cy="320" r="3.5" fill="#e59a24" opacity="0.78" />
                </g>
              ))}
              <rect x="0" y="395" width="1440" height="25" fill="#070a0e" />
            </svg>
          </div>
        </>
      )}

      {/* Halftone & film grain grit */}
      <div className="absolute inset-0 halftone-grid opacity-35" />
      <div className="absolute inset-0 film-grain-layer opacity-80" />
    </div>
  );
}
