"use client";

import { useEffect, useState } from "react";

type Mode = "idle" | "cooldown" | "choose" | "break";

const COOLDOWN_SECONDS = 30;
const BREAK_SECONDS = 3 * 60; // 想要 5 分钟：改成 5 * 60

const LS_KEY = "focus_to_code_interrupts_v1";

type InterruptLog = {
  id: string;
  at: string;
  trigger: string;
  cooldownDone: boolean;
  outcome: "return_to_today" | "short_break" | "quit";
};

function safeId() {
  return `i_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function pad2(n: number) {
  return n.toString().padStart(2, "0");
}
function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

export default function InterruptPage() {
  const [mode, setMode] = useState<Mode>("idle");
  const [trigger, setTrigger] = useState("走神/想逃避");
  const [cooldownLeft, setCooldownLeft] = useState(COOLDOWN_SECONDS);
  const [breakLeft, setBreakLeft] = useState(BREAK_SECONDS);
  const [logs, setLogs] = useState<InterruptLog[]>([]);

  // 读取历史记录
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setLogs(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  function persist(next: InterruptLog[]) {
    setLogs(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function addLog(outcome: InterruptLog["outcome"], cooldownDone: boolean) {
    const log: InterruptLog = {
      id: safeId(),
      at: new Date().toISOString(),
      trigger: trigger.trim() ? trigger.trim() : "走神/想逃避",
      cooldownDone,
      outcome,
    };
    persist([log, ...logs].slice(0, 50));
  }

  // 冷却倒计时
  useEffect(() => {
    if (mode !== "cooldown") return;
    const t = setInterval(() => {
      setCooldownLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    if (mode === "cooldown" && cooldownLeft === 0) {
      setMode("choose");
    }
  }, [mode, cooldownLeft]);

  // 休息倒计时
  useEffect(() => {
    if (mode !== "break") return;
    const t = setInterval(() => {
      setBreakLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    if (mode === "break" && breakLeft === 0) {
      // 休息结束 → 自动回到选择页（鼓励回到 Today）
      setMode("choose");
    }
  }, [mode, breakLeft]);

  function startCooldown() {
    setCooldownLeft(COOLDOWN_SECONDS);
    setMode("cooldown");
  }

  function startBreak() {
    // 记录一次“选择短休息”
    addLog("short_break", true);
    setBreakLeft(BREAK_SECONDS);
    setMode("break");
  }

  function goToday() {
    addLog("return_to_today", mode !== "idle"); // 只要不是 idle，算完成了一次流程
    window.location.href = "/today";
  }

  function quitToday() {
    addLog("quit", mode !== "idle");
    alert("允许休息也没关系。下次走神，先来这里做一次拦截。");
    // 回到初始态
    setMode("idle");
    setCooldownLeft(COOLDOWN_SECONDS);
    setBreakLeft(BREAK_SECONDS);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Interrupt（走神拦截）</h1>
        <a href="/" style={{ fontSize: 14 }}>← 返回首页</a>
      </div>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <p style={{ opacity: 0.75, marginTop: 0 }}>
          走神不是失败。你只需要完成一次“拦截”，再回到 Today 做最小任务。
        </p>

        <label style={{ display: "block", fontSize: 14, opacity: 0.85 }}>
          走神原因（可选）：
        </label>
        <input
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="例：卡在报错 / 不知道从哪下手 / 想刷一下"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", maxWidth: 560 }}
          disabled={mode !== "idle"}
        />

        {mode === "idle" ? (
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={startCooldown} style={{ padding: "10px 14px" }}>
              开始 30 秒冷却
            </button>
            <a href="/today" style={{ padding: "10px 14px", display: "inline-block" }}>
              直接回到 Today
            </a>
          </div>
        ) : null}

        {mode === "cooldown" ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 56, fontWeight: 700 }}>{formatMMSS(cooldownLeft)}</div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>
              现在只做一件事：深呼吸 3 次 / 起身喝水 / 看远处 10 秒。
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => setMode("choose")} style={{ padding: "10px 14px" }}>
                我已冷却（跳过）
              </button>
              <button
                onClick={() => {
                  setMode("idle");
                  setCooldownLeft(COOLDOWN_SECONDS);
                }}
                style={{ padding: "10px 14px" }}
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        {mode === "break" ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 56, fontWeight: 700 }}>{formatMMSS(breakLeft)}</div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>
              休息规则：不刷信息流。可以走动、喝水、伸展。
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={goToday} style={{ padding: "10px 14px" }}>
                休息结束 → 回到 Today
              </button>
            </div>
          </div>
        ) : null}

        {mode === "choose" ? (
          <div style={{ marginTop: 14, padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
            <div style={{ fontWeight: 700 }}>下一步怎么选？</div>
            <div style={{ fontSize: 14, opacity: 0.75, marginTop: 6 }}>
              推荐：回到 Today，开始 20min 或记录一次“有进度”。
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={goToday} style={{ padding: "10px 14px" }}>
                回到 Today（推荐）
              </button>
              <button onClick={startBreak} style={{ padding: "10px 14px" }}>
                先休息 3 分钟
              </button>
              <button onClick={quitToday} style={{ padding: "10px 14px" }}>
                我今天先算了（也记录）
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>最近拦截记录（本地）</h2>
        {logs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>还没有记录。完成一次拦截/选择后会出现在这里。</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {logs.map((l) => (
              <div key={l.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                <div style={{ fontWeight: 600 }}>
                  {new Date(l.at).toLocaleString()} ｜ {l.cooldownDone ? "冷却✅" : "未冷却"}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>原因：{l.trigger}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>结果：{l.outcome}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}