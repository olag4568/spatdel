"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

export default function NotificationPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const canNotify = typeof window !== "undefined" && "Notification" in window;
    setSupported(canNotify);
    if (!canNotify || Notification.permission !== "default") return;
    try {
      if (window.localStorage.getItem("spatdel-notification-prompt-dismissed") !== "yes") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setVisible(false);
      if (permission === "granted") {
        try { window.localStorage.setItem("spatdel-notification-permission", "granted"); } catch {}
      } else {
        try { window.localStorage.setItem("spatdel-notification-prompt-dismissed", "yes"); } catch {}
      }
    } catch {
      setVisible(false);
    }
  }

  function dismiss() {
    setVisible(false);
    try { window.localStorage.setItem("spatdel-notification-prompt-dismissed", "yes"); } catch {}
  }

  if (!visible || !supported) return null;

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-[#087b62]/20 bg-white p-4 text-[#102f46] shadow-2xl">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e4f5ee] text-[#087b62]"><Bell size={21} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">Stay updated on SPATDEL</p>
        <p className="mt-1 text-xs leading-5 text-[#71808a]">Allow browser notifications for updates and important alerts. You can change this in your browser settings.</p>
        <button onClick={() => void enableNotifications()} className="mt-3 rounded-lg bg-[#087b62] px-3 py-2 text-xs font-bold text-white">Enable notifications</button>
      </div>
      <button onClick={dismiss} aria-label="Dismiss notification prompt" className="self-start rounded-lg p-2 text-[#71808a] hover:bg-[#f8f7f2]"><X size={17} /></button>
    </aside>
  );
}
