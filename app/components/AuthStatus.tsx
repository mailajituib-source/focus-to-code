"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MiniUser = {
  email?: string | null;
};

export default function AuthStatus() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MiniUser | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!mounted) return;
        setUser(data.session?.user ?? null);
        setErr(null);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    async function safeSignOut() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    // 网络不通也允许退出 UI 继续
  }

  // ✅ 只删除 supabase 的 token（sb-开头）
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith("sb-")) localStorage.removeItem(k);
  }

  // ❌ 不要 localStorage.clear()
  // ❌ 不要删除 focus_to_code_sessions_v1 / focus_to_code_interrupts_v1
}

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // 登录 / 退出 / 刷新 token 都会进来
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) return <span style={{ fontSize: 13, opacity: 0.7 }}>Auth...</span>;

  // 如果你想看错误可以显示出来（也可以直接忽略）
  // if (err) return <span style={{ fontSize: 13, color: "crimson" }}>{err}</span>;

  if (!user?.email) {
    return (
      <a href="/login" style={{ fontSize: 14 }}>
        登录
      </a>
    );
  }

  const short = user.email.length > 18 ? user.email.slice(0, 18) + "…" : user.email;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 14, opacity: 0.85 }}>{short}</span>
      <button
        onClick={async () => {
          setLoading(true);
          try {
            const { error } = await supabase.auth.signOut({ scope: "local" });
            window.location.href = "/login"; // 或 router.push("/login")
            if (error) throw error;
            // 不强制 reload，onAuthStateChange 会自动刷新 UI
          } catch (e: any) {
            alert(e?.message ?? String(e));
          } finally {
            setLoading(false);
          }
        }}
        style={{ padding: "6px 10px", fontSize: 13 }}
      >
        退出
      </button>
    </div>
  );
}