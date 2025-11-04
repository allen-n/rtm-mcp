// Client-side helpers for web app

export async function fetchSession(): Promise<{
  id: string;
  email?: string;
  name?: string;
} | null> {
  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.user || null;
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    const res = await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`Sign out failed: ${res.status}`);
    }
  } catch (error) {
    console.error("Failed to sign out:", error);
    throw error instanceof Error ? error : new Error("Failed to sign out");
  }
}
