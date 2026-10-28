var e=()=>matchMedia(`(prefers-reduced-motion: reduce)`).matches,t=`
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`,n=`
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
`;function r(e){let t=getComputedStyle(document.documentElement).getPropertyValue(e).trim(),n=/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(t);return n===null?[0,0,0]:[Number.parseInt(n[1]??`0`,16)/255,Number.parseInt(n[2]??`0`,16)/255,Number.parseInt(n[3]??`0`,16)/255]}function i(e,t,n){let r=e.createShader(t);return r===null?null:(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)===!0?r:null)}function a(e){let a=document.createElement(`canvas`),o=a.getContext(`webgl`,{antialias:!1,alpha:!1,depth:!1});if(o===null)return;let s=i(o,o.VERTEX_SHADER,t),c=i(o,o.FRAGMENT_SHADER,n),l=o.createProgram();if(s===null||c===null||(o.attachShader(l,s),o.attachShader(l,c),o.linkProgram(l),o.getProgramParameter(l,o.LINK_STATUS)!==!0))return;o.useProgram(l),o.bindBuffer(o.ARRAY_BUFFER,o.createBuffer()),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),o.STATIC_DRAW);let u=o.getAttribLocation(l,`position`);o.enableVertexAttribArray(u),o.vertexAttribPointer(u,2,o.FLOAT,!1,0,0);let d=o.getUniformLocation(l,`size`),f=o.getUniformLocation(l,`time`),p=[`c0`,`c1`,`c2`,`c3`].map(e=>o.getUniformLocation(l,e)),m=o.getUniformLocation(l,`strength`),h=()=>{p.forEach((e,t)=>o.uniform3fv(e,r(`--wave-${t}`)));let e=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--wave-strength`));o.uniform1f(m,Number.isFinite(e)?e:1)};h(),new MutationObserver(h).observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let g=()=>{let t=Math.min(devicePixelRatio,1.5);a.width=Math.max(1,Math.round(e.clientWidth*t)),a.height=Math.max(1,Math.round(e.clientHeight*t)),o.viewport(0,0,a.width,a.height),o.uniform2f(d,a.width,a.height)};new ResizeObserver(g).observe(e),g(),e.append(a);let _=!1,v=0,y=performance.now()-2e4,b=e=>{v=0,_&&!document.hidden&&(o.uniform1f(f,(e-y)/1e3),o.drawArrays(o.TRIANGLES,0,3),a.dataset.drawn=``,v=requestAnimationFrame(b))},x=()=>{v===0&&_&&!document.hidden&&(v=requestAnimationFrame(b))};new IntersectionObserver(([e])=>{_=e?.isIntersecting??!1,x()}).observe(e),document.addEventListener(`visibilitychange`,x)}function o(e){matchMedia(`(hover: hover) and (min-width: 52.01rem)`).matches&&(e.addEventListener(`pointermove`,t=>{let n=e.getBoundingClientRect(),r=(t.clientX-n.left)/n.width-.5,i=(t.clientY-n.top)/n.height-.5;e.style.setProperty(`--ry`,`${(r*6).toFixed(2)}deg`),e.style.setProperty(`--rx`,`${(-i*5).toFixed(2)}deg`)}),e.addEventListener(`pointerleave`,()=>{e.style.setProperty(`--ry`,`0deg`),e.style.setProperty(`--rx`,`0deg`)}))}function s(){document.querySelectorAll(`[data-spotlight]`).forEach(e=>{e.addEventListener(`pointermove`,t=>{let n=e.getBoundingClientRect();e.style.setProperty(`--mx`,`${t.clientX-n.left}px`),e.style.setProperty(`--my`,`${t.clientY-n.top}px`)})})}function c(){let e=[...document.querySelectorAll(`[data-count]`)],t=new WeakSet,n=e=>{let t=Number(e.dataset.count),n=Number(e.dataset.decimals??`0`),r=performance.now(),i=a=>{let o=Math.min(1,(a-r)/1300),s=1-(1-o)**3;e.textContent=(t*s).toFixed(n),o<1&&requestAnimationFrame(i)};requestAnimationFrame(i)},r=new IntersectionObserver(e=>{for(let i of e){let e=i.target;if(e instanceof HTMLElement){if(t.has(e))i.isIntersecting&&(r.unobserve(e),n(e));else{if(t.add(e),i.isIntersecting){r.unobserve(e);continue}e.style.minWidth=`${e.getBoundingClientRect().width}px`,e.textContent=0 .toFixed(Number(e.dataset.decimals??`0`))}}}},{threshold:.6});for(let t of e)r.observe(t)}function l(){if(e())return;let t=document.querySelector(`[data-waves]`);t!==null&&a(t);let n=t?.closest(`.showcase`);n!=null&&o(n),s(),c()}l();