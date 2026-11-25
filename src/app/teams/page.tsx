import type { Metadata } from "next";
import Link from "next/link";
import { Card, SectionTitle, TeamDot, TierBadge } from "@/components/ui";
import { getPublicState } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "참가 팀" };

export default function TeamsPage() {
  const s = getPublicState();
  const playerById = new Map(s.players.map((p) => [p.id, p]));
  const orderIndex = new Map(s.draft.order.map((id, i) => [id, i]));
  const teams = [...s.teams].sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-12">
      <SectionTitle
        title="참가 팀"
        desc={
          s.draft.status === "done"
            ? "드래프트가 끝나 로스터가 확정되었습니다."
            : "드래프트 결과에 따라 로스터가 채워집니다."
        }
      />

      {teams.length === 0 ? (
        <Card className="p-10 text-center text-mute">
          아직 등록된 팀이 없습니다.{" "}
          <Link href="/admin" className="text-accent underline-offset-4 hover:underline">
            관리자 페이지
          </Link>
          에서 팀을 추가하세요.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {teams.map((t) => {
            const roster = s.picks.filter((p) => p.teamId === t.id);
            return (
              <Card key={t.id} className="overflow-hidden">
                <div className="h-1" style={{ background: t.color }} />
                <div className="p-5">
                  <div className="flex items-start gap-2">
                    <TeamDot color={t.color} className="mt-2" />
                    <h3 className="min-w-0 text-lg leading-snug font-black">{t.name}</h3>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="inline-flex h-5 items-center rounded bg-white/10 px-1.5 text-[11px] font-bold">
                        주장
                      </span>
                      <span className="font-semibold">{t.captain}</span>
                    </li>
                    {Array.from({ length: s.draft.rounds }, (_, r) => {
                      const pick = roster[r];
                      const p = pick && playerById.get(pick.playerId);
                      return (
                        <li key={r} className="flex items-center gap-2">
                          <span className="tabular w-8 text-[11px] text-mute">R{r + 1}</span>
                          {p ? (
                            <>
                              <TierBadge tier={p.tier} />
                              <span className="min-w-0">{p.nickname}</span>
                              <span className="score ml-auto text-xl">{p.rating.toLocaleString()}</span>
                            </>
                          ) : (
                            <span className="text-mute/50">—</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
