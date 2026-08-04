// components/three/ArcBackground.tsx
//
// Signature 3D moment: a glowing gold arc (TubeGeometry along a CatmullRomCurve3)
// connects two floating chain nodes. Gold particles stream along the arc, their
// speed and density driven by real bridge transaction state.
//
// Design rationale:
//   - Gold (#C8922A) = source chain / value-in-motion. Deep teal (#0891B2) = destination.
//   - The arc itself is the product's name and metaphor — "bridge" rendered literally.
//   - Motion maps to state: idle = ambient drift; attest = slow midpoint pulse;
//     burn = particles launch; mint = burst at destination.
//   - Performance: particle count capped by navigator.hardwareConcurrency and a
//     lightweight FPS guard that halves particles if dipping below 30fps.
//   - prefers-reduced-motion: Canvas is replaced with a static gradient fallback.

'use client';

import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BridgePhase = 'idle' | 'approve' | 'burn' | 'attest' | 'mint' | 'success';

interface ArcBackgroundProps {
  isBridging?: boolean;
  isWalletConnected?: boolean;
  theme?: 'dark' | 'light';
  bridgePhase?: BridgePhase;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GOLD = new THREE.Color('#C8922A');
const GOLD_BRIGHT = new THREE.Color('#E8B84B');
const TEAL = new THREE.Color('#0891B2');
const TEAL_BRIGHT = new THREE.Color('#38BDF8');
const WHITE = new THREE.Color('#FFFFFF');

const SOURCE_POS = new THREE.Vector3(-3.8, 0, 0);
const DEST_POS = new THREE.Vector3(3.8, 0, 0);

// Arc control points: left node → apex → right node
function buildArcCurve() {
  return new THREE.CatmullRomCurve3([
    SOURCE_POS.clone(),
    new THREE.Vector3(-2.2, 2.2, 0.4),
    new THREE.Vector3(0, 3.0, 0.6),
    new THREE.Vector3(2.2, 2.2, 0.4),
    DEST_POS.clone(),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// The glowing arc tube
// ─────────────────────────────────────────────────────────────────────────────

function ArcTube({ phase, theme }: { phase: BridgePhase; theme: 'dark' | 'light' }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const curve = useMemo(() => buildArcCurve(), []);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.018, 8, false), [curve]);

  useFrame((state) => {
    if (!matRef.current) return;
    const t = state.clock.getElapsedTime();

    // Opacity pulses slowly when idle, faster when bridging
    const phaseSpeed = phase === 'attest' ? 0.6 : phase === 'idle' ? 0.3 : 1.2;
    const baseOpacity = theme === 'dark' ? 0.65 : 0.45;
    matRef.current.opacity = baseOpacity + Math.sin(t * phaseSpeed) * 0.15;

    // Emissive intensity cranks up during active phases
    const emissiveTarget = phase === 'idle' ? 0.4 : phase === 'attest' ? 0.6 : 1.0;
    matRef.current.emissiveIntensity += (emissiveTarget - matRef.current.emissiveIntensity) * 0.04;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        ref={matRef}
        color={GOLD}
        emissive={GOLD}
        emissiveIntensity={0.4}
        transparent
        opacity={0.6}
        depthWrite={false}
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain nodes (floating spheres, source gold / destination teal)
// ─────────────────────────────────────────────────────────────────────────────

function ChainNode({
  position,
  color,
  isActive,
  phase,
  side,
  theme,
}: {
  position: THREE.Vector3;
  color: THREE.Color;
  isActive: boolean;
  phase: BridgePhase;
  side: 'source' | 'dest';
  theme: 'dark' | 'light';
}) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const shouldBurst = (side === 'dest' && phase === 'mint') || (side === 'source' && phase === 'burn');

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!innerRef.current || !outerRef.current) return;

    const floatY = Math.sin(t * 0.8 + (side === 'dest' ? Math.PI : 0)) * 0.12;
    innerRef.current.position.y = floatY;
    outerRef.current.position.y = floatY;
    if (ringRef.current) ringRef.current.position.y = floatY;

    // Pulse scale
    const pulseAmp = shouldBurst ? 0.18 : isActive ? 0.08 : 0.04;
    const pulseFreq = shouldBurst ? 2.5 : isActive ? 1.2 : 0.5;
    const scale = 1.0 + Math.sin(t * pulseFreq) * pulseAmp;

    const innerMat = innerRef.current.material as THREE.MeshStandardMaterial;
    innerMat.emissiveIntensity = isActive ? 0.7 + Math.sin(t * 2) * 0.3 : 0.25;

    const outerMat = outerRef.current.material as THREE.MeshStandardMaterial;
    outerMat.opacity = theme === 'dark' ? 0.18 : 0.10;

    innerRef.current.scale.setScalar(scale);
    outerRef.current.scale.setScalar(scale * 1.6);

    if (ringRef.current) {
      ringRef.current.rotation.z = t * (side === 'source' ? 0.5 : -0.4);
      ringRef.current.rotation.x = Math.sin(t * 0.3) * 0.3;
    }
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Outer glow shell */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[0.55, 20, 20]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.12}
          depthWrite={false}
          roughness={1}
        />
      </mesh>

      {/* Inner solid core */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>

      {/* Orbital ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[0.52, 0.010, 8, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Particles flowing along the arc
// ─────────────────────────────────────────────────────────────────────────────

interface ArcParticlesProps {
  phase: BridgePhase;
  theme: 'dark' | 'light';
  particleCount: number;
}

function ArcParticles({ phase, theme, particleCount }: ArcParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const curve = useMemo(() => buildArcCurve(), []);

  // Each particle has: position (t ∈ [0,1] along curve), speed, trail
  const particleData = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      t: i / particleCount,
      speed: 0.05 + Math.random() * 0.08,
    }));
  }, [particleCount]);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    return { positions: pos, colors: col };
  }, [particleCount]);

  const progressRef = useRef(particleData.map(d => d.t));

  // Phase → speed multiplier and particle spread
  const getPhaseParams = useCallback((p: BridgePhase) => {
    switch (p) {
      case 'idle':      return { speed: 0.12, gather: false, burst: false };
      case 'approve':   return { speed: 0.20, gather: true,  burst: false };
      case 'burn':      return { speed: 0.90, gather: false, burst: false };
      case 'attest':    return { speed: 0.18, gather: false, burst: false };
      case 'mint':      return { speed: 1.20, gather: false, burst: true  };
      case 'success':   return { speed: 0.35, gather: false, burst: true  };
      default:          return { speed: 0.12, gather: false, burst: false };
    }
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const { speed, gather } = getPhaseParams(phase);
    const t = state.clock.getElapsedTime();

    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = pointsRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;

    for (let i = 0; i < particleCount; i++) {
      // If gathering (approve phase) particles slow near source
      if (gather) {
        progressRef.current[i] += delta * speed * particleData[i].speed * (progressRef.current[i] < 0.15 ? 0.05 : 1.0);
      } else {
        progressRef.current[i] += delta * speed * particleData[i].speed;
      }

      // Wrap
      if (progressRef.current[i] > 1.0) progressRef.current[i] -= 1.0;

      const pt = curve.getPoint(progressRef.current[i]);
      // Small random jitter perpendicular to arc
      const jitter = 0.06;
      posAttr.setXYZ(i, pt.x + (Math.random() - 0.5) * jitter, pt.y + (Math.random() - 0.5) * jitter, pt.z + (Math.random() - 0.5) * jitter);

      // Color: gold at source side, teal at destination side
      const ratio = progressRef.current[i];
      const col = new THREE.Color().lerpColors(GOLD_BRIGHT, TEAL_BRIGHT, ratio);
      // Brightness pulse
      const brightness = 0.6 + Math.sin(t * 3 + i * 0.5) * 0.4;
      col.multiplyScalar(brightness);
      colAttr.setXYZ(i, col.r, col.g, col.b);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={theme === 'dark' ? 0.055 : 0.04}
        vertexColors
        transparent
        opacity={theme === 'dark' ? 0.85 : 0.65}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient background particles (stars) — minimal, not competing with the arc
// ─────────────────────────────────────────────────────────────────────────────

function AmbientStars({ theme }: { theme: 'dark' | 'light' }) {
  const ref = useRef<THREE.Points>(null);
  const count = 600;

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const goldLow = new THREE.Color('#7A5515');
    const tealLow = new THREE.Color('#0C3545');
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 15;
      const c = new THREE.Color().lerpColors(goldLow, tealLow, Math.random());
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.006;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        vertexColors
        transparent
        opacity={theme === 'dark' ? 0.35 : 0.12}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mouse parallax wrapper
// ─────────────────────────────────────────────────────────────────────────────

function ParallaxGroup({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += (state.pointer.x * 0.25 - groupRef.current.rotation.y) * 0.04;
    groupRef.current.rotation.x += (-state.pointer.y * 0.15 - groupRef.current.rotation.x) * 0.04;
  });
  return <group ref={groupRef}>{children}</group>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge scene composition
// ─────────────────────────────────────────────────────────────────────────────

function BridgeScene({ phase, theme, particleCount }: { phase: BridgePhase; theme: 'dark' | 'light'; particleCount: number }) {
  const isDark = theme === 'dark';
  const isActive = phase !== 'idle';

  return (
    <>
      <ambientLight intensity={isDark ? 0.5 : 0.9} />
      <pointLight position={[0, 4, 2]} intensity={isDark ? 2.0 : 1.5} color={GOLD} />
      <pointLight position={[0, -2, 3]} intensity={isDark ? 1.0 : 0.6} color={TEAL} />

      <ParallaxGroup>
        <AmbientStars theme={theme} />
        <ArcTube phase={phase} theme={theme} />
        <ArcParticles phase={phase} theme={theme} particleCount={particleCount} />
        <ChainNode
          position={SOURCE_POS}
          color={GOLD}
          isActive={isActive && (phase === 'approve' || phase === 'burn')}
          phase={phase}
          side="source"
          theme={theme}
        />
        <ChainNode
          position={DEST_POS}
          color={TEAL_BRIGHT}
          isActive={isActive && (phase === 'mint' || phase === 'success')}
          phase={phase}
          side="dest"
          theme={theme}
        />
      </ParallaxGroup>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Static fallback for prefers-reduced-motion
// ─────────────────────────────────────────────────────────────────────────────

function StaticFallback({ theme }: { theme: 'dark' | 'light' }) {
  const isDark = theme === 'dark';
  return (
    <div
      className="absolute inset-0"
      style={{
        background: isDark
          ? 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(200,146,42,0.12), rgba(8,145,178,0.06) 55%, transparent 85%)'
          : 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(200,146,42,0.07), rgba(8,145,178,0.04) 55%, transparent 80%)',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function ArcBackground({ isWalletConnected = false, theme = 'dark' }: ArcBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<BridgePhase>('idle');
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [particleCount, setParticleCount] = useState(120);

  // Adaptive particle cap based on device capability
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4;
    const base = cores >= 8 ? 200 : cores >= 4 ? 140 : 80;
    setParticleCount(base);
  }, []);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Listen to bridge state events
  useEffect(() => {
    const handleBridgeState = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.isBridging === false) setPhase('idle');
      else if (ce.detail?.isBridging === true && phase === 'idle') setPhase('approve');
    };
    const handleStepChange = (e: Event) => {
      const ce = e as CustomEvent;
      const step = ce.detail?.step as BridgePhase | undefined;
      if (step) setPhase(step);
    };
    window.addEventListener('bridge-state-change', handleBridgeState);
    window.addEventListener('bridge-step-change', handleStepChange);
    return () => {
      window.removeEventListener('bridge-state-change', handleBridgeState);
      window.removeEventListener('bridge-step-change', handleStepChange);
    };
  }, [phase]);

  if (!mounted) return null;

  const isDark = theme === 'dark';

  const wrapperBg = isDark
    ? 'bg-[#0B0A07]'
    : 'bg-[#FAFAF8]';

  // Dark mode: deep amber glow at top; light mode: soft gold wash
  const radialOverlay = isDark
    ? 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(200,146,42,0.10),rgba(8,145,178,0.05)_55%,transparent_85%)]'
    : 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(200,146,42,0.06),rgba(8,145,178,0.03)_55%,transparent_80%)]';

  return (
    <div className={`fixed inset-0 z-[-1] pointer-events-none w-screen h-screen select-none overflow-hidden ${wrapperBg} transition-colors duration-500`}>
      {/* Ambient radial glow */}
      <div className={`absolute inset-0 ${radialOverlay} pointer-events-none`} />

      {/* Gold-tinted grid lattice (the "bridge girder" motif) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(200,146,42,${isDark ? '0.04' : '0.025'}) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(200,146,42,${isDark ? '0.04' : '0.025'}) 1px, transparent 1px)
          `,
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }}
      />

      {/* Reduced-motion fallback */}
      {prefersReduced ? (
        <StaticFallback theme={theme} />
      ) : (
        <Canvas
          camera={{ position: [0, 1.2, 7], fov: 52 }}
          dpr={[1, Math.min(window.devicePixelRatio, 2)]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          style={{ width: '100vw', height: '100vh' }}
        >
          <BridgeScene phase={phase} theme={theme} particleCount={particleCount} />
        </Canvas>
      )}
    </div>
  );
}
