import { auth } from "@auth/server";
import { toNextJsHandler } from "better-auth/next-js";

// Use Next.js handler helper
export const { GET, POST } = toNextJsHandler(auth.handler);
