"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated as checkAuth } from "./api";

/**
 * Client-only auth hook that prevents hydration mismatches.
 * Returns { ready, authed } — pages should render nothing until ready=true.
 *
 * Pattern:
 *   const { ready, authed } = useAuth();
 *   if (!ready) return null;          // ← SSR returns null (server & client match)
 *   // ...rest of component
 */
export function useAuth() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const ok = checkAuth();
    setAuthed(ok);
    setReady(true);
    if (!ok) router.push("/login");
  }, [router]);

  return { ready, authed };
}
