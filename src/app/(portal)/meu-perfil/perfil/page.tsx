"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function normalizeImageExt(file: File) {
  const t = file.type.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  return "jpg";
}

export default function PerfilPage() {
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const initials = useMemo(
    () => getInitials(fullName || "Colaborador"),
    [fullName]
  );

  function hydrateFromUser(user: User) {
    setUserId(user?.id ?? null);
    setUserEmail(user?.email ?? null);

    const md = (user.user_metadata ?? {}) as Record<string, unknown>;
    setFullName(String(md.full_name ?? md.name ?? ""));
    setAvatarUrl(String(md.avatar_url ?? md.picture ?? ""));
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const user = data.user;
      if (user) hydrateFromUser(user);

      setBooting(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (user) hydrateFromUser(user);
      else {
        setUserId(null);
        setUserEmail(null);
        setFullName("");
        setAvatarUrl("");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    setMsg("");
    await supabase.auth.signOut();
    // onAuthStateChange já limpa estados
  }

  async function saveProfile() {
    setMsg("");

    if (!userId) {
      setMsg("Você precisa estar logado.");
      return;
    }
    if (!fullName.trim()) {
      setMsg("Informe seu nome completo.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
        avatar_url: avatarUrl || "",
      },
    });
    setLoading(false);

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      return;
    }

    setMsg("Perfil atualizado ✅");
  }

  async function uploadAvatar(file: File) {
    setMsg("");

    if (!userId) {
      setMsg("Você precisa estar logado.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMsg("Envie um arquivo de imagem (PNG/JPG/WEBP).");
      return;
    }

    // limite simples (ex.: 3MB)
    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      setMsg("Imagem muito grande. Envie uma foto de até 3MB.");
      return;
    }

    setLoading(true);

    const ext = normalizeImageExt(file);
    const path = `${userId}/avatar.${ext}`; // sobrescreve

    // 1) upload para o bucket "avatars"
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type,
      });

    if (uploadError) {
      setLoading(false);
      setMsg("Erro no upload: " + uploadError.message);
      return;
    }

    // 2) URL pública
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    // 3) salvar no Auth metadata (sidebar usa)
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim() || "",
        avatar_url: publicUrl,
      },
    });

    setLoading(false);

    if (updateError) {
      setMsg("Upload ok, mas erro ao salvar perfil: " + updateError.message);
      return;
    }

    setAvatarUrl(publicUrl);
    setMsg("Foto atualizada ✅");
  }

  // ✅ Tela de carregamento inicial
  if (booting) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white border rounded-2xl shadow p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold">Meu Perfil</h1>
          <p className="mt-2 text-gray-600">Carregando informações…</p>
        </div>
      </main>
    );
  }

  // ✅ Se não está logado
  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white border rounded-2xl shadow p-6 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="mt-2 text-gray-600">
            Você precisa estar logado para editar seu perfil.
          </p>

          <Link href="/" className="inline-block mt-4 underline">
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white border rounded-2xl shadow p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <p className="text-sm text-gray-600 mt-2">{userEmail}</p>
          </div>

          <div className="flex gap-3">
            <Link href="/feedback" className="underline text-sm">
              Ir para Feedback
            </Link>
            <Link href="/" className="underline text-sm">
              Home
            </Link>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Avatar"
              className="h-20 w-20 rounded-full object-cover border"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-black text-white flex items-center justify-center font-semibold text-xl">
              {initials}
            </div>
          )}

          <div className="flex-1">
            <label className="text-sm font-medium">Foto do perfil</label>
            <input
              className="mt-2 block w-full text-sm"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              Envie uma foto (PNG/JPG/WEBP). Ela aparece na sidebar automaticamente.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <label className="text-sm font-medium">Nome completo</label>
          <input
            className="mt-2 w-full border rounded-xl p-4"
            placeholder="Ex.: Maria Luiza Santos"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
          />
        </div>

        <button
          onClick={saveProfile}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-black text-white py-4 font-medium disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar alterações"}
        </button>

        <button
          onClick={signOut}
          disabled={loading}
          className="mt-3 w-full rounded-xl border py-4 font-medium disabled:opacity-60"
        >
          Sair
        </button>

        {msg && <p className="mt-4 text-sm text-center">{msg}</p>}

        <p className="mt-6 text-xs text-gray-500 text-center">
          Dica: se a sidebar não atualizar na hora, recarregue a página (F5).
        </p>
      </div>
    </main>
  );
}
