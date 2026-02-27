"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchCloudData, pushLocalToCloud, pullCloudToLocalMerge, pullCloudToLocalOverwrite } from "@/lib/cloud";


type Session = {
  id: string;
  taskId: string;
  taskTitle: string;
  plannedMinutes: number;
  startedAt: string;
  endedAt: string;
  status: "done" | "partial" | "aborted";
  note?: string;
};

type InterruptLog = {
  id: string;
  at: string;
  trigger: string;
  cooldownDone: boolean;
  outcome: "return_to_today" | "short_break" | "quit";
};

const SESSIONS_KEY = "focus_to_code_sessions_v1";
const INTERRUPTS_KEY = "focus_to_code_interrupts_v1";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekRange(now: Date) {
  // 以周一为一周开始
  const d = startOfDay(now);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diffToMonday = (day + 6) % 7; // Mon=0, Tue=1 ... Sun=6
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7); // 结束为下周一（不含）

  return { weekStart, weekEnd };
}

function withinRange(t: Date, start: Date, endExclusive: Date) {
  return t.getTime() >= start.getTime() && t.getTime() < endExclusive.getTime();
}
  function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export default function StreakPage() {
const [importText, setImportText] = useState("");
const [sessions, setSessions] = useState<Session[]>([]);
const [interrupts, setInterrupts] = useState<InterruptLog[]>([]); 
const pushTimerRef = useRef<number | null>(null);
const lastSigRef = useRef<string>("");
const hasHydratedRef = useRef(false);

// ✅ 云同步 UI 需要的 state（只保留这一份）
const [cloudInfo, setCloudInfo] = useState<{ sessions: number; interrupts: number } | null>(null);
const [cloudErr, setCloudErr] = useState<string | null>(null);

const [pushing, setPushing] = useState(false);
const [pushMsg, setPushMsg] = useState<string | null>(null);

// ✅ 进页面先读一次云端数量（只保留这一份）

useEffect(() => {
  // 读本地 sessions/interrupts
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    setSessions(raw ? JSON.parse(raw) : []);
  } catch { setSessions([]); }

  try {
    const raw = localStorage.getItem(INTERRUPTS_KEY);
    setInterrupts(raw ? JSON.parse(raw) : []);
  } catch { setInterrupts([]); }

  hasHydratedRef.current = true; // ✅ 本地数据已加载完成
}, []);

useEffect(() => {
  (async () => {
    try {
      const fresh = await fetchCloudData();
      setCloudInfo({ sessions: fresh.sessions.length, interrupts: fresh.interrupts.length });
      setCloudErr(null);
    } catch (e: any) {
      setCloudErr(e?.message ?? String(e));
    }
  })();
}, []);

// ✅ 推送本地→云端（只保留这一份）
async function onPushToCloud() {
  setPushing(true);
  setPushMsg(null);
  try {
    const res = await pushLocalToCloud(sessions, interrupts);
    setPushMsg(`✅ 已推送：sessions ${res.sessions} 条；interrupts ${res.interrupts} 条`);

    const fresh = await fetchCloudData();
    setCloudInfo({ sessions: fresh.sessions.length, interrupts: fresh.interrupts.length });
    setCloudErr(null);
  } catch (e: any) {
    setPushMsg(`❌ 推送失败：${e?.message ?? String(e)}`);
  } finally {
    setPushing(false);
  }
}
// ✅ 自动推送：本地 sessions/interrupts 变化后，3 秒节流推送到云端
useEffect(() => {
  // 1) 本地数据还没加载完，不推
  if (!hasHydratedRef.current) return;

  // 2) 还没登录 / 云端读失败时，不推（避免一直报错）
  if (cloudErr) return;

  // 3) 生成一个签名，避免无意义重复推
  const sig = `${sessions.length}-${interrupts.length}-${sessions[0]?.id ?? ""}-${interrupts[0]?.id ?? ""}`;
  if (sig === lastSigRef.current) return;
  lastSigRef.current = sig;

  // 4) 节流：3 秒内多次变化只推一次
  if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);

  pushTimerRef.current = window.setTimeout(async () => {
    try {
      // 只在有数据时推（也可以允许 0 推送）
      if (sessions.length === 0 && interrupts.length === 0) return;

      const res = await pushLocalToCloud(sessions, interrupts);
      setPushMsg(`✅ 自动推送：sessions ${res.sessions}，interrupts ${res.interrupts}`);

      const fresh = await fetchCloudData();
      setCloudInfo({ sessions: fresh.sessions.length, interrupts: fresh.interrupts.length });
      setCloudErr(null);
    } catch (e: any) {
      // 自动推送失败不弹 confirm，不 reload，只显示消息
      setPushMsg(`⚠️ 自动推送失败：${e?.message ?? String(e)}`);
    }
  }, 3000);

  return () => {
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
  };
}, [sessions, interrupts, cloudErr]);

