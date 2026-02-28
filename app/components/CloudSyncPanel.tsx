"use client";

import { useEffect, useState } from "react";
import {
  fetchCloudData,
  pushLocalToCloud,
  pullCloudToLocalMerge,
  pullCloudToLocalOverwrite,
} from "@/lib/cloud";

type SyncStatus =
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "synced"; at?: string }
  | { state: "failed"; reason?: string; at?: string };

const SYNC_STATUS_KEY = "focus_to_code_sync_status_v1";

export default function CloudSyncPanel(props: {
  sessions: any[];
  interrupts: any[];
  onLocalRefresh: () => void;
}) {
  const { sessions, interrupts, onLocalRefresh } = props;

  const [cloudInfo, setCloudInfo] = useState<{ sessions: number; interrupts: number } | null>(
    null
  );
  const [cloudErr, setCloudErr] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  async function refreshCloudCount() {
    try {
      const fresh = await fetchCloudData();
      setCloudInfo({ sessions: fresh.sessions.length, interrupts: fresh.interrupts.length });
      setCloudErr(null);
    } catch (e: any) {
      setCloudErr(e?.message ?? String(e));
    }
  }

  // 云端数量：进来读一次
  useEffect(() => {
    refreshCloudCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步状态监听
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(SYNC_STATUS_KEY);
        setSyncStatus(raw ? (JSON.parse(raw) as SyncStatus) : null);
      } catch {
        setSyncStatus(null);
      }
    };

    read();

    const onCustom = () => read();
    window.addEventListener("focus_to_code_sync_status", onCustom);

    const onStorage = (e: StorageEvent) => {
      if (e.key === SYNC_STATUS_KEY) read();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus_to_code_sync_status", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function onPush() {
    setPushing(true);
    setMsg(null);
    try {
      const res = await pushLocalToCloud(sessions, interrupts);
      setMsg(`✅ 已推送：sessions ${res.sessions} 条；interrupts ${res.interrupts} 条`);
      await refreshCloudCount();
    } catch (e: any) {
      setMsg(`❌ 推送失败：${e?.message ?? String(e)}`);
    } finally {
      setPushing(false);
    }
  }

  async function onPullMerge() {
    setPushing(true);
    setMsg(null);
    try {
      const res = await pullCloudToLocalMerge();
      setMsg(`✅ 已拉取合并：sessions ${res.sessions} 条；interrupts ${res.interrupts} 条`);
      onLocalRefresh();
      await refreshCloudCount();
    } catch (e: any) {
      setMsg(`❌ 拉取失败：${e?.message ?? String(e)}`);
    } finally {
      setPushing(false);
    }
  }

  async function onPullOverwrite() {
    if (!confirm("确定用云端覆盖本地？本地记录会被替换。")) return;
    setPushing(true);
    setMsg(null);
    try {
      const res = await pullCloudToLocalOverwrite();
      setMsg(`✅ 已云端覆盖：sessions ${res.sessions} 条；interrupts ${res.interrupts} 条`);
      onLocalRefresh();
      await refreshCloudCount();
    } catch (e: any) {
      setMsg(`❌ 覆盖失败：${e?.message ?? String(e)}`);
    } finally {
      setPushing(false);
    }
  }

  return (
    <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ fontWeight: 700 }}>云同步状态（Supabase）</div>

      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
        同步状态：
        {syncStatus?.state === "syncing" && "同步中…"}
        {syncStatus?.state === "synced" && "已同步 ✅"}
        {syncStatus?.state === "failed" && `同步失败 ⚠️ ${syncStatus.reason ?? ""}`}
        {(!syncStatus || syncStatus.state === "idle") && "空闲"}
      </div>

      {cloudErr ? (
        <div style={{ color: "crimson", marginTop: 8 }}>云端读取失败：{cloudErr}</div>
      ) : cloudInfo ? (
        <div style={{ marginTop: 8, opacity: 0.85 }}>
          云端 sessions：{cloudInfo.sessions} 条；interrupts：{cloudInfo.interrupts} 条
        </div>
      ) : (
        <div style={{ marginTop: 8, opacity: 0.7 }}>云端数量读取中...</div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        <button onClick={onPush} disabled={pushing} style={{ padding: "10px 14px" }}>
          {pushing ? "处理中..." : "推送本地到云端"}
        </button>

        <button onClick={onPullMerge} disabled={pushing} style={{ padding: "10px 14px" }}>
          从云端拉取（合并）
        </button>

        <button onClick={onPullOverwrite} disabled={pushing} style={{ padding: "10px 14px" }}>
          云端覆盖本地
        </button>

        {msg ? <span style={{ fontSize: 13, opacity: 0.85 }}>{msg}</span> : null}
      </div>
    </section>
  );
}