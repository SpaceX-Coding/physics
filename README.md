# Interactive Light Mirror

A student project exploring how a moving object or human silhouette can be represented by a grid of lights. The repository contains a playable software simulation, a 16 × 16 camera-to-Arduino prototype, circuit diagrams, and a cheaper checkpoint experiment retained for comparison.

## Play the web app

The repository root is a Vercel-ready website called **Light / Motion**. It runs entirely in the browser, with no API keys, accounts, server functions or third-party runtime packages.

- **Human:** four pose presets, independent arm angles, drag/tap and keyboard movement.
- **Toy car:** move and rotate a car anywhere within the stage.
- **Webcam:** opt-in camera input with a three-second empty-room capture, fixed-background silhouette extraction and adjustable difference threshold. Processing remains on the device; no video or audio is uploaded.
- Compare **8 × 8, 16 × 16 and 32 × 32** grids, a full silhouette or a single centre pixel, fading trails and display brightness. Save the virtual LED image as a PNG.
- An eight-second movement demo stops automatically. Manual movement or pose changes stop the demo.

Human and toy-car modes are software simulations. Webcam mode performs real image processing, but does not recognise gestures or drive an Arduino. Holding still does not deliberately erase the silhouette; shadows and lighting changes can produce false detections.

### Deploy on Vercel

Import **[SpaceX-Coding/physics](https://github.com/SpaceX-Coding/physics)** in Vercel, select branch **main**, and use the repository root (leave Root Directory at its default).

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None |

The included [vercel.json](vercel.json) sets the framework, build command and output directory. Click **Deploy**. This prepares the project for Vercel; pushing source alone is not proof of a deployment. See [Vercel's configuration documentation](https://vercel.com/docs/project-configuration/vercel-json).

### Run locally

Install Node.js 22 or newer, then run from the repository root:

```bash
npm run dev
```

Open **http://127.0.0.1:4173**. There are no packages to install. Do not double-click `index.html`: this version uses browser ES modules and should be served over HTTP/HTTPS. For a production build, run `npm run build`; `npm start` serves the built `dist/` folder.

For webcam mode: click **Webcam → Start camera**, allow browser camera access, step out of the frame, then click **Capture empty room · 3s**. Re-enter the square crop after capture. Keep the camera and lighting steady. A contrasting background works best. Capture a new background after moving the camera. The camera stops when you change subjects, reset, hide or leave the page. A denied permission or missing camera leaves the simulation available. Camera access requires HTTPS or localhost; see [MDN's camera API reference](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

The earlier inline toy-car/checkpoint experiment remains as editable source in [preview/](preview/); the new website focuses on whole-scene silhouette tracking.

## Current design direction

The essential requirement is **continuous position or silhouette tracking**, with repeated measurements throughout the object's movement. Reducing the display resolution makes the light image coarser; replacing the camera with scattered obstacle sensors changes the sensing capability itself.

| Approach | What it provides | Status |
|---|---|---|
| Camera + laptop + Arduino + LED matrix | Position/outline across the visible scene | Main direction; 16 × 16 code and wiring included |
| Smaller 8 × 8 LED matrix | Same sensing concept, fewer output pixels | Simulated and discussed; matching hardware firmware/protocol adaptation not yet included |
| One range sensor on a straight track | Changing distance along one dimension | Discussed alternative; no implementation included |
| Six IR obstacle sensors | Detection only at selected stations | Alternative code and diagrams retained for comparison |

The latest budget constraint was ₹1,000 with an Arduino already available. A camera-based 8 × 8 hardware version depends on also reusing a laptop, camera and suitable power source. The original 16 × 16 bill of materials exceeds that budget. Read each design's power requirements; do not swap panel size, voltage or brightness without updating the design.

## Build resources

- **[Camera light-mirror guide](camera-light-mirror/README.md):** components, power calculations, wiring, laptop setup, background calibration, Arduino upload, panel orientation and troubleshooting.
- **[Camera circuit](camera-light-mirror/wiring.png):** 16 × 16 WS2812B-compatible RGB panel, external power and Uno R3.
- **[Human silhouettes and gestures](docs/human-gestures.md):** realistic expectations for 8 × 8 versus 16 × 16.
- **[Checkpoint-road guide](checkpoint-road/BUILD-GUIDE.md):** lower-cost six-sensor experiment. It does not meet the continuous-tracking requirement.
- **[Checkpoint circuit](checkpoint-road/wiring.png):** ordinary LEDs and individual current-limiting resistors.

## Camera prototype

The webcam feeds a laptop running Python/OpenCV. The program compares the current image with a saved empty background, cleans the foreground mask, and sends a 16 × 16 on/off image over USB. Arduino firmware displays it on the LED panel.

The background stays fixed until recalibrated, so holding a pose does not deliberately erase the person. Shadows, exposure changes and similar foreground/background colours can still cause errors. The program does not classify gesture meanings or recognise identities.

From `camera-light-mirror/`, install dependencies in a virtual environment and run the laptop-only preview first:

```bash
python -m venv .venv
# Activate the virtual environment using your operating system's usual command.
python -m pip install -r requirements.txt
python silhouette.py
```

Press **B**, step out for background capture, then step into view. Press **Q** to quit. Full Windows/macOS/Linux setup instructions are in the guide. The Arduino sketch is [light_mirror.ino](camera-light-mirror/light_mirror/light_mirror.ino); install **Adafruit NeoPixel** through Arduino IDE's Library Manager.

## Checks

```bash
npm test
npm run build
python camera-light-mirror/test_protocol.py
```

The new engine tests cover human poses at all three resolutions, car movement/rotation, stationary visibility, centre-pixel output, trail decay, synthetic camera masks, isolated noise, empty frames and camera cleanup (including late permission grants). The earlier preview harness is retained. Tests use Node.js built-ins only.

Browser checks exercise pose and grid changes, movement, display modes, reset and responsive layouts. Camera segmentation is tested with synthetic frames; actual webcam image quality and physical hardware require testing on your own equipment. The Arduino sketch has not been compiled or verified on hardware in this environment.

## Reference and attribution

Inspired by Random International's **[Our Future Selves (2019)](https://www.random-international.com/our-future-selves-2019)**, seen in the NMACC *Second Nature* exhibition. This is an independent educational prototype, not the artwork's original circuitry, sensing architecture or software.

Technical references and supplier examples are linked in the build guides. Prices are planning estimates recorded during the October 2026 discussion, not guaranteed current quotations.
