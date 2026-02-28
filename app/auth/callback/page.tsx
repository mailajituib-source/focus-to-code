"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          // 登录成功 → 回首页
          router.replace("/");
        } else {
          // 没有 session → 回登录页
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  return <p style={{ padding: 24 }}>登录中，请稍候…</p>;
}