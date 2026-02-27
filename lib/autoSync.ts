import { pushLocalToCloud } from "@/lib/cloud";

const SESSIONS_KEY = "focus_to_code_sessions_v1";
const INTERRUPTS_KEY = "focus_to_code_interrupts_v1";
const SYNC_STATUS_KEY = "focus_to_code_sync_status_v1";

type SyncStatus =
  | { state: "idle"; at: string }
  | { state: "syncing"; at: string }
  | { state: "synced"; at: string }
  | { state: "failed"; at: string; reason?: string };

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setStatus(s: SyncStatus) {
  try {
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(s));
    // 触发同 tab 内的监听（storage 事件只对其他 tab 有效）
    window.dispatchEvent(new Event("focus_to_code_sync_status"));
  } catch {
    // ignore
  }
}

let timer: number | null = null;
let lastSig = "";

function makeSig(sessions: any[], interrupts: any[]) {
  const s0 = sessions?.[0]?.id ?? "";
  const i0 = interrupts?.[0]?.id ?? "";
  return `${sessions.length}-${interrupts.length}-${s0}-${i0}`;
}

/**
 * 自动同步（节流 + 去重 + 状态提示）
 */
export function tryAutoSync() {
  try {
    const sessions = safeParse<any[]>(localStorage.getItem(SESSIONS_KEY), []);
    const interrupts = safeParse<any[]>(localStorage.getItem(INTERRUPTS_KEY), []);

    if (sessions.length === 0 && interrupts.length === 0) {
      setStatus({ state: "idle", at: new Date().toISOString() });
      return;
    }

    const sig = makeSig(sessions, interrupts);
    if (sig === lastSig) return;
    lastSig = sig;

    setStatus({ state: "syncing", at: new Date().toISOString() });

    if (timer) window.clearTimeout(timer);

    timer = window.setTimeout(async () => {
      try {
        await pushLocalToCloud(sessions, interrupts);
        setStatus({ state: "synced", at: new Date().toISOString() });
      } catch (e: any) {
        setStatus({ state: "failed", at: new Date().toISOString(), reason: e?.message ?? String(e) });
      } finally {
        timer = null;
      }
    }, 2500);
  } catch (e: any) {
    setStatus({ state: "failed", at: new Date().toISOString(), reason: e?.message ?? String(e) });
  }
}