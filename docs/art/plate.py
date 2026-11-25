"""Judgment Line — plate 08. Renders at 2x and downsamples."""
import random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = "canvas-fonts/"  # IBMPlexMono-Regular/Bold, BigShoulders-Bold (OFL)
OUT = sys.argv[1]

S = 2                      # supersample
W, H = 2400, 3200          # final size
w, h = W * S, H * S

BG = (11, 13, 17)
LINE = (37, 42, 52)
MUTE = (138, 144, 157)
INK = (231, 233, 238)
CHROME = (200, 205, 214)
BLUE = (61, 123, 255)
JUDGE = (90, 215, 255)
LIVE = (255, 59, 48)

def px(v): return int(round(v * S))
def font(name, size): return ImageFont.truetype(FONTS + name, px(size))

img = Image.new("RGB", (w, h), BG)
d = ImageDraw.Draw(img)

# ---- grid geometry (everything is a multiple of U) ----
U = 40
M = 6 * U                     # outer margin 240
LANES = 8
LW = (W - 2 * M) / LANES      # lane width 240
X0 = M
BEAT = U // 2                 # 20px beat grid
JY = 64 * U                   # judgment line at 2560? -> keep room below
JY = 52 * U                   # 2080
TOP = 9 * U                   # 360: rain starts
BLUE_LANES = {2, 5}

def lane_x(i): return X0 + i * LW

RT = JY + 3 * U
RH = 4 * U
CH = 22
CURRENT = 21
# lane dividers (full height of field)
for i in range(LANES + 1):
    x = lane_x(i)
    d.line([(px(x), px(TOP - U)), (px(x), px(RT + 3 * RH + CH + U))], fill=LINE, width=max(1, S))

# ---- note skin ----
def note(x, y, nw, nh, col, alpha):
    """Metallic bar: bright top, dark bottom, blended toward BG by alpha."""
    x0, y0, x1, y1 = px(x), px(y), px(x + nw), px(y + nh)
    hh = max(1, y1 - y0)
    for k in range(hh):
        t = k / max(1, hh - 1)
        # vertical gradient: highlight -> base -> shadow
        if t < 0.38:
            f = 1.18 - 0.18 * (t / 0.38)
        else:
            f = 1.0 - 0.42 * ((t - 0.38) / 0.62)
        c = tuple(min(255, int(ch * f)) for ch in col)
        c = tuple(int(BG[j] + (c[j] - BG[j]) * alpha) for j in range(3))
        d.line([(x0, y0 + k), (x1 - 1, y0 + k)], fill=c)

# ---- the rain: patient accumulation toward the line ----
rnd = random.Random(2027)
NW = LW * 0.62
NH = 10
rows = int((JY - TOP) / BEAT)
for i in range(LANES):
    col = BLUE if i in BLUE_LANES else CHROME
    hold_until = -1
    for r in range(rows):
        y = TOP + r * BEAT
        p = (r / rows) ** 1.45                   # density rises toward the line
        a = 0.10 + 0.90 * (r / rows) ** 1.6      # brightness rises toward the line
        if r <= hold_until:
            continue
        if rnd.random() < 0.03 + p * 0.5:
            nx = lane_x(i) + (LW - NW) / 2
            if rnd.random() < 0.035 and r < rows - 8:
                # long note: hairline body with caps
                ln = rnd.choice([4, 6, 8])
                body_c = tuple(int(BG[j] + (col[j] - BG[j]) * a * 0.35) for j in range(3))
                cx = lane_x(i) + LW / 2
                d.rectangle([px(cx - 3), px(y + NH), px(cx + 3), px(y + ln * BEAT)], fill=body_c)
                note(nx, y, NW, NH, col, a)
                note(nx, y + ln * BEAT, NW, NH, col, a)
                hold_until = r + ln + 1
            else:
                note(nx, y, NW, NH, col, a)

# ---- measure ticks on the left: reference markers ----
fm_xs = font("IBMPlexMono-Regular.ttf", 15)
for r in range(0, rows + 1, 16):
    y = TOP + r * BEAT
    d.line([(px(M - 28), px(y)), (px(M - 10), px(y))], fill=MUTE, width=S)
    d.text((px(M - 40), px(y)), f"{r // 16:03d}", font=fm_xs, fill=MUTE, anchor="rm")
for r in range(0, rows + 1, 4):
    y = TOP + r * BEAT
    d.line([(px(M - 18), px(y)), (px(M - 10), px(y))], fill=LINE, width=S)
# lane indices above the field
for i in range(LANES):
    d.text((px(lane_x(i) + LW / 2), px(TOP - U - 18)), f"L{i + 1}", font=fm_xs, fill=MUTE, anchor="ms")

