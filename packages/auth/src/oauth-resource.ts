import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { createAuthClient } from "better-auth/client";
import { auth } from "./server";

export const oauthResourceClient = createAuthClient({
  plugins: [oauthProviderResourceClient(auth)],
});
