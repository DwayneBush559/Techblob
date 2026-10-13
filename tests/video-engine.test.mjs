// tests/video-engine.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { TechblobVideoEngine, MockRedisStore } from '../src/lib/video-engine.ts';

test('TechBlob In-Repo: generates presigned S3 upload contracts with size limits', () => {
  const engine = new TechblobVideoEngine();
  const presigned = engine.generatePresignedUpload({
    uploaderId: 'user_dev_01',
    filename: 'silicon_valley_blooper.mp4',
    mimeType: 'video/mp4',
    byteSize: 32_000_000,
  });

  assert.match(presigned.uploadUrl, /^https:\/\/storage\.kavaro\.techblob\.s3\.amazonaws\.com/);
  assert.equal(presigned.headers['Content-Type'], 'video/mp4');
  assert.equal(presigned.headers['Content-Length'], '32000000');
  assert.equal(presigned.expiresInSeconds, 900);
});

test('TechBlob In-Repo: Redis view beacon buffering and atomic SQL batch flusher', async () => {
  const redis = new MockRedisStore();
  const engine = new TechblobVideoEngine(redis);

  await engine.recordViewBeacon('vid_incident_404');
  await engine.recordViewBeacon('vid_incident_404');
  await engine.recordViewBeacon('vid_incident_500');

  const flush = await engine.flushViewsToPostgresQuery();
  assert.ok(flush);
  assert.equal(flush.totalDeltas, 3);
  assert.match(flush.sql, /UPDATE videos AS target SET view_count = target\.view_count \+ v\.delta/);
});

test('TechBlob In-Repo: cursor pagination handles descending feed ordering', () => {
  const engine = new TechblobVideoEngine();
  const sampleVideos = [
    { id: 'v1', uploaderId: 'u1', title: 'Clip 1', storageKey: 'k1', mimeType: 'video/mp4', byteSize: 100, durationSeconds: 10, viewCount: 1, likeCount: 0, createdAt: '2026-10-13T01:00:00Z' },
    { id: 'v2', uploaderId: 'u2', title: 'Clip 2', storageKey: 'k2', mimeType: 'video/mp4', byteSize: 100, durationSeconds: 20, viewCount: 5, likeCount: 1, createdAt: '2026-10-13T02:00:00Z' },
  ];

  const page = engine.paginateVideos(sampleVideos, { limit: 1 });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].id, 'v2');
  assert.equal(page.hasMore, true);
});
