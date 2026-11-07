/**
 * Traitement couleur d'une photo sur la carte graphique (WebGL 2), avec un secours sur le
 * processeur. Les formules GLSL reprennent exactement celles de color.ts.
 */
import { colorPixel, combine, type ColorParams, type RGB } from './color'
import type { Drawable } from './render'

export type Processed = Drawable & { close(): void }

const VERT = `#version 300 es
in vec2 p;
out vec2 v_uv;
// Image chargée sans retournement (ligne 0 = haut) : on inverse y pour qu'elle sorte à l'endroit.
void main() { v_uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform vec4 u_a0, u_a1;
uniform vec2 u_a2;
uniform float u_hasLook, u_intensity, u_mono, u_fade;
uniform vec4 u_l0, u_l1;
uniform vec2 u_l2;
uniform vec3 u_st, u_ht;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 adjust(vec3 c, vec4 a0, vec4 a1, float vib) {
  c *= exp2(a0.x * 1.2);
  float br = a0.y * 0.35;
  c = br >= 0.0 ? c + (1.0 - c) * br : c * (1.0 + br);
  c = (c - 0.5) * (1.0 + a0.z * 0.75) + 0.5;
  float L = luma(clamp(c, 0.0, 1.0));
  float tone = a1.x * 0.3 * (1.0 - smoothstep(0.0, 0.55, L)) + a0.w * 0.3 * smoothstep(0.45, 1.0, L);
  c += tone;
  c += vec3(a1.y * 0.08 + a1.z * 0.03, -a1.z * 0.06, -a1.y * 0.08 + a1.z * 0.03);
  float L2 = luma(c);
  c = L2 + (c - L2) * (1.0 + a1.w);
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  L2 = luma(c);
  c = L2 + (c - L2) * (1.0 + vib * (1.0 - clamp(sat, 0.0, 1.0)));
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec4 src = texture(u_tex, v_uv);
  vec3 c = src.rgb;
  if (u_a2.y > 0.0) {
    vec3 n = texture(u_tex, v_uv + vec2(u_texel.x, 0.0)).rgb + texture(u_tex, v_uv - vec2(u_texel.x, 0.0)).rgb
           + texture(u_tex, v_uv + vec2(0.0, u_texel.y)).rgb + texture(u_tex, v_uv - vec2(0.0, u_texel.y)).rgb;
    c = clamp(c + u_a2.y * 2.0 * (c - n * 0.25), 0.0, 1.0);
  }
  vec3 base = adjust(c, u_a0, u_a1, u_a2.x);
  if (u_hasLook > 0.5) {
    vec3 f = adjust(base, u_l0, u_l1, u_l2.x);
    if (u_mono > 0.5) f = vec3(luma(f));
    float L = luma(f);
    f += u_st * (1.0 - L) + u_ht * L;
    float fd = u_fade * 0.15;
    f = clamp(fd + f * (1.0 - fd), 0.0, 1.0);
    base = mix(base, f, clamp(u_intensity, 0.0, 1.0));
  }
  o = vec4(base, src.a);
}`

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Netteté (même noyau que le GLSL), appliquée sur une copie des pixels. */
function sharpenCpu(px: Uint8ClampedArray, w: number, h: number, amount: number) {
  if (amount <= 0) return px
  const src = px.slice()
  const k2 = amount * 2
  for (let y = 0; y < h; y++) {
    const yu = Math.max(0, y - 1) * w
    const yd = Math.min(h - 1, y + 1) * w
    const yy = y * w
    for (let x = 0; x < w; x++) {
      const xl = Math.max(0, x - 1)
      const xr = Math.min(w - 1, x + 1)
      const i = (yy + x) * 4
      for (let k = 0; k < 3; k++) {
        const c = src[i + k]
        const n = src[(yy + xr) * 4 + k] + src[(yy + xl) * 4 + k] + src[(yd + x) * 4 + k] + src[(yu + x) * 4 + k]
        px[i + k] = c + k2 * (c - n * 0.25)
      }
    }
  }
  return px
}

export function processPhotoCpu(source: CanvasImageSource, w: number, h: number, p: ColorParams): Processed {
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ctx.drawImage(source, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const px = sharpenCpu(img.data, w, h, p.adjust.sharpness)
  // Réglages du filtre résolus une fois pour toute l'image (et non par pixel).
  const lookAdjust = p.look ? combine(p.look.adjust) : undefined
  const c: RGB = [0, 0, 0]
  for (let i = 0; i < px.length; i += 4) {
    c[0] = px[i] / 255
    c[1] = px[i + 1] / 255
    c[2] = px[i + 2] / 255
    const [r, g, b] = colorPixel(c, p, lookAdjust)
    px[i] = r * 255
    px[i + 1] = g * 255
    px[i + 2] = b * 255
  }
  ctx.putImageData(img, 0, 0)
  return { source: canvas, width: w, height: h, close: () => {} }
}

interface Gl {
  gl: WebGL2RenderingContext
  canvas: AnyCanvas
  prog: WebGLProgram
  u: Record<string, WebGLUniformLocation | null>
  maxSize: number
}

function initGl(): Gl | null {
  try {
    const canvas = makeCanvas(1, 1)
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false }) as WebGL2RenderingContext | null
    if (!gl) return null
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    // Sans retournement : cette option est ignorée pour les ImageBitmap, on retourne dans le shader.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    const names = ['u_tex', 'u_texel', 'u_a0', 'u_a1', 'u_a2', 'u_hasLook', 'u_intensity', 'u_mono', 'u_fade', 'u_l0', 'u_l1', 'u_l2', 'u_st', 'u_ht']
    const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]))
    return { gl, canvas, prog, u, maxSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number }
  } catch {
    return null
  }
}

