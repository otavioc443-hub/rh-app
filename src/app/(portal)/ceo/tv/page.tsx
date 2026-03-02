import { redirect } from "next/navigation";

type TvPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CeoTvPage({ searchParams }: TvPageProps) {
  const params = (await searchParams) ?? {};
  const refreshRaw = Array.isArray(params.refresh) ? params.refresh[0] : params.refresh;
  const refresh = refreshRaw === "30" || refreshRaw === "60" || refreshRaw === "120" ? refreshRaw : "60";
  redirect(`/ceo?tv=1&compact=1&refresh=${refresh}`);
}
