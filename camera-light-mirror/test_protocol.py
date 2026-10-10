"""Run with Python; no camera, Arduino, or third-party packages required."""
import random
import unittest
from protocol import crc8, encode_frame


class ProtocolTests(unittest.TestCase):
    def test_standard_crc_vector(self):
        self.assertEqual(crc8(b"123456789"), 0xF4)

    def test_every_individual_pixel_position(self):
        for n in range(256):
            grid = [False] * 256
            grid[n] = True
            packet = encode_frame(grid)
            self.assertEqual(len(packet), 35)
            self.assertEqual(packet[:2], b"LM")
            payload = packet[2:-1]
            self.assertEqual(payload[n // 8], 0x80 >> (n % 8))
            self.assertEqual(sum(v.bit_count() for v in payload), 1)
            self.assertEqual(packet[-1], crc8(payload))

    def test_random_frames_round_trip(self):
        rng = random.Random(7)
        for _ in range(1000):
            grid = [bool(rng.getrandbits(1)) for _ in range(256)]
            packet = encode_frame(grid)
            decoded = [bool(packet[2 + n // 8] & (0x80 >> (n % 8))) for n in range(256)]
            self.assertEqual(grid, decoded)

    def test_corrupted_payload_single_bits_detected(self):
        packet = encode_frame([n % 3 == 0 for n in range(256)])
        for n in range(256):
            corrupt = bytearray(packet[2:-1])
            corrupt[n // 8] ^= 0x80 >> (n % 8)
            self.assertNotEqual(crc8(corrupt), packet[-1])

    def test_reject_wrong_pixel_count(self):
        for size in (0, 64, 255, 257, 1024):
            with self.assertRaises(ValueError):
                encode_frame([False] * size)


if __name__ == "__main__":
    unittest.main()
