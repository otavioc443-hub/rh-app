"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MemberProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  cargo?: string | null;
  setor?: string | null;
};

type MemberPost = {
  id: string;
  author_user_id: string;
  audience_type: "company" | "project";
  audience_label: string;
  text: string;
  created_at: string;
};

function lastSeenLabel(value: string | null | undefined) {
  if (!value) return "Offline";
  const date = new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return "Offline";
  const diffMinutes = Math.max(0, Math.round((Date.now() - ms) / (1000 * 60)));
  if (diffMinutes < 1) return "Offline • último acesso agora";
  if (diffMinutes < 60) return `Offline • último acesso há ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Offline • último acesso há ${diffHours} h`;
  return `Offline • último acesso em ${date.toLocaleDateString("pt-BR")}`;
}

function displayName(profile?: MemberProfile | null) {
  const full = (profile?.full_name ?? "").trim();
  if (full && !full.includes("@")) return full;
  return (profile?.email ?? "Colaborador").trim() || "Colaborador";
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function roleLine(profile?: MemberProfile | null) {
  const parts = [(profile?.cargo ?? "").trim(), (profile?.setor ?? "").trim()].filter(Boolean);
  return parts.length ? parts.join(" | ") : "Cargo e setor não informados";
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function InternalSocialMemberProfilePage() {
  const params = useParams<{ id: string }>();
  const memberId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [posts, setPosts] = useState<MemberPost[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!memberId) return;
      setLoading(true);
      setError("");
      try {
        const authRes = await supabase.auth.getUser();
        const sessionRes = await supabase.auth.getSession();
        const currentUserId = authRes.data.user?.id ?? "";
        const token = sessionRes.data.session?.access_token ?? "";
        const [profileRes, collaboratorRes, postsRes, commentsRes, reactionsRes, messagesRes] = await Promise.all([
          supabase.from("profiles").select("id,full_name,email,avatar_url").eq("id", memberId).maybeSingle<MemberProfile>(),
          supabase
            .from("colaboradores")
            .select("nome,cargo,setor")
            .eq("user_id", memberId)
            .maybeSingle<{ nome: string | null; cargo: string | null; setor: string | null }>(),
          supabase
            .from("internal_social_posts")
            .select("id,author_user_id,audience_type,audience_label,text,created_at")
            .eq("author_user_id", memberId)
            .order("created_at", { ascending: false }),
          supabase
            .from("internal_social_post_comments")
            .select("id,created_at")
            .eq("author_user_id", memberId)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("internal_social_post_reactions")
            .select("id,created_at")
            .eq("user_id", memberId)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("internal_social_direct_messages")
            .select("id,created_at")
            .or(`from_user_id.eq.${memberId},to_user_id.eq.${memberId}`)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        if (profileRes.error) throw new Error(profileRes.error.message);
        if (postsRes.error) throw new Error(postsRes.error.message);
        if (commentsRes.error) throw new Error(commentsRes.error.message);
        if (reactionsRes.error) throw new Error(reactionsRes.error.message);
        if (messagesRes.error) throw new Error(messagesRes.error.message);

        const baseProfile = profileRes.data;
        if (!baseProfile) {
          setProfile(null);
          setPosts([]);
          return;
        }

        const collaborator = collaboratorRes.error ? null : collaboratorRes.data;
        const collaboratorName = (collaborator?.nome ?? "").trim();
        const currentName = (baseProfile.full_name ?? "").trim();
        const safeName =
          currentName && !currentName.includes("@")
            ? currentName
            : collaboratorName && !collaboratorName.includes("@")
              ? collaboratorName
              : currentName || collaboratorName || null;

        setProfile({
          ...baseProfile,
          full_name: safeName,
          cargo: (collaborator?.cargo ?? "").trim() || null,
          setor: (collaborator?.setor ?? "").trim() || null,
        });

        const nextPosts = (postsRes.data ?? []) as MemberPost[];
        setPosts(nextPosts);

        let onlineFromSession = false;
        if (token) {
          const presenceRes = await fetch("/api/institucional/presence", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ userIds: [memberId] }),
          });
          const presenceJson = (await presenceRes.json().catch(() => ({}))) as {
            presence?: Record<string, { online: boolean; lastSeenAt: string | null }>;
          };
          onlineFromSession = !!presenceJson.presence?.[memberId]?.online;
          setLastSeenAt(presenceJson.presence?.[memberId]?.lastSeenAt ?? null);
        }

        const threshold = Date.now() - 15 * 60 * 1000;
        const latestTimestamps = [
          ...nextPosts.slice(0, 1).map((item) => item.created_at),
          ...((commentsRes.data ?? []) as Array<{ created_at: string }>).map((item) => item.created_at),
          ...((reactionsRes.data ?? []) as Array<{ created_at: string }>).map((item) => item.created_at),
          ...((messagesRes.data ?? []) as Array<{ created_at: string }>).map((item) => item.created_at),
        ]
          .map((value) => new Date(value).getTime())
          .filter((value) => !Number.isNaN(value));
        const fallbackOnline = latestTimestamps.some((value) => value >= threshold);
        setIsOnline(memberId === currentUserId || onlineFromSession || fallbackOnline);
        if (!onlineFromSession && latestTimestamps.length) {
          setLastSeenAt(new Date(Math.max(...latestTimestamps)).toISOString());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar perfil do membro.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [memberId]);

  const title = useMemo(() => displayName(profile), [profile]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">PulseHub</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Perfil do membro</h1>
        </div>
        <Link
          href="/institucional/rede-social"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Voltar para a rede
        </Link>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando perfil...</div>
      ) : profile ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-20 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.55),_transparent_35%),linear-gradient(120deg,#0f172a_0%,#1d4ed8_55%,#2563eb_100%)]" />
            <div className="px-6 pb-6">
              <div className="-mt-8 h-16 w-16 rounded-full border-4 border-white shadow-sm">
                {profile.avatar_url ? (
                  <div className="h-full w-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${profile.avatar_url})` }} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white">
                    {initials(title)}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-2xl font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-500">{roleLine(profile)}</p>
                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                      isOnline
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </div>
                <p className={`mt-2 text-xs font-semibold ${isOnline ? "text-emerald-600" : "text-slate-400"}`}>
                  {isOnline ? "Online agora" : lastSeenLabel(lastSeenAt)}
                </p>
                <div className="mt-3">
                  <Link
                    href={`/institucional/rede-social?tab=messages&user=${profile.id}`}
                    className="inline-flex rounded-2xl bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                  >
                    Enviar mensagem
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Publicações</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Publicações de {title}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {posts.length} {posts.length === 1 ? "publicação" : "publicações"}
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {posts.length ? (
                posts.map((post) => (
                  <article key={post.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {post.audience_type === "company" ? "Empresa" : post.audience_label}
                      </p>
                      <p className="text-xs text-slate-400">{when(post.created_at)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{post.text}</p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Este membro ainda não publicou na rede interna.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          Membro não encontrado.
        </div>
      )}
    </div>
  );
}
