"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = new URL(window.location.href).searchParams.get("code");
if (code) {
  await supabase.auth.exchangeCodeForSession(code);
}

        // 无论有没有 code，都检查一次 session
        const { data: sessData } = await supabase.auth.getSession();
        if (sessData.session) {
          router.replace("/streak");
          return;
        }

        // 情况 B：有些 magic link 会异步写入 session，监听一下
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
            router.replace("/streak");
          }
        });

        unsub = () => listener.subscription.unsubscribe();

        // 给它一点时间；如果还是没有 session，就回 login
        setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            router.replace("/login");
          }
        }, 1500);
      } catch (e) {
        console.error("auth callback error:", e);
        router.replace("/login");
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [router]);

  return <div style={{ padding: 24 }}>登录处理中，请稍候…</div>;
}   