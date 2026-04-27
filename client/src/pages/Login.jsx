import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import PrimaryButton from "../components/PrimaryButton";
import { useMockApp } from "../context/MockAppContext";

function Login() {
  const { login, currentUserId } = useMockApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  if (currentUserId) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    document.body.classList.add("login-page");
    return () => {
      document.body.classList.remove("login-page");
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    const result = login(username, password);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div
      className="login-screen"
      style={{ backgroundImage: "url('/src/assets/mainbackground.png')" }}
    >
      <div className="login-overlay" />
      <div className="login-content">
        <h1 className="login-wordmark">
          SIDE<span>5</span>
        </h1>
        <p className="login-tagline">DRAFT YOUR SIDE.</p>
        <p className="login-tagline login-tagline-orange">RUN THE GAME.</p>
        <img
          src="/src/assets/transparentlogo.png"
          alt="Side5"
          className="login-main-logo"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />

        {!showForm ? (
          <div className="login-cta-wrap">
            <PrimaryButton
              type="button"
              className="w-full login-cta-btn"
              onClick={() => navigate("/login-main")}
            >
              Log In
            </PrimaryButton>
            <Link className="w-full" to="/signup">
              <button type="button" className="btn btn-secondary w-full login-cta-btn">
                Create Account
              </button>
            </Link>
          </div>
        ) : (
          <form className="login-form-card" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field-label">Username</span>
              <input
                className="field-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="reydel"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="1234"
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="button-row">
              <SecondaryButton
                type="button"
                className="w-full"
                onClick={() => setShowForm(false)}
              >
                Back
              </SecondaryButton>
              <PrimaryButton type="submit" className="w-full">
                Enter
              </PrimaryButton>
            </div>
          </form>
        )}

        <p className="login-footnote">Play fair. Compete. Improve.</p>
      </div>
    </div>
  );
}

export default Login;
