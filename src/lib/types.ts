// Shared DTO types crossing the server/client boundary.
// BigInt fields are serialized as strings.

export interface VideoSourceDto {
  resolution: "P240" | "P360" | "P480" | "P720" | "P1080";
  label: string; // "720p"
  url: string;
  mimeType: string;
  bitrateKbps: number;
}

export interface VideoCardDto {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  viewCount: string;
  publishedAt: string | null;
  categoryName: string | null;
  uploaderName: string;
}

export interface FeedPageDto {
  items: VideoCardDto[];
  nextCursor: string | null;
}

export interface StreamMetadataDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  viewCount: string;
  sources: VideoSourceDto[];
}

export type ViewEvent = "start" | "milestone_25" | "milestone_50" | "milestone_75" | "milestone_100";

export interface CommentDto {
  id: string;
  body: string;
  createdAt: string; // ISO
  author: { username: string; avatarUrl: string | null };
  replies?: CommentDto[]; // present on top-level comments only
}

export interface CommentPageDto {
  items: CommentDto[];
  nextCursor: string | null;
  totalCount: number;
}

export interface SessionUserDto {
  id: string;
  username: string;
  role: "USER" | "MODERATOR" | "ADMIN";
}
