export interface RtmApiResponse {
  rsp: {
    stat: "ok" | "fail";
    err?: {
      code: string;
      msg: string;
    };
    [key: string]: any;
  };
}

export interface RtmTimeline {
  timeline: string;
}

export interface RtmAuthToken {
  token: string;
  perms: "read" | "write" | "delete";
  user: {
    id: string;
    username: string;
    fullname: string;
  };
}

export interface WebhookEvent {
  id: string;
  ts: string; // ISO 8601
  type: string;
  data: any;
}
