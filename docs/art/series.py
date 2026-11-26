"""Judgment Line — plates 01 and 16. Same frame, grid and palette as plate 08.
usage: python series.py <fonts_dir> <out_dir>
"""
import random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

FONTS, OUT = sys.argv[1].rstrip("/") + "/", sys.argv[2].rstrip("/") + "/"

S = 2
W, H = 2400, 3200
w, h = W * S, H * S
BG = (11, 13, 17); LINE = (37, 42, 52); MUTE = (138, 144, 157); INK = (231, 233, 238)
CHROME = (200, 205, 214); BLUE = (61, 123, 255); JUDGE = (90, 215, 255); LIVE = (255, 59, 48)

U = 40; M = 6 * U; LANES = 8; LW = (W - 2 * M) / LANES; X0 = M
BEAT = U // 2; JY = 52 * U; TOP = 9 * U; BLUE_LANES = {2, 5}
FIELD_END = JY + 16 * U       # lane dividers stop here, well above the title


def px(v): return int(round(v * S))
def font(name, size): return ImageFont.truetype(FONTS + name, px(size))
def lane_x(i): return X0 + i * LW
def mix(c, a): return tuple(int(BG[j] + (c[j] - BG[j]) * a) for j in range(3))


class Plate:
    def __init__(self):
        self.img = Image.new("RGB", (w, h), BG)
        self.d = ImageDraw.Draw(self.img)
        self.mono = font("IBMPlexMono-Regular.ttf", 15)
        self.mono_b = font("IBMPlexMono-Bold.ttf", 17)
        self.mono_c = font("IBMPlexMono-Regular.ttf", 17)
        self.mono_n = font("IBMPlexMono-Regular.ttf", 14)
        self.head = font("BigShoulders-Bold.ttf", 176)

    def note(self, x, y, nw, nh, col, alpha):
        """Metallic bar: bright top, dark bottom, blended toward BG by alpha (same skin as plate 08)."""
        x0, y0, x1, y1 = px(x), px(y), px(x + nw), px(y + nh)
        hh = max(1, y1 - y0)
        for k in range(hh):
            t = k / max(1, hh - 1)
            f = 1.18 - 0.18 * (t / 0.38) if t < 0.38 else 1.0 - 0.42 * ((t - 0.38) / 0.62)
            c = tuple(min(255, int(ch * f)) for ch in col)
            self.d.line([(x0, y0 + k), (x1 - 1, y0 + k)], fill=mix(c, alpha))

    def lanes(self, end=FIELD_END):
        for i in range(LANES + 1):
            self.d.line([(px(lane_x(i)), px(TOP - U)), (px(lane_x(i)), px(end))], fill=LINE, width=S)
        for i in range(LANES):
            self.d.text((px(lane_x(i) + LW / 2), px(TOP - U - 18)), f"L{i + 1}", font=self.mono, fill=MUTE, anchor="ms")

    def judgment(self, strength=1.0):
        glow = Image.new("RGB", (w, h), (0, 0, 0))
        ImageDraw.Draw(glow).rectangle([px(M - U), px(JY - 3), px(W - M + U), px(JY + 3)],
                                       fill=tuple(int(c * strength) for c in (40, 110, 140)))
        self.img = ImageChops.add(self.img, glow.filter(ImageFilter.GaussianBlur(px(10))))
        self.d = ImageDraw.Draw(self.img)
        self.d.rectangle([px(M - U), px(JY), px(W - M + U), px(JY + 1) - 1], fill=mix(JUDGE, strength))

    def tick(self, y, label=None, major=True):
        self.d.line([(px(M - (28 if major else 18)), px(y)), (px(M - 10), px(y))], fill=MUTE if major else LINE, width=S)
        if label:
            self.d.text((px(M - 40), px(y)), label, font=self.mono, fill=MUTE, anchor="rm")

    def frame(self, plate_no, header_mid, header_right, captions):
        d = self.d
        HY = M - U
        d.text((px(M), px(HY)), "JUDGMENT LINE", font=self.mono_b, fill=MUTE, anchor="ls")
        d.text((px(W / 2), px(HY)), header_mid, font=self.mono_c, fill=MUTE, anchor="ms")
        d.text((px(W - M), px(HY)), header_right, font=self.mono_c, fill=MUTE, anchor="rs")
        d.line([(px(M), px(HY + 22)), (px(W - M), px(HY + 22))], fill=LINE, width=S)
        TY = H - M - 20
        d.text((px(M), px(TY)), "LINK MATCH", font=self.head, fill=INK, anchor="ls")
        d.text((px(W - M), px(TY)), "2027", font=self.head, fill=CHROME, anchor="rs")
        CY = H - M + 2 * U
        cells = [(0, f"PLATE {plate_no}", True)] + [(li, t, False) for li, t in captions] + [(7, "01.30—31", False)]
        for li, t, bold in cells:
            x, anchor = (W - M, "rs") if li == 7 else (lane_x(li), "ls")
            d.text((px(x), px(CY)), t, font=self.mono_b if bold else self.mono_c, fill=MUTE, anchor=anchor)
        for cx, cy, sx, sy in [(M / 2, M / 2, 1, 1), (W - M / 2, M / 2, -1, 1), (M / 2, H - M / 2, 1, -1), (W - M / 2, H - M / 2, -1, -1)]:
            d.line([(px(cx), px(cy)), (px(cx + sx * 36), px(cy))], fill=LINE, width=S)
            d.line([(px(cx), px(cy)), (px(cx), px(cy + sy * 36))], fill=LINE, width=S)

    def save(self, name):
        out = self.img.resize((W, H), Image.LANCZOS)
        out.save(OUT + name, optimize=True)
        return out


