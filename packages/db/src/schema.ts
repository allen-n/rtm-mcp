import type {
  Accounts,
  DB as GeneratedDB,
  RtmTimelines,
  RtmTokens,
  Sessions,
  Users,
  WebhookSubs
} from "./generated-types";

export type DB = GeneratedDB;

// Backwards-compatible aliases so the rest of the codebase can keep singular names.
export type User = Users;
export type Session = Sessions;
export type Account = Accounts;
export type RtmToken = RtmTokens;
export type RtmTimeline = RtmTimelines;
export type WebhookSub = WebhookSubs;
