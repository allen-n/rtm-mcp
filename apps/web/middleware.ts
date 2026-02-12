import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wantsMarkdownHome } from "./lib/llms-negotiation";

export function middleware(request: NextRequest) {
  if (request.method !== "GET") {
    return NextResponse.next();
  }

  if (wantsMarkdownHome(request.headers.get("accept"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/llms.txt";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
