"use client";

import { useEffect, useState } from "react";
import type { LmsMediaLibraryItem } from "@/lib/lms/types";

export function LmsMediaLibrary({
  bucket,
  title,
  description,
  emptyLabel,
  onSelect,
}: {
  bucket: LmsMediaLibraryItem["bucket"];
  title: string;
  description?: string;
  emptyLabel?: string;
  onSelect: (storageRef: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LmsMediaLibraryItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ bucket });
        if (query.trim()) params.set("search", query.trim());
        const response = await fetch(`/api/lms/storage/library?${params.toString()}`, { signal: controller.signal });
        const data = (await response.json()) as { items?: LmsMediaLibraryItem[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Falha ao carregar a biblioteca.");
        if (active) setItems(data.items ?? []);
      } catch (fetchError) {
        if (!active || controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar a biblioteca.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [bucket, query]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {description ? <div className="mt-1 text-xs text-slate-500">{description}</div> : null}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar arquivo"
          className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
        />
      </div>

      {error ? <div className="mt-3 text-xs font-medium text-rose-600">{error}</div> : null}
      {loading ? <div className="mt-3 text-xs text-slate-500">Carregando arquivos...</div> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!loading && !items.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
            {emptyLabel ?? "Nenhum arquivo encontrado neste espaco."}
          </div>
        ) : null}

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.storageRef)}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex h-32 items-center justify-center bg-slate-100">
              {item.signedUrl && (bucket === "lms-thumbnails" || bucket === "lms-banners" || item.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.signedUrl} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="px-4 text-center text-xs font-medium text-slate-500">{item.name}</div>
              )}
            </div>
            <div className="space-y-1 px-4 py-3">
              <div className="line-clamp-1 text-sm font-semibold text-slate-900">{item.name}</div>
              <div className="text-xs text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("pt-BR") : "Arquivo sem data"}</div>
              <div className="text-xs font-medium text-slate-600">Clique para reutilizar neste campo</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
