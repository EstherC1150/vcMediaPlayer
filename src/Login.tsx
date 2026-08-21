import { useState } from "react";
import "./Login.css";

interface LoginProps {
  onLogin: (username: string, password: string) => void;
}

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      setError("아이디와 비밀번호를 모두 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 엑셀 데이터 검증 우회
      await onLogin(username, password);
      return;

      /*
      const response = await fetch("/api/excel");
      const data = await response.json();

      const today = new Date();
      const todayString = `${today.getFullYear()}${(today.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;

      const user = data.find(
        (entry: ExcelData) =>
          entry.ID === username && entry.PW.toString() === password
      );

      if (user) {
        if (user.유효기간 >= todayString) {
          await onLogin(username, password);
        } else {
          setError("유효기간이 만료되었습니다.");
        }
      } else {
        setError("아이디 또는 비밀번호가 잘못되었습니다.");
      }
      */
    } catch (err) {
      setError("로그인에 실패했습니다. 서버 오류가 발생했습니다.");
      console.error("로그인 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>{"Visual Components\n미디어 플레이어"}</h1>
        <h2>로그인</h2>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">아이디</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
