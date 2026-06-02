import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, LockKeyhole, MessageSquareText } from "lucide-react";
import { getPulseHubSharePost } from "@/lib/pulsehubShare";

type SharePageProps = {
  params: Promise<{ postId: string }>;
};

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPulseHubSharePost(postId);

  if (!post) {
    return {
      title: "Publicação PulseHub | Portal de RH",
      description: "Acesse o Portal de RH para visualizar esta publicação.",
    };
  }

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: post.shareUrl },
    openGraph: {
      title: post.title,
      description: post.description,
      url: post.shareUrl,
      siteName: "Portal de RH",
      type: "article",
      publishedTime: post.createdAt,
      images: [
        {
          url: post.imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.imageUrl],
    },
    other: {
      "og:image:secure_url": post.imageUrl,
      "og:image:type": "image/png",
      "og:image:width": "1200",
      "og:image:height": "630",
      "twitter:image": post.imageUrl,
    },
  };
}

export default async function PulseHubSharePage({ params }: SharePageProps) {
  const { postId } = await params;
  const post = await getPulseHubSharePost(postId);

  if (!post) notFound();

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-50">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 rounded-[2rem] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl shadow-black/30 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
            RH
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">PulseHub</p>
            <h1 className="text-lg font-black text-slate-950">Portal de RH</h1>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
            <MessageSquareText size={14} />
            {post.postType}
          </div>
          <p className="text-sm font-semibold text-slate-500">{post.publisher}</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{post.title}</h2>
          <p className="mt-3 text-base leading-7 text-slate-700">{post.description}</p>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-bold">Login necessário</p>
              <p className="text-sm leading-6">Para visualizar a publicação completa, entre com seu acesso do Portal de RH.</p>
            </div>
          </div>
          <Link
            href={post.portalUrl}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            Acessar publicação
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
