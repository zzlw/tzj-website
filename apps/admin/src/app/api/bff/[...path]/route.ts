import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE, COOKIE } from "@/lib/config";
import { applyTokenCookies, refreshAccessToken } from "@/lib/tokenRefresh";

async function proxy(req: NextRequest, path: string[]) {
  const store = await cookies();
  let accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  const search = req.nextUrl.search || "";
  const target = `${API_BASE}/${path.join("/")}${search}`;

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const rawBody = hasBody ? await req.text() : undefined;

  const forward = (bearer?: string) =>
    fetch(target, {
      method,
      headers: {
        "Content-Type": req.headers.get("content-type") || "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: rawBody,
      cache: "no-store",
    });

  let apiRes = await forward(accessToken);
  let rotated = null;

  if (apiRes.status === 401) {
    rotated = await refreshAccessToken(refreshToken);
    if (rotated) {
      accessToken = rotated.accessToken;
      apiRes = await forward(accessToken);
    }
  }

  const text = await apiRes.text();
  const res = new NextResponse(text, {
    status: apiRes.status,
    headers: {
      "content-type":
        apiRes.headers.get("content-type") || "application/json",
    },
  });

  if (rotated) {
    applyTokenCookies(res, rotated);
  }

  return res;
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path);
}
