"use client";

import { useState } from "react";
import Link from "next/link";

type RefreshSec = 30 | 60 | 120;
type CycleSec = 10 | 20 | 30;

type Preset = {
  name: string;
  refresh: RefreshSec;
  cycle: CycleSec;
  rotateClients: boolean;
  rotateAnalysis: boolean;
  rotateWindow: boolean;
};

const PRESETS: Preset[] = [
  {
    name: "Apresentacao executiva",
    refresh: 60,
    cycle: 20,
    rotateClients: true,
    rotateAnalysis: true,
    rotateWindow: false,
  },
  {
    name: "Monitor operacao",
    refresh: 30,
    cycle: 10,
    rotateClients: true,
    rotateAnalysis: false,
    rotateWindow: true,
  },
  {
    name: "Foco margem",
    refresh: 60,
    cycle: 20,
    rotateClients: true,
    rotateAnalysis: false,
    rotateWindow: true,
  },
];

export default function CeoPainelTvConfigPage() {
  const [msg, setMsg] = useState("");
  const [refresh, setRefresh] = useState<RefreshSec>(() => {
    try {
      const r = window.localStorage.getItem("ceo_dashboard_tv_refresh_seconds");
      return r === "30" || r === "60" || r === "120" ? (Number(r) as RefreshSec) : 60;
    } catch {
      return 60;
    }
  });
  const [cycle, setCycle] = useState<CycleSec>(() => {
    try {
      const c = window.localStorage.getItem("ceo_dashboard_tv_cycle_seconds");
      return c === "10" || c === "20" || c === "30" ? (Number(c) as CycleSec) : 20;
    } catch {
      return 20;
    }
  });
  const [rotateClients, setRotateClients] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("ceo_dashboard_tv_rotate_clients") === "1";
    } catch {
      return true;
    }
  });
  const [rotateAnalysis, setRotateAnalysis] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("ceo_dashboard_tv_rotate_analysis") === "1";
    } catch {
      return true;
    }
  });
  const [rotateWindow, setRotateWindow] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("ceo_dashboard_tv_rotate_window") === "1";
    } catch {
      return false;
    }
  });

  function save(values?: Partial<{ refresh: RefreshSec; cycle: CycleSec; rotateClients: boolean; rotateAnalysis: boolean; rotateWindow: boolean }>) {
    const next = {
      refresh: values?.refresh ?? refresh,
      cycle: values?.cycle ?? cycle,
      rotateClients: values?.rotateClients ?? rotateClients,
      rotateAnalysis: values?.rotateAnalysis ?? rotateAnalysis,
      rotateWindow: values?.rotateWindow ?? rotateWindow,
    };
    try {
      window.localStorage.setItem("ceo_dashboard_tv_mode", "1");
      window.localStorage.setItem("ceo_dashboard_compact_mode", "1");
      window.localStorage.setItem("ceo_dashboard_tv_refresh_seconds", String(next.refresh));
      window.localStorage.setItem("ceo_dashboard_tv_cycle_seconds", String(next.cycle));
      window.localStorage.setItem("ceo_dashboard_tv_rotate_clients", next.rotateClients ? "1" : "0");
      window.localStorage.setItem("ceo_dashboard_tv_rotate_analysis", next.rotateAnalysis ? "1" : "0");
      window.localStorage.setItem("ceo_dashboard_tv_rotate_window", next.rotateWindow ? "1" : "0");
      setRefresh(next.refresh);
      setCycle(next.cycle);
      setRotateClients(next.rotateClients);
      setRotateAnalysis(next.rotateAnalysis);
      setRotateWindow(next.rotateWindow);
      setMsg("Preset salvo no navegador.");
    } catch {
      setMsg("Falha ao salvar preset no navegador.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Configuracao do Painel TV (CEO)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Define presets para `Modo TV` do painel CEO e atalhos para abrir em monitor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ceo" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Voltar painel CEO
            </Link>
            <Link href={`/ceo-tv?refresh=${refresh}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Abrir Painel TV
            </Link>
          </div>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Preset customizado</h2>
          <p className="mt-1 text-sm text-slate-500">Salva como padrao no navegador desta maquina.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Refresh automatico</span>
              <select value={refresh} onChange={(e) => setRefresh(Number(e.target.value) as RefreshSec)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>120s</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ciclo de rotacao</span>
              <select value={cycle} onChange={(e) => setCycle(Number(e.target.value) as CycleSec)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value={10}>10s</option>
                <option value={20}>20s</option>
                <option value={30}>30s</option>
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center gap-3 text-sm text-slate-800">
              <input type="checkbox" checked={rotateClients} onChange={(e) => setRotateClients(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Rotacionar clientes
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-800">
              <input type="checkbox" checked={rotateAnalysis} onChange={(e) => setRotateAnalysis(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Rotacionar analise (faturamento/margem)
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-800">
              <input type="checkbox" checked={rotateWindow} onChange={(e) => setRotateWindow(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Rotacionar janela (30/90/180 dias)
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => save()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Salvar preset
            </button>
            <Link href={`/ceo-tv?refresh=${refresh}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Abrir TV com preset
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Presets prontos</h2>
          <p className="mt-1 text-sm text-slate-500">Aplicacao rapida para cenarios comuns.</p>

          <div className="mt-4 space-y-3">
            {PRESETS.map((preset) => (
              <div key={preset.name} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{preset.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Refresh {preset.refresh}s | Ciclo {preset.cycle}s | Clientes {preset.rotateClients ? "ON" : "OFF"} | Analise {preset.rotateAnalysis ? "ON" : "OFF"} | Janela {preset.rotateWindow ? "ON" : "OFF"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => save(preset)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Aplicar preset
                  </button>
                  <Link
                    href={`/ceo-tv?refresh=${preset.refresh}`}
                    onClick={() => save(preset)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Aplicar e abrir TV
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
