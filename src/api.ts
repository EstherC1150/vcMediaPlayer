import { createClient, FileStat } from "webdav";

const WEBDAV_USERNAME = import.meta.env.VITE_WEBDAV_USERNAME || "web";
const WEBDAV_PASSWORD = import.meta.env.VITE_WEBDAV_PASSWORD || "RCKdnpq1004+";

// WebDAV 클라이언트 생성 (/webdav 개발 서버 프록시 사용)
const client = createClient("/webdav", {
  username: WEBDAV_USERNAME,
  password: WEBDAV_PASSWORD,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PROPFIND, OPTIONS",
  },
});

// 파일 타입 정의
export interface FileItem {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: "file" | "directory";
}

export interface SearchResultItem extends FileItem {
  parentPath: string;
  displayPath: string;
}

// 간단하고 직관적인 페이지 내 경로 변환 함수 (dept-seoul 제거 및 › 구분자 적용)
export const formatDisplayPath = (fullPath: string): string => {
  const cleanPath = fullPath.replace(/\.\.\//g, "").replace(/^\/+/, "");
  const parts = cleanPath.split("/").filter(Boolean);
  if (parts.length <= 1) return "Home";
  
  const subParts = parts[0] === "dept-seoul" ? parts.slice(1) : parts;
  if (subParts.length === 0) return "Home";
  return subParts.join(" › ");
};

// 폴더 내용 가져오기
export const fetchFiles = async (path: string): Promise<FileItem[]> => {
  try {
    const normalizedPath = path.replace(/\.\.\//g, "").replace(/^\/+/, "");

    const directoryContents = (await client.getDirectoryContents(
      normalizedPath
    )) as FileStat[];

    // WebDAV self-directory 반환 항목 및 중복 제거
    const formattedFiles: FileItem[] = [];
    const seen = new Set<string>();

    for (const item of directoryContents) {
      const cleanFilename = item.filename.replace(/\.\.\//g, "").replace(/^\/+/, "");
      
      // 자기 자신 폴더 응답 제거
      if (cleanFilename === normalizedPath || cleanFilename === normalizedPath + "/") {
        continue;
      }

      if (!seen.has(cleanFilename)) {
        seen.add(cleanFilename);
        formattedFiles.push({
          filename: cleanFilename,
          basename: item.basename,
          lastmod: item.lastmod,
          size: item.size,
          type: item.type,
        });
      }
    }

    return formattedFiles;
  } catch (err) {
    console.error("WebDAV 접근 오류:", err);
    throw err;
  }
};

// 초고속 병렬(Promise.all) 하위 폴더 및 동영상 재귀 검색 (중복 100% 제거)
export const searchAllFiles = async (
  startPath: string = "dept-seoul",
  query: string,
  maxDepth: number = 4
): Promise<SearchResultItem[]> => {
  const results: SearchResultItem[] = [];
  const seenPaths = new Set<string>(); // 중복 방지 고유 경로 세트
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return results;

  const traverse = async (currentPath: string, depth: number) => {
    if (depth > maxDepth) return;
    try {
      const items = await fetchFiles(currentPath);
      const subFolders: string[] = [];

      for (const item of items) {
        if (item.basename === "..") continue;

        // 동영상(.mp4) 또는 폴더만 대상
        if (item.type !== "directory" && !item.basename.toLowerCase().endsWith(".mp4")) {
          continue;
        }

        // 이미 결과에 추가된 고유 경로면 중복 스킵!
        if (seenPaths.has(item.filename)) {
          continue;
        }

        // 검색 매칭 조건: 자기 자신의 파일/폴더 명칭(basename)에만 검색어가 들어있는지 확인
        const isMatch = item.basename.toLowerCase().includes(lowerQuery);
        const parentPath = currentPath;

        if (isMatch) {
          seenPaths.add(item.filename);
          results.push({
            ...item,
            parentPath,
            displayPath: formatDisplayPath(parentPath),
          });
        }

        // 하위 폴더일 경우 재귀 탐색 대상에 추가
        if (item.type === "directory") {
          subFolders.push(item.filename);
        }
      }

      // 병렬(Promise.all) 탐색
      if (subFolders.length > 0 && depth < maxDepth) {
        await Promise.all(
          subFolders.map((folder) => traverse(folder, depth + 1))
        );
      }
    } catch (err) {
      console.error(`재귀 탐색 오류 (${currentPath}):`, err);
    }
  };

  await traverse(startPath, 1);
  return results;
};

// TXT 파일 내용 가져오기 (WebDAV 클라이언트 getFileContents 활용)
export const fetchTxtContent = async (filePath: string): Promise<string> => {
  try {
    const normalizedPath = filePath.replace(/\.\.\//g, "").replace(/^\/+/, "");

    const content = await client.getFileContents(normalizedPath, {
      format: "text",
    });

    if (
      typeof content === "string" &&
      content.trim() &&
      !content.trim().startsWith("<!doctype") &&
      !content.trim().startsWith("<html")
    ) {
      return content;
    }
    return "설명 없음";
  } catch (err) {
    console.log("TXT 파일 없음 또는 읽기 실패:", err);
    return "설명 없음";
  }
};

// 비디오 URL 생성 (/webdav 프록시 경로 사용)
export const getVideoUrl = (filePath: string): string => {
  const normalizedPath = filePath.replace(/\.\.\//g, "").replace(/^\/+/, "");
  return encodeURI(`/webdav/${normalizedPath}`);
};

// 파일 다운로드
export const downloadFile = async (
  filePath: string,
  fileName: string
): Promise<void> => {
  try {
    const normalizedPath = filePath.replace(/\.\.\//g, "").replace(/^\/+/, "");
    const downloadUrl = encodeURI(`/webdav/${normalizedPath}`);

    const response = await fetch(downloadUrl, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(
        `다운로드 실패: ${response.status} ${response.statusText}`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error("파일 다운로드 오류:", err);
    throw err;
  }
};
