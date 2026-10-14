export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function pcmToWavBlob(
  pcmBuffer: ArrayBuffer,
  sampleRate = 24000,
  numChannels = 1,
  bitDepth = 16
): Blob {
  const dataLength = pcmBuffer.byteLength;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * numChannels * bitDepth) / 8, true);
  view.setUint16(32, (numChannels * bitDepth) / 8, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  new Uint8Array(buffer, 44).set(new Uint8Array(pcmBuffer));
  return new Blob([buffer], { type: 'audio/wav' });
}

export function concatenateArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  let totalLength = 0;
  for (const b of buffers) {
    totalLength += b.byteLength;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return result.buffer;
}
