// lib/cloud.ts
import { supabase } from "@/lib/supabaseClient";

type LocalSession = {
  id: string;
  taskId: string;
  taskTitle: string;
  plannedMinutes: number;
  startedAt: string;
  endedAt: string;
  status: "done" | "partial" | "aborted";
  note?: string;
};

type LocalInterrupt = {
  id: string;
  at: string;
  trigger: string;
  cooldownDone: boolean;
  outcome: "return_to_today" | "short_break" | "quit";
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not logged in");
  return uid;
}

// ✅ 云端读取（给你 streak 的“云端数量”用）
export async function fetchCloudData() {
  const userId = await requireUserId();

  const [sRes, iRes] = await Promise.all([
    supabase.from("sessions").select("*").eq("user_id", userId),
    supabase.from("interrupts").select("*").eq("user_id", userId),
  ]);

  if (sRes.error) throw sRes.error;
  if (iRes.error) throw iRes.error;

  return {
    sessions: sRes.data ?? [],
    interrupts: iRes.data ?? [],
  };
}

// ✅ 本地推送到云端（给你按钮用）
// ✅ 本地推送到云端（用 local_id 去重）
export async function pushLocalToCloud(localSessions: LocalSession[], localInterrupts: LocalInterrupt[]) {
  const userId = await requireUserId();

  const sessionsRows = localSessions.map((s) => ({
    user_id: userId,
    local_id: s.id,               // ✅ 关键：本地 id 存到 local_id
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
    local_id: i.id,               // ✅ 关键：本地 id 存到 local_id
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
// ====== Pull helpers (追加到 lib/cloud.ts 底部) ======
const SESSIONS_KEY = "focus_to_code_sessions_v1";
const INTERRUPTS_KEY = "focus_to_code_interrupts_v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// 云端 → 本地（合并）：去重合并，云端优先覆盖同 id
export async function pullCloudToLocalMerge() {
  const cloud = await fetchCloudData();

  const localSessions = safeParse<LocalSession[]>(localStorage.getItem(SESSIONS_KEY), []);
  const localInterrupts = safeParse<LocalInterrupt[]>(localStorage.getItem(INTERRUPTS_KEY), []);

  const mergeById = <T extends { id: string }>(localArr: T[], cloudArr: T[]) => {
    const m = new Map<string, T>();
    for (const x of localArr) m.set(x.id, x);
    for (const x of cloudArr) m.set(x.id, x); // 云端覆盖
    return Array.from(m.values());
  };

  // ✅ 先读云端数据（你已经有 fetchCloudData 这个函数了）
const { sessions: cloudSessions, interrupts: cloudInterrupts } = await fetchCloudData();

// 然后下面就不要再用 sRes / iRes 了
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

  const mergedSessions = mergeById(localSessions, cloudSessions);
  const mergedInterrupts = mergeById(localInterrupts, cloudInterrupts);

  localStorage.setItem(SESSIONS_KEY, JSON.stringify(mergedSessions));
  localStorage.setItem(INTERRUPTS_KEY, JSON.stringify(mergedInterrupts));
  
  return { sessions: cloudSessions.length, interrupts: cloudInterrupts.length };
}

// 云端 → 本地（覆盖）：本地直接替换成云端
export async function pullCloudToLocalOverwrite() {
  const cloud = await fetchCloudData();

  const cloudSessions: LocalSession[] = (cloud.sessions ?? []).map((s: any) => ({
    id: s.id,
    taskId: s.task_id ?? "",
    taskTitle: s.task_title ?? "",
    plannedMinutes: s.planned_minutes ?? 20,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    status: s.status,
    note: s.note ?? undefined,
  }));

  const cloudInterrupts: LocalInterrupt[] = (cloud.interrupts ?? []).map((i: any) => ({
    id: i.id,
    at: i.at,
    trigger: i.trigger ?? "",
    cooldownDone: !!i.cooldown_done,
    outcome: i.outcome,
  }));

  localStorage.setItem(SESSIONS_KEY, JSON.stringify(cloudSessions));
  localStorage.setItem(INTERRUPTS_KEY, JSON.stringify(cloudInterrupts));

  return { sessions: cloudSessions.length, interrupts: cloudInterrupts.length };
}