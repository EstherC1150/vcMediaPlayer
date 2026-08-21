import { useState, useCallback, useEffect, useMemo } from "react";
import "./App.css";
import {
  fetchFiles as apiFetchFiles,
  fetchTxtContent as apiFetchTxtContent,
  getVideoUrl,
  searchAllFiles as apiSearchAllFiles,
  SearchResultItem,
} from "./api";

// 파일 타입 정의
interface FileItem {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: "file" | "directory";
}

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("dept-seoul");
  
  // 전체 검색 State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDescription, setVideoDescription] = useState<string>("설명 없음");
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState<boolean>(false);

  // 폴더 내용 가져오기
  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      let normalizedPath = path.replace(/\.\.\//g, "").replace(/^\/+/, "");
      
      if (!normalizedPath.startsWith("dept-seoul")) {
        normalizedPath = "dept-seoul";
      }

      const data = await apiFetchFiles(normalizedPath);

      // MP4 파일과 폴더만 필터링
      const filteredFiles = data.filter(
        (file) =>
          file.type === "directory" ||
          file.basename.toLowerCase().endsWith(".mp4")
      );

      const currentFolderName = normalizedPath.split("/").pop() || "";
      let filesWithParent = [...filteredFiles];

      if (normalizedPath !== "dept-seoul") {
        const parentPath =
          normalizedPath.split("/").slice(0, -1).join("/") || "dept-seoul";

        filesWithParent = [
          {
            filename: parentPath,
            basename: `..`,
            lastmod: new Date().toISOString(),
            size: 0,
            type: "directory" as const,
          },
          ...filteredFiles.filter(
            (file) =>
              file.type !== "directory" || file.basename !== currentFolderName
          ),
        ];
      } else {
        filesWithParent = filteredFiles.filter(
          (file) =>
            file.type !== "directory" || file.basename !== currentFolderName
        );
      }

      setFiles(filesWithParent);
      setCurrentPath(normalizedPath);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(`오류 발생: ${errorMessage}`);
      console.error("파일 목록 가져오기 오류:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles("dept-seoul");
  }, [fetchFiles]);

  // 키보드 단축키 (Esc 키로 비디오 플레이어 닫기)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVideoPlayerVisible) {
        closeVideoPlayer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVideoPlayerVisible]);

  // 전체 검색 디바운싱 처리 (Global Recursive Search)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await apiSearchAllFiles("dept-seoul", searchQuery.trim());
        setSearchResults(results);
      } catch (err) {
        console.error("전체 검색 오류:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const navigateToFolder = (folderPath: string) => {
    fetchFiles(folderPath);
    setSelectedVideo(null);
    setVideoUrl(null);
    setVideoDescription("설명 없음");
    setSearchQuery(""); // 폴더 이동 시 검색어 초기화
  };

  const fetchTxtContent = async (videoPath: string, videoName: string) => {
    try {
      const baseNameWithoutExt = videoName.replace(/\.mp4$/i, "");
      const txtFileName = `${baseNameWithoutExt}.txt`;
      const txtFilePath = videoPath.replace(videoName, txtFileName);

      const text = await apiFetchTxtContent(txtFilePath);
      setVideoDescription(text);
    } catch (err) {
      console.error("TXT 파일 읽기 오류:", err);
      setVideoDescription("설명 없음");
    }
  };

  const closeVideoPlayer = () => {
    setIsVideoPlayerVisible(false);
    setSelectedVideo(null);
    setVideoUrl(null);
  };

  const playVideo = async (filePath: string, fileName: string) => {
    try {
      setLoading(true);
      setSelectedVideo(fileName);
      setError(null);
      setVideoDescription("설명 없음");
      setIsVideoPlayerVisible(true);

      const normalizedPath = filePath.replace(/\.\.\//g, "");
      const generatedUrl = getVideoUrl(normalizedPath);
      setVideoUrl(generatedUrl);

      await fetchTxtContent(normalizedPath, fileName);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(`비디오 재생 오류: ${errorMessage}`);
      console.error("비디오 재생 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  const isVideoFile = (fileName: string): boolean => {
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"];
    return videoExtensions.some((ext) => fileName.toLowerCase().endsWith(ext));
  };

  // 현재 폴더 요약 수량 정보 계산
  const folderSummary = useMemo(() => {
    const validItems = files.filter((f) => f.basename !== "..");
    const dirCount = validItems.filter((f) => f.type === "directory").length;
    const fileCount = validItems.filter((f) => f.type === "file").length;
    return { dirCount, fileCount };
  }, [files]);

  // 검색 상태 여부
  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
    <div className="App">
      {/* 헤더 */}
      <div className="header">
        <h1 className="header-title">Visual Components 미디어 플레이어</h1>
      </div>

      {loading && <p className="loading">로딩 중...</p>}
      {error && <p className="error">{error}</p>}

      <div className="content-container">
        <div className={`file-list ${currentPath === "" ? "root-path" : ""}`}>
          {/* Breadcrumb 경로 및 검색 바 영역 */}
          <div className="breadcrumb-bar">
            <div className="breadcrumb">
              <span 
                className="breadcrumb-link" 
                onClick={() => navigateToFolder("dept-seoul")}
              >
                <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Home
              </span>
              {currentPath.split("/").map((part, index, arr) => {
                if (index === 0 && part === "dept-seoul") return null;
                if (!part) return null;
                
                const targetPath = arr.slice(0, index + 1).join("/");
                return (
                  <span key={index} className="breadcrumb-segment">
                    <span className="breadcrumb-separator">›</span>
                    <span 
                      className={index === arr.length - 1 ? "breadcrumb-current" : "breadcrumb-link"}
                      onClick={() => navigateToFolder(targetPath)}
                    >
                      {part}
                    </span>
                  </span>
                );
              })}

            </div>

            {/* 전체 검색 입력창 */}
            <div className="mini-search-box">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="전체 하위 폴더 & 동영상 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mini-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="search-clear-btn"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <table className="file-table">
            <thead>
              <tr>
                <th>{hasActiveSearch ? "전체 검색 항목 (폴더 / 동영상)" : "파일 / 폴더 목록"}</th>
                <th style={{ textAlign: "right" }}>
                  <div className="header-action-col">
                    {!hasActiveSearch && (
                      <span className="folder-summary-badge">
                        폴더 {folderSummary.dirCount}개 · 동영상 {folderSummary.fileCount}개
                      </span>
                    )}
                    {hasActiveSearch && (
                      <span className="folder-summary-badge search-mode-badge">
                        {isSearching ? "검색 중..." : `결과: ${searchResults.length}건`}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 일반 폴더 보기 모드 */}
              {!hasActiveSearch &&
                files.map((file, index) => (
                  <tr key={index}>
                    <td>
                      {file.type === "directory" ? (
                        <button
                          className="folder-link"
                          onClick={() => navigateToFolder(file.filename)}
                        >
                          <svg className="item-icon folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                          </svg>
                          <span className="truncate-text" title={file.basename}>{file.basename}</span>
                        </button>
                      ) : (
                        <div
                          className="file-link"
                          onClick={() => playVideo(file.filename, file.basename)}
                        >
                          <svg className="item-icon video-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                          </svg>
                          <span className="truncate-text" title={file.basename}>{file.basename}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {file.type === "file" && (
                        <div className="action-buttons">
                          {isVideoFile(file.basename) && (
                            <button
                              className="play-button"
                              onClick={() =>
                                playVideo(file.filename, file.basename)
                              }
                            >
                              재생
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

              {/* 전체 검색 모드 */}
              {hasActiveSearch && isSearching && (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "var(--primary-hover)", padding: "30px" }}>
                    검색 중입니다...
                  </td>
                </tr>
              )}

              {hasActiveSearch && !isSearching && searchResults.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px" }}>
                    "{searchQuery}" 와 일치하는 폴더나 동영상이 없습니다.
                  </td>
                </tr>
              )}

              {hasActiveSearch &&
                !isSearching &&
                searchResults.map((item, index) => (
                  <tr key={index}>
                    <td>
                      {item.type === "directory" ? (
                        <button
                          className="folder-link search-item-link"
                          onClick={() => navigateToFolder(item.filename)}
                        >
                          <svg className="item-icon folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                          </svg>
                          <div className="item-info-col">
                            <span className="truncate-text font-bold" title={item.basename}>{item.basename}</span>
                            <span className="item-parent-path">{item.displayPath}</span>
                          </div>
                        </button>
                      ) : (
                        <div
                          className="file-link search-item-link"
                          onClick={() => playVideo(item.filename, item.basename)}
                        >
                          <svg className="item-icon video-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                          </svg>
                          <div className="item-info-col">
                            <span className="truncate-text font-bold" title={item.basename}>{item.basename}</span>
                            <span className="item-parent-path">{item.displayPath}</span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      {item.type === "file" && isVideoFile(item.basename) && (
                        <div className="action-buttons">
                          <button
                            className="play-button"
                            onClick={() => playVideo(item.filename, item.basename)}
                          >
                            재생
                          </button>
                        </div>
                      )}
                      {item.type === "directory" && (
                        <div className="action-buttons">
                          <button
                            className="folder-open-btn"
                            onClick={() => navigateToFolder(item.filename)}
                          >
                            이동
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* 스크롤 고정 (Sticky) 비디오 플레이어 */}
        {selectedVideo && isVideoPlayerVisible && (
          <div className="video-player sticky-player">
            <div className="video-player-header">
              <h2>{selectedVideo}</h2>
              <button
                className="close-button"
                onClick={closeVideoPlayer}
                title="닫기 (Esc)"
              >
                ✕
              </button>
            </div>
            {videoUrl && (
              <>
                <video
                  controls
                  autoPlay
                  className="video-element"
                  src={videoUrl}
                  onError={(e) => {
                    console.error("비디오 재생 오류:", e);
                    setError(
                      `비디오 재생 오류: ${selectedVideo} 파일을 재생할 수 없습니다.`
                    );
                  }}
                >
                  브라우저가 비디오 태그를 지원하지 않습니다.
                </video>
                <div className="video-info">
                  <div className="video-description">
                    <h3>설명</h3>
                    <p>{videoDescription}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
