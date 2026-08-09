// components/three/ArcBackground.tsx
//
// 3D Animated Golden Suspension Bridge — Matched strictly to the Bridgr logo identity:
//   - Metallic Gold (#F4D98A / #C8922A / #A6741C) suspension bridge arch, twin pillars & cable stay network.
//   - Streaming golden particles along the bridge deck and arch curve.
//   - Interactive mouse parallax & phase-based illumination.
//   - Adaptive fallback for reduced motion.

'use client';

import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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
// Color Tokens — Logo Palette
// ─────────────────────────────────────────────────────────────────────────────

const GOLD_LIGHT = new THREE.Color('#F4D98A');
const GOLD_MID = new THREE.Color('#C8922A');
const GOLD_DEEP = new THREE.Color('#A6741C');
const TEAL_ACCENT = new THREE.Color('#0891B2');

const SOURCE_POS = new THREE.Vector3(-3.4, 0.3, 0);
const DEST_POS = new THREE.Vector3(3.4, 0.3, 0);

function buildArcCurve() {
  return new THREE.CatmullRomCurve3([
    SOURCE_POS.clone(),
    new THREE.Vector3(-2.0, 2.2, 0.3),
    new THREE.Vector3(0, 2.8, 0.4),
    new THREE.Vector3(2.0, 2.2, 0.3),
    DEST_POS.clone(),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D Logo Bridge Structure (Pillars, Arch, Deck & Cable Stays)
// ─────────────────────────────────────────────────────────────────────────────

function LogoBridge3D({ phase, theme }: { phase: BridgePhase; theme: 'dark' | 'light' }) {
  const isDark = theme === 'dark';
  const groupRef = useRef<THREE.Group>(null);

  const curve = useMemo(() => buildArcCurve(), []);
  const archGeometry = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.07, 10, false), [curve]);

  // Cablestay anchor positions
  const cables = useMemo(() => {
    const xs = [-2.5, -1.8, -1.1, -0.4, 0.4, 1.1, 1.8, 2.5];
    return xs.map((x) => {
      const t = (x + 3.4) / 6.8;
      const point = curve.getPoint(t);
      const deckY = 0.3;
      const height = Math.max(0.1, point.y - deckY);
      return { x, deckY, archY: point.y, height, z: point.z };
    });
  }, [curve]);

  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: GOLD_LIGHT,
        emissive: GOLD_MID,
        emissiveIntensity: isDark ? 0.75 : 0.45,
        metalness: 0.92,
        roughness: 0.18,
      }),
    [isDark]
  );

  const cableMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: GOLD_MID,
        emissive: GOLD_DEEP,
        emissiveIntensity: 0.5,
        metalness: 0.85,
        roughness: 0.25,
      }),
    []
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    // Gentle ambient floating & subtle sway matching logo majesty
    groupRef.current.rotation.y = Math.sin(t * 0.2) * 0.05;
    groupRef.current.position.y = Math.sin(t * 0.4) * 0.04 - 0.2;

    const pulse = phase === 'idle' ? 0.75 : 1.2;
    goldMat.emissiveIntensity = (isDark ? 0.65 : 0.4) + Math.sin(t * pulse * 2) * 0.15;
  });

  return (
    <group ref={groupRef}>
      {/* Main Curved Bridge Arch */}
      <mesh geometry={archGeometry} material={goldMat} />

      {/* Left Pillar */}
      <mesh position={[-3.4, 1.1, 0]} material={goldMat}>
        <boxGeometry args={[0.28, 2.6, 0.28]} />
      </mesh>
      <mesh position={[-3.4, 2.45, 0]} material={goldMat}>
        <boxGeometry args={[0.36, 0.12, 0.36]} />
      </mesh>

      {/* Right Pillar */}
      <mesh position={[3.4, 1.1, 0]} material={goldMat}>
        <boxGeometry args={[0.28, 2.6, 0.28]} />
      </mesh>
      <mesh position={[3.4, 2.45, 0]} material={goldMat}>
        <boxGeometry args={[0.36, 0.12, 0.36]} />
      </mesh>

      {/* Main Bridge Deck Bar */}
      <mesh position={[0, 0.3, 0]} material={goldMat}>
        <boxGeometry args={[7.4, 0.12, 0.4]} />
      </mesh>

      {/* Vertical Cables */}
      {cables.map((c, i) => (
        <mesh key={i} position={[c.x, c.deckY + c.height / 2, c.z]} material={cableMat}>
          <cylinderGeometry args={[0.015, 0.015, c.height, 8]} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain Nodes (Floating Source Gold & Destination Glowing Spheres)
// ─────────────────────────────────────────────────────────────────────────────

function ChainNode({
  position,
  color,
  isActive,
  side,
  theme,
}: {
  position: THREE.Vector3;
  color: THREE.Color;
  isActive: boolean;
  side: 'source' | 'dest';
  theme: 'dark' | 'light';
}) {
  const innerRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!innerRef.current) return;

    const floatY = Math.sin(t * 0.8 + (side === 'dest' ? Math.PI : 0)) * 0.1;
    innerRef.current.position.y = position.y + floatY;

    if (ringRef.current) {
      ringRef.current.position.y = position.y + floatY;
      ringRef.current.rotation.z = t * (side === 'source' ? 0.6 : -0.5);
      ringRef.current.rotation.x = Math.sin(t * 0.4) * 0.3;
    }

    const innerMat = innerRef.current.material as THREE.MeshStandardMaterial;
    innerMat.emissiveIntensity = isActive ? 0.9 + Math.sin(t * 3) * 0.4 : 0.4;
  });

  return (
    <group>
      {/* Inner Core */}
      <mesh ref={innerRef} position={[position.x, position.y, position.z]}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.15}
          metalness={0.92}
        />
      </mesh>

      {/* Orbital Ring */}
      <mesh ref={ringRef} position={[position.x, position.y, position.z]} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[0.48, 0.012, 8, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Golden Particles Streaming Along Bridge Arch & Deck
// ─────────────────────────────────────────────────────────────────────────────

function ArcParticles({ phase, theme, particleCount }: { phase: BridgePhase; theme: 'dark' | 'light'; particleCount: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const curve = useMemo(() => buildArcCurve(), []);

  const particleData = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      t: i / particleCount,
      speed: 0.06 + Math.random() * 0.09,
    }));
  }, [particleCount]);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    return { positions: pos, colors: col };
  }, [particleCount]);

  const progressRef = useRef(particleData.map((d) => d.t));

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    const speedMult = phase === 'burn' || phase === 'mint' ? 1.2 : 0.25;

    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = pointsRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;

    for (let i = 0; i < particleCount; i++) {
      progressRef.current[i] += delta * speedMult * particleData[i].speed;
      if (progressRef.current[i] > 1.0) progressRef.current[i] -= 1.0;

      const pt = curve.getPoint(progressRef.current[i]);
      const jitter = 0.05;
      posAttr.setXYZ(
        i,
        pt.x + (Math.random() - 0.5) * jitter,
        pt.y + (Math.random() - 0.5) * jitter - 0.2,
        pt.z + (Math.random() - 0.5) * jitter
      );

      const ratio = progressRef.current[i];
      const col = new THREE.Color().lerpColors(GOLD_LIGHT, GOLD_MID, ratio);
      const brightness = 0.7 + Math.sin(t * 3.5 + i * 0.4) * 0.3;
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
        opacity={theme === 'dark' ? 0.9 : 0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient Starfield
// ─────────────────────────────────────────────────────────────────────────────

function AmbientStars({ theme }: { theme: 'dark' | 'light' }) {
  const ref = useRef<THREE.Points>(null);
  const count = 500;

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 35;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 35 - 10;
      const c = new THREE.Color().lerpColors(GOLD_MID, GOLD_DEEP, Math.random());
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.005;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={theme === 'dark' ? 0.4 : 0.15}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mouse Parallax Wrapper
// ─────────────────────────────────────────────────────────────────────────────

function ParallaxGroup({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += (state.pointer.x * 0.2 - groupRef.current.rotation.y) * 0.04;
    groupRef.current.rotation.x += (-state.pointer.y * 0.12 - groupRef.current.rotation.x) * 0.04;
  });
  return <group ref={groupRef}>{children}</group>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Scene Composition
// ─────────────────────────────────────────────────────────────────────────────

function BridgeScene({ phase, theme, particleCount }: { phase: BridgePhase; theme: 'dark' | 'light'; particleCount: number }) {
  const isDark = theme === 'dark';
  const isActive = phase !== 'idle';

  return (
    <>
      <ambientLight intensity={isDark ? 0.6 : 0.95} />
      <pointLight position={[0, 4, 3]} intensity={isDark ? 2.5 : 1.8} color={GOLD_LIGHT} />
      <pointLight position={[0, -2, 3]} intensity={isDark ? 1.2 : 0.8} color={GOLD_MID} />

      <ParallaxGroup>
        <AmbientStars theme={theme} />
        <LogoBridge3D phase={phase} theme={theme} />
        <ArcParticles phase={phase} theme={theme} particleCount={particleCount} />
        <ChainNode
          position={SOURCE_POS}
          color={GOLD_LIGHT}
          isActive={isActive && (phase === 'approve' || phase === 'burn')}
          side="source"
          theme={theme}
        />
        <ChainNode
          position={DEST_POS}
          color={GOLD_MID}
          isActive={isActive && (phase === 'mint' || phase === 'success')}
          side="dest"
          theme={theme}
        />
      </ParallaxGroup>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Static Fallback
// ─────────────────────────────────────────────────────────────────────────────

function StaticFallback({ theme }: { theme: 'dark' | 'light' }) {
  const isDark = theme === 'dark';
  return (
    <div
      className="absolute inset-0"
      style={{
        background: isDark
          ? 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(244,217,138,0.15), rgba(200,146,42,0.08) 55%, #0A0A0A 85%)'
          : 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(244,217,138,0.10), rgba(200,146,42,0.05) 55%, #FAFAF8 80%)',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

export default function ArcBackground({ isWalletConnected = false, theme = 'dark' }: ArcBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<BridgePhase>('idle');
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [particleCount, setParticleCount] = useState(120);

  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4;
    const base = cores >= 8 ? 180 : cores >= 4 ? 130 : 70;
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

  // Deep obsidian luxury dark background matching the logo's radial background (#1C1C1C to #0A0A0A)
  const wrapperBg = isDark ? 'bg-[#0A0A0A]' : 'bg-[#FAF7F0]';

  const radialOverlay = isDark
    ? 'bg-[radial-gradient(ellipse_80%_65%_at_50%_40%,#1C1C1C_0%,rgba(200,146,42,0.12)_45%,#0A0A0A_100%)]'
    : 'bg-[radial-gradient(ellipse_80%_65%_at_50%_40%,rgba(244,217,138,0.18)_0%,rgba(200,146,42,0.06)_55%,#FAF7F0_100%)]';

  return (
    <div className={`fixed inset-0 z-[-1] pointer-events-none w-screen h-screen select-none overflow-hidden ${wrapperBg} transition-colors duration-500`}>
      {/* Radial Gold Ambient Background overlay */}
      <div className={`absolute inset-0 ${radialOverlay} pointer-events-none`} />

      {/* Gold-tinted grid lattice */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(200,146,42,${isDark ? '0.05' : '0.03'}) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(200,146,42,${isDark ? '0.05' : '0.03'}) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }}
      />

      {/* 3D Scene or Reduced Motion Fallback */}
      {prefersReduced ? (
        <StaticFallback theme={theme} />
      ) : (
        <Canvas
          camera={{ position: [0, 0.8, 6.8], fov: 52 }}
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
