/**
 * Shared types between frontend and backend.
 * This file is used by both server and client code.
 */

export type SavedDocumentSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sizeInBytes: number;
  lastOpenedAt: string | null;
  versionCount: number;
};

export type SavedDocumentVersionSummary = {
  id: string;
  documentId: string;
  name: string;
  createdAt: string;
  sizeInBytes: number;
};

export type SavedDocumentRecord = {
  metadata: SavedDocumentSummary;
  buffer: Uint8Array;
};

export type SavedDocumentVersionRecord = {
  metadata: SavedDocumentVersionSummary;
  buffer: Uint8Array;
};

export type ReadDocumentOptions = {
  markOpened?: boolean;
};
