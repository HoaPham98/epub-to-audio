import 'dart:typed_data';

/// Encodes raw PCM (s16le) bytes into a standard 44-byte header WAV container.
Uint8List pcmToWav(
  Uint8List pcmData, {
  int sampleRate = 24000,
  int channels = 1,
  int bitsPerSample = 16,
}) {
  final byteRate = sampleRate * channels * (bitsPerSample ~/ 8);
  final blockAlign = channels * (bitsPerSample ~/ 8);
  final subChunk2Size = pcmData.length;
  final chunkSize = 36 + subChunk2Size;

  final header = ByteData(44);
  // "RIFF"
  header.setUint8(0, 0x52);
  header.setUint8(1, 0x49);
  header.setUint8(2, 0x46);
  header.setUint8(3, 0x46);
  header.setUint32(4, chunkSize, Endian.little);
  // "WAVE"
  header.setUint8(8, 0x57);
  header.setUint8(9, 0x41);
  header.setUint8(10, 0x56);
  header.setUint8(11, 0x45);
  // "fmt "
  header.setUint8(12, 0x66);
  header.setUint8(13, 0x6D);
  header.setUint8(14, 0x74);
  header.setUint8(15, 0x20);
  header.setUint32(16, 16, Endian.little); // Subchunk1Size
  header.setUint16(20, 1, Endian.little); // PCM format = 1
  header.setUint16(22, channels, Endian.little);
  header.setUint32(24, sampleRate, Endian.little);
  header.setUint32(28, byteRate, Endian.little);
  header.setUint16(32, blockAlign, Endian.little);
  header.setUint16(34, bitsPerSample, Endian.little);
  // "data"
  header.setUint8(36, 0x64);
  header.setUint8(37, 0x61);
  header.setUint8(38, 0x74);
  header.setUint8(39, 0x61);
  header.setUint32(40, subChunk2Size, Endian.little);

  final builder = BytesBuilder(copy: false);
  builder.add(header.buffer.asUint8List());
  builder.add(pcmData);
  return builder.toBytes();
}

/// Checks whether byte buffer begins with standard WAV header ("RIFF" ... "WAVE").
bool isWavBytes(Uint8List bytes) {
  if (bytes.length < 12) return false;
  return bytes[0] == 0x52 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x46 &&
      bytes[8] == 0x57 &&
      bytes[9] == 0x41 &&
      bytes[10] == 0x56 &&
      bytes[11] == 0x45;
}

/// Strips WAV header to extract raw PCM bytes, searching for the 'data' subchunk.
Uint8List wavToPcm(Uint8List wavBytes) {
  if (!isWavBytes(wavBytes) || wavBytes.length < 44) {
    return wavBytes;
  }

  // Scan for 'data' chunk
  int offset = 12;
  while (offset + 8 <= wavBytes.length) {
    final isData = wavBytes[offset] == 0x64 &&
        wavBytes[offset + 1] == 0x61 &&
        wavBytes[offset + 2] == 0x74 &&
        wavBytes[offset + 3] == 0x61;
    final byteData = ByteData.sublistView(wavBytes, offset + 4, offset + 8);
    final size = byteData.getUint32(0, Endian.little);

    if (isData) {
      final dataStart = offset + 8;
      final dataEnd = (dataStart + size <= wavBytes.length)
          ? dataStart + size
          : wavBytes.length;
      return Uint8List.sublistView(wavBytes, dataStart, dataEnd);
    }
    offset += 8 + size;
  }

  // Fallback to standard 44 bytes offset
  return Uint8List.sublistView(wavBytes, 44);
}
