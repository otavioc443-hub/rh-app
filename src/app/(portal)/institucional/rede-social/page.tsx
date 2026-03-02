"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Image as ImageIcon, MessageCircle, MessageSquare, Paperclip, Play, Send, Sparkles, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type BasicProfile = { id: string; name: string; email: string; avatarUrl: string | null };
type ProjectOption = { id: string; name: string };
type SocialAttachmentType = "image" | "video" | "link";
type SocialAttachment = { id: string; type: SocialAttachmentType; url: string; label: string };
type SocialComment = { id: string; authorId: string; authorName: string; text: string; createdAt: string };
type SocialPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  audienceType: "company" | "project";
  audienceProjectId: string | null;
  audienceLabel: string;
  text: string;
  attachments: SocialAttachment[];
  reactions: Record<string, string[]>;
  comments: SocialComment[];
  createdAt: string;
};
type DirectMessage = { id: string; fromUserId: string; fromName: string; toUserId: string; text: string; createdAt: string };
type SocialStore = { posts: SocialPost[]; directMessages: DirectMessage[] };

const STORAGE_KEY = "portal_internal_social_v1";
const QUICK_EMOJIS = ["??", "??", "??", "??", "??", "??"];

function createId(prefix: string) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function formatDateTime(value: string) { try { return new Date(value).toLocaleString("pt-BR"); } catch { return value; } }
function formatTimeAgo(value: string) {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return formatDateTime(value);
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return formatDateTime(value);
}
function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
function safeParseStore(raw: string | null): SocialStore {
  if (!raw) return { posts: [], directMessages: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<SocialStore>;
    return { posts: Array.isArray(parsed.posts) ? parsed.posts : [], directMessages: Array.isArray(parsed.directMessages) ? parsed.directMessages : [] };
  } catch { return { posts: [], directMessages: [] }; }
}
function isImageUrl(url: string) { return /\.(png|jpe?g|gif|webp|svg)$/i.test(url); }
function isVideoUrl(url: string) { return /\.(mp4|webm|mov|m4v)$/i.test(url) || /youtube\.com|youtu\.be|vimeo\.com/i.test(url); }

export default function InstitucionalRedeSocialPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [currentUser, setCurrentUser] = useState<BasicProfile | null>(null);
  const [profiles, setProfiles] = useState<BasicProfile[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [store, setStore] = useState<SocialStore>({ posts: [], directMessages: [] });
  const [audienceValue, setAudienceValue] = useState("company");
  const [postText, setPostText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentType, setAttachmentType] = useState<SocialAttachmentType>("image");
  const [draftAttachments, setDraftAttachments] = useState<SocialAttachment[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedChatUserId, setSelectedChatUserId] = useState("");
  const [chatDraft, setChatDraft] = useState("");

  useEffect(() => { setStore(safeParseStore(typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null)); }, []);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }, [store]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setMsg("");
      try {
        const auth = await supabase.auth.getUser();
        if (auth.error || !auth.data.user) throw new Error("Sessao invalida.");
        const authUser = auth.data.user;
        const [currentProfileRes, allProfilesRes, myMembershipsRes] = await Promise.all([
          supabase.from("profiles").select("id,full_name,email,avatar_url").eq("id", authUser.id).maybeSingle<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null }>(),
          supabase.from("profiles").select("id,full_name,email,avatar_url,active").eq("active", true),
          supabase.from("project_members").select("project_id").eq("user_id", authUser.id),
        ]);
        const me: BasicProfile = {
          id: authUser.id,
          name: currentProfileRes.data?.full_name?.trim() || authUser.user_metadata?.full_name || authUser.email || "Usuario",
          email: currentProfileRes.data?.email ?? authUser.email ?? "",
          avatarUrl: currentProfileRes.data?.avatar_url ?? null,
        };
        const memberProjectIds = Array.from(new Set(((myMembershipsRes.data ?? []) as Array<{ project_id: string }>).map((row) => row.project_id)));
        let projectRows: Array<{ id: string; name: string }> = [];
        if (memberProjectIds.length) {
          const projectsRes = await supabase.from("projects").select("id,name").in("id", memberProjectIds);
          if (!projectsRes.error) projectRows = (projectsRes.data ?? []) as Array<{ id: string; name: string }>;
        }
        const normalizedProfiles = (!allProfilesRes.error ? (allProfilesRes.data ?? []) : []).map((row) => {
          const profile = row as { id: string; full_name: string | null; email: string | null; avatar_url: string | null };
          return { id: profile.id, name: profile.full_name?.trim() || profile.email?.trim() || "Colaborador sem nome", email: profile.email?.trim() || "", avatarUrl: profile.avatar_url ?? null };
        }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        if (!alive) return;
        setCurrentUser(me);
        setProfiles(normalizedProfiles.length ? normalizedProfiles : [me]);
        setProjectOptions(projectRows.map((row) => ({ id: row.id, name: row.name })));
      } catch (error: unknown) {
        if (!alive) return;
        setMsg(error instanceof Error ? error.message : "Erro ao carregar a rede social interna.");
      } finally { if (alive) setLoading(false); }
    }
    void load();
    return () => { alive = false; };
  }, []);

  const companyRecipients = useMemo(() => profiles.filter((profile) => profile.id !== currentUser?.id), [profiles, currentUser?.id]);
  const selectedChatUser = useMemo(() => profiles.find((profile) => profile.id === selectedChatUserId) ?? null, [profiles, selectedChatUserId]);
  const visiblePosts = useMemo(() => {
    if (!currentUser) return [];
    const allowedProjectIds = new Set(projectOptions.map((project) => project.id));
    return [...store.posts].filter((post) => post.audienceType === "company" || (!!post.audienceProjectId && allowedProjectIds.has(post.audienceProjectId))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentUser, projectOptions, store.posts]);
  const directThreads = useMemo(() => {
    if (!currentUser) return [] as DirectMessage[];
    return [...store.directMessages].filter((message) => (message.fromUserId === currentUser.id && message.toUserId === selectedChatUserId) || (message.fromUserId === selectedChatUserId && message.toUserId === currentUser.id)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [currentUser, selectedChatUserId, store.directMessages]);

  function insertEmoji(emoji: string) { setPostText((value) => `${value}${value ? " " : ""}${emoji}`); }
  function addDraftAttachment() {
    const url = attachmentUrl.trim();
    if (!url) return;
    const resolvedType = attachmentType === "link" ? (isImageUrl(url) ? "image" : isVideoUrl(url) ? "video" : "link") : attachmentType;
    setDraftAttachments((current) => [...current, { id: createId("att"), type: resolvedType, url, label: url.replace(/^https?:\/\//i, "") }]);
    setAttachmentUrl(""); setAttachmentType("image");
  }
  function publishPost() {
    if (!currentUser) return;
    const text = postText.trim();
    if (!text && draftAttachments.length === 0) { setMsg("Escreva algo ou adicione ao menos um anexo antes de publicar."); return; }
    const projectId = audienceValue.startsWith("project:") ? audienceValue.replace("project:", "") : null;
    const project = projectOptions.find((item) => item.id === projectId);
    const nextPost: SocialPost = {
      id: createId("post"), authorId: currentUser.id, authorName: currentUser.name, authorAvatarUrl: currentUser.avatarUrl,
      audienceType: project ? "project" : "company", audienceProjectId: project?.id ?? null, audienceLabel: project ? `Equipe do projeto: ${project.name}` : "Toda a empresa",
      text, attachments: draftAttachments, reactions: {}, comments: [], createdAt: new Date().toISOString(),
    };
    setStore((current) => ({ ...current, posts: [nextPost, ...current.posts] }));
    setPostText(""); setDraftAttachments([]); setMsg("");
  }
  function toggleReaction(postId: string, emoji: string) {
    if (!currentUser) return;
    setStore((current) => ({ ...current, posts: current.posts.map((post) => {
      if (post.id !== postId) return post;
      const users = post.reactions[emoji] ?? [];
      const nextUsers = users.includes(currentUser.id) ? users.filter((id) => id !== currentUser.id) : [...users, currentUser.id];
      const nextReactions = { ...post.reactions, [emoji]: nextUsers };
      if (nextUsers.length === 0) delete nextReactions[emoji];
      return { ...post, reactions: nextReactions };
    }) }));
  }
  function addComment(postId: string) {
    if (!currentUser) return;
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    const comment: SocialComment = { id: createId("comment"), authorId: currentUser.id, authorName: currentUser.name, text, createdAt: new Date().toISOString() };
    setStore((current) => ({ ...current, posts: current.posts.map((post) => (post.id === postId ? { ...post, comments: [...post.comments, comment] } : post)) }));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
  }
  function sendDirectMessage() {
    if (!currentUser || !selectedChatUserId || !chatDraft.trim()) return;
    const nextMessage: DirectMessage = { id: createId("dm"), fromUserId: currentUser.id, fromName: currentUser.name, toUserId: selectedChatUserId, text: chatDraft.trim(), createdAt: new Date().toISOString() };
    setStore((current) => ({ ...current, directMessages: [...current.directMessages, nextMessage] }));
    setChatDraft("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-sky-950 to-indigo-950 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Institucional</p>
            <h1 className="mt-2 text-2xl font-semibold">Rede social interna</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200">Feed corporativo com cara de timeline social: publicacoes, anexos, reacoes, comentarios e inbox lateral.</p>
          </div>
          <Link href="/institucional" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Voltar ao institucional <ChevronRight size={16} /></Link>
        </div>
      </section>

      {msg ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{msg}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Voce no feed</p><div className="mt-4 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-sm font-semibold text-white">{initialsFromName(currentUser?.name ?? "Usuario")}</div><div><p className="text-sm font-semibold text-slate-900">{currentUser?.name ?? "Carregando..."}</p><p className="text-xs text-slate-500">{currentUser?.email || "Membro da empresa"}</p></div></div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Projetos com alcance</p><p className="mt-4 text-3xl font-semibold text-slate-900">{projectOptions.length}</p><p className="mt-1 text-sm text-slate-600">Canais por equipe para falar com o time certo.</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Conversas diretas</p><p className="mt-4 text-3xl font-semibold text-slate-900">{store.directMessages.length}</p><p className="mt-1 text-sm text-slate-600">Inbox lateral para conversas privadas.</p></div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">Nova publicacao</h2><p className="mt-1 text-sm text-slate-600">Composer central com visual mais proximo de um feed social.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"><Sparkles size={14} /> Feed interno</span></div>
            <div className="mt-5 grid gap-4 md:grid-cols-[72px_minmax(0,1fr)_280px]">
              <div className="flex justify-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-base font-semibold text-white">{initialsFromName(currentUser?.name ?? "Usuario")}</div></div>
              <div className="space-y-3">
                <textarea value={postText} onChange={(event) => setPostText(event.target.value)} rows={5} placeholder="No que voce esta pensando?" className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300" />
                <div className="flex flex-wrap gap-2">{QUICK_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-lg hover:border-indigo-200 hover:bg-indigo-50">{emoji}</button>)}</div>
              </div>
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <select value={audienceValue} onChange={(event) => setAudienceValue(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="company" className="bg-white text-slate-900">Toda a empresa</option>{projectOptions.map((project) => <option key={project.id} value={`project:${project.id}`} className="bg-white text-slate-900">Equipe: {project.name}</option>)}</select>
                <select value={attachmentType} onChange={(event) => setAttachmentType(event.target.value as SocialAttachmentType)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="image" className="bg-white text-slate-900">Imagem</option><option value="video" className="bg-white text-slate-900">Video</option><option value="link" className="bg-white text-slate-900">Link</option></select>
                <input value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="Cole a URL da imagem, video ou link" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400" />
                <button type="button" onClick={addDraftAttachment} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><Paperclip size={16} /> Adicionar anexo</button>
              </div>
            </div>
            {draftAttachments.length ? <div className="mt-4 flex flex-wrap gap-2">{draftAttachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => setDraftAttachments((current) => current.filter((item) => item.id !== attachment.id))} className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">{attachment.type === "video" ? <Play size={14} /> : attachment.type === "image" ? <ImageIcon size={14} /> : <Paperclip size={14} />}{attachment.label}</button>)}</div> : null}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">MVP com persistencia local neste navegador.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setPostText(""); setDraftAttachments([]); setAttachmentUrl(""); setAudienceValue("company"); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Limpar</button><button type="button" onClick={publishPost} disabled={loading || !currentUser} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Send size={16} /> Publicar</button></div></div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">Feed interno</h2><p className="mt-1 text-sm text-slate-600">Timeline com autor, publico, reacoes e comentarios.</p></div><div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"><Users size={14} /> {visiblePosts.length} publicacao(oes)</div></div>
            {visiblePosts.length ? visiblePosts.map((post) => (
              <article key={post.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-xs font-semibold text-white">{initialsFromName(post.authorName)}</div><div><p className="text-sm font-semibold text-slate-900">{post.authorName}</p><p className="mt-1 text-xs text-slate-500">{post.audienceLabel} • {formatTimeAgo(post.createdAt)}</p></div></div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${post.audienceType === "project" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>{post.audienceType === "project" ? "Equipe do projeto" : "Toda a empresa"}</span>
                </div>
                {post.text ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.text}</p> : null}
                {post.attachments.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{post.attachments.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="rounded-3xl border border-slate-200 bg-slate-50 p-3 hover:border-indigo-200 hover:bg-indigo-50"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800">{attachment.type === "image" ? <ImageIcon size={16} /> : attachment.type === "video" ? <Play size={16} /> : <Paperclip size={16} />}{attachment.type === "image" ? "Imagem" : attachment.type === "video" ? "Video" : "Link"}</div><p className="mt-2 truncate text-xs text-slate-500">{attachment.label}</p>{attachment.type === "image" ? <div className="mt-3 h-36 rounded-2xl border border-slate-200 bg-cover bg-center" style={{ backgroundImage: `url("${attachment.url}")` }} /> : null}{attachment.type === "video" ? <div className="mt-3 flex h-24 items-center justify-center rounded-2xl border border-slate-200 bg-slate-900 text-sm font-semibold text-white">Abrir video</div> : null}</a>)}</div> : null}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-slate-100 py-3">{QUICK_EMOJIS.map((emoji) => { const users = post.reactions[emoji] ?? []; const active = !!currentUser && users.includes(currentUser.id); return <button key={`${post.id}-${emoji}`} type="button" onClick={() => toggleReaction(post.id, emoji)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"}`}>{emoji} {users.length || ""}</button>; })}</div>
                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><MessageCircle size={16} /> Comentarios</div><span className="text-xs font-semibold text-slate-500">{post.comments.length}</span></div><div className="mt-3 space-y-3">{post.comments.length ? post.comments.map((comment) => <div key={comment.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-800">{comment.authorName}</span><span className="text-[11px] text-slate-500">{formatTimeAgo(comment.createdAt)}</span></div><p className="mt-1 text-sm text-slate-700">{comment.text}</p></div>) : <p className="text-sm text-slate-500">Nenhum comentario ainda.</p>}</div><div className="mt-3 flex gap-3"><input value={commentDrafts[post.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Escreva um comentario" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400" /><button type="button" onClick={() => addComment(post.id)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Send size={15} /> Enviar</button></div></div>
              </article>
            )) : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-base font-semibold text-slate-900">Nenhuma publicacao ainda</p><p className="mt-2 text-sm text-slate-600">Use o composer acima para iniciar a timeline.</p></div>}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900"><MessageSquare size={18} /> Mensagem individual</div>
            <p className="mt-2 text-sm text-slate-600">Inbox lateral com contatos e historico da conversa.</p>
            <div className="mt-4 space-y-3"><div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">{companyRecipients.length ? companyRecipients.map((profile) => { const active = selectedChatUserId === profile.id; return <button key={profile.id} type="button" onClick={() => setSelectedChatUserId(profile.id)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ${active ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}><div className={`flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-semibold ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>{initialsFromName(profile.name)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile.name}</p><p className={`truncate text-[11px] ${active ? "text-indigo-100" : "text-slate-500"}`}>{profile.email || "Membro da empresa"}</p></div></button>; }) : <p className="px-2 py-3 text-sm text-slate-500">Nenhum outro membro ativo encontrado.</p>}</div></div>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">{selectedChatUser ? <><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{selectedChatUser.name}</p><p className="text-xs text-slate-500">{selectedChatUser.email || "Membro da empresa"}</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">{directThreads.length} mensagem(ns)</span></div><div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">{directThreads.length ? directThreads.map((message) => { const mine = message.fromUserId === currentUser?.id; return <div key={message.id} className={`rounded-3xl px-3 py-2.5 text-sm ${mine ? "ml-6 bg-indigo-600 text-white" : "mr-6 border border-slate-200 bg-white text-slate-700"}`}><p>{message.text}</p><p className={`mt-1 text-[11px] ${mine ? "text-indigo-100" : "text-slate-500"}`}>{formatTimeAgo(message.createdAt)}</p></div>; }) : <p className="text-sm text-slate-500">Nenhuma mensagem com este membro ainda.</p>}</div><div className="mt-4 flex gap-3"><textarea value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} rows={3} placeholder="Escreva uma mensagem individual" className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400" /><button type="button" onClick={sendDirectMessage} className="inline-flex h-fit items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Send size={15} /> Enviar</button></div></> : <p className="text-sm text-slate-500">Escolha um membro para abrir uma conversa individual.</p>}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}

