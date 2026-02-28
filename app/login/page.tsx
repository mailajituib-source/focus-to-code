"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendLink() {
    const supabase = getSupabaseBrowserClient();
    setLoading(true);
    setMsg(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("signInWithOtp error:", error);
        setMsg(`发送失败：${error.message}`);
      } else {
        setMsg("登录邮件已发送，请检查邮箱点击 Magic Link。");
      }
    } catch (e: any) {
      setMsg(`发送失败：${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>邮箱登录</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button
          onClick={sendLink}
          disabled={loading || !email}
          style={{ padding: "8px 12px", borderRadius: 6 }}
        >
          {loading ? "发送中…" : "发送登录链接"}
        </button>
      </div>

      {msg && (
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
          {msg}
        </p>
      )}
    </main>
  );
}