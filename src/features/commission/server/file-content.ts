export function validReferenceContent(bytes: Uint8Array, type: string): boolean {
  if (bytes.length < 12) return false;
  switch (type) {
    case "image/jpeg": return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png": return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
    case "image/webp": return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    case "application/pdf": return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
    default: return false;
  }
}
