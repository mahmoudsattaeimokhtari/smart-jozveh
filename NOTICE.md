# Third-party audio encoder

This app uses @breezystack/lamejs 1.2.7, a JavaScript MP3 encoder, under LGPL-3.0.

Source and build/replacement instructions: https://github.com/shijinyu/lamejs

The encoder is imported by src/utils/mp3.worker.ts. To replace or modify it, install a compatible encoder package, update that import, and run npm run build. The output worker is served as a separate JavaScript asset.

The upstream license is included at public/licenses/lamejs-LICENSE.txt.
