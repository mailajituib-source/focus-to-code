// lib/supabaseClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ❗关键：不要 throw（构建期可能没有 env）
  // 这里用一个“占位 client”也不行，因为请求会乱飞。
  // 最好的方式：如果 env 缺失，返回一个会在调用时明确报错的 client 包装。
  if (!url || !anon) {
    const msg =
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY";
    // 用 Proxy：只有真的去调用 supabase.xxx 时才报错
    // 避免 build 期间仅仅 import 就挂
    return new Proxy(
      {},
      {
        get() {
          throw new Error(msg);
        },
      }
    ) as SupabaseClient;
  }

  _client = createClient(url, anon);
  return _client;
}