import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export interface AdminUserPayload {
  id: number | string;
  email: string;
  fullName: string;
  role: string;
  exp?: number;
}

function getSecret(): string {
  return (
    process.env.ADMIN_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "blockquest-event-super-secret-key-2026"
  );
}

/**
 * Generate a signed JWT-style session token for admin users (12-hour expiry)
 */
export function generateAdminToken(user: AdminUserPayload): string {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours from now
  const payload = { ...user, exp };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  return `${payloadBase64}.${signature}`;
}

/**
 * Verify and decode an admin session token
 */
export function verifyAdminToken(token: string): AdminUserPayload | null {
  try {
    if (!token || !token.includes(".")) return null;
    const [payloadBase64, signature] = token.split(".");
    if (!payloadBase64 || !signature) return null;

    const secret = getSecret();
    const expectedSignature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadBase64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as AdminUserPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header or cookie and verify admin permissions
 */
export function verifyAdminAuth(
  request: Request,
  allowedRoles?: string[]
): {
  authorized: boolean;
  user?: AdminUserPayload;
  error?: string;
  status?: number;
} {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    // Check cookie fallback
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/bq_admin_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return {
      authorized: false,
      error: "Authentication required. Missing admin authorization token.",
      status: 401,
    };
  }

  const user = verifyAdminToken(token);
  if (!user) {
    return {
      authorized: false,
      error: "Invalid or expired admin session token. Please log in again.",
      status: 401,
    };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    // Normalizing role checks: superadmin has access to all roles
    const userRole = user.role?.toLowerCase();
    const hasRole =
      userRole === "superadmin" ||
      allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!hasRole) {
      return {
        authorized: false,
        error: `Forbidden. Role '${user.role}' lacks permission for this resource.`,
        status: 403,
      };
    }
  }

  return { authorized: true, user };
}

/**
 * Helper to generate standardized unauthorized JSON responses
 */
export function unauthorizedResponse(error = "Unauthorized", status = 401) {
  return NextResponse.json({ error }, { status });
}
