"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#1c1c1c",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>页面出错了</h2>
          <p style={{ color: "#5b6166", marginTop: 8, fontSize: 14 }}>
            {error.message || "发生未知错误"}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              background: "#e3000f",
              color: "#fff",
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
