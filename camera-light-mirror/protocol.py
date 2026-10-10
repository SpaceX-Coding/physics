"""Small, dependency-free wire protocol shared by the preview and tests."""
WIDTH = HEIGHT = 16
HEADER = b"LM"


def crc8(data):
    crc = 0
    for value in data:
        crc ^= value
        for _ in range(8):
            crc = (((crc << 1) ^ 0x07) if crc & 0x80 else crc << 1) & 0xFF
    return crc


def encode_frame(values):
    """256 row-major booleans -> 35 bytes; top-left first, MSB first."""
    values = list(values)
    if len(values) != WIDTH * HEIGHT:
        raise ValueError("Expected exactly 256 pixel values")
    payload = bytearray(32)
    for n, on in enumerate(values):
        if on:
            payload[n // 8] |= 0x80 >> (n % 8)
    return HEADER + payload + bytes([crc8(payload)])
