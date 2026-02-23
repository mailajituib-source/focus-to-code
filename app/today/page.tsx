"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Task = {
  id: string;
  title: string;
  estMinutes: number; // 默认 20
  difficulty: 1 | 2 | 3;
};

type Session = {
  id: string;
  taskId: string;
  taskTitle: string;
  plannedMinutes: number;
  startedAt: string; // ISO
  endedAt: string;   // ISO
  status: "done" | "partial" | "aborted";
  note?: string;
};

const DEFAULT_MINUTES = 20;

const TASKS: Task[] = [
  { id: "t1", title: "JS 入门：写一个计时器函数（复述思路）", estMinutes: DEFAULT_MINUTES, difficulty: 1 },
  { id: "t2", title: "TS 小练习：写一个 Task 类型并使用它", estMinutes: DEFAULT_MINUTES, difficulty: 1 },
  { id: "t3", title: "React：做一个按钮计数器并加上重置", estMinutes: DEFAULT_MINUTES, difficulty: 1 },
  { id: "t4", title: "Next.js：做一个列表页，把数组渲染成卡片", estMinutes: DEFAULT_MINUTES, difficulty: 2 },
];

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function safeId() {
  return `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const LS_KEY = "focus_to_code_sessions_v1";

export default function TodayPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(TASKS[0]?.id ?? "");
  const selectedTask = useMemo(
    () => TASKS.find((t) => t.id === selectedTaskId) ?? TASKS[0],
    [selectedTaskId]
  );

  const plannedSeconds = (selectedTask?.estMinutes ?? DEFAULT_MINUTES) * 60;

  const [secondsLeft, setSecondsLeft] = useState<number>(plannedSeconds);
  const [running, setRunning] = useState(false);

  // 用 ref 存时间戳，避免 state 更新延迟
  const startedAtRef = useRef<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [note, setNote] = useState("");

  // 初始化：读本地 sessions
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSessions(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  // 选择任务时，重置计时器（只有不在运行时才重置，避免误操作）
  useEffect(() => {
    if (!running) setSecondsLeft(plannedSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId]);

  // 计时器主循环
  useEffect(() => {
    if (!running) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [running]);

  // 到 0 自动停止
  useEffect(() => {
    if (secondsLeft === 0 && running) {
      setRunning(false);
    }
  }, [secondsLeft, running]);

  function persistSessions(next: Session[]) {
    setSessions(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function onStart() {
    if (secondsLeft <= 0) setSecondsLeft(plannedSeconds);
    setRunning(true);
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
  }

  function onPause() {
    setRunning(false);
  }

  function onReset() {
    setRunning(false);
    setSecondsLeft(plannedSeconds);
    startedAtRef.current = null;
  }

  function saveSession(status: Session["status"]) {
    if (!selectedTask) return;

    // 如果从未 start，也允许记录（当作 partial/aborted）
    const startedAt = startedAtRef.current ?? new Date().toISOString();
    const endedAt = new Date().toISOString();

    const sess: Session = {
      id: safeId(),
      taskId: selectedTask.id,
      taskTitle: selectedTask.title,
      plannedMinutes: Math.round(plannedSeconds / 60),
      startedAt,
      endedAt,
      status,
      note: note.trim() ? note.trim() : undefined,
    };

    const next = [sess, ...sessions].slice(0, 50); // 保留最近 50 条
    persistSessions(next);

    // 记录后重置
    setNote("");
    onReset();
  }

  const progress = plannedSeconds === 0 ? 0 : (plannedSeconds - secondsLeft) / plannedSeconds;
  const progressPct = Math.round(progress * 100);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Today（20min 专注）</h1>
        <a href="/" style={{ fontSize: 14 }}>← 返回首页</a>
      </div>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 14, opacity: 0.8 }}>
            选择最小任务：
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              disabled={running}
              style={{ marginLeft: 8, padding: "6px 8px" }}
            >
              {TASKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}（难度 {t.difficulty}）
                </option>
              ))}
            </select>
          </label>

          <div style={{ fontSize: 13, opacity: 0.75 }}>
            规则：走神时先去 <a href="/interrupt">Interrupt</a>，冷却后再回来继续。
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: 1 }}>
            {formatMMSS(secondsLeft)}
          </div>

          <div style={{ height: 10, background: "#eee", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "#111",
                transition: "width 200ms linear",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {!running ? (
              <button onClick={onStart} style={{ padding: "10px 14px" }}>
                开始
              </button>
            ) : (
              <button onClick={onPause} style={{ padding: "10px 14px" }}>
                暂停
              </button>
            )}
            <button onClick={onReset} style={{ padding: "10px 14px" }} disabled={running && secondsLeft === plannedSeconds}>
              重置
            </button>

            <span style={{ marginLeft: 8, fontSize: 13, opacity: 0.75, alignSelf: "center" }}>
              进度：{progressPct}%
            </span>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontSize: 14, opacity: 0.85 }}>
              备注（可选：写一句你刚刚在做什么/卡在哪里）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="例：卡在 useEffect 依赖数组，不确定何时会重复触发"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <button onClick={() => saveSession("done")} style={{ padding: "10px 14px" }}>
              完成 ✅（记录一次）
            </button>
            <button onClick={() => saveSession("partial")} style={{ padding: "10px 14px" }}>
              有进度 ✅（但没做完）
            </button>
            <button onClick={() => saveSession("aborted")} style={{ padding: "10px 14px" }}>
              中断 ✋（记录一下）
            </button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>最近记录（本地）</h2>
        {sessions.length === 0 ? (
          <p style={{ opacity: 0.7 }}>还没有记录。完成一次“完成✅ / 有进度✅”就会出现在这里。</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                <div style={{ fontWeight: 600 }}>{s.taskTitle}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  状态：{s.status} ｜ 计划：{s.plannedMinutes} min ｜ 结束：{new Date(s.endedAt).toLocaleString()}
                </div>
                {s.note ? <div style={{ marginTop: 6, fontSize: 13 }}>{s.note}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ marginTop: 16, fontSize: 13, opacity: 0.75 }}>
        下一步（Day3）：做 /interrupt 页面：30 秒冷却 + 3 分钟休息倒计时。
      </p>
    </main>
  );
}