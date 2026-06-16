"use client";

import { SessionProvider, signOut, useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { useEffect, useRef } from "react";

interface Props {
  children: React.ReactNode;
  session?: Session | null;
}

/**
 * Component that handles automatic logout when session expires
 */
function SessionTimeoutHandler() {
  const { data: session } = useSession();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Only set timeout if session exists and has an expiry
    if (session?.expires) {
      const expiryTime = new Date(session.expires).getTime();
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;

      // Only set timeout if expiry is in the future
      if (timeUntilExpiry > 0) {
        timeoutRef.current = setTimeout(() => {
          signOut({ callbackUrl: "/login" });
        }, timeUntilExpiry);
      } else {
        signOut({ callbackUrl: "/login" });
      }
    }

    // Cleanup timeout on unmount or session change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [session?.expires]);

  return null;
}

export function AuthSessionProvider({ children, session }: Props) {
  return (
    <SessionProvider session={session}>
      <SessionTimeoutHandler />
      {children}
    </SessionProvider>
  );
}