// ✅ 拉取云端→本地（合并）
async function refreshLocalState() {
  try {
    const rawS = localStorage.getItem(SESSIONS_KEY);
    const rawI = localStorage.getItem(INTERRUPTS_KEY);
    setSessions(rawS ? JSON.parse(rawS) : []);
    setInterrupts(rawI ? JSON.parse(rawI) : []);
  } catch {
    // ignore
  }
}

async function onPullMerge() {
  setPushing(true);
  setPushMsg(null);
  try {
    const res = await pullCloudToLocalMerge();
    await refreshLocalState();
    const fresh = await fetchCloudData();
    setCloudInfo({ sessions: fresh.sessions.length, interrupts: fresh.interrupts.length });
    setCloudErr(null);
    setPushMsg(`✅ 已拉取合并：sessions ${res.sessions} 条；interrupts ${res.interrupts} 条`);
  } catch (e: any) {
    setPushMsg(`❌ 拉取失败：${e?.message ?? String(e)}`);
  } finally {
    setPushing(false);
  }
}

async function onPullOverwrite() {
  if (!confirm("确定用云端覆盖本地？本地记录会被替换。")) return;
  setPushing(true);
  setPushMsg(null);
  try {
    const res = await pullCloudToLocalOverwrite();
    await refreshLocalState();
    const fresh = await fetchCloudData();
    setCloudInfo({ sessions: fresh.sessions.length, interrupts: fresh.interrupts.length });
    setCloudErr(null);
    setPushMsg(`✅ 已云端覆盖：sessions ${res.sessions} 条；interrupts ${res.interrupts} 条`);
  } catch (e: any) {
    setPushMsg(`❌ 覆盖失败：${e?.message ?? String(e)}`);
  } finally {
    setPushing(false);
  }
}

// ✅ 下面继续你的 metrics/useMemo
const now = new Date();
const { weekStart, weekEnd } = getWeekRange(now);

