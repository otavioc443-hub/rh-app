"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const IDLE_TIME = 15 * 60 * 1000; // ✅ 15 minutos

export function useIdleTimeout() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  function resetTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
      router.replace("/");
    }, IDLE_TIME);
  }

  useEffect(() => {
    const events = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ];

    events.forEach((event) =>
      window.addEventListener(event, resetTimer)
    );

    resetTimer(); // inicia o timer ao entrar

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, []);
}
