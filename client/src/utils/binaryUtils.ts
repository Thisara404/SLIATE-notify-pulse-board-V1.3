// A utility function to convert binary data to string in browser environments with UTF-8 support
export function binaryToString(data: number[]): string {
  try {
    // Use TextDecoder for proper UTF-8 handling (better for Sinhala text)
    const uint8Array = new Uint8Array(data);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(uint8Array);
  } catch (error) {
    console.error('Failed to decode using TextDecoder, falling back to String.fromCharCode:', error);
    
    // Fallback: For very large arrays, process in chunks to avoid maximum call stack size exceeded
    const CHUNK_SIZE = 8192;
    let result = '';
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      result += String.fromCharCode.apply(null, chunk);
    }
    
    return result;
  }
}