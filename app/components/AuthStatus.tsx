"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type MiniUser = { email?: string | null };

export default function AuthStatus() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MiniUser | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseClient();

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(data.session?.user ?? null);
      } catch {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function safeSignOut() {
    const supabase = getSupabaseClient();
    try {
      await supabase.auth.signOut();
    } catch {
      // 网络不通也允许退出 UI 继续
    }

    // ✅ 只删除 supabase 的 token（sb-开头）
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-")) localStorage.removeItem(k);
    }

    window.location.href = "/login";
  }

  if (loading) return <span style={{ fontSize: 13, opacity: 0.7 }}>Auth...</span>;

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
      <button onClick={safeSignOut} style={{ padding: "6px 10px", fontSize: 13 }}>
        退出
      </button>
    </div>
  );
}