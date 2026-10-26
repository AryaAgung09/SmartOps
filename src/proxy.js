import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import {
  FEATURE_KEYS_HEADER,
  getApiFeatureKeys,
} from "@/lib/apiFeatures";
import { getAllowedFeatureKeys } from "@/lib/featureAccess";
import { routeFeatureKey } from "@/lib/features";

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete(FEATURE_KEYS_HEADER);

    const featureKeys = getApiFeatureKeys(pathname, request.method);
    if (featureKeys?.length) {
      requestHeaders.set(FEATURE_KEYS_HEADER, featureKeys.join(","));
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(FEATURE_KEYS_HEADER);

  const featureKey = routeFeatureKey(pathname);

  if (!featureKey) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.role) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const allowedFeatureKeys = await getAllowedFeatureKeys(token.role);

  if (allowedFeatureKeys.includes(featureKey)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";
  url.searchParams.set("accessDenied", featureKey);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/notifications/:path*",
    "/hr-dashboard/:path*",
    "/employees/:path*",
    "/users/:path*",
    "/my-profile/:path*",
    "/attendance/:path*",
    "/leaves/:path*",
    "/requests/:path*",
    "/finance/:path*",
    "/payroll/:path*",
    "/my-payroll/:path*",
    "/documents/:path*",
    "/access-control/:path*",
  ],
};