# ---- judgment line: the only cyan ----
glow = Image.new("RGB", (w, h), (0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.rectangle([px(M - U), px(JY - 3), px(W - M + U), px(JY + 3)], fill=(40, 110, 140))
glow = glow.filter(ImageFilter.GaussianBlur(px(10)))
img = Image.composite(img, img, Image.new("L", (w, h), 255))
from PIL import ImageChops
img = ImageChops.add(img, glow)
d = ImageDraw.Draw(img)
d.rectangle([px(M - U), px(JY), px(W - M + U), px(JY + 1) - 1], fill=JUDGE)

# ---- below the line: the record (8 teams x 4 rounds, snake order) ----
RT = JY + 3 * U              # 2200
RH = 4 * U                   # row pitch 160
CW, CH = LW * 0.62, 22
order = []
for rd in range(4):
    seq = range(LANES) if rd % 2 == 0 else reversed(range(LANES))
    for i in seq:
        order.append((rd, i))
centers = []
for rd, i in order:
    cx = lane_x(i) + LW / 2
    cy = RT + rd * RH
    centers.append((cx, cy))

# snake path: hairline, under the notes
path = [(px(x), px(y + CH / 2)) for x, y in centers]
d.line(path[:CURRENT + 1], fill=(78, 84, 98), width=S, joint="curve")
d.line(path[CURRENT:], fill=LINE, width=S, joint="curve")

CURRENT = 21                  # 0-based index of "now": pick 22 (round 3)
fm_num = font("IBMPlexMono-Regular.ttf", 14)
for n, ((rd, i), (cx, cy)) in enumerate(zip(order, centers)):
    if n < CURRENT:
        col = BLUE if i in BLUE_LANES else CHROME
        note(cx - CW / 2, cy, CW, CH, col, 1.0)
        d.text((px(cx + CW / 2 + 10), px(cy + CH / 2)), f"{n + 1:02d}", font=fm_num, fill=MUTE, anchor="lm")
    elif n == CURRENT:
        # the single red mark: an empty slot outlined, a small square at its heart
        d.rectangle([px(cx - CW / 2), px(cy), px(cx + CW / 2), px(cy + CH)], fill=BG, outline=LIVE, width=px(1.5))
        d.rectangle([px(cx - 4), px(cy + CH / 2 - 4), px(cx + 4), px(cy + CH / 2 + 4)], fill=LIVE)
        d.text((px(cx + CW / 2 + 10), px(cy + CH / 2)), f"{n + 1:02d}", font=fm_num, fill=LIVE, anchor="lm")
    else:
        # unfilled slots: outline only
        d.rectangle([px(cx - CW / 2), px(cy), px(cx + CW / 2), px(cy + CH)], fill=BG, outline=LINE, width=S)
# round labels on the left
for rd in range(4):
    y = RT + rd * RH + CH / 2
    d.text((px(M - 40), px(y)), f"R{rd + 1}", font=fm_xs, fill=MUTE, anchor="rm")
    d.line([(px(M - 28), px(y)), (px(M - 10), px(y))], fill=MUTE, width=S)

# ---- typography ----
f_head = font("BigShoulders-Bold.ttf", 176)
f_cap = font("IBMPlexMono-Regular.ttf", 17)
f_capb = font("IBMPlexMono-Bold.ttf", 17)

TY = H - M - 20              # baseline of title
d.text((px(M), px(TY)), "LINK MATCH", font=f_head, fill=INK, anchor="ls")
d.text((px(W - M), px(TY)), "2027", font=f_head, fill=CHROME, anchor="rs")

# caption row under title, aligned to lanes
CY = H - M + 2 * U
caps = [(0, "PLATE 08"), (2, "8 LANES · 8 TEAMS"), (4, "4 ROUNDS · 32 PICKS"), (7, "01.30—31")]
for li, t in caps:
    x = lane_x(li)
    anchor = "ls"
    if li == 7:
        x, anchor = W - M, "rs"
    d.text((px(x), px(CY)), t, font=f_capb if li == 0 else f_cap, fill=MUTE, anchor=anchor)

# header
HY = M - U
d.text((px(M), px(HY)), "JUDGMENT LINE", font=f_capb, fill=MUTE, anchor="ls")
d.text((px(W / 2), px(HY)), "1/16 · QUANTIZED", font=f_cap, fill=MUTE, anchor="ms")
d.text((px(W - M), px(HY)), "SNAKE ORDER, OBSERVED", font=f_cap, fill=MUTE, anchor="rs")
d.line([(px(M), px(HY + 22)), (px(W - M), px(HY + 22))], fill=LINE, width=S)

# crop marks
for cx, cy, sx, sy in [(M / 2, M / 2, 1, 1), (W - M / 2, M / 2, -1, 1), (M / 2, H - M / 2, 1, -1), (W - M / 2, H - M / 2, -1, -1)]:
    d.line([(px(cx), px(cy)), (px(cx + sx * 36), px(cy))], fill=LINE, width=S)
    d.line([(px(cx), px(cy)), (px(cx), px(cy + sy * 36))], fill=LINE, width=S)

img = img.resize((W, H), Image.LANCZOS)
img.save(OUT, optimize=True)
print("saved", OUT)
