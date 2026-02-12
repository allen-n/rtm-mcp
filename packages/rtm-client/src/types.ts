export interface RtmApiResponse {
  rsp: {
    stat: "ok" | "fail";
    err?: { code: string; msg: string };
    [key: string]: unknown;
  };
}

export interface RtmAuthToken {
  token: string;
  perms: string;
  user: {
    id: string;
    username: string;
    fullname: string;
  };
}

export interface RtmList {
  id: string;
  name: string;
  deleted: string;
  locked: string;
  archived: string;
  position: string;
  smart: string;
  sort_order?: string;
  filter?: string;
}

export interface RtmTask {
  id: string;
  due: string;
  has_due_time: string;
  added: string;
  completed: string;
  deleted: string;
  priority: string;
  postponed: string;
  estimate: string;
}

export interface RtmTaskSeries {
  id: string;
  created: string;
  modified: string;
  name: string;
  source: string;
  url: string;
  location_id: string;
  tags: { tag: string[] } | [];
  participants: unknown[];
  notes: { note: RtmNote[] } | [];
  task: RtmTask[];
  rrule?: {
    every: string;
    $t: string;
  };
}

export interface RtmTag {
  name: string;
}

export interface RtmLocation {
  id: string;
  name: string;
  longitude: string;
  latitude: string;
  zoom: string;
  address: string;
  viewable: string;
}

export interface RtmNote {
  id: string;
  created: string;
  modified: string;
  title: string;
  $t: string; // Note body text
}

export interface RtmContact {
  id: string;
  fullname: string;
  username: string;
}

export interface RtmSettings {
  timezone: string;
  dateformat: string;
  timeformat: string;
  defaultlist: string;
  language: string;
}

export interface RtmSubscription {
  id: string;
  url: string;
  topics: string;
  lease_seconds: number;
  created: string;
  expires: string;
  filter?: string;
}

export interface WebhookEvent {
  id: string;
  ts: string;
  type: string;
  data: Record<string, unknown>;
}
