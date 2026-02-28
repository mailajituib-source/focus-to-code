"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type MiniUser = {
  email?: string | null;
};

export default function AuthStatus() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MiniUser | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function safeSignOut() {
    // 1) 先尽量走 supabase 正常退出（可能会 Failed to fetch）
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut(); // 不依赖 scope，失败也无所谓
    } catch {
      // ignore：网络断了也允许继续
    }

    // 2) 无论如何：清掉本地 sb- token（只清 supabase 的，不动你的业务数据）
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-")) localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }

    // 3) 更新 UI
    setUser(null);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const supabase = getSupabaseClient();

        // 用 getUser 更直接（拿不到就说明没登录）
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (!mounted) return;
        setUser(data.user ? { email: data.user.email } : null);
        setErr(null);
      } catch (e: any) {
        if (!mounted) return;
        // 未登录/网络问题都可能报错，允许 UI 正常显示“登录”
        setUser(null);
        setErr(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    // 监听登录/退出/刷新 token
    let unsub: (() => void) | null = null;
    try {
      const supabase = getSupabaseClient();
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ? { email: session.user.email } : null);
      });
      unsub = () => data.subscription.unsubscribe();
    } catch {
      // 如果 env 缺失或 getSupabaseClient 抛错，会走这里；
      // 你线上 env 配好后不会发生。
    }

    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  if (loading) return <span style={{ fontSize: 13, opacity: 0.7 }}>Auth...</span>;

  // 你想排查问题时可以临时打开（不建议长期展示）
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