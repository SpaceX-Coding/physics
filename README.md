# Interactive Light Mirror

A student project exploring how a moving object or human silhouette can be represented by a grid of lights. The repository contains a playable software simulation, a 16 × 16 camera-to-Arduino prototype, circuit diagrams, and a cheaper checkpoint experiment retained for comparison.

## Play the preview

Download or clone the repository and open **[index.html](index.html)** in a modern browser. No installation, camera access, Arduino or internet connection is required for the preview. GitHub's file viewer displays HTML source; open the downloaded file in your browser to play it.

Drag or tap to move the toy car, use the arrow buttons, or select **Play a movement**. You can:

- Compare 8 × 8, 16 × 16 and 32 × 32 LED grids.
- Switch between a silhouette and a position dot.
- Rotate the car and add a fading light trail.
- Compare whole-surface camera tracking with six discrete checkpoint sensors.

The preview models ideal detection from a simulated object. It is not a real webcam tracker or a test of physical electronics. A still object remains visible. Its editable fragment is in [preview/](preview/); the standalone page includes the rendering styles and runtime needed outside the original chat.

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

The preview logic test uses Node.js built-ins and a small DOM model, without third-party packages:

```bash
node tests/preview.test.cjs
```

The serial encoding tests use Python's standard library:

```bash
python camera-light-mirror/test_protocol.py
python -m py_compile camera-light-mirror/silhouette.py camera-light-mirror/protocol.py
```

Checks cover resolution, movement, rotation, stationary visibility, trails, checkpoint gaps, finite demo playback, state persistence, pixel encoding and CRC checks. These are not browser-layout, camera, Arduino compilation or hardware tests. Physical assembly, actual current, LED mapping and environmental performance require verification on the purchased components.

## Reference and attribution

Inspired by Random International's **[Our Future Selves (2019)](https://www.random-international.com/our-future-selves-2019)**, seen in the NMACC *Second Nature* exhibition. This is an independent educational prototype, not the artwork's original circuitry, sensing architecture or software.

Technical references and supplier examples are linked in the build guides. Prices are planning estimates recorded during the October 2026 discussion, not guaranteed current quotations.