let shared: Gl | null | undefined

/** Textures déjà envoyées à la carte graphique : un curseur de réglage ne renvoie pas 20 photos par image. */
const MAX_TEXTURES = 24
const textures = new Map<TexImageSource, WebGLTexture>()

function textureFor(g: Gl, source: TexImageSource): WebGLTexture {
  const { gl } = g
  const hit = textures.get(source)
  if (hit) {
    // Entrée remise en fin de liste : la plus ancienne est évincée en premier.
    textures.delete(source)
    textures.set(source, hit)
    return hit
  }
  if (textures.size >= MAX_TEXTURES) {
    const [oldSource, oldTex] = textures.entries().next().value!
    textures.delete(oldSource)
    gl.deleteTexture(oldTex)
  }
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  textures.set(source, tex)
  return tex
}

/** À appeler quand une image source est libérée (bitmap fermé). */
export function forgetTexture(source: TexImageSource) {
  const tex = textures.get(source)
  if (!tex) return
  textures.delete(source)
  shared?.gl.deleteTexture(tex)
}

function processGl(g: Gl, source: TexImageSource, w: number, h: number, p: ColorParams): Processed {
  const { gl, canvas, u } = g
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  gl.viewport(0, 0, w, h)
  gl.bindTexture(gl.TEXTURE_2D, textureFor(g, source))
  const a = p.adjust
  gl.uniform1i(u.u_tex, 0)
  gl.uniform2f(u.u_texel, 1 / w, 1 / h)
  gl.uniform4f(u.u_a0, a.exposure, a.brightness, a.contrast, a.highlights)
  gl.uniform4f(u.u_a1, a.shadows, a.warmth, a.tint, a.saturation)
  gl.uniform2f(u.u_a2, a.vibrance, a.sharpness)
  const look = p.look
  const la = { exposure: 0, brightness: 0, contrast: 0, highlights: 0, shadows: 0, warmth: 0, tint: 0, saturation: 0, vibrance: 0, ...(look?.adjust ?? {}) }
  gl.uniform1f(u.u_hasLook, look && p.intensity > 0 ? 1 : 0)
  gl.uniform1f(u.u_intensity, p.intensity)
  gl.uniform1f(u.u_mono, look?.mono ? 1 : 0)
  gl.uniform1f(u.u_fade, look?.fade ?? 0)
  gl.uniform4f(u.u_l0, la.exposure, la.brightness, la.contrast, la.highlights)
  gl.uniform4f(u.u_l1, la.shadows, la.warmth, la.tint, la.saturation)
  gl.uniform2f(u.u_l2, la.vibrance, 0)
  gl.uniform3f(u.u_st, ...(look?.shadowTint ?? [0, 0, 0]))
  gl.uniform3f(u.u_ht, ...(look?.highlightTint ?? [0, 0, 0]))
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  // Copie du résultat : le contexte WebGL est partagé entre toutes les photos.
  if ('transferToImageBitmap' in canvas) {
    const bitmap = canvas.transferToImageBitmap()
    return { source: bitmap, width: w, height: h, close: () => bitmap.close() }
  }
  const copy = makeCanvas(w, h)
  ;(copy.getContext('2d') as CanvasRenderingContext2D).drawImage(canvas, 0, 0)
  return { source: copy, width: w, height: h, close: () => {} }
}

/**
 * Applique réglages et filtre à une image, à la taille (w, h). Carte graphique si possible ;
 * sinon (ou image plus grande que ce qu'elle accepte), calcul sur le processeur.
 */
export function processPhoto(source: CanvasImageSource & TexImageSource, w: number, h: number, p: ColorParams): Processed {
  if (shared === undefined) shared = initGl()
  if (shared?.gl.isContextLost()) {
    // Contexte perdu (onglet en arrière-plan sur mobile) : on le recrée à l'appel suivant.
    textures.clear()
    shared = initGl()
  }
  if (shared && w <= shared.maxSize && h <= shared.maxSize) {
    try {
      return processGl(shared, source, w, h, p)
    } catch {
      textures.clear()
      shared = null
    }
  }
  return processPhotoCpu(source, w, h, p)
}

/** Pour les tests et le diagnostic : moteur utilisé. */
export function processorKind(): 'webgl' | 'cpu' {
  if (shared === undefined) shared = initGl()
  return shared ? 'webgl' : 'cpu'
}
