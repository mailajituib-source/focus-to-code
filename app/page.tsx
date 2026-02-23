export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Focus→Code</h1>
      <p style={{ opacity: 0.75, marginBottom: 20 }}>
        走神就拦截，拦截后回到最小编程任务。
      </p>

      <div style={{ display: "flex", gap: 12 }}>
<a href="/today">进入 Today</a>
<a href="/interrupt">进入 Interrupt</a>
<a href="/streak">进入 Streak</a>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <p style={{ fontSize: 14, opacity: 0.7 }}>
        Day2 目标：Today 页 + 20min 计时器 + 记录一次完成。
      </p>
    </main>
  );
}