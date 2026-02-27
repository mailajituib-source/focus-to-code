"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

async function sendLink() {
  setMsg(null);

  try {
    const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
});

if (error) {
  console.error("signInWithOtp error:", error);
  setMsg(`发送失败：${error.message}`);
}

    setMsg("✅ 已发送登录链接，请检查邮箱");
  } catch (e: any) {
    console.error("signInWithOtp exception:", e);
    setMsg("❌ 网络请求失败（Failed to fetch）。请检查 Supabase 域名是否可访问、代理/网络是否拦截。");
  }
}

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24 }}>登录</h1>
      <p style={{ opacity: 0.8 }}>输入邮箱，我们会发你一个登录链接（免密码）。</p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
      />

      <button onClick={sendLink} style={{ marginTop: 12, padding: "10px 14px" }} disabled={!email.includes("@")}>
        发送登录链接
      </button>

      {sent ? <p style={{ marginTop: 12 }}>已发送，请去邮箱点击登录链接。</p> : null}
      {msg ? <p style={{ marginTop: 12, color: "crimson" }}>{msg}</p> : null}

      <p style={{ marginTop: 18 }}>
        <a href="/">← 返回首页</a>
      </p>
    </main>
  );
}   