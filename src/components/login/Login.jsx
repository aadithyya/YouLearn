import React, { useState } from "react";
import "./Login.css";
import loginpic from "../../assets/loginreal.png";

const Login = ({ onLogin }) => {
  const [mode, setMode] = useState(null); 
  const [form, setForm] = useState({ email: "", password: "", name: "" });

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin?.();
  };

  return (
    <div className="login-page">
  
      <div className="login-left">
        <div className="login-brand">YouLearn</div>

        <div className="login-content">
          <h1 className="login-heading">
       Start Your Study <br/>
       with YouLearn.
          </h1>
          <p className="login-sub">
             Quick login to jump into your AI-powered study workspace.
          </p>

          {mode === null && (
            <div className="login-btns">
              <button className="btn-primary" onClick={() => setMode("login")}>
                Log In
              </button>
              <button className="btn-secondary" onClick={() => setMode("signup")}>
                Sign Up
              </button>
            </div>
          )}

          {mode === "login" && (
            <form className="login-form" onSubmit={handleSubmit}>
              <input
                className="login-input"
                type="email"
                name="email"
                placeholder="Email address"
                value={form.email}
                onChange={handleChange}
                required
                autoFocus
              />
              <input
                className="login-input"
                type="password"
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <div className="login-form-actions">
                <button type="submit" className="btn-primary">Log In →</button>
                <button type="button" className="btn-ghost" onClick={() => setMode(null)}>
                  Back
                </button>
              </div>
              <p className="login-switch">
                No account?{" "}
                <span onClick={() => setMode("signup")}>Sign up</span>
              </p>
            </form>
          )}

          {mode === "signup" && (
            <form className="login-form" onSubmit={handleSubmit}>
              <input
                className="login-input"
                type="text"
                name="name"
                placeholder="Full name"
                value={form.name}
                onChange={handleChange}
                required
                autoFocus
              />
              <input
                className="login-input"
                type="email"
                name="email"
                placeholder="Email address"
                value={form.email}
                onChange={handleChange}
                required
              />
              <input
                className="login-input"
                type="password"
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <div className="login-form-actions">
                <button type="submit" className="btn-primary">Create Account →</button>
                <button type="button" className="btn-ghost" onClick={() => setMode(null)}>
                  Back
                </button>
              </div>
              <p className="login-switch">
                Already have one?{" "}
                <span onClick={() => setMode("login")}>Log in</span>
              </p>
            </form>
          )}
        </div>
      </div>

      <div className="login-right">
        <img src={loginpic} alt="Grow illustration" className="login-illustration" />
      </div>
    </div>
  );
};

export default Login;