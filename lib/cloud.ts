// lib/cloud.ts
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const supabase = getSupabaseBrowserClient();
// ... 后面是 requireUserId / fetchCloudData / pushLocalToCloud ...
export type LocalSession = {
  id: string; // 本地 id（string）
  taskId: string;
  taskTitle: string;
  plannedMinutes: number;
  startedAt: string;
  endedAt: string;
  status: "done" | "partial" | "aborted";
  note?: string;
};

export type LocalInterrupt = {
  id: string; // 本地 id（string）
  at: string;
  trigger: string;
  cooldownDone: boolean;
  outcome: "return_to_today" | "short_break" | "quit";
};

const SESSIONS_KEY = "focus_to_code_sessions_v1";
const INTERRUPTS_KEY = "focus_to_code_interrupts_v1";

async function requireUserId() {

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Auth session missing!");
  return uid;
}

/**
 * ✅ 云端读取（给 streak “云端数量/云端拉取”用）
 */
export async function fetchCloudData() {
  const userId = await requireUserId();

  const [sRes, iRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .order("ended_at", { ascending: false }),
    supabase
      .from("interrupts")
      .select("*")
      .eq("user_id", userId)
      .order("at", { ascending: false }),
  ]);

  if (sRes.error) throw sRes.error;
  if (iRes.error) throw iRes.error;

  return {
    sessions: sRes.data ?? [],
    interrupts: iRes.data ?? [],
  };
}

/**
 * ✅ 本地推送到云端（用 local_id 去重）
 * 依赖你的 Supabase 表具备：
 * - sessions.local_id (text) + sessions.user_id (uuid) 组合唯一
 * - interrupts.local_id (text) + interrupts.user_id (uuid) 组合唯一
 */
export async function pushLocalToCloud(
  localSessions: LocalSession[],
  localInterrupts: LocalInterrupt[]
) {
  const userId = await requireUserId();

  const sessionsRows = localSessions.map((s) => ({
    user_id: userId,
    local_id: s.id, // ✅ 本地 id 存到 local_id
    task_id: s.taskId ?? null,
    task_title: s.taskTitle ?? "",
    planned_minutes: s.plannedMinutes ?? 20,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    status: s.status,
    note: s.note ?? null,
  }));

  const interruptsRows = localInterrupts.map((i) => ({
    user_id: userId,
    local_id: i.id, // ✅ 本地 id 存到 local_id
    at: i.at,
    trigger: i.trigger ?? null,
    cooldown_done: !!i.cooldownDone,
    outcome: i.outcome,
  }));

  // ✅ 用 (user_id, local_id) 做 upsert 冲突键
  const sUp = await supabase
    .from("sessions")
    .upsert(sessionsRows, { onConflict: "user_id,local_id" });
  if (sUp.error) throw sUp.error;

  const iUp = await supabase
    .from("interrupts")
    .upsert(interruptsRows, { onConflict: "user_id,local_id" });
  if (iUp.error) throw iUp.error;

  return { sessions: sessionsRows.length, interrupts: interruptsRows.length };
}

/**
 * ✅ 云端 → 本地：合并（不丢本地）
 * 策略：按 id（本地）去重；云端记录用 local_id 作为本地 id
 */
export async function pullCloudToLocalMerge() {
  const { sessions: cloudSessions, interrupts: cloudInterrupts } =
    await fetchCloudData();

  const localSessions: LocalSession[] = safeReadJson(SESSIONS_KEY, []);
  const localInterrupts: LocalInterrupt[] = safeReadJson(INTERRUPTS_KEY, []);

  const normalizedSessions: LocalSession[] = (cloudSessions ?? []).map((r: any) => ({
    id: r.local_id ?? String(r.id), // ✅ 关键：优先 local_id
    taskId: r.task_id ?? "",
    taskTitle: r.task_title ?? "",
    plannedMinutes: r.planned_minutes ?? 20,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    status: r.status,
    note: r.note ?? undefined,
  }));

  const normalizedInterrupts: LocalInterrupt[] = (cloudInterrupts ?? []).map((r: any) => ({
    id: r.local_id ?? String(r.id), // ✅ 关键：优先 local_id
    at: r.at,
    trigger: r.trigger ?? "",
    cooldownDone: !!r.cooldown_done,
    outcome: r.outcome,
  }));

  const mergedSessions = mergeById(localSessions, normalizedSessions);
  const mergedInterrupts = mergeById(localInterrupts, normalizedInterrupts);

  safeWriteJson(SESSIONS_KEY, mergedSessions);
  safeWriteJson(INTERRUPTS_KEY, mergedInterrupts);

  return { sessions: normalizedSessions.length, interrupts: normalizedInterrupts.length };
}

/**
 * ✅ 云端 → 本地：覆盖（本地全部替换为云端）
 */
export async function pullCloudToLocalOverwrite() {
  const { sessions: cloudSessions, interrupts: cloudInterrupts } =
    await fetchCloudData();

  const normalizedSessions: LocalSession[] = (cloudSessions ?? []).map((r: any) => ({
    id: r.local_id ?? String(r.id),
    taskId: r.task_id ?? "",
    taskTitle: r.task_title ?? "",
    plannedMinutes: r.planned_minutes ?? 20,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    status: r.status,
    note: r.note ?? undefined,
  }));

  const normalizedInterrupts: LocalInterrupt[] = (cloudInterrupts ?? []).map((r: any) => ({
    id: r.local_id ?? String(r.id),
    at: r.at,
    trigger: r.trigger ?? "",
    cooldownDone: !!r.cooldown_done,
    outcome: r.outcome,
  }));

  safeWriteJson(SESSIONS_KEY, normalizedSessions);
  safeWriteJson(INTERRUPTS_KEY, normalizedInterrupts);

  return { sessions: normalizedSessions.length, interrupts: normalizedInterrupts.length };
}

/** ---------------- helpers ---------------- */

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

function mergeById<T extends { id: string }>(localArr: T[], cloudArr: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of localArr) m.set(x.id, x);
  for (const x of cloudArr) m.set(x.id, x); // 云端覆盖同 id 的本地
  return Array.from(m.values());
}