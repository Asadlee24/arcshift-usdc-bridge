// components/three/ArcBackground.tsx
// High-performance 3D React Three Fiber background with interactive 3D spheres, glowing orbital rings, dynamic particle field, and mouse parallax

'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ArcBackgroundProps {
  isBridging?: boolean;
  isWalletConnected?: boolean;
  theme?: 'dark' | 'light';
}

// 1. DYNAMIC FLOATING STAR/PARTICLE FIELD
function FloatingParticles({ isBridging = false, theme = 'dark' }: { isBridging?: boolean; theme?: 'dark' | 'light' }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 1800;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    return pos;
  }, [count]);

  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3);
    const emerald = new THREE.Color('#10B981');
    const cyan = new THREE.Color('#06B6D4');
    const purple = new THREE.Color('#8B5CF6');

    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let color: THREE.Color;
      if (rand < 0.5) {
        color = new THREE.Color().lerpColors(emerald, cyan, rand * 2);
      } else {
        color = new THREE.Color().lerpColors(cyan, purple, (rand - 0.5) * 2);
      }
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    return cols;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const speedMult = isBridging ? 3.5 : 1.0;
    pointsRef.current.rotation.y += 0.0004 * speedMult;
    pointsRef.current.rotation.x += 0.0002 * speedMult;

    const positionAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (positionAttr) {
      const drift = (isBridging ? 0.08 : 0.012) * speedMult;
      for (let i = 0; i < positionAttr.count; i++) {
        let y = positionAttr.getY(i);
        y += drift;
        if (y > 35) y = -35;
        positionAttr.setY(i, y);
      }
      positionAttr.needsUpdate = true;
    }
  });

  const particleOpacity = theme === 'dark' ? 0.45 : 0.25;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={theme === 'dark' ? 0.12 : 0.09}
        vertexColors
        transparent
        opacity={particleOpacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// 2. DUAL 3D GEODESIC SPHERES & ORBITAL RINGS
function ArcSphere3D({ isBridging = false, theme = 'dark' }: { isBridging?: boolean; theme?: 'dark' | 'light' }) {
  const outerSphereRef = useRef<THREE.Mesh>(null);
  const innerSphereRef = useRef<THREE.Mesh>(null);
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);
  const ringRef3 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const speed = isBridging ? 2.5 : 1.0;

    if (outerSphereRef.current) {
      outerSphereRef.current.rotation.y = t * 0.08 * speed;
      outerSphereRef.current.rotation.x = t * 0.04 * speed;
      const pulse = 1.0 + Math.sin(t * 0.8 * speed) * 0.05;
      outerSphereRef.current.scale.set(pulse, pulse, pulse);
    }

    if (innerSphereRef.current) {
      innerSphereRef.current.rotation.y = -t * 0.12 * speed;
      innerSphereRef.current.rotation.z = t * 0.06 * speed;
      const pulseInner = 1.0 + Math.cos(t * 1.2 * speed) * 0.08;
      innerSphereRef.current.scale.set(pulseInner, pulseInner, pulseInner);
    }

    if (ringRef1.current) {
      ringRef1.current.rotation.z = t * 0.15 * speed;
      ringRef1.current.rotation.x = Math.sin(t * 0.3) * 0.2;
    }
    if (ringRef2.current) {
      ringRef2.current.rotation.z = -t * 0.2 * speed;
      ringRef2.current.rotation.y = Math.cos(t * 0.3) * 0.25;
    }
    if (ringRef3.current) {
      ringRef3.current.rotation.x = t * 0.18 * speed;
      ringRef3.current.rotation.z = Math.sin(t * 0.4) * 0.3;
    }
  });

  const isDark = theme === 'dark';
  const wireColor = isDark ? '#10B981' : '#059669';
  const coreColor = isDark ? '#06B6D4' : '#0284C7';
  const opacityOuter = isDark ? 0.22 : 0.12;
  const opacityInner = isDark ? 0.35 : 0.18;

  return (
    <group position={[0, 0, -5]}>
      {/* Outer Geodesic Sphere */}
      <mesh ref={outerSphereRef}>
        <icosahedronGeometry args={[3.2, 3]} />
        <meshStandardMaterial
          color={wireColor}
          wireframe
          transparent
          opacity={opacityOuter}
          roughness={0.2}
          metalness={0.8}
          emissive={wireColor}
          emissiveIntensity={isDark ? 0.4 : 0.1}
          depthWrite={false}
        />
      </mesh>

      {/* Inner Glowing Core Mesh */}
      <mesh ref={innerSphereRef}>
        <octahedronGeometry args={[1.9, 2]} />
        <meshStandardMaterial
          color={coreColor}
          wireframe
          transparent
          opacity={opacityInner}
          emissive={coreColor}
          emissiveIntensity={isDark ? 0.6 : 0.2}
          depthWrite={false}
        />
      </mesh>

      {/* Orbital Ring 1 - Emerald */}
      <mesh ref={ringRef1} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[4.2, 0.018, 16, 120]} />
        <meshStandardMaterial
          color="#10B981"
          transparent
          opacity={isDark ? 0.35 : 0.15}
          emissive="#10B981"
          emissiveIntensity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* Orbital Ring 2 - Electric Cyan */}
      <mesh ref={ringRef2} rotation={[-Math.PI / 4, Math.PI / 6, 0]}>
        <torusGeometry args={[4.8, 0.015, 16, 120]} />
        <meshStandardMaterial
          color="#06B6D4"
          transparent
          opacity={isDark ? 0.3 : 0.12}
          emissive="#06B6D4"
          emissiveIntensity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* Orbital Ring 3 - Violet Accent */}
      <mesh ref={ringRef3} rotation={[Math.PI / 6, -Math.PI / 3, 0]}>
        <torusGeometry args={[5.4, 0.012, 16, 120]} />
        <meshStandardMaterial
          color="#8B5CF6"
          transparent
          opacity={isDark ? 0.25 : 0.08}
          emissive="#8B5CF6"
          emissiveIntensity={0.4}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// 3. INTERACTIVE MOUSE PARALLAX CONTROLLER
function InteractiveGroup({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const targetX = state.pointer.x * 0.45;
    const targetY = state.pointer.y * 0.45;

    groupRef.current.rotation.y += (targetX - groupRef.current.rotation.y) * 0.05;
    groupRef.current.rotation.x += (-targetY - groupRef.current.rotation.x) * 0.05;
  });

  return <group ref={groupRef}>{children}</group>;
}

export default function ArcBackground({ isWalletConnected = false, theme = 'dark' }: ArcBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  const [isBridging, setIsBridging] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.isBridging === 'boolean') {
        setIsBridging(customEvent.detail.isBridging);
      }
    };
    window.addEventListener('bridge-state-change', handleStatus);
    return () => window.removeEventListener('bridge-state-change', handleStatus);
  }, []);

  if (!mounted) return null;

  const isDark = theme === 'dark';
  
  // Sleek dark space backdrop with dual glowing gradients
  const wrapperBg = isDark ? 'bg-[#050811]' : 'bg-[#F8FAFC]';
  const glowOverlay = isDark 
    ? 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.14),rgba(6,182,212,0.08)_50%,transparent_100%)]' 
    : 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(59,130,246,0.05)_50%,transparent_100%)]';

  return (
    <div className={`fixed inset-0 z-[-1] pointer-events-none w-screen h-screen select-none overflow-hidden ${wrapperBg} transition-colors duration-500`}>
      {/* Background radial glow */}
      <div className={`absolute inset-0 ${glowOverlay} pointer-events-none`} />

      {/* Ambient glass grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#10B981 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <Canvas
        camera={{ position: [0, 0, 5], fov: 58 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <ambientLight intensity={isDark ? 0.8 : 1.2} />
        <pointLight position={[10, 10, 10]} intensity={isDark ? 1.5 : 1.0} color="#10B981" />
        <pointLight position={[-10, -10, -5]} intensity={isDark ? 1.2 : 0.8} color="#06B6D4" />

        <InteractiveGroup>
          <FloatingParticles isBridging={isBridging} theme={theme} />
          <ArcSphere3D isBridging={isBridging} theme={theme} />
        </InteractiveGroup>
      </Canvas>
    </div>
  );
}
