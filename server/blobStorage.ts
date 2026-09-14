import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Stores document blobs (the .docx bytes) by an opaque, forward-slash key so the
 * same keys work for a filesystem now and object storage later.
 */
export interface BlobStoragePort {
  put(key: string, contents: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /** Removes every blob under a prefix (used when deleting a document). */
  deletePrefix(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class BlobNotFoundError extends Error {
  constructor(key: string) {
    super(`Blob ${key} was not found.`);
    this.name = 'BlobNotFoundError';
  }
}

export function documentVersionKey(documentId: string, versionId: string) {
  return `documents/${documentId}/${versionId}.docx`;
}

export function documentPrefix(documentId: string) {
  return `documents/${documentId}`;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

/** Filesystem-backed blob store for self-host and local development. */
export class DiskBlobStorage implements BlobStoragePort {
  readonly rootDir: string;

  constructor({ rootDir }: { rootDir: string }) {
    this.rootDir = rootDir;
  }

  private resolve(key: string) {
    const segments = key.split('/');
    if (segments.some((segment) => segment === '' || segment === '..')) {
      throw new Error(`Invalid blob key: ${key}`);
    }

    return join(this.rootDir, ...segments);
  }

  async put(key: string, contents: Uint8Array) {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }

  async get(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if (isNotFound(error)) throw new BlobNotFoundError(key);
      throw error;
    }
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }

  async deletePrefix(prefix: string) {
    await rm(this.resolve(prefix), { recursive: true, force: true });
  }

  async exists(key: string) {
    try {
      await stat(this.resolve(key));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}
