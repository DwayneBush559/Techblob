// src/lib/video-engine.ts
// TechBlob High-Throughput Video Engine & Hot-Path View Buffer.
// Provides S3 direct-upload presigning, Redis view beacon buffering,
// atomic SQL batch flusher generation, and cursor-indexed feeds.

export interface PresignedUploadRequest {
  uploaderId: string;
  filename: string;
  mimeType: 'video/mp4' | 'video/quicktime' | 'video/webm';
  byteSize: number;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface VideoMetadata {
  id: string;
  uploaderId: string;
  title: string;
  caption?: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  createdAt: string; // ISO string
}

export interface CursorPaginationParams {
  limit?: number;
  cursor?: string; // Encoded base64(createdAt + '|' + id)
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * In-memory Mock Redis store simulating HINCRBY and SADD for zero-dependency tests and offline dev.
 */
export class MockRedisStore {
  private viewCounts = new Map<string, number>();
  private dirtyVideos = new Set<string>();

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    const videoId = key.replace('techblob:views:', '');
    const current = this.viewCounts.get(videoId) ?? 0;
    const next = current + increment;
    this.viewCounts.set(videoId, next);
    this.dirtyVideos.add(videoId);
    return next;
  }

  async smembers(key: string): Promise<string[]> {
    if (key === 'techblob:dirty_views') {
      return Array.from(this.dirtyVideos);
    }
    return [];
  }

  async getAndResetDirtyCounts(): Promise<Array<{ videoId: string; delta: number }>> {
    const batch: Array<{ videoId: string; delta: number }> = [];
    for (const videoId of this.dirtyVideos) {
      const delta = this.viewCounts.get(videoId) ?? 0;
      if (delta > 0) {
        batch.push({ videoId, delta });
      }
    }
    this.dirtyVideos.clear();
    this.viewCounts.clear();
    return batch;
  }
}

/**
 * Core TechBlob High-Throughput Video Engine
 */
export class TechblobVideoEngine {
  private redis: MockRedisStore;
  private maxByteSize = 524_288_000; // 500 MB max video upload
  private allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

  constructor(redisStore?: MockRedisStore) {
    this.redis = redisStore ?? new MockRedisStore();
  }

  generatePresignedUpload(request: PresignedUploadRequest): PresignedUploadResponse {
    if (request.byteSize <= 0 || request.byteSize > this.maxByteSize) {
      throw new Error(`Upload size must be between 1 byte and ${this.maxByteSize / 1024 / 1024} MB`);
    }

    if (!this.allowedMimeTypes.has(request.mimeType)) {
      throw new Error(`Mime-type ${request.mimeType} is not permitted for TechBlob video streaming`);
    }

    const timestamp = Date.now();
    const sanitizedFilename = request.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `raw-videos/${request.uploaderId}/${timestamp}-${sanitizedFilename}`;

    const uploadUrl = `https://storage.kavaro.techblob.s3.amazonaws.com/${storageKey}?X-Amz-Signature=mock_sig_${timestamp}`;

    return {
      uploadUrl,
      storageKey,
      headers: {
        'Content-Type': request.mimeType,
        'Content-Length': request.byteSize.toString(),
        'x-amz-acl': 'private',
      },
      expiresInSeconds: 900,
    };
  }

  async recordViewBeacon(videoId: string): Promise<void> {
    await this.redis.hincrby(`techblob:views:${videoId}`, 'count', 1);
  }

  async flushViewsToPostgresQuery(): Promise<{ sql: string; values: Array<string | number>; totalDeltas: number } | null> {
    const dirtyBatch = await this.redis.getAndResetDirtyCounts();
    if (dirtyBatch.length === 0) return null;

    const values: Array<string | number> = [];
    const valuePlaceholders: string[] = [];

    dirtyBatch.forEach((item, index) => {
      const p1 = index * 2 + 1;
      const p2 = index * 2 + 2;
      valuePlaceholders.push(`($${p1}::text, $${p2}::int)`);
      values.push(item.videoId, item.delta);
    });

    const sql = `UPDATE videos AS target SET view_count = target.view_count + v.delta FROM (VALUES ${valuePlaceholders.join(
      ', '
    )}) AS v(id, delta) WHERE target.id = v.id;`;

    const totalDeltas = dirtyBatch.reduce((sum, item) => sum + item.delta, 0);

    return { sql, values, totalDeltas };
  }

  encodeCursor(createdAt: string, id: string): string {
    return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64');
  }

  decodeCursor(cursor: string): { createdAt: string; id: string } {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const [createdAt, id] = decoded.split('|');
    if (!createdAt || !id) throw new Error('Malformed pagination cursor');
    return { createdAt, id };
  }

  paginateVideos(videos: VideoMetadata[], params: CursorPaginationParams): CursorPaginationResult<VideoMetadata> {
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);

    const sorted = [...videos].sort((a, b) => {
      const timeDiff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    let startIndex = 0;
    if (params.cursor) {
      const { createdAt, id } = this.decodeCursor(params.cursor);
      startIndex = sorted.findIndex(v => v.createdAt === createdAt && v.id === id) + 1;
      if (startIndex === 0) {
        startIndex = 0;
      }
    }

    const items = sorted.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < sorted.length;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem.createdAt, lastItem.id) : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
