import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { ROUTE_PERMISSIONS, PUBLIC_ROUTES } from "@lib/navigation/config";

function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (!token) return NextResponse.next();

    if (path === "/") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const isAdmin = (token.isAdmin as boolean) || false;
    const permissions = (token.permissions as string[]) || [];

    if (isAdmin) return NextResponse.next();

    const isPublicRoute = PUBLIC_ROUTES.some(
      (route) => path === route || path.startsWith(route + "/")
    );
    if (isPublicRoute) return NextResponse.next();

    for (const [routePrefix, requiredPerms] of Object.entries(ROUTE_PERMISSIONS)) {
      if (path.startsWith(routePrefix)) {
        if (!hasAnyPermission(permissions, requiredPerms)) {
          return NextResponse.redirect(new URL("/permission-denied", req.url));
        }
        return NextResponse.next();
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!api|login|_next/static|_next/image|favicon.ico|icons/).*)",
  ],
};
