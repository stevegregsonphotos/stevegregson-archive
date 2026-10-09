import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  BACKSTAGE_COOKIE_NAME,
  readBackstageSession,
} from "./backstage-auth";

/**
 * Server-side login check for Backstage pages.
 *
 * The proxy already guards /admin, but pages that can be reached through a
 * rewrite (e.g. transfers.stevegregson.com/) must not rely on it alone.
 */
export async function requireBackstagePage(next = "/admin") {
  const store = await cookies();
  const session = readBackstageSession(
    store.get(BACKSTAGE_COOKIE_NAME)?.value,
  );

  if (!session) {
    redirect("/admin/login?next=" + encodeURIComponent(next));
  }

  return session;
}
