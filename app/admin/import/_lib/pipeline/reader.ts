/**
 * Reader module — reads the raw bytes of an uploaded file.
 *
 * Isolated: knows nothing about Excel, CSV, or rows. Just turns a File into a
 * Uint8Array + detected extension so the parser can decide how to decode it.
 */

export interface ReadFile {
  name: string;
  ext: string;
  bytes: Uint8Array;
}

export async function readFile(file: File): Promise<ReadFile> {
  const buf = await file.arrayBuffer();
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  return { name: file.name, ext, bytes: new Uint8Array(buf) };
}
