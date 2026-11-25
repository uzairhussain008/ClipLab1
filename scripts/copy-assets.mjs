import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFfmpegCore() {
  const esmDir = path.join(rootDir, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
  const targetDir = path.join(rootDir, 'public', 'ffmpeg');
  ensureDir(targetDir);

  const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];
  for (const file of files) {
    const src = path.join(esmDir, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`[copy-assets] Copied ${file} -> public/ffmpeg/${file}`);
    } else {
      console.warn(`[copy-assets] Warning: ${src} not found. Run npm install first.`);
    }
  }
}

function copyOpenFonts() {
  const fontsDir = path.join(rootDir, 'public', 'fonts');
  ensureDir(fontsDir);

  const fontMappings = [
    {
      destName: 'caption-sans-bold.ttf',
      candidates: [
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
      ],
    },
    {
      destName: 'caption-mono-bold.ttf',
      candidates: [
        '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
      ],
    },
    {
      destName: 'caption-display-bold.ttf',
      candidates: [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      ],
    },
    {
      destName: 'caption-bangers.ttf',
      candidates: [
        path.join(rootDir, 'node_modules', '@expo-google-fonts', 'bangers', '400Regular', 'Bangers_400Regular.ttf'),
      ],
    },
    {
      destName: 'caption-luckiest-guy.ttf',
      candidates: [
        path.join(rootDir, 'node_modules', '@expo-google-fonts', 'luckiest-guy', '400Regular', 'LuckiestGuy_400Regular.ttf'),
      ],
    },
    {
      destName: 'caption-anton.ttf',
      candidates: [
        path.join(rootDir, 'node_modules', '@expo-google-fonts', 'anton', '400Regular', 'Anton_400Regular.ttf'),
      ],
    },
    {
      destName: 'caption-montserrat-extrabold.ttf',
      candidates: [
        path.join(rootDir, 'node_modules', '@expo-google-fonts', 'montserrat', '800ExtraBold', 'Montserrat_800ExtraBold.ttf'),
      ],
    },
  ];

  for (const mapping of fontMappings) {
    const dest = path.join(fontsDir, mapping.destName);
    const found = mapping.candidates.find((candidate) => fs.existsSync(candidate));
    if (found) {
      const srcSize = fs.statSync(found).size;
      const destSize = fs.existsSync(dest) ? fs.statSync(dest).size : -1;
      if (srcSize !== destSize) {
        fs.copyFileSync(found, dest);
        console.log(`[copy-assets] Copied ${path.basename(found)} -> public/fonts/${mapping.destName}`);
      }
    } else if (!fs.existsSync(dest)) {
      console.warn(
        `[copy-assets] No open-license TTF found for ${mapping.destName}. ` +
          `Place an open-license .ttf file at public/fonts/${mapping.destName} (see README.md).`
      );
    }
  }
}

copyFfmpegCore();
copyOpenFonts();
