import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const targetHost = env.VITE_WEBDAV_HOST || "https://webdav.rck.dscloud.biz";
  const username = env.VITE_WEBDAV_USERNAME || "web";
  const password = env.VITE_WEBDAV_PASSWORD || "RCKdnpq1004+";

  return {
    base: "/video/",
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      hmr: false,
      proxy: {
        "^/(video/)?webdav": {
          target: targetHost,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^(\/video)?\/webdav/, ""),
          secure: false,
          configure: (proxy) => {
            // 비디오 스트리밍을 위한 설정
            proxy.on("proxyReq", (proxyReq, req) => {
              // Range 헤더 지원
              if (req.headers.range) {
                proxyReq.setHeader("Range", req.headers.range);
              }

              // 인증 헤더 추가 - 환경변수에서 동적 읽기
              const auth = `${username}:${password}`;
              const base64Auth = "Basic " + Buffer.from(auth).toString("base64");
              proxyReq.setHeader("Authorization", base64Auth);
            });

            // 응답 헤더 설정
            proxy.on("proxyRes", (proxyRes, req) => {
              // CORS 헤더 추가
              proxyRes.headers["Access-Control-Allow-Origin"] = "*";
              proxyRes.headers["Access-Control-Allow-Methods"] =
                "GET, POST, PUT, DELETE, PROPFIND, OPTIONS";
              proxyRes.headers["Access-Control-Allow-Headers"] =
                "Content-Type, Authorization, Range";
              proxyRes.headers["Access-Control-Expose-Headers"] =
                "Content-Range, Content-Length";

              // 비디오 스트리밍을 위한 헤더 설정
              const pathname = req.url ? req.url.split("?")[0] : "";
              const decodedPath = decodeURI(pathname);
              if (
                decodedPath &&
                /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(decodedPath)
              ) {
                if (decodedPath.toLowerCase().endsWith(".mp4")) {
                  proxyRes.headers["Content-Type"] = "video/mp4";
                } else if (decodedPath.toLowerCase().endsWith(".webm")) {
                  proxyRes.headers["Content-Type"] = "video/webm";
                } else if (decodedPath.toLowerCase().endsWith(".ogg")) {
                  proxyRes.headers["Content-Type"] = "video/ogg";
                } else if (decodedPath.toLowerCase().endsWith(".mov")) {
                  proxyRes.headers["Content-Type"] = "video/quicktime";
                } else if (decodedPath.toLowerCase().endsWith(".avi")) {
                  proxyRes.headers["Content-Type"] = "video/x-msvideo";
                } else if (decodedPath.toLowerCase().endsWith(".mkv")) {
                  proxyRes.headers["Content-Type"] = "video/x-matroska";
                }

                proxyRes.headers["Accept-Ranges"] = "bytes";
                proxyRes.headers["Cache-Control"] = "no-cache";
              }
            });
          },
        },
      },
    },
  };
});
