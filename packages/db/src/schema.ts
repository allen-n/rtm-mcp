// User and auth
export interface User {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string; // ISO 8601
  token: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  created_at: string;
}

// RTM integration
export interface RtmToken {
  user_id: string;
  auth_token: string;
  perms: "read" | "write" | "delete";
  status: "active" | "invalid";
  username: string | null;
  fullname: string | null;
  updated_at: string;
}

// Timeline management - session-based, not permanent
export interface RtmTimeline {
  id: string;
  user_id: string;
  timeline: string;
  created_at: string;
  expires_at: string; // Timelines refresh every 24h or per session
}

export interface WebhookSub {
  id: string;
  user_id: string;
  subscription_id: string; // RTM subscription ID
  topics: string; // JSON array of topics
  filter: string | null;
  url: string;
  lease_seconds: number | null;
  expires_at: string | null;
  status: "active" | "expired" | "failed";
  created_at: string;
  updated_at: string;
}

export interface DB {
  users: User;
  sessions: Session;
  accounts: Account;
  rtm_tokens: RtmToken;
  rtm_timelines: RtmTimeline;
  webhook_subs: WebhookSub;
}