const metrics = useMemo(() => {
  const last7Start = startOfDay(new Date(now));
last7Start.setDate(last7Start.getDate() - 6); // 含今天共7天

const recentSessions = sessions.filter((s) => {
  const t = new Date(s.endedAt);
  return t.getTime() >= last7Start.getTime() && t.getTime() <= now.getTime();
});
  const todayAttemptCount = recentSessions.length;
  const todayFocusCount = recentSessions.filter(
    (s) => s.status === "done" || s.status === "partial"
  ).length;

  const weekSessions = sessions.filter((s) => {
    const t = new Date(s.endedAt);
    return withinRange(t, weekStart, weekEnd);
  });

  const weekFocusMinutes = weekSessions
    .filter((s) => s.status === "done" || s.status === "partial")
    .reduce((sum, s) => {
      const start = new Date(s.startedAt).getTime();
      const end = new Date(s.endedAt).getTime();
      const mins = Math.max(0, Math.round((end - start) / 60000));
      return sum + mins;
    }, 0);

  const todayInterrupts = interrupts.filter((it) => isSameDay(new Date(it.at), now));
  const todayInterruptCount = todayInterrupts.length;

  const weekInterrupts = interrupts.filter((it) => {
    const t = new Date(it.at);
    return withinRange(t, weekStart, weekEnd);
  });
  const weekInterruptCount = weekInterrupts.length;

  // ✅ 关键：一定要 return 一个对象
  return {
    todayAttemptCount,
    todayFocusCount,
    weekFocusMinutes,
    todayInterruptCount,
    weekInterruptCount,
    recentSessions,
    todayInterrupts,
  };
}, [sessions, interrupts, now, weekStart, weekEnd]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Streak（汇总仪表盘）</h1>
        <a href="/" style={{ fontSize: 14 }}>← 返回首页</a>
      </div>
 <section style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
       <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
  <div style={{ fontSize: 13, opacity: 0.75 }}>今日完成次数</div>
  <div style={{ fontSize: 40, fontWeight: 800 }}>{metrics.todayFocusCount}</div>
  <div style={{ fontSize: 13, opacity: 0.75 }}>
    今日尝试：{metrics.todayAttemptCount}（含 aborted）
  </div>
</div>

        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>本周专注分钟</div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>{metrics.weekFocusMinutes}</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>按 startedAt/endedAt 计算</div>
        </div>

        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>今日拦截次数</div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>{metrics.todayInterruptCount}</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>走神→拦截就是胜利</div>
        </div>

        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>本周拦截次数</div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>{metrics.weekInterruptCount}</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>越多说明你越会“拉回来”</div>
        </div>
      </section>

     <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
  <div style={{ fontWeight: 700 }}>云同步状态（Supabase）</div>

  {cloudErr ? (
    <div style={{ color: "crimson", marginTop: 8 }}>读取失败：{cloudErr}</div>
  ) : cloudInfo ? (
    <div style={{ marginTop: 8, opacity: 0.85 }}>
      云端 sessions：{cloudInfo.sessions} 条；interrupts：{cloudInfo.interrupts} 条
    </div>
  ) : (
    <div style={{ marginTop: 8, opacity: 0.7 }}>读取中...</div>
  )}

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
    <button onClick={onPushToCloud} disabled={pushing} style={{ padding: "10px 14px" }}>
      {pushing ? "处理中..." : "推送本地到云端"}
    </button>

    <button onClick={onPullMerge} disabled={pushing} style={{ padding: "10px 14px" }}>
      从云端拉取（合并）
    </button>

    <button onClick={onPullOverwrite} disabled={pushing} style={{ padding: "10px 14px" }}>
      云端覆盖本地
    </button>

    {pushMsg ? <span style={{ fontSize: 13, opacity: 0.85 }}>{pushMsg}</span> : null}
  </div>
</section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>今天的拦截记录</h2>
        {metrics.todayInterrupts.length === 0 ? (
          <p style={{ opacity: 0.7 }}>
            今天还没有拦截记录。走神时去 <a href="/interrupt">Interrupt</a> 完成一次冷却。
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {metrics.todayInterrupts.map((i) => (
              <div key={i.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                <div style={{ fontWeight: 700 }}>{new Date(i.at).toLocaleString()}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>原因：{i.trigger}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>结果：{i.outcome}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
  <h2 style={{ fontSize: 18, marginTop: 0 }}>数据备份</h2>

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
    <button
      onClick={() => {
        const payload = {
          exportedAt: new Date().toISOString(),
          sessions: localStorage.getItem(SESSIONS_KEY),
          interrupts: localStorage.getItem(INTERRUPTS_KEY),
        };
        downloadText("focus-to-code-backup.json", JSON.stringify(payload, null, 2));
      }}
      style={{ padding: "10px 14px" }}
    >
      导出备份 JSON
    </button>

    <button
      onClick={() => {
        if (!confirm("确定要导入？这会覆盖当前本地数据。")) return;
        try {
          const payload = JSON.parse(importText);
          if (typeof payload?.sessions === "string") localStorage.setItem(SESSIONS_KEY, payload.sessions);
          if (typeof payload?.interrupts === "string") localStorage.setItem(INTERRUPTS_KEY, payload.interrupts);
          alert("导入成功！刷新页面即可看到数据。");
          window.location.reload();
        } catch (e) {
          alert("导入失败：请确认粘贴的是正确 JSON。");
        }
      }}
      style={{ padding: "10px 14px" }}
    >
      导入（覆盖本地）
    </button>
    <button
  onClick={async () => {
    const res = await pullCloudToLocalMerge();
    alert(`已合并拉取：sessions ${res.sessions} / interrupts ${res.interrupts}`);
    window.location.reload();
  }}
>
  从云端拉取（合并）
</button>

<button
  onClick={async () => {
    if (!confirm("确定用云端覆盖本地？")) return;
    const res = await pullCloudToLocalOverwrite();
    alert(`已覆盖拉取：sessions ${res.sessions} / interrupts ${res.interrupts}`);
    window.location.reload();
  }}
>
  云端覆盖本地
</button>
  </div>

  <div style={{ marginTop: 12 }}>
    <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
      把备份 JSON 粘贴到下面（导入时会覆盖当前数据）
    </div>
    <textarea
      value={importText}
      onChange={(e) => setImportText(e.target.value)}
      rows={6}
      placeholder='粘贴 focus-to-code-backup.json 的内容…'
      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
    />
  </div>
</section>

      <p style={{ marginTop: 16, fontSize: 13, opacity: 0.75 }}>
        下一步（Day5）：把首页链接里的 “进入 Streak” 指到 /streak（我们已经是这个路径），再做一次 Vercel 部署上线。
      </p>
    </main>
  );
  console.log("bad session ids:", sessions.filter(s => !s.id));
}