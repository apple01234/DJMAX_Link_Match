"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 히어로 배경: 8B(6레인 + L/R 트리거) + 사이드 트랙 리듬게임 기어를 WebGL2 프래그먼트 셰이더 하나로 그린다.
 * 게임 에셋·HUD를 쓰지 않고 장르 문법(수직 낙하, 금속/블루 노트, 좌우 절반을 덮는 트리거 노트와
 * 사이드 트랙 롱노트, 판정선, 키 빔, 6키 + L/R 트리거 키)을 셰이더로 직접 해석했다.
 * 외부 라이브러리 없이 풀스크린 삼각형 1개만 그린다.
 *  - 넓은 화면(≥1280px): 기어를 오른쪽에 두고 왼쪽은 카피용으로 비운다 / 그 외: 가운데 + 감광
 *  - prefers-reduced-motion이면 정지 프레임으로 시작하고, 오른쪽 아래 버튼으로 재생·정지할 수 있다
 *  - 화면 밖으로 나가면 렌더 루프 정지 (IntersectionObserver)
 *  - WebGL2 미지원 시 CSS 그라디언트로 대체
 */

const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uSide;   // 0 = 가운데 + 감광, 1 = 오른쪽 배치, 2 = 화면 패널(가운데, 감광 없음)
out vec4 outColor;

const float LANES = 6.0;                      // 8B = 6레인 + L/R 트리거
const float BPM   = 150.0;
const vec3  CYAN  = vec3(0.35, 0.88, 1.00);
const vec3  SIDE  = vec3(1.00, 0.10, 0.10);   // L/R 트리거 노트 색 (빨강)
const vec3  STICK = vec3(0.28, 0.86, 0.96);   // 사이드 트랙(스틱) 롱노트 색

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 레인 종류: 0 = 은색(금속) 노트, 1 = 블루 노트. 좌우 대칭: S B S | S B S
float laneKind(float i) {
  return (i == 1.0 || i == 4.0) ? 1.0 : 0.0;
}
vec3 laneTint(float kind) {
  return kind > 0.5 ? vec3(0.22, 0.58, 1.00) : vec3(0.82, 0.86, 0.94);
}

// 16분음표 셀마다 노트 유무. 정박일수록 자주 나오게 해서 리듬감을 준다.
float noteAt(float lane, float cell) {
  float m = mod(cell, 4.0);
  float th = m == 0.0 ? 0.64 : (m == 2.0 ? 0.82 : 0.94);
  return step(th, hash(vec2(lane + 1.0, cell)));
}

// 롱노트 시작이면 길이(셀 수), 아니면 0. 정박에서만 시작한다.
float longLen(float lane, float cell) {
  if (mod(cell, 4.0) != 0.0) return 0.0;
  float h = hash(vec2(lane * 3.1 + 7.0, cell * 1.7 + 3.0));
  return h > 0.92 ? 4.0 + 4.0 * floor(hash(vec2(cell, lane + 9.0)) * 3.0) : 0.0;
}

// 사이드 트랙 (side 0 = 왼쪽 절반, 1 = 오른쪽 절반)
// 롱: 16셀(한 마디) 경계에서만 시작, 8 또는 16셀 길이
float sideLong(float side, float cell) {
  if (mod(cell, 16.0) != 0.0) return 0.0;
  float h = hash(vec2(side * 5.0 + 2.0, cell * 0.37 + 1.0));
  return h > 0.78 ? 8.0 + 8.0 * floor(hash(vec2(cell, side + 4.0)) * 2.0) : 0.0;
}
// 단: 8셀(반 마디) 경계에서만
float sideAt(float side, float cell) {
  if (mod(cell, 8.0) != 0.0 || sideLong(side, cell) > 0.0) return 0.0;
  return step(0.58, hash(vec2(side * 17.0 + 31.0, cell)));
}

// 노트 스킨. fy: 노트 안 세로 위치(0 아래 → 1 위), lf: 가로 위치(0..1)
vec3 noteSkin(float kind, float fy, float lf) {
  float across = 1.0 - abs(lf - 0.5) * 2.0;
  float spec = exp(-pow((fy - 0.70) * 4.5, 2.0));             // 상단 반사광 띠
  float rim = smoothstep(0.0, 0.16, fy) * (1.0 - smoothstep(0.86, 1.0, fy));
  vec3 c;
  if (kind > 0.5) {
    c = mix(vec3(0.02, 0.16, 0.70), vec3(0.30, 0.76, 1.00), fy);
    c += vec3(0.75, 0.92, 1.00) * spec * 0.60;
  } else {
    c = mix(vec3(0.36, 0.38, 0.44), vec3(0.84, 0.86, 0.92), fy);
    c += vec3(1.0) * spec * 0.50;
  }
  c *= 0.50 + 0.50 * rim;           // 위·아래 모서리를 어둡게 해서 두께감
  c *= 0.86 + 0.14 * across;        // 가운데가 살짝 밝은 원통형 음영
  return c;
}

vec3 sideSkin(float fy) {
  float spec = exp(-pow((fy - 0.68) * 4.0, 2.0));
  float rim = smoothstep(0.0, 0.14, fy) * (1.0 - smoothstep(0.88, 1.0, fy));
  vec3 c = mix(vec3(0.40, 0.02, 0.02), vec3(1.00, 0.24, 0.22), fy);
  c += vec3(1.0, 0.84, 0.82) * spec * 0.45;
  return c * (0.55 + 0.45 * rim);
}

vec3 stickSkin(float fy) {
  float spec = exp(-pow((fy - 0.68) * 4.0, 2.0));
  float rim = smoothstep(0.0, 0.14, fy) * (1.0 - smoothstep(0.88, 1.0, fy));
  vec3 c = mix(vec3(0.02, 0.30, 0.42), vec3(0.45, 0.92, 1.00), fy);
  c += vec3(0.85, 1.0, 1.0) * spec * 0.45;
  return c * (0.55 + 0.45 * rim);
}

// 레인의 가장 최근 타격으로부터 지난 시간(초). 최근 4셀 안에 없으면 큰 값
float lastHit(float lane, float hitLocal, float beatPx, float speed) {
  float hitCell = floor(hitLocal / beatPx);
  for (int j = 0; j < 4; j++) {
    float c = hitCell - float(j);
    if (noteAt(lane, c) > 0.0 || longLen(lane, c) > 0.0) return (hitLocal - c * beatPx) / speed;
  }
  return 99.0;
}
float lastSideHit(float side, float hitLocal, float beatPx, float speed) {
  float hitCell = floor(hitLocal / beatPx);
  for (int j = 0; j < 3; j++) {
    float c = floor(hitCell / 8.0) * 8.0 - 8.0 * float(j);
    if (sideAt(side, c) > 0.0) return (hitLocal - c * beatPx) / speed;
  }
  return 99.0;
}

// 타격 효과: 하얀 중심, X자 섬광 두 줄기, 퍼지는 고리. d = 타격 지점으로부터의 거리(px), size = 크기 기준(px)
vec3 burst(vec2 d, float dt, float size, vec3 tint, float seed) {
  if (dt > 0.45) return vec3(0.0);
  float fade = exp(-dt * 7.5);
  float r = length(d);
  float ang = 0.785 + (hash(vec2(seed, 7.0)) - 0.5) * 0.35;      // 타격마다 살짝 다른 각도
  vec2 a = vec2(cos(ang), sin(ang));
  vec2 b = vec2(-a.y, a.x);
  float len = size * (0.75 + dt * 2.0);
  float s1 = exp(-abs(dot(d, b)) / 2.4) * exp(-abs(dot(d, a)) / len);
  float s2 = exp(-abs(dot(d, a)) / 2.4) * exp(-abs(dot(d, b)) / len);
  float R = size * (0.22 + dt * 1.9);
  float ring = exp(-pow((r - R) / (size * 0.045), 2.0));
  float core = exp(-r / (size * 0.16));
  vec3 hot = mix(tint, vec3(1.0, 0.96, 0.90), 0.55);
  return (hot * (s1 + s2) * 1.3 + tint * ring * 0.6 + vec3(1.0) * core * 1.0) * fade;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float H = uRes.y;
  bool screen = uSide > 1.5;
  bool wide = uSide > 0.5 && !screen;
  float W = screen ? min(H * 0.62, uRes.x * 0.84) : min(H * 0.50, uRes.x * 0.86);
  float cx = wide ? uRes.x * 0.95 - W * 0.5 : uRes.x * 0.5;
  float left = cx - W * 0.5;
  float lanePx = W / LANES;
  float lx = (px.x - left) / lanePx;

  float judgeY = H * 0.22;
  float keyTop = judgeY - 10.0;
  float keyBot = H * 0.035;
  float split  = keyBot + (keyTop - keyBot) * 0.44;   // 아래: L/R 트리거 키 / 위: 6키
  float speed  = H * 0.80;                       // px / s
  float beatPx = speed * 60.0 / BPM / 4.0;       // 16분음표 간격 (px)
  float noteH  = clamp(lanePx * 0.44, 10.0, 28.0);
  float sideH  = noteH * 1.15;
  float t = uTime;

  // 배경: 기어 뒤로 은은한 앰버 + 블루 광원
  vec3 bg = vec3(0.016, 0.017, 0.024);
  float dxc = abs(px.x - cx) / W;
  bg += vec3(0.50, 0.26, 0.05) * exp(-dxc * 1.6) * exp(-abs(px.y / H - 0.55) * 3.0) * 0.10;
  bg += vec3(0.05, 0.20, 0.45) * exp(-dxc * 2.4) * 0.10;
  vec3 col = bg;

  // 프레임: 크롬 테두리 + 바깥쪽 블루 LED 띠
  float dOut = max(left - px.x, px.x - (left + W));
  if (dOut > 0.0 && dOut < 14.0 && px.y > keyBot - 8.0) {
    float chrome = 0.08 + 0.30 * exp(-pow((dOut - 2.5) / 1.6, 2.0)) + 0.06 * (1.0 - dOut / 14.0);
    col = vec3(chrome, chrome * 1.04, chrome * 1.14);
    float led = step(7.0, dOut) * (1.0 - step(10.0, dOut));
    float dash = 0.35 + 0.65 * step(0.45, fract(px.y / 9.0));
    col += CYAN * led * dash * 0.75;
    col += CYAN * exp(-abs(dOut - 8.5) / 3.0) * 0.12;
  }

  if (lx >= 0.0 && lx < LANES && px.y > keyBot - 8.0) {
    float lane = floor(lx);
    float lf = fract(lx);
    float edgePx = min(lf, 1.0 - lf) * lanePx;
    float kind = laneKind(lane);
    vec3 tint = laneTint(kind);
    float noteMask = smoothstep(1.0, 2.2, edgePx);

    // 사이드 트랙: 기어의 왼쪽/오른쪽 절반
    float side = lx < 3.0 ? 0.0 : 1.0;
    float sx = (lx - side * 3.0) / 3.0;                  // 절반 안 가로 위치 0..1
    float sEdge = min(sx, 1.0 - sx) * 3.0 * lanePx;
    float sMask = smoothstep(1.5, 3.0, sEdge);

    // 기어 내부: 어두운 바탕 + 판정선 위쪽의 따뜻한 글로우
    float gy = (px.y - judgeY) / (H - judgeY);
    vec3 g = vec3(0.020, 0.021, 0.028);
    g += vec3(0.62, 0.34, 0.07) * exp(-pow((gy - 0.30) * 2.0, 2.0)) * 0.20;
    g += vec3(0.06, 0.07, 0.09) * (1.0 - smoothstep(0.4, 1.2, edgePx));   // 희미한 레인 구분선
    g += vec3(0.10, 0.11, 0.14) * (1.0 - smoothstep(0.5, 1.5, abs(lx - 3.0) * lanePx)); // 가운데 분할선
    col = g;

    // 키 빔: 판정선을 마지막으로 지난 노트로부터의 경과 시간
    float hitLocal = t * speed;
    float hitCell = floor(hitLocal / beatPx);
    float beam = 0.0;
    for (int j = 0; j < 4; j++) {
      float c = hitCell - float(j);
      if (noteAt(lane, c) > 0.0 || longLen(lane, c) > 0.0) {
        float dt = (hitLocal - c * beatPx) / speed;
        beam = max(beam, exp(-dt * 7.0));
      }
    }
    for (int j = 0; j < 13; j++) {         // 롱노트를 누르고 있는 중이면 빔 유지
      float c = hitCell - float(j);
      float L = longLen(lane, c);
      if (L > 0.0 && hitLocal - c * beatPx < L * beatPx) beam = max(beam, 0.7);
    }
    // 트리거 빔(tBeam)과 사이드 트랙 빔(lBeam)
    float tBeam = 0.0;
    for (int j = 0; j < 3; j++) {
      float c = floor(hitCell / 8.0) * 8.0 - 8.0 * float(j);
      if (sideAt(side, c) > 0.0) tBeam = max(tBeam, exp(-(hitLocal - c * beatPx) / speed * 6.0));
    }
    float lBeam = 0.0;
    for (int j = 0; j < 2; j++) {
      float c = floor(hitCell / 16.0) * 16.0 - 16.0 * float(j);
      float L = sideLong(side, c);
      if (L > 0.0 && hitLocal - c * beatPx < L * beatPx) lBeam = 0.65;
    }

    if (px.y > judgeY) {
      float local = (px.y - judgeY) + t * speed;
      float cell = floor(local / beatPx);
      float f = local - cell * beatPx;
      float fadeTop = 1.0 - smoothstep(H * 0.86, H, px.y);
      float nearJudge = 1.0 - smoothstep(judgeY, judgeY + H * 0.34, px.y);

      // 빔
      col += tint * beam * 0.22 * nearJudge * noteMask;
      col += SIDE * tBeam * 0.10 * nearJudge * sMask;
      col += STICK * lBeam * 0.08 * nearJudge * sMask;

      // 사이드 트랙(스틱) 롱노트: 절반 폭, 반투명 시안. 일반 노트보다 아래 층
      float sDrawn = 0.0;
      for (int j = 0; j < 2; j++) {
        float c = floor(cell / 16.0) * 16.0 - 16.0 * float(j);
        float L = sideLong(side, c);
        if (L <= 0.0) continue;
        float off = local - c * beatPx;
        float end = L * beatPx;
        if (off >= 0.0 && off < end + sideH) {
          col = mix(col, STICK * 0.42, 0.24 * sMask * fadeTop);
          float edgeGlow = 1.0 - smoothstep(2.0, 6.0, sEdge);         // 몸통 양옆 테두리
          col += STICK * edgeGlow * 0.35 * fadeTop;
          if (off < sideH) col = mix(col, stickSkin(off / sideH), 0.85 * sMask * fadeTop);
          if (off > end)   col = mix(col, stickSkin((off - end) / sideH), 0.85 * sMask * fadeTop);
          sDrawn = 1.0;
        }
      }
      // L/R 트리거 단노트: 절반 폭, 레드
      if (sDrawn == 0.0) {
        float c = floor(cell / 8.0) * 8.0;
        float off = local - c * beatPx;
        if (sideAt(side, c) > 0.0 && off < sideH) {
          col = mix(col, sideSkin(off / sideH), 0.78 * sMask * fadeTop);
        }
      }

      // 롱노트 (최근 13셀 안에서 시작한 것 — 최대 길이 12셀)
      float drawn = 0.0;
      for (int j = 0; j < 13; j++) {
        float c = cell - float(j);
        float L = longLen(lane, c);
        if (L <= 0.0) continue;
        float off = float(j) * beatPx + f;            // 롱노트 시작점으로부터 px
        float end = L * beatPx;
        if (off < end + noteH) {
          float inset = smoothstep(lanePx * 0.12, lanePx * 0.12 + 1.0, edgePx);
          vec3 body = kind > 0.5 ? vec3(0.08, 0.26, 0.62) : vec3(0.40, 0.43, 0.50);
          body *= 0.70 + 0.30 * (1.0 - abs(lf - 0.5) * 2.0);
          col = mix(col, body, inset * 0.62 * fadeTop);
          if (off < noteH) col = mix(col, noteSkin(kind, off / noteH, lf), noteMask * fadeTop);
          if (off > end)   col = mix(col, noteSkin(kind, (off - end) / noteH, lf), noteMask * fadeTop);
          drawn = 1.0;
        }
      }
      // 일반 노트
      if (drawn == 0.0 && noteAt(lane, cell) > 0.0 && f < noteH) {
        col = mix(col, noteSkin(kind, f / noteH, lf), noteMask * fadeTop);
      }
    } else if (px.y < keyTop && px.y > keyBot) {
      vec3 panel = vec3(0.03, 0.035, 0.045);
      if (px.y > split + 3.0) {
        // 6키: 노트가 판정선을 지나면 해당 키 테두리가 켜진다
        float ky = (px.y - split - 3.0) / (keyTop - split - 3.0);
        float capMask = smoothstep(2.5, 4.0, edgePx) * smoothstep(0.04, 0.12, ky) * (1.0 - smoothstep(0.88, 0.96, ky));
        vec3 cap = mix(vec3(0.05, 0.06, 0.08), vec3(0.11, 0.12, 0.16), ky);
        float rimLight = (1.0 - smoothstep(3.5, 6.0, edgePx)) + smoothstep(0.80, 0.88, ky);
        cap += CYAN * rimLight * (0.10 + 0.55 * beam);
        cap = mix(cap, tint * 0.45, beam * 0.45);
        col = mix(panel, cap, capMask);
      } else {
        // L / R 트리거 키: 각 절반(3레인)의 가운데 두 레인 폭
        float kx = side == 0.0 ? (lx - 0.5) / 2.0 : (lx - 3.5) / 2.0;
        float ky = (px.y - keyBot) / (split - keyBot);
        float kEdge = min(kx, 1.0 - kx) * 2.0 * lanePx;
        float inKey = step(0.0, kx) * step(kx, 1.0);
        float capMask = inKey * smoothstep(2.5, 4.0, kEdge) * smoothstep(0.10, 0.20, ky) * (1.0 - smoothstep(0.84, 0.94, ky));
        vec3 cap = mix(vec3(0.05, 0.05, 0.065), vec3(0.11, 0.11, 0.14), ky);
        float rimLight = (1.0 - smoothstep(3.5, 6.0, kEdge)) + smoothstep(0.76, 0.84, ky);
        cap += SIDE * rimLight * (0.08 + 0.55 * tBeam);
        cap = mix(cap, SIDE * 0.40, tBeam * 0.40);
        col = mix(panel, cap, capMask);
      }
    }

    // 히트 플래시
    float dj = abs(px.y - judgeY);
    col += mix(CYAN, tint, 0.5) * beam * exp(-dj / 8.0) * 0.8 * noteMask;
    col += SIDE * tBeam * exp(-dj / 10.0) * 0.35 * sMask;
    col += STICK * lBeam * exp(-dj / 10.0) * 0.25 * sMask;
  }

  // 판정선: 기어 폭 전체, 시안
  if (px.x > left && px.x < left + W) {
    float dj = abs(px.y - judgeY);
    col = mix(col, vec3(0.70, 0.96, 1.00), 1.0 - smoothstep(1.5, 3.0, dj));
    col += CYAN * exp(-dj / 12.0) * 0.30;
  }

  // 타격 효과: 판정선 근처에서만 계산. 섬광이 옆 레인까지 뻗도록 모든 레인을 본다
  float hl = t * speed;
  if (abs(px.y - judgeY) < lanePx * 2.2 && px.x > left - 20.0 && px.x < left + W + 20.0) {
    for (int l = 0; l < 6; l++) {
      float fl = float(l);
      float dt = lastHit(fl, hl, beatPx, speed);
      if (dt < 0.45) {
        vec2 c = vec2(left + (fl + 0.5) * lanePx, judgeY);
        col += burst(px - c, dt, lanePx * 1.1, laneTint(laneKind(fl)) * vec3(1.0, 0.92, 0.80), floor((hl - dt * speed) / beatPx) + fl);
      }
    }
    for (int sd = 0; sd < 2; sd++) {
      float fs = float(sd);
      float dt = lastSideHit(fs, hl, beatPx, speed);
      if (dt < 0.45) {
        vec2 c = vec2(left + (fs * 3.0 + 1.5) * lanePx, judgeY);
        col += burst(px - c, dt, lanePx * 1.5, SIDE, floor((hl - dt * speed) / beatPx) + fs * 13.0) * 0.8;
      }
    }
  }

  // 좁은 화면에서는 카피 가독성을 위해 기어를 어둡게
  if (!wide && !screen) col = mix(bg, col, 0.45);

  // 비네트 + 그레인
  vec2 q = px / uRes - 0.5;
  col *= 1.0 - dot(q, q) * 0.7;
  col += (hash(px + fract(t) * 91.0) - 0.5) * 0.02;

  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

/**
 * placement
 *  - "hero": 넓은 화면(≥1280px)이면 오른쪽, 아니면 가운데에 어둡게 (텍스트 뒤 배경용)
 *  - "screen": 항상 가운데, 감광 없음 (독립된 화면 패널 안에 넣을 때)
 */
export function HeroCanvas({ className, placement = "hero" }: { className?: string; placement?: "hero" | "screen" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  // 재생 상태. null = 아직 모름(첫 렌더). 동작 줄이기 설정이면 멈춘 채 시작하고, 버튼으로 직접 켤 수 있다.
  const [playing, setPlaying] = useState<boolean | null>(null);
  const control = useRef<{ play: () => void; pause: () => void } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) {
      setFallback(true);
      return;
    }

    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link failed");
    } catch (e) {
      console.warn("[HeroCanvas]", e);
      setFallback(true);
      return;
    }
    gl.useProgram(prog);

    // 화면 전체를 덮는 삼각형 1개
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uSide = gl.getUniformLocation(prog, "uSide");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    let playingNow = !reduced;
    let t = 12; // 첫 프레임부터 노트가 화면에 차 있도록 12초 지점에서 시작
    let last = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const draw = (t: number) => {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      // 헤드라인(lg:text-8xl)과 겹치지 않을 만큼 넓을 때만 기어를 오른쪽에 둔다
      gl.uniform1f(uSide, placement === "screen" ? 2 : canvas.clientWidth >= 1280 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // 멈췄다 다시 재생해도 이어지도록 경과 시간을 직접 누적한다
    const loop = (now: number) => {
      if (last) t += Math.min(0.1, (now - last) / 1000);
      last = now;
      draw(t);
      raf = visible && playingNow ? requestAnimationFrame(loop) : 0;
      if (!raf) last = 0;
    };
    const start = () => {
      if (!raf && visible && playingNow) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    control.current = {
      play: () => {
        playingNow = true;
        start();
      },
      pause: () => {
        playingNow = false;
        stop();
      },
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    io.observe(canvas);

    const ro = new ResizeObserver(() => !raf && draw(t));
    ro.observe(canvas);

    setPlaying(playingNow);
    draw(t);
    start();

    return () => {
      control.current = null;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [placement]);

  if (fallback) {
    return (
      <div aria-hidden className={className} style={{ background: "linear-gradient(#05060a, #0b0d14)" }} />
    );
  }
  return (
    <>
      <canvas ref={ref} aria-hidden className={className} />
      {playing !== null && (
        <button
          type="button"
          aria-pressed={playing}
          aria-label={playing ? "기어 애니메이션 멈추기" : "기어 애니메이션 재생"}
          onClick={() => {
            const next = !playing;
            setPlaying(next);
            if (next) control.current?.play();
            else control.current?.pause();
          }}
          title={playing ? "멈추기" : "재생"}
          className="press absolute right-1 bottom-1 z-10 grid size-8 cursor-pointer place-items-center font-mono text-xs text-mute hover:text-ink"
        >
          <span aria-hidden>{playing ? "❚❚" : "▶"}</span>
        </button>
      )}
    </>
  );
}
