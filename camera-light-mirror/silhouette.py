"""Mini light mirror: local webcam -> fixed-background mask -> LED panel.

Run without --port first. B schedules an empty-background capture.
Q/Esc quits. Camera images are neither saved nor uploaded by this program.
See README.md for setup, power constraints, and physical testing.
"""
import argparse
import math
import time

import cv2
import numpy as np

from protocol import WIDTH, HEIGHT, encode_frame

SIZE = 320


def camera_square(frame, mirror=True):
    """Keep proportions: crop a centred square, then resize."""
    h, w = frame.shape[:2]
    side = min(h, w)
    x, y = (w - side) // 2, (h - side) // 2
    square = cv2.resize(frame[y:y + side, x:x + side], (SIZE, SIZE))
    return cv2.flip(square, 1) if mirror else square


def blur_image(image):
    return cv2.GaussianBlur(image, (5, 5), 0)


def foreground_mask(image, background, threshold):
    # Maximum RGB-channel difference also detects colours with similar grey levels.
    difference = np.max(cv2.absdiff(image, background), axis=2)
    mask = ((difference > threshold).astype(np.uint8) * 255)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    # Keep all sufficiently large regions; no identity or skeleton model involved.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    keep = np.zeros(count, dtype=np.uint8)
    keep[1:] = (stats[1:, cv2.CC_STAT_AREA] >= 120).astype(np.uint8) * 255
    return keep[labels]


def mask_to_grid(mask):
    coverage = cv2.resize(mask, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA)
    # A cell lights when foreground covers at least about 20% of its area.
    return coverage > 50


def grid_view(grid):
    view = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    cell = SIZE // WIDTH
    for y in range(HEIGHT):
        for x in range(WIDTH):
            colour = (60, 155, 255) if grid[y, x] else (22, 22, 22)
            cv2.circle(view, (x * cell + cell // 2, y * cell + cell // 2),
                       max(2, cell // 3), colour, -1)
    return view


class Panel:
    def __init__(self, port):
        self.link = None
        if port:
            import serial
            self.link = serial.Serial(port, 115200, timeout=0.6, write_timeout=1)
            time.sleep(2)  # UNO normally resets when a serial port is opened.
            self.link.reset_input_buffer()

    def send(self, grid):
        if self.link is None:
            return
        packet = encode_frame(grid.ravel())
        if self.link.write(packet) != len(packet):
            raise RuntimeError("Incomplete USB write. Check cable and port.")
        answer = self.link.read(1)
        if answer != b"K":
            raise RuntimeError("No valid Arduino acknowledgement. Close Serial Monitor, "
                               "check port/firmware, then restart this program.")

    def close(self):
        if self.link is not None:
            try:
                self.send(np.zeros((HEIGHT, WIDTH), dtype=bool))
            except Exception:
                pass  # Firmware also blanks independently after a 2-second timeout.
            self.link.close()


def test_grid(mode, elapsed):
    grid = np.zeros((HEIGHT, WIDTH), dtype=bool)
    if mode == "full":
        grid[:] = True
    elif mode == "corners":
        # TL, TR, BR, BL, one corner per second.
        x, y = [(0, 0), (15, 0), (15, 15), (0, 15)][int(elapsed) % 4]
        grid[y, x] = True
    else:
        # One row-major pixel every 0.1 seconds: 25.6 s for the whole grid.
        n = int(elapsed * 10) % 256
        grid[n // WIDTH, n % WIDTH] = True
    return grid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", help="Arduino port, e.g. COM5 or /dev/cu.usbmodem1101")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--threshold", type=int, default=35)
    parser.add_argument("--fps", type=int, default=25)
    parser.add_argument("--no-mirror", action="store_true")
    parser.add_argument("--test-pattern", choices=["corners", "scan", "full"])
    args = parser.parse_args()
    if not 1 <= args.fps <= 30 or not 1 <= args.threshold <= 120:
        parser.error("Use --fps 1..30 and --threshold 1..120")

    panel, capture = None, None
    window = "Mini light mirror | B: capture empty scene | Q: quit"
    try:
        panel = Panel(args.port)
        cv2.namedWindow(window, cv2.WINDOW_AUTOSIZE)
        if not args.test_pattern:
            capture = cv2.VideoCapture(args.camera)
            if not capture.isOpened():
                raise RuntimeError("Camera unavailable. Grant camera permission to Python/" 
                                   "your terminal, close other camera apps, or try --camera 1.")
            capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cv2.createTrackbar("Difference threshold", window, args.threshold, 120, lambda _: None)

        background = None
        capture_at = None
        samples = []
        started = time.monotonic()
        zero = np.zeros((HEIGHT, WIDTH), dtype=bool)
        while True:
            frame_start = time.monotonic()
            grid = zero.copy()
            if args.test_pattern:
                grid = test_grid(args.test_pattern, frame_start - started)
                screen = grid_view(grid)
                message = "Test: " + args.test_pattern + " | Q: quit"
            else:
                ok, raw = capture.read()
                if not ok:
                    raise RuntimeError("Camera stopped returning frames.")
                frame = camera_square(raw, mirror=not args.no_mirror)
                blurred = blur_image(frame)
                mask = np.zeros((SIZE, SIZE), dtype=np.uint8)
                if capture_at is not None:
                    if frame_start < capture_at:
                        message = "Step OUT of view: " + str(math.ceil(capture_at - frame_start))
                    else:
                        samples.append(blurred)
                        message = "Stay OUT: recording empty background " + str(len(samples)) + "/30"
                        if len(samples) >= 30:
                            background = np.mean(samples, axis=0).astype(np.uint8)
                            samples.clear()
                            capture_at = None
                            message = "Background saved. Step into view."
                elif background is None:
                    message = "Press B, then step OUT of the camera view."
                else:
                    threshold = max(1, cv2.getTrackbarPos("Difference threshold", window))
                    mask = foreground_mask(blurred, background, threshold)
                    grid = mask_to_grid(mask)
                    message = "Camera crop | Foreground | 16 x 16 LEDs     B: recapture   Q: quit"
                screen = np.hstack((frame, cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR), grid_view(grid)))

            banner = np.zeros((46, screen.shape[1], 3), dtype=np.uint8)
            cv2.putText(banner, message, (8, 28), cv2.FONT_HERSHEY_SIMPLEX,
                        0.46 if screen.shape[1] > SIZE else 0.4, (235, 235, 235), 1, cv2.LINE_AA)
            cv2.imshow(window, np.vstack((banner, screen)))
            panel.send(grid)  # No next frame until the panel acknowledges this one.
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
            if key == ord("b") and not args.test_pattern:
                capture_at = time.monotonic() + 3.0
                samples.clear()
            if cv2.getWindowProperty(window, cv2.WND_PROP_VISIBLE) < 1:
                break
            remaining = 1 / args.fps - (time.monotonic() - frame_start)
            if remaining > 0:
                time.sleep(remaining)
    finally:
        if panel is not None:
            panel.close()
        if capture is not None:
            capture.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
