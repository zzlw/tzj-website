import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE, COOKIE } from "@/lib/config";
import { applyTokenCookies, refreshAccessToken } from "@/lib/tokenRefresh";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 站点资源替换专用 BFF：multipart 转发至 Nest POST /media/:id/replace-site
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const store = await cookies();
  let accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  const incoming = await req.formData();
  const file = incoming.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: { message: "未接收到文件" } },
      { status: 400 },
    );
  }

  const buildForm = () => {
    const fd = new FormData();
    fd.append("file", file, file.name);
    return fd;
  };

  const forward = (bearer?: string) =>
    fetch(`${API_BASE}/media/${id}/replace-site`, {
      method: "POST",
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      body: buildForm(),
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
