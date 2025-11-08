import { auth } from "@packages/auth/src/server";

// We need to manually handle the requests since better-auth/next-js isn't available
// The auth.handler works directly with Request/Response
export async function GET(request: Request) {
  return auth.handler(request);
}

export async function POST(request: Request) {
  return auth.handler(request);
}
