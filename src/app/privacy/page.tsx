import type { Metadata } from "next";
import { Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "운영·개인정보 안내" };

const REPO = "https://github.com/apple01234/DJMAX_Link_Match";
const ISSUES = `${REPO}/issues`;

/** 표 한 줄: 왼쪽 항목 이름, 오른쪽 내용 */
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-4 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="label pt-0.5">{k}</dt>
      <dd className="text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-12">
      <SectionTitle
        title="운영·개인정보 안내"
        desc="이 사이트는 DJMAX LINK MATCH 2027 스태프 지원용으로 만든 초안입니다. 아래는 이 사이트가 실제로 저장하고 보여주는 정보입니다."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="px-5 py-2">
          <dl>
            <Row k="운영 주체">
              이 사이트의 제작자(GitHub <span className="font-mono">apple01234</span>)가 운영합니다. 대회 공식 운영진의
              사이트가 아닙니다.
            </Row>
            <Row k="문의">
              <a href={ISSUES} className="font-semibold text-accent underline-offset-4 hover:underline">
                GitHub 저장소 이슈
              </a>
              로 받습니다. 이슈는 누구나 볼 수 있으니 닉네임 외의 개인정보는 적지 마세요.
            </Row>
            <Row k="회원가입·쿠키">회원가입과 로그인 계정이 없고, 쿠키를 쓰지 않습니다.</Row>
          </dl>
        </Card>

        <Card className="px-5 py-2">
          <dl>
            <Row k="공개되는 정보">
              팀명, 주장 이름, 선수 닉네임·티어·레이팅·주력 키·메모, 지명 기록. 운영진이 입력하며 누구나 볼 수
              있습니다. 이 사이트는 참가 신청을 직접 받지 않습니다.
            </Row>
            <Row k="보관 기간">
              대회 종료 후 30일(2027년 3월 2일)까지 보관하고 지웁니다. 그 전에 지우거나 고치고 싶으면 문의로
              요청해 주세요.
            </Row>
          </dl>
        </Card>

        <Card className="px-5 py-2">
          <dl>
            <Row k="접속 IP">
              주장 코드·운영진 토큰 대입을 막으려고 실패 횟수를 IP별로 셉니다. IP는 되돌릴 수 없는 해시로만
              저장하고, 10분 집계가 끝나면 다음 요청 때 지웁니다.
            </Row>
            <Row k="브라우저 저장소">
              주장 코드는 주장의 브라우저(localStorage)에만 저장되고 로그아웃하면 지워집니다. 운영진 토큰은 탭을
              닫으면 지워지는 저장소(sessionStorage)에 둡니다. 서버로 따로 보내 저장하지 않습니다.
            </Row>
          </dl>
        </Card>

        <Card className="px-5 py-2">
          <dl>
            <Row k="처리 위탁·국외 이전">
              호스팅은 Vercel Inc.(미국), 데이터베이스는 Neon(서버 위치 싱가포르)을 씁니다. 위 정보는 이 두
              서비스의 서버에 저장·처리됩니다. Vercel은 서비스 운영을 위해 접속 기록을 따로 남깁니다.
            </Row>
            <Row k="V-ARCHIVE 조회">
              운영진이 &lsquo;V-ARCHIVE 8B 불러오기&rsquo;를 누를 때만, 선수 닉네임을 V-ARCHIVE(v-archive.net)에 보내 공개된
              8B 티어 점수를 받아 레이팅에 씁니다. 닉네임 외의 정보는 보내지 않습니다.
            </Row>
            <Row k="외부 글꼴">
              글꼴을 Google Fonts와 jsDelivr에서 불러오므로, 페이지를 열 때 이 서비스들에 접속 IP가 전달됩니다.
            </Row>
          </dl>
        </Card>
      </div>

      <p className="mt-6 text-xs text-mute">최종 수정 2026-11-26</p>
    </main>
  );
}
