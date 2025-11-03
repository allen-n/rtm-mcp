import { auth } from "@auth/server";

// Handle BetterAuth requests in Next.js
export async function GET(request: Request) {
  return auth.handler(request);
}

export async function POST(request: Request) {
  return auth.handler(request);
}