# ───────────── Plate 01 · thirty: the clock narrows onto the line ─────────────
def plate01():
    p = Plate()
    p.lanes()
    n = 30
    span = JY - 2 * U - (TOP + U)
    FW = W - 2 * M
    for i in range(n):                      # i = 0 → 30 seconds left … i = 29 → 1 second left
        s = n - i
        y = TOP + U + span * i / (n - 1)
        bw = FW * s / n
        a = 0.22 + 0.78 * (i / (n - 1)) ** 1.3
        col = LIVE if s == 1 else CHROME
        p.note(W / 2 - bw / 2, y, bw, 10, col, 1.0 if s == 1 else a)
        if s in (30, 20, 10, 1):
            p.tick(y + 5, f"{s:02d}")
        else:
            p.tick(y + 5, major=False)
    p.judgment()
    # the result, below the line: a single settled note on the centre seam
    RT = JY + 3 * U
    cw = LW * 0.62
    p.note(W / 2 - cw / 2, RT, cw, 22, CHROME, 1.0)
    p.d.text((px(W / 2 + cw / 2 + 10), px(RT + 11)), "01", font=p.mono_n, fill=MUTE, anchor="lm")
    p.frame("01", "1 SECOND · 1 MARK", "COUNTDOWN, OBSERVED", [(2, "30 SECONDS"), (4, "1 PICK")])
    return p.save("judgment-line-plate-01.png")


# ───────────── Plate 16 · settled: every pick at rest on the line ─────────────
def plate16():
    p = Plate()
    p.lanes(end=JY)                         # the field ends at the line: nothing falls any more
    rnd = random.Random(20270131)
    # faint time grid only: the field above is empty now
    rows = int((JY - TOP) / BEAT)
    for r in range(0, rows + 1, 16):
        p.tick(TOP + r * BEAT, f"{r // 16:03d}")
    for r in range(0, rows + 1, 4):
        p.tick(TOP + r * BEAT, major=False)
    p.judgment(strength=0.55)               # the line, quieter after the draft

    NW, NH, GAP = LW * 0.62, 28, 20
    order = list(range(LANES))
    pick_no = {}
    n = 0
    for rd in range(3):
        for i in (order if rd % 2 == 0 else order[::-1]):
            n += 1
            pick_no[(i, rd)] = n
    tiers = [1.0, 0.82, 0.64, 0.48]         # S A B C → brightness
    for i in range(LANES):
        col = BLUE if i in BLUE_LANES else CHROME
        x = lane_x(i) + (LW - NW) / 2
        for rd in range(3):                 # round 1 rests on the line, round 3 on top
            y = JY - 6 - NH - rd * (NH + GAP)
            auto = rnd.random() < 0.12
            tier = min(3, rd + (1 if rnd.random() < 0.4 else 0))
            if auto:
                p.d.rectangle([px(x), px(y), px(x + NW), px(y + NH)], outline=mix(col, 0.7), width=S)
            else:
                p.note(x, y, NW, NH, col, tiers[tier])
            p.d.text((px(x + NW + 10), px(y + NH / 2)), f"{pick_no[(i, rd)]:02d}", font=p.mono_n, fill=MUTE, anchor="lm")
        # captain: a small hollow square above the stack
        cy = JY - 6 - 3 * (NH + GAP) - 18
        cx = lane_x(i) + LW / 2
        p.d.rectangle([px(cx - 7), px(cy - 7), px(cx + 7), px(cy + 7)], outline=MUTE, width=S)
    p.frame("16", "SNAKE ORDER, SETTLED", "AFTER THE LAST PICK", [(2, "8 TEAMS · 3 ROUNDS"), (4, "24 PICKS · 8 CAPTAINS")])
    return p.save("judgment-line-plate-16.png")


if __name__ == "__main__":
    a = plate01()
    b = plate16()
    print("ok", a.size, b.size)
