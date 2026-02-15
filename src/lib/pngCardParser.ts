import pako from "pako";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function decodeLatin1(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

export function parsePngTextMetadata(buffer: ArrayBuffer): Record<string, string> {
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Not a PNG file.");
    }
  }

  const metadata: Record<string, string> = {};
  let offset = 8;

  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = decodeLatin1(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      break;
    }

    const data = bytes.slice(dataStart, dataEnd);
    if (type === "tEXt") {
      const sep = data.indexOf(0);
      if (sep > 0) {
        const key = decodeLatin1(data.slice(0, sep));
        const value = decodeLatin1(data.slice(sep + 1));
        metadata[key] = value;
      }
    } else if (type === "zTXt") {
      const sep = data.indexOf(0);
      if (sep > 0 && sep + 2 <= data.length) {
        const key = decodeLatin1(data.slice(0, sep));
        const compressionMethod = data[sep + 1];
        const compressed = data.slice(sep + 2);
        if (compressionMethod === 0) {
          const inflated = pako.inflate(compressed);
          metadata[key] = decodeText(inflated);
        }
      }
    } else if (type === "iTXt") {
      const nullPositions: number[] = [];
      for (let i = 0; i < data.length; i += 1) {
        if (data[i] === 0) {
          nullPositions.push(i);
          if (nullPositions.length === 3) {
            break;
          }
        }
      }
      if (nullPositions.length >= 3) {
        const key = decodeLatin1(data.slice(0, nullPositions[0]));
        const compressionFlag = data[nullPositions[0] + 1];
        const compressionMethod = data[nullPositions[0] + 2];
        const textStart = nullPositions[2] + 1;
        const textData = data.slice(textStart);
        if (compressionFlag === 1 && compressionMethod === 0) {
          metadata[key] = decodeText(pako.inflate(textData));
        } else {
          metadata[key] = decodeText(textData);
        }
      }
    }

    offset = dataEnd + 4;
    if (type === "IEND") {
      break;
    }
  }

  return metadata;
}
