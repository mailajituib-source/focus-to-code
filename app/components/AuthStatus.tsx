"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type MiniUser = {
  email?: string | null;
};

export default function AuthStatus() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MiniUser | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    init();

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function safeSignOut() {
    const supabase = getSupabaseBrowserClient();
    try {
      await supabase.auth.signOut();
    } catch {
      // 网络错误就算了，至少前端先退出
    }

    // ✅ 只删掉 supabase 的 token，不动你的本地 session/interrupt 数据
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-")) localStorage.removeItem(k);
    }
  }

  if (loading) return <span style={{ fontSize: 13, opacity: 0.7 }}>Auth...</span>;

  // 这里你如果想展示 err 也可以：
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
            await safeSignOut();
            window.location.href = "/login";
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