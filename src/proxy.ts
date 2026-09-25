import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth redirect only — real authorization happens server-side in
 * each layout/action (requireAdmin / requirePro). This just avoids rendering
 * protected shells for visitors with no session cookie at all.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("dw_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/pro/:path*",
    "/messages/:path*",
    "/notifications/:path*",
    "/boards/:path*",
    "/billing/:path*",
  ],
};
