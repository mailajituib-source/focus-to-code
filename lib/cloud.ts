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
export async function pushLocalToCloud(localSessions: LocalSession[], localInterrupts: LocalInterrupt[]) {
  const userId = await requireUserId();

  // sessions：尽量用本地 id 作为主键 upsert（你表里 id 是 uuid 主键）
  const sessionsRows = localSessions.map((s) => ({
    ...(isUuid(s.id) ? { id: s.id } : {}), // 如果不是 uuid，就别塞 id
    user_id: userId,
    task_id: s.taskId ?? null,
    task_title: s.taskTitle ?? "",
    planned_minutes: s.plannedMinutes ?? 20,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    status: s.status,
    note: s.note ?? null,
  }));

  const interruptsRows = localInterrupts.map((i) => ({
    ...(isUuid(i.id) ? { id: i.id } : {}),
    user_id: userId,
    at: i.at,
    trigger: i.trigger ?? null,
    cooldown_done: !!i.cooldownDone,
    outcome: i.outcome,
  }));

  // 用 upsert 避免重复推送（依赖 id 主键/唯一）
  const sUp = await supabase.from("sessions").upsert(sessionsRows, { onConflict: "id" });
  if (sUp.error) throw sUp.error;

  const iUp = await supabase.from("interrupts").upsert(interruptsRows, { onConflict: "id" });
  if (iUp.error) throw iUp.error;

  return { sessions: sessionsRows.length, interrupts: interruptsRows.length };
}