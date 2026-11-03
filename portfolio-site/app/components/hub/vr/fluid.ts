/**
 * Fluid under the cursor (D38 round A feedback): a small GPU simulation that
 * the pointer stirs — velocity in RG, dye in B, the dye's hue in A — and a
 * post effect that bends the picture along the flow and glows where the dye
 * is. One ping-pong pass per frame at 160 px; cheap on any GPU.
 *
 * Not a full Navier–Stokes solve (no pressure projection): the curl term
 * rotates the flow so it swirls instead of streaking, which is what reads as
 * "fluid" behind a cursor. Light-time slows it too, so holding freezes the
 * swirls with everything else.
 */
import { Effect } from "postprocessing";
import * as THREE from "three";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";

const SIM_SIZE = 160;

const simVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const simFragment = /* glsl */ `
precision highp float;
uniform sampler2D tPrev;
uniform vec2 uTexel;
uniform vec2 uPointer;   // uv
uniform vec2 uDelta;     // uv per frame, aspect-corrected
uniform float uDt;
uniform float uAspect;
uniform float uHue;
uniform float uStir;     // 0…1 how much the pointer stirs (0 while it rests)
varying vec2 vUv;

float curlAt(vec2 p) {
  float l = texture2D(tPrev, p - vec2(uTexel.x, 0.0)).g;
  float r = texture2D(tPrev, p + vec2(uTexel.x, 0.0)).g;
  float b = texture2D(tPrev, p - vec2(0.0, uTexel.y)).r;
  float t = texture2D(tPrev, p + vec2(0.0, uTexel.y)).r;
  return (r - l) - (t - b);
}

void main() {
  vec4 here = texture2D(tPrev, vUv);
  // Semi-Lagrangian advection: look back along the flow.
  vec2 back = vUv - here.rg * uDt * 2.0;
  vec4 s = texture2D(tPrev, back);
  vec2 v = s.rg;
  float d = s.b;
  float hue = s.a;

  // Vorticity confinement: push the flow around the centres of rotation, so
  // a stroke rolls up into eddies instead of fading as a straight streak.
  float c0 = curlAt(vUv);
  vec2 grad = vec2(
    abs(curlAt(vUv + vec2(uTexel.x, 0.0))) - abs(curlAt(vUv - vec2(uTexel.x, 0.0))),
    abs(curlAt(vUv + vec2(0.0, uTexel.y))) - abs(curlAt(vUv - vec2(0.0, uTexel.y))));
  vec2 N = grad / (length(grad) + 1e-5);
  v += vec2(N.y, -N.x) * c0 * 7.0 * uDt;

  // A touch of diffusion keeps it soft.
  vec2 blur = (texture2D(tPrev, vUv - vec2(uTexel.x, 0.0)).rg + texture2D(tPrev, vUv + vec2(uTexel.x, 0.0)).rg
             + texture2D(tPrev, vUv - vec2(0.0, uTexel.y)).rg + texture2D(tPrev, vUv + vec2(0.0, uTexel.y)).rg) * 0.25;
  v = mix(v, blur, 0.1);

  // Dissipate.
  v *= exp(-uDt * 0.8);
  d *= exp(-uDt * 0.75);

  // Splat where the pointer moved: a narrow stroke, the flow spreads it.
  vec2 dp = (vUv - uPointer) * vec2(uAspect, 1.0);
  float g = exp(-dot(dp, dp) / 0.0012) * uStir;
  v += uDelta * g * 2.4;
  float add = length(uDelta) * g * 7.0;
  hue = mix(hue, uHue, clamp(add * 2.0, 0.0, 1.0));
  d = min(d + add, 1.6);
  // Never let the flow run away.
  float vl = length(v);
  if (vl > 0.3) v *= 0.3 / vl;

  gl_FragColor = vec4(v, d, hue);
}
`;

export class FluidSim {
  private rt: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private pointer = new THREE.Vector2(0.5, 0.5);
  private hasPointer = false;
  private flip = 0;
  private width = SIM_SIZE;
  private height = SIM_SIZE;
  private cleared = false;

  constructor() {
    const make = () =>
      new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
      });
    this.rt = [make(), make()];
    this.material = new THREE.ShaderMaterial({
      vertexShader: simVertex,
      fragmentShader: simFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tPrev: { value: null },
        uTexel: { value: new THREE.Vector2(1 / SIM_SIZE, 1 / SIM_SIZE) },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uDelta: { value: new THREE.Vector2() },
        uDt: { value: 0 },
        uAspect: { value: 1 },
        uHue: { value: 0 },
        uStir: { value: 0 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /** The latest state (velocity.rg, dye.b, hue.a). */
  get texture(): THREE.Texture {
    return this.rt[this.flip].texture;
  }

  setSize(width: number, height: number) {
    const aspect = width / Math.max(1, height);
    const w = aspect >= 1 ? SIM_SIZE : Math.round(SIM_SIZE * aspect);
    const h = aspect >= 1 ? Math.round(SIM_SIZE / aspect) : SIM_SIZE;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.cleared = false;
    for (const t of this.rt) t.setSize(w, h);
    (this.material.uniforms.uTexel.value as THREE.Vector2).set(1 / w, 1 / h);
    this.material.uniforms.uAspect.value = aspect;
  }

  /**
   * One step. `px, py` are the pointer in NDC (−1…1); `dt` is light-time (slowed
   * while holding), `hue` 0…1 the colour new dye takes.
   */
  step(gl: THREE.WebGLRenderer, px: number, py: number, dt: number, hue: number) {
    const u = this.material.uniforms;
    const nx = px * 0.5 + 0.5;
    const ny = py * 0.5 + 0.5;
    const aspect = u.uAspect.value as number;
    const delta = u.uDelta.value as THREE.Vector2;
    if (this.hasPointer) delta.set((nx - this.pointer.x) * aspect, ny - this.pointer.y);
    else delta.set(0, 0);
    this.hasPointer = true;
    // Clamp wild jumps (tab switch, first move) so the sim never explodes.
    if (delta.length() > 0.12) delta.setLength(0.12);
    this.pointer.set(nx, ny);
    (u.uPointer.value as THREE.Vector2).copy(this.pointer);
    u.uDt.value = Math.min(dt, 0.05);
    u.uHue.value = hue;
    u.uStir.value = delta.lengthSq() > 1e-8 ? 1 : 0;

    const read = this.rt[this.flip];
    const write = this.rt[1 - this.flip];
    u.tPrev.value = read.texture;
    const prevTarget = gl.getRenderTarget();
    const prevAutoClear = gl.autoClear;
    if (!this.cleared) {
      // Fresh targets hold whatever the driver left there: start from still water.
      this.cleared = true;
      const c = gl.getClearColor(new THREE.Color());
      const a = gl.getClearAlpha();
      gl.setClearColor(0x000000, 0);
      for (const t of this.rt) {
        gl.setRenderTarget(t);
        gl.clear(true, false, false);
      }
      gl.setClearColor(c, a);
    }
    gl.autoClear = false;
    gl.setRenderTarget(write);
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(prevTarget);
    gl.autoClear = prevAutoClear;
    this.flip = 1 - this.flip;
  }

  dispose() {
    for (const t of this.rt) t.dispose();
    this.material.dispose();
  }
}

const effectFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform sampler2D tFluid;
uniform float uBend;
uniform float uGlow;

void mainUv(inout vec2 uv) {
  vec2 v = texture2D(tFluid, uv).rg;
  uv -= v * uBend;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 f = texture2D(tFluid, uv);
  float d = f.b;
  vec3 glow = mix(vec3(1.0), spectrum(f.a), 0.6) * d * d * uGlow;
  outputColor = vec4(inputColor.rgb + glow, inputColor.a);
}
`;

/** Bends the frame along the fluid's velocity and adds the dye as light. */
export class FluidEffect extends Effect {
  constructor(texture: THREE.Texture) {
    super("FluidEffect", effectFragment, {
      uniforms: new Map<string, THREE.Uniform>([
        ["tFluid", new THREE.Uniform(texture)],
        ["uBend", new THREE.Uniform(0.16)],
        ["uGlow", new THREE.Uniform(0.3)],
      ]),
    });
  }
  setTexture(texture: THREE.Texture) {
    this.uniforms.get("tFluid")!.value = texture;
  }
}
