/**
 * The landing page's motion: a WebGL wave field behind the showcase, glass cards that lean
 * towards the pointer, a light that follows it over the feature cards, and counters that run up
 * to the measured numbers. Nothing runs
 * with `prefers-reduced-motion`; without WebGL the field stays the CSS gradient under it.
 */

const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// Domain-warped sine bands, strongest towards the bottom of the panel, in four palette colors.
const FRAGMENT = `
precision mediump float;
uniform vec2 size;
uniform float time;
uniform vec3 c0;
uniform vec3 c1;
uniform vec3 c2;
uniform vec3 c3;
uniform float strength;
void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec2 p = vec2(uv.x * size.x / size.y, uv.y);
  float t = time * 0.08;
  for (int i = 1; i < 5; i++) {
    float f = float(i);
    p.x += 0.35 / f * sin(f * 2.1 * p.y + t * 1.3 + 0.3 * f);
    p.y += 0.25 / f * cos(f * 1.7 * p.x - t + 0.5 * f);
  }
  float band = 0.5 + 0.5 * sin(p.x * 1.6 + p.y * 2.4 + t * 0.7);
  float weight = smoothstep(1.15, -0.05, uv.y) * strength;
  vec3 color = mix(c0, c1, smoothstep(0.1, 0.7, band) * weight);
  color = mix(color, c2, smoothstep(0.55, 0.95, band) * weight * 0.9);
  color = mix(color, c3, smoothstep(0.82, 1.0, band) * weight * 0.75);
  gl_FragColor = vec4(color, 1.0);
}
`;

type Rgb = readonly [number, number, number];

/** A palette token (`#rrggbb`) as WebGL color components. */
function token(name: string): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (match === null) return [0, 0, 0];
  return [
    Number.parseInt(match[1] ?? '0', 16) / 255,
    Number.parseInt(match[2] ?? '0', 16) / 255,
    Number.parseInt(match[3] ?? '0', 16) / 255,
  ];
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true ? shader : null;
}

function setUpWaves(host: HTMLElement): void {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false });
  if (gl === null) return;
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (vertex === null || fragment === null) return;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) return;
  gl.useProgram(program);

  // One triangle covering the viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const size = gl.getUniformLocation(program, 'size');
  const time = gl.getUniformLocation(program, 'time');
  const colors = ['c0', 'c1', 'c2', 'c3'].map((name) => gl.getUniformLocation(program, name));
  const strength = gl.getUniformLocation(program, 'strength');
  const applyColors = (): void => {
    colors.forEach((location, index) => gl.uniform3fv(location, token(`--wave-${index}`)));
    const value = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--wave-strength'),
    );
    gl.uniform1f(strength, Number.isFinite(value) ? value : 1);
  };
  applyColors();
  new MutationObserver(applyColors).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  const resize = (): void => {
    const scale = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.max(1, Math.round(host.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(host.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(size, canvas.width, canvas.height);
  };
  new ResizeObserver(resize).observe(host);
  resize();
  host.append(canvas);

  // Drawn only while the panel is on screen and the tab is visible.
  let visible = false;
  let frame = 0;
  const start = performance.now() - 20_000;
  const draw = (now: number): void => {
    frame = 0;
    if (!visible || document.hidden) return;
    gl.uniform1f(time, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.dataset.drawn = '';
    frame = requestAnimationFrame(draw);
  };
  const schedule = (): void => {
    if (frame === 0 && visible && !document.hidden) frame = requestAnimationFrame(draw);
  };
  new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    schedule();
  }).observe(host);
  document.addEventListener('visibilitychange', schedule);
}

/** The glass cards lean a little towards the pointer, on screens wide enough to show them side by side. */
function setUpTilt(showcase: HTMLElement): void {
  if (!matchMedia('(hover: hover) and (min-width: 52.01rem)').matches) return;
  showcase.addEventListener('pointermove', (event) => {
    const box = showcase.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    showcase.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
    showcase.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
  });
  showcase.addEventListener('pointerleave', () => {
    showcase.style.setProperty('--ry', '0deg');
    showcase.style.setProperty('--rx', '0deg');
  });
}

function setUpSpotlights(): void {
  document.querySelectorAll<HTMLElement>('[data-spotlight]').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - box.left}px`);
      card.style.setProperty('--my', `${event.clientY - box.top}px`);
    });
  });
}

/** Counters run up once they scroll into view; numbers already on screen are left alone. */
function setUpCounters(): void {
  const numbers = [...document.querySelectorAll<HTMLElement>('[data-count]')];
  const seen = new WeakSet<Element>();
  const run = (element: HTMLElement): void => {
    const target = Number(element.dataset.count);
    const decimals = Number(element.dataset.decimals ?? '0');
    const begin = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, (now - begin) / 1300);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = (target * eased).toFixed(decimals);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const element = entry.target;
        if (!(element instanceof HTMLElement)) continue;
        if (!seen.has(element)) {
          seen.add(element);
          if (entry.isIntersecting) {
            observer.unobserve(element);
            continue;
          }
          // Keep the number's width, so the unit beside it does not move while it counts.
          element.style.minWidth = `${element.getBoundingClientRect().width}px`;
          element.textContent = (0).toFixed(Number(element.dataset.decimals ?? '0'));
          continue;
        }
        if (entry.isIntersecting) {
          observer.unobserve(element);
          run(element);
        }
      }
    },
    { threshold: 0.6 },
  );
  for (const element of numbers) observer.observe(element);
}

export function setUpLanding(): void {
  if (reducedMotion()) return;
  const field = document.querySelector<HTMLElement>('[data-waves]');
  if (field !== null) setUpWaves(field);
  const showcase = field?.closest<HTMLElement>('.showcase');
  if (showcase !== null && showcase !== undefined) setUpTilt(showcase);
  setUpSpotlights();
  setUpCounters();
}
