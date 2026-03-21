import React, { useState } from "react";
import { SignIn, SignUp } from "@clerk/react";
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
        <div className="login-brand" style={{ display: 'flex', alignItems: 'center', fontSize: '36px', fontWeight: '800' }}>
          YouLearn
        </div>

        <div className="login-content">
          <h1 className="login-heading">
            Start Your Study <br />
            with YouLearn.
          </h1>
          <p className="login-sub">
            Quick login to jump into your AI-powered study workspace.
          </p>

          <div style={{ marginTop: '2rem' }}>
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
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', display: 'inline-block' }}>
                <SignIn routing="hash" />
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <p className="login-switch">
                    <span onClick={() => setMode(null)}>← Back</span>
                  </p>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', display: 'inline-block' }}>
                <SignUp routing="hash" />
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <p className="login-switch">
                    <span onClick={() => setMode(null)}>← Back</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="login-right">
        <img src={loginpic} alt="Grow illustration" className="login-illustration" />
      </div>
    </div>
  );
};

export default Login;