/* MINI LIGHT MIRROR — 16 x 16, Arduino UNO R3, 5 V WS2812B RGB.
   Install Adafruit NeoPixel with the Arduino IDE Library Manager.
   D6 -> 330 ohm -> panel DIN. External LED power; common GND.
   Keep BRIGHTNESS at 32 or below with the supplied 5 V / 5 A design.
   Host: b'LM' + 32 packed silhouette bytes + CRC-8 (poly 0x07).
   The host MUST wait for K (acknowledgement) after every frame.
   This allows show() to disable interrupts without losing serial data.
*/
#include <Adafruit_NeoPixel.h>

constexpr uint8_t WIDTH = 16, HEIGHT = 16, DATA_PIN = 6;
constexpr uint16_t LED_COUNT = uint16_t(WIDTH) * HEIGHT;
constexpr uint16_t MASK_BYTES = (LED_COUNT + 7) / 8;
constexpr uint8_t BRIGHTNESS = 32; // 0..255. Do not raise with this power design.
static_assert(BRIGHTNESS <= 32, "Recalculate and rebuild power system first.");

// Default: first LED at top-left; rows run alternately left/right.
// Check using --test-pattern corners and scan. Panel layouts differ.
constexpr bool SERPENTINE = true;
constexpr bool SWAP_XY = false;
constexpr bool FLIP_X = false;
constexpr bool FLIP_Y = false;

Adafruit_NeoPixel pixels(LED_COUNT, DATA_PIN, NEO_GRB + NEO_KHZ800);
uint8_t packet[MASK_BYTES + 1];
uint16_t received = 0;
uint8_t state = 0;
unsigned long lastByte = 0, lastFrame = 0;
bool displayOn = false;

uint16_t physicalIndex(uint8_t x, uint8_t y) {
  if (SWAP_XY) { uint8_t t = x; x = y; y = t; }
  if (FLIP_X) x = WIDTH - 1 - x;
  if (FLIP_Y) y = HEIGHT - 1 - y;
  if (SERPENTINE && (y & 1)) x = WIDTH - 1 - x;
  return uint16_t(y) * WIDTH + x;
}

uint8_t crc8(const uint8_t* data, uint16_t size) {
  uint8_t crc = 0;
  for (uint16_t i = 0; i < size; ++i) {
    crc ^= data[i];
    for (uint8_t bit = 0; bit < 8; ++bit)
      crc = (crc & 0x80) ? uint8_t((crc << 1) ^ 0x07) : uint8_t(crc << 1);
  }
  return crc;
}

void displayMask() {
  // Warm light. Full white is also inside the brightness calculation.
  const uint32_t colour = pixels.Color(255, 155, 60);
  for (uint16_t n = 0; n < LED_COUNT; ++n) {
    bool on = packet[n / 8] & (0x80 >> (n % 8));
    pixels.setPixelColor(physicalIndex(n % WIDTH, n / WIDTH), on ? colour : 0);
  }
  pixels.show();
  displayOn = true;
  lastFrame = millis();
}

void setup() {
  pixels.begin();
  pixels.setBrightness(BRIGHTNESS);
  pixels.clear();
  pixels.show();
  Serial.begin(115200);
}

void loop() {
  if (state && millis() - lastByte > 250) { state = 0; received = 0; }
  while (Serial.available()) {
    uint8_t b = uint8_t(Serial.read());
    lastByte = millis();
    if (state == 0) {
      if (b == 'L') state = 1;
    } else if (state == 1) {
      if (b == 'M') { state = 2; received = 0; }
      else state = (b == 'L') ? 1 : 0;
    } else {
      packet[received++] = b;
      if (received == MASK_BYTES + 1) {
        state = 0;
        if (crc8(packet, MASK_BYTES) == packet[MASK_BYTES]) {
          displayMask();
          Serial.write('K'); // ACK only AFTER LED update is complete.
        } else {
          Serial.write('E');
        }
      }
    }
  }
  // Disconnect/stalled application: blank the display after 2 seconds.
  if (displayOn && millis() - lastFrame > 2000) {
    pixels.clear();
    pixels.show();
    displayOn = false;
  }
}
