import { NextResponse } from "next/server";
// Auth middleware placeholder: Supabase SSR session refresh lands here
// once a Supabase project is connected (see docs/operations/runbook.md).
// Until then, all routes are public demo routes.
export function middleware() {
  return NextResponse.next();
}
export const config = { matcher: [] };
