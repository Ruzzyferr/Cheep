/**
 * Hero WebGL world — one GPU surface the hero content floats over.
 *   • Aurora shader background (Cheep brand colors flowing over cream)
 *   • Floating refractive glass "price tags" + coins (MeshTransmissionMaterial)
 *   • Lightformer environment (offline, no external HDRI) for real reflections
 *   • Subtle bloom + chromatic aberration post
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScreenQuad, Environment, Lightformer, MeshTransmissionMaterial, Float, RoundedBox } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'

/* ----------------------------------------------------------- aurora shader */
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

    // organic domain warp so the blobs breathe
    vec2 warp = vec2(fbm(p*1.3 + t + m*0.2), fbm(p*1.3 - t + 5.2)) * 0.35;
    vec2 wp = p + warp;

    // animated color-blob centers (biased to the right so the left copy zone stays calm)
    vec2 c1 = vec2((0.78 + 0.10*sin(t*1.10)) * aspect, 0.62 + 0.12*cos(t*0.90)); // forest
    vec2 c2 = vec2((0.92 + 0.09*cos(t*0.85)) * aspect, 0.34 + 0.14*sin(t*1.20)); // clementine
    vec2 c3 = vec2((0.66 + 0.14*sin(t*0.70)) * aspect, 0.50 + 0.13*cos(t*1.05)); // mint
    vec2 c4 = vec2((0.85 + 0.12*sin(t*0.95)) * aspect, 0.80 + 0.10*cos(t*0.75)); // lilac

    float d1 = smoothstep(0.85, 0.0, distance(wp, c1));
    float d2 = smoothstep(0.70, 0.0, distance(wp, c2));
    float d3 = smoothstep(0.95, 0.0, distance(wp, c3));
    float d4 = smoothstep(0.60, 0.0, distance(wp, c4));

    vec3 col = cream;
    col = mix(col, mint,       d3 * 0.85);
    col = mix(col, lilac,      d4 * 0.55);
    col = mix(col, forest,     d1 * 0.80);
    col = mix(col, clementine, d2 * 0.85);

    // keep the far-left third calm & creamy for text legibility
    float leftCalm = smoothstep(0.05, 0.42, uv.x);
    col = mix(cream, col, leftCalm);

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
    <ScreenQuad renderOrder={-10}>
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} depthTest={false} depthWrite={false} />
    </ScreenQuad>
  )
}

/* ----------------------------------------------------------- glass objects */
type TagDef = { pos: [number, number, number]; rot: [number, number, number]; scale: number; color: string; kind: 'tag' | 'coin' }

const TAGS: TagDef[] = [
  { pos: [3.0, 0.3, 0], rot: [0.28, -0.5, 0.16], scale: 0.72, color: '#F89B6F', kind: 'tag' },
  { pos: [4.1, -1.1, -0.8], rot: [-0.2, 0.42, -0.12], scale: 0.6, color: '#7EDBB4', kind: 'tag' },
  { pos: [1.9, -1.9, -0.4], rot: [0.1, 0.2, 0.3], scale: 0.46, color: '#C9B8E8', kind: 'coin' },
  { pos: [4.9, 0.7, -1.6], rot: [0.2, -0.3, -0.2], scale: 0.4, color: '#57C99A', kind: 'coin' },
]

function GlassPiece({ def }: { def: TagDef }) {
  return (
    <Float speed={1.4} rotationIntensity={0.7} floatIntensity={0.9} position={def.pos}>
      <group rotation={def.rot} scale={def.scale}>
        {def.kind === 'tag' ? (
          <RoundedBox args={[1.5, 1, 0.26]} radius={0.14} smoothness={6}>
            <MeshTransmissionMaterial
              backside
              samples={6}
              thickness={0.35}
              roughness={0.05}
              chromaticAberration={0.35}
              anisotropy={0.2}
              distortion={0.15}
              distortionScale={0.3}
              temporalDistortion={0.08}
              ior={1.3}
              color="#ffffff"
              attenuationColor={def.color}
              attenuationDistance={1.6}
            />
          </RoundedBox>
        ) : (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.6, 0.6, 0.16, 48]} />
            <MeshTransmissionMaterial
              backside
              samples={6}
              thickness={0.3}
              roughness={0.06}
              chromaticAberration={0.45}
              ior={1.35}
              color="#ffffff"
              attenuationColor={def.color}
              attenuationDistance={1.4}
            />
          </mesh>
        )}
      </group>
    </Float>
  )
}

function ParallaxGroup({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  useFrame((state) => {
    if (!g.current) return
    g.current.rotation.y += (state.pointer.x * 0.18 - g.current.rotation.y) * 0.05
    g.current.rotation.x += (-state.pointer.y * 0.12 - g.current.rotation.x) * 0.05
  })
  return <group ref={g}>{children}</group>
}

export function HeroCanvas({ className }: { className?: string }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 0, 6], fov: 42 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Aurora />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />

      <ParallaxGroup>
        {TAGS.map((t, i) => (
          <GlassPiece key={i} def={t} />
        ))}
      </ParallaxGroup>

      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3.2} position={[3, 3, 4]} scale={7} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[-4, 1, 2]} scale={6} color="#E8F7EF" />
        <Lightformer form="circle" intensity={2.4} position={[2, -3, 3]} scale={5} color="#FFE0CC" />
        <Lightformer form="ring" intensity={1.6} position={[-2, -2, 2]} scale={3} color="#C9B8E8" />
      </Environment>

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.85} luminanceSmoothing={0.3} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.0006, 0.0006]} radialModulation={false} modulationOffset={0} />
      </EffectComposer>
    </Canvas>
  )
}
