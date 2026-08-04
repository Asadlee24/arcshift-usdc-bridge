// components/three/ArcBackground.tsx
// 3D React Three Fiber centerpiece sphere background (Supports Dark/Light Themes dynamically)

'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ArcBackgroundProps {
  isBridging?: boolean;
  isWalletConnected?: boolean;
  theme?: 'dark' | 'light';
}

// ELEMENT 1: Floating Particle Field (Smooth slow floating motion)
function FloatingParticles({ isWalletConnected = false, isBridging = false }: { isWalletConnected?: boolean; isBridging?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);

  const count = 1200;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;     // X
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60; // Y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60; // Z
    }
    return pos;
  }, []);

  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3);
    const colorEmerald = new THREE.Color('#10B981');
    const colorBlue = new THREE.Color('#3B82F6');

    for (let i = 0; i < count; i++) {
      const mixedColor = new THREE.Color().lerpColors(colorEmerald, colorBlue, Math.random());
      cols[i * 3] = mixedColor.r;
      cols[i * 3 + 1] = mixedColor.g;
      cols[i * 3 + 2] = mixedColor.b;
    }
    return cols;
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;

    // Elegant rotation speed based on isBridging state (Warp space effect)
    const rotSpeedY = isBridging ? 0.008 : 0.0003;
    const rotSpeedX = isBridging ? 0.004 : 0.00015;
    pointsRef.current.rotation.y += rotSpeedY;
    pointsRef.current.rotation.x += rotSpeedX;

    // Smooth drift upward speed based on isBridging state
    const driftSpeed = isBridging ? 0.09 : 0.006;
    const positionAttribute = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (positionAttribute) {
      for (let i = 0; i < positionAttribute.count; i++) {
        let y = positionAttribute.getY(i);
        y += driftSpeed; // Smooth visible float
        if (y > 30) y = -30;
        positionAttribute.setY(i, y);
      }
      positionAttribute.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        vertexColors
        transparent
        opacity={0.2}
        sizeAttenuation={true}
        depthWrite={false}
      />
    </points>
  );
}

// ELEMENT 2: Centerpiece wireframe sphere
function ArcSphere({ isBridging = false }: { isBridging?: boolean }) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (sphereRef.current) {
      const rotSpeed = isBridging ? 0.015 : 0.0005;
      sphereRef.current.rotation.y += rotSpeed;
      sphereRef.current.rotation.x += rotSpeed / 2;
      
      // Professional, slow gentle breathing/pulsing animation (accelerates during bridging)
      const pulseSpeed = isBridging ? 2.5 : 0.5;
      const pulseAmp = isBridging ? 0.15 : 0.04;
      const breathingScale = 1.0 + Math.sin(state.clock.getElapsedTime() * pulseSpeed) * pulseAmp;
      sphereRef.current.scale.set(breathingScale, breathingScale, breathingScale);
    }
    if (ringRef.current) {
      const ringRot = isBridging ? 0.01 : 0.0003;
      ringRef.current.rotation.z -= ringRot;
    }
  });

  return (
    <group position={[0, 0, -6]}>
      {/* 3D Wireframe sphere centerpiece — 10% opacity for a sharp, premium professional feel */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[2.8, 24, 24]} />
        <meshBasicMaterial
          color="#10B981"
          wireframe
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>

      {/* Equatorial torus ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[3.2, 0.02, 16, 100]} />
        <meshBasicMaterial
          color="#10B981"
          transparent
          opacity={0.04}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ELEMENT 3: Subtle network lines
function ChainLines() {
  const linesRef = useRef<THREE.LineSegments>(null);

  const [positions, colors] = useMemo(() => {
    const lineCount = 10;
    const pos = new Float32Array(lineCount * 2 * 3);
    const cols = new Float32Array(lineCount * 2 * 3);
    const colorCenter = new THREE.Color('#10B981');

    for (let i = 0; i < lineCount; i++) {
      pos[i * 6] = 0;
      pos[i * 6 + 1] = 0;
      pos[i * 6 + 2] = -6;

      cols[i * 6] = colorCenter.r;
      cols[i * 6 + 1] = colorCenter.g;
      cols[i * 6 + 2] = colorCenter.b;

      const angle = (i / lineCount) * Math.PI * 2;
      const radius = 6 + Math.random() * 4;
      pos[i * 6 + 3] = Math.cos(angle) * radius;
      pos[i * 6 + 4] = Math.sin(angle) * radius;
      pos[i * 6 + 5] = -6 + (Math.random() - 0.5) * 6;

      cols[i * 6 + 3] = 0.2;
      cols[i * 6 + 4] = 0.5;
      cols[i * 6 + 5] = 0.8;
    }
    return [pos, cols];
  }, []);

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.04}
        depthWrite={false}
      />
    </lineSegments>
  );
}

// Master group handler for interactive pointer parallax
function InteractiveGroup({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const targetX = state.pointer.x * 0.25; // Enhanced visible parallax 3D effect
    const targetY = state.pointer.y * 0.25;

    groupRef.current.rotation.y += (targetX - groupRef.current.rotation.y) * 0.04;
    groupRef.current.rotation.x += (-targetY - groupRef.current.rotation.x) * 0.04;
  });

  return <group ref={groupRef}>{children}</group>;
}

export default function ArcBackground({ isWalletConnected = false, theme = 'light' }: ArcBackgroundProps) {
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
  const wrapperBg = isDark ? 'bg-[#070B13]' : 'bg-[#F8FAFC]';
  const radialGlow = isDark 
    ? 'bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.06)_0%,transparent_80%)]' 
    : 'bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.04)_0%,transparent_80%)]';

  return (
    <div className={`fixed inset-0 z-[-1] pointer-events-none w-screen h-screen select-none overflow-hidden ${wrapperBg} transition-colors duration-300`}>
      {/* Background radial gradient mask for elegant ambient light depth */}
      <div className={`absolute inset-0 ${radialGlow} pointer-events-none`} />

      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <ambientLight intensity={1.3} />

        <InteractiveGroup>
          <FloatingParticles isWalletConnected={isWalletConnected} isBridging={isBridging} />
          <ArcSphere isBridging={isBridging} />
          <ChainLines />
        </InteractiveGroup>
      </Canvas>
    </div>
  );
}
