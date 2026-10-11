import fs from 'node:fs';
import path from 'node:path';

const targetDir = path.resolve('public/images/hero');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const images = {
  'hero-portrait.jpg': 'C:/Users/Home/.gemini/antigravity/brain/04f7a880-3d87-45f8-995a-201649a88bc8/hero_scientist_facing_left_1791677628503.jpg',
  'microscopy-cysts.jpg': 'C:/Users/Home/.gemini/antigravity/brain/04f7a880-3d87-45f8-995a-201649a88bc8/microscopy_cysts_1791677385182.jpg',
  'microscopy-larva.jpg': 'C:/Users/Home/.gemini/antigravity/brain/04f7a880-3d87-45f8-995a-201649a88bc8/microscopy_larva_1791677416373.jpg',
  'microscopy-giardia.jpg': 'C:/Users/Home/.gemini/antigravity/brain/04f7a880-3d87-45f8-995a-201649a88bc8/microscopy_giardia_1791677450826.jpg',
};

for (const [dest, src] of Object.entries(images)) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(targetDir, dest));
    console.log(`Copied ${src} -> ${dest}`);
  } else {
    console.error(`Source missing: ${src}`);
  }
}
