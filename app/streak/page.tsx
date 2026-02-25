"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchCloudData, pushLocalToCloud } from "@/lib/cloud"; 


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
const [pushing, setPushing] = useState(false);
const [pushMsg, setPushMsg] = useState<string | null>(null);

useEffect(() => {
  (async () => {
    try {
      const { sessions, interrupts } = await fetchCloudData();
      setCloudInfo({ sessions: sessions.length, interrupts: interrupts.length });
      setCloudErr(null);
    } catch (e: any) {
      setCloudErr(e?.message ?? String(e));
    }
  })();
}, []);

async function onPushToCloud() {
  setPushing(true);
  setPushMsg(null);
  try {
    const res = await pushLocalToCloud(sessions, interrupts);
    setPushMsg(`✅ 已推送：sessions ${res.sessions} 条；interrupts ${res.interrupts} 条`);

    // 推完再拉一次云端数量刷新显示
    const fresh = await fetchCloudData();
    setCloudInfo({ sessions: fresh.sessions.length, interrupts: fresh.interrupts.length });
  } catch (e: any) {
    setPushMsg(`❌ 推送失败：${e?.message ?? String(e)}`);
  } finally {
    setPushing(false);
  }
}
const [cloudInfo, setCloudInfo] = useState<{ sessions: number; interrupts: number } | null>(null);
const [cloudErr, setCloudErr] = useState<string | null>(null);

  const now = new Date();
  const { weekStart, weekEnd } = getWeekRange(now);

  const metrics = useMemo(() => {
    const todaySessions = sessions.filter((s) => isSameDay(new Date(s.endedAt), now));
   const todayAttemptCount = todaySessions.length;
const todayFocusCount = todaySessions.filter((s) => s.status === "done" || s.status === "partial").length;

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

    const todayInterrupts = interrupts.filter((i) => isSameDay(new Date(i.at), now));
    const todayInterruptCount = todayInterrupts.length;

    const weekInterrupts = interrupts.filter((i) => {
      const t = new Date(i.at);
      return withinRange(t, weekStart, weekEnd);
    });
    const weekInterruptCount = weekInterrupts.length;

   return {
  todayAttemptCount,
  todayFocusCount,
  weekFocusMinutes,
  todayInterruptCount,
  weekInterruptCount,
  todaySessions,
  todayInterrupts,
};
  }, [sessions, interrupts]); // eslint-disable-line react-hooks/exhaustive-deps

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

  {/* ✅按钮放在三元表达式结束之后，这里最安全 */}
  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
    <button
      onClick={onPushToCloud}
      disabled={pushing}
      style={{ padding: "10px 14px" }}
    >
      {pushing ? "推送中..." : "推送本地到云端"}
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
}