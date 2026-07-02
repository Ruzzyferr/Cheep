/**
 * Hero WebGL — SADECE aurora shader'ı (tek fullscreen fragment shader).
 * Bilinçli olarak sade: transmission cam + postprocessing bazı GPU'larda siyah
 * titreme yapıyordu. Tek geçişli shader en sağlam WebGL'dir; `alpha:true` sayesinde
 * bir sorun olursa arkadaki CSS gradyanı görünür (siyah değil).
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScreenQuad } from '@react-three/drei'
import * as THREE from 'three'

const vertex = /* glsl */ `
  void main(){ gl_Position = vec4(position.xy, 1.0, 1.0); }
`
const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse;

  const vec3 cream      = vec3(0.984, 0.980, 0.965);
  const vec3 forest     = vec3(0.122, 0.435, 0.290);
  const vec3 mint       = vec3(0.341, 0.788, 0.604);
  const vec3 clementine = vec3(0.941, 0.408, 0.169);
  const vec3 lilac      = vec3(0.788, 0.722, 0.910);

  vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
    return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(dot(hash(i),f), dot(hash(i+vec2(1,0)),f-vec2(1,0)),u.x),
               mix(dot(hash(i+vec2(0,1)),f-vec2(0,1)), dot(hash(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;} return v; }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes; float aspect = uRes.x/max(uRes.y,1.0);
    vec2 p = vec2(uv.x*aspect, uv.y); vec2 m = vec2(uMouse.x*aspect, uMouse.y);
    float t = uTime*0.08;

    vec2 warp = vec2(fbm(p*1.3 + t + m*0.2), fbm(p*1.3 - t + 5.2)) * 0.35;
    vec2 wp = p + warp;

    // color blobs spread across the width for a balanced full-bleed field
    vec2 c1 = vec2((0.30 + 0.10*sin(t*1.10)) * aspect, 0.66 + 0.12*cos(t*0.90)); // mint (left)
    vec2 c2 = vec2((0.88 + 0.09*cos(t*0.85)) * aspect, 0.40 + 0.14*sin(t*1.20)); // clementine (right)
    vec2 c3 = vec2((0.60 + 0.14*sin(t*0.70)) * aspect, 0.52 + 0.13*cos(t*1.05)); // forest (center)
    vec2 c4 = vec2((0.78 + 0.12*sin(t*0.95)) * aspect, 0.82 + 0.10*cos(t*0.75)); // lilac (upper-right)

    float d1 = smoothstep(0.90, 0.0, distance(wp, c1));
    float d2 = smoothstep(0.72, 0.0, distance(wp, c2));
    float d3 = smoothstep(0.98, 0.0, distance(wp, c3));
    float d4 = smoothstep(0.60, 0.0, distance(wp, c4));

    vec3 col = cream;
    col = mix(col, mint,       d1 * 0.80);
    col = mix(col, lilac,      d4 * 0.45);
    col = mix(col, forest,     d3 * 0.55);
    col = mix(col, clementine, d2 * 0.80);

    // keep the text zone (upper-left) readable with a soft cream scrim
    float textZone = smoothstep(0.62, 0.18, uv.x) * smoothstep(0.30, 0.95, uv.y);
    col = mix(col, cream, textZone * 0.55);

    // gentle top/bottom fade toward cream
    float edge = smoothstep(0.0,0.14,uv.y) * smoothstep(1.0,0.86,uv.y);
    col = mix(cream, col, mix(0.72, 1.0, edge));

    col += (hash(gl_FragCoord.xy).x)*0.010;
    gl_FragColor = vec4(col, 1.0);
  }
`

function Aurora() {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const { size, viewport } = useThree()
  const mouse = useRef(new THREE.Vector2(0.5, 0.5))
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) } }),
    [],
  )
  useFrame((state) => {
    mat.current.uniforms.uTime.value = state.clock.elapsedTime
    mat.current.uniforms.uRes.value.set(size.width * viewport.dpr, size.height * viewport.dpr)
    mouse.current.x += (state.pointer.x * 0.5 + 0.5 - mouse.current.x) * 0.04
    mouse.current.y += (state.pointer.y * 0.5 + 0.5 - mouse.current.y) * 0.04
    mat.current.uniforms.uMouse.value.copy(mouse.current)
  })
  return (
    <ScreenQuad>
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} depthTest={false} depthWrite={false} />
    </ScreenQuad>
  )
}

export function HeroCanvas({ className }: { className?: string }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.75]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Aurora />
    </Canvas>
  )
}
