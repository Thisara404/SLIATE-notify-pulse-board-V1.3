// A utility function to convert binary data to string in browser environments
export function binaryToString(data: number[]): string {
  // For very large arrays, process in chunks to avoid maximum call stack size exceeded
  const CHUNK_SIZE = 8192;
  let result = '';
  
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, chunk);
  }
  
  return result;
}