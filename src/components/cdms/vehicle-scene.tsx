import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import {
  Maximize2,
  Minimize2,
  RotateCw,
  RotateCcw,
  RefreshCw,
  X,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface VehiclePartInfo {
  id: string;
  name: string;
  category: string;
  purpose: string;
  location: string;
}

export const VEHICLE_PARTS: Record<string, VehiclePartInfo> = {
  chassis: {
    id: 'chassis',
    name: 'High-Tensile Platform & Chassis',
    category: 'Structural Framework',
    purpose:
      'Provides torsional stiffness, absorbs frontal and side impact energy through engineered crumple zones, and provides hardpoints for suspension and powertrain.',
    location: 'Lower vehicle backbone between axles',
  },
  battery: {
    id: 'battery',
    name: 'High-Voltage Traction Battery',
    category: 'Energy Storage & Powertrain',
    purpose:
      'Supplies high-density electrical energy to the drive unit with liquid thermal management, lowering the vehicle center of gravity for dynamic cornering stability.',
    location: 'Integrated underfloor skateboard housing',
  },
  engine: {
    id: 'engine',
    name: 'Turbocharged Powertrain & Transaxle',
    category: 'Propulsion Unit',
    purpose:
      'Combines variable-geometry turbocharging with computerized direct fuel injection to generate responsive torque across all gear ratios with optimal thermal efficiency.',
    location: 'Front powertrain bay between strut towers',
  },
  suspension: {
    id: 'suspension',
    name: 'Independent Multi-Link Suspension',
    category: 'Chassis Dynamics',
    purpose:
      'Gas-pressurized telescopic dampers and tuned coil springs maintain tyre contact patch over irregular road surfaces and suppress body roll during high-speed lane changes.',
    location: 'All four wheel corners',
  },
  wheels: {
    id: 'wheels',
    name: 'Alloy Wheels & Low-Resistance Tyres',
    category: 'Running Gear',
    purpose:
      'Forged aerodynamic alloy rims with ventilated disc brake assemblies and silica-compound radial tyres engineered for wet-weather braking and minimal rolling resistance.',
    location: 'Four outer corner contact points',
  },
  seats: {
    id: 'seats',
    name: 'Ergonomic Sculpted Seating',
    category: 'Interior Ergonomics',
    purpose:
      'Anatomically contoured lumbar support and multi-density foam cushions reduce driver fatigue during cross-country touring while providing lateral restraint.',
    location: 'Passenger cabin interior',
  },
  doors: {
    id: 'doors',
    name: 'Side Intrusion Protection Doors',
    category: 'Body Shell & Safety',
    purpose:
      'Ultra-high-strength steel anti-intrusion beams inside the door panels protect occupants during lateral impacts and create acoustic seals against wind buffeting.',
    location: 'Left and right vehicle flanks',
  },
  bumpers: {
    id: 'bumpers',
    name: 'Aerodynamic Impact Fascias',
    category: 'Exterior Aerodynamics',
    purpose:
      'Energy-absorbing honeycomb pedestrian-safety structures with integrated active air vents to manage cooling airflow and reduce aerodynamic drag.',
    location: 'Fore and aft vehicle extremities',
  },
  hood: {
    id: 'hood',
    name: 'Sculpted Lightweight Hood',
    category: 'Exterior Bodywork',
    purpose:
      'Contoured aerodynamic aluminum panel designed with passive acoustic dampening layers to reduce cabin NVH (Noise, Vibration, Harshness).',
    location: 'Front upper engine compartment',
  },
  cabin_glass: {
    id: 'cabin_glass',
    name: 'Acoustic Laminated Greenhouse',
    category: 'Glazing & Visibility',
    purpose:
      '360-degree high-visibility safety glass with acoustic acoustic interlayer and solar-reflecting thermal coating to maintain interior cabin temperature.',
    location: 'Upper cabin surround and pillars',
  },
  roof: {
    id: 'roof',
    name: 'Reinforced Roof Structure',
    category: 'Body Shell & Rollover Protection',
    purpose:
      'High-rigidity roof bows tied into reinforced B-pillars ensure structural survival cell integrity during rollover events.',
    location: 'Top canopy',
  },
};

interface SedanProps {
  exploded: boolean;
  activePart: string | null;
  onHoverPart: (partId: string | null) => void;
  onClickPart: (partId: string) => void;
  scrollProgress: number;
}

function SchematicSedan({
  exploded,
  activePart,
  onHoverPart,
  onClickPart,
  scrollProgress,
}: SedanProps) {
  const group = useRef<THREE.Group>(null);
  const explodeLerp = useRef(0);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }, []);

  useFrame((state, delta) => {
    const target = exploded ? 1 : Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.6));
    if (prefersReducedMotion.current) {
      explodeLerp.current = target;
    } else {
      explodeLerp.current = THREE.MathUtils.damp(
        explodeLerp.current,
        target,
        4.5,
        delta
      );
    }
  });

  const t = explodeLerp.current;

  // Material palettes with dark monochrome baseline and luminous accent on highlight
  const getMaterial = (partId: string, baseColor = '#4a5568', isGlass = false) => {
    const isHighlighted = activePart === partId;
    if (isGlass) {
      return (
        <meshPhysicalMaterial
          color={isHighlighted ? '#7dd3fc' : '#1e293b'}
          roughness={0.1}
          metalness={0.9}
          transmission={0.65}
          thickness={0.5}
          transparent
          opacity={isHighlighted ? 0.8 : 0.45}
          emissive={isHighlighted ? '#38bdf8' : '#000000'}
          emissiveIntensity={isHighlighted ? 0.6 : 0}
        />
      );
    }

    return (
      <meshStandardMaterial
        color={isHighlighted ? '#94a3b8' : baseColor}
        metalness={0.8}
        roughness={0.25}
        emissive={isHighlighted ? '#38bdf8' : '#000000'}
        emissiveIntensity={isHighlighted ? 0.7 : 0}
      />
    );
  };

  return (
    <group ref={group} position={[0, 0.45, 0]}>
      {/* 1. LOWER BODY / CHASSIS */}
      <group
        position={[0, -0.35 * t, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('chassis');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('chassis');
        }}
      >
        <RoundedBox args={[3.8, 0.16, 1.6]} radius={0.05} position={[0, 0.1, 0]}>
          {getMaterial('chassis', '#334155')}
        </RoundedBox>
        {/* Front subframe */}
        <RoundedBox args={[1.1, 0.12, 1.2]} radius={0.04} position={[-1.75, 0.12, 0]}>
          {getMaterial('chassis', '#1e293b')}
        </RoundedBox>
        {/* Rear subframe */}
        <RoundedBox args={[0.9, 0.12, 1.2]} radius={0.04} position={[1.75, 0.12, 0]}>
          {getMaterial('chassis', '#1e293b')}
        </RoundedBox>
      </group>

      {/* 2. BATTERY PACK */}
      <group
        position={[0.1, -0.75 * t, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('battery');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('battery');
        }}
      >
        <RoundedBox args={[2.1, 0.11, 1.35]} radius={0.03} position={[0.1, -0.02, 0]}>
          {getMaterial('battery', '#0f172a')}
        </RoundedBox>
        {/* Battery cooling lines accent */}
        <mesh position={[0.1, 0.05, 0]}>
          <boxGeometry args={[1.9, 0.02, 1.15]} />
          <meshStandardMaterial
            color={activePart === 'battery' ? '#38bdf8' : '#0284c7'}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* 3. ENGINE & GEARBOX */}
      <group
        position={[-1.4 - 0.9 * t, 0.35 - 0.1 * t, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('engine');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('engine');
        }}
      >
        {/* Engine Block */}
        <RoundedBox args={[0.75, 0.52, 0.65]} radius={0.05} position={[0, 0.15, 0]}>
          {getMaterial('engine', '#64748b')}
        </RoundedBox>
        {/* Cylinder head */}
        <RoundedBox args={[0.65, 0.12, 0.52]} radius={0.03} position={[0, 0.44, 0]}>
          {getMaterial('engine', '#475569')}
        </RoundedBox>
        {/* Transaxle side casing */}
        <mesh position={[0.15, 0.05, 0.38]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.32, 16]} />
          {getMaterial('engine', '#475569')}
        </mesh>
      </group>

      {/* 4. SUSPENSION SPRINGS (4 Corners) */}
      <group
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('suspension');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('suspension');
        }}
      >
        {[
          { x: -1.4, z: 0.75, dx: -0.4, dz: 0.5 },
          { x: -1.4, z: -0.75, dx: -0.4, dz: -0.5 },
          { x: 1.4, z: 0.75, dx: 0.4, dz: 0.5 },
          { x: 1.4, z: -0.75, dx: 0.4, dz: -0.5 },
        ].map((s, idx) => (
          <group key={idx} position={[s.x + s.dx * t, 0.15 + 0.1 * t, s.z + s.dz * t]}>
            <mesh>
              <cylinderGeometry args={[0.06, 0.06, 0.45, 12]} />
              {getMaterial('suspension', '#94a3b8')}
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.25, 12]} />
              <meshStandardMaterial
                color={activePart === 'suspension' ? '#38bdf8' : '#e2e8f0'}
                metalness={0.9}
                roughness={0.15}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* 5. WHEELS & TYRES (4 Corners) */}
      <group
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('wheels');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('wheels');
        }}
      >
        {[
          { x: -1.4, z: 0.95, dz: 0.85 },
          { x: -1.4, z: -0.95, dz: -0.85 },
          { x: 1.4, z: 0.95, dz: 0.85 },
          { x: 1.4, z: -0.95, dz: -0.85 },
        ].map((w, idx) => (
          <group
            key={idx}
            position={[w.x, 0.05, w.z + w.dz * t]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            {/* Outer Tyre */}
            <mesh>
              <cylinderGeometry args={[0.42, 0.42, 0.26, 32]} />
              <meshStandardMaterial color="#090d12" roughness={0.9} metalness={0.1} />
            </mesh>
            {/* Inner Alloy Rim */}
            <mesh position={[0, (w.z > 0 ? 1 : -1) * 0.02, 0]}>
              <cylinderGeometry args={[0.27, 0.27, 0.28, 16]} />
              {getMaterial('wheels', '#cbd5e1')}
            </mesh>
            {/* Center Cap */}
            <mesh position={[0, (w.z > 0 ? 1 : -1) * 0.14, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.02, 12]} />
              <meshStandardMaterial color="#0f172a" metalness={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 6. INTERIOR SEATS */}
      <group
        position={[0, 0.45 * t, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('seats');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('seats');
        }}
      >
        {/* Front Left Seat */}
        <RoundedBox args={[0.55, 0.12, 0.48]} radius={0.03} position={[-0.2, 0.28, 0.42]}>
          {getMaterial('seats', '#1e293b')}
        </RoundedBox>
        <RoundedBox
          args={[0.12, 0.62, 0.46]}
          radius={0.03}
          position={[0.08, 0.58, 0.42]}
          rotation={[0, 0, -0.15]}
        >
          {getMaterial('seats', '#1e293b')}
        </RoundedBox>

        {/* Front Right Seat */}
        <RoundedBox args={[0.55, 0.12, 0.48]} radius={0.03} position={[-0.2, 0.28, -0.42]}>
          {getMaterial('seats', '#1e293b')}
        </RoundedBox>
        <RoundedBox
          args={[0.12, 0.62, 0.46]}
          radius={0.03}
          position={[0.08, 0.58, -0.42]}
          rotation={[0, 0, -0.15]}
        >
          {getMaterial('seats', '#1e293b')}
        </RoundedBox>

        {/* Rear Bench Seat */}
        <RoundedBox args={[0.58, 0.14, 1.38]} radius={0.04} position={[1.05, 0.32, 0]}>
          {getMaterial('seats', '#1e293b')}
        </RoundedBox>
        <RoundedBox
          args={[0.14, 0.68, 1.38]}
          radius={0.04}
          position={[1.32, 0.65, 0]}
          rotation={[0, 0, -0.18]}
        >
          {getMaterial('seats', '#1e293b')}
        </RoundedBox>
      </group>

      {/* 7. FOUR DOORS */}
      <group
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('doors');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('doors');
        }}
      >
        {/* Front Left Door */}
        <RoundedBox
          args={[0.95, 0.68, 0.08]}
          radius={0.03}
          position={[-0.25, 0.52, 0.85 + 0.8 * t]}
        >
          {getMaterial('doors', '#475569')}
        </RoundedBox>
        {/* Front Right Door */}
        <RoundedBox
          args={[0.95, 0.68, 0.08]}
          radius={0.03}
          position={[-0.25, 0.52, -0.85 - 0.8 * t]}
        >
          {getMaterial('doors', '#475569')}
        </RoundedBox>
        {/* Rear Left Door */}
        <RoundedBox
          args={[0.92, 0.68, 0.08]}
          radius={0.03}
          position={[0.72, 0.52, 0.85 + 0.8 * t]}
        >
          {getMaterial('doors', '#475569')}
        </RoundedBox>
        {/* Rear Right Door */}
        <RoundedBox
          args={[0.92, 0.68, 0.08]}
          radius={0.03}
          position={[0.72, 0.52, -0.85 - 0.8 * t]}
        >
          {getMaterial('doors', '#475569')}
        </RoundedBox>
      </group>

      {/* 8. FRONT & REAR BUMPERS */}
      <group
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('bumpers');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('bumpers');
        }}
      >
        {/* Front Bumper */}
        <RoundedBox
          args={[0.42, 0.38, 1.7]}
          radius={0.08}
          position={[-2.25 - 0.85 * t, 0.28, 0]}
        >
          {getMaterial('bumpers', '#334155')}
        </RoundedBox>
        {/* Rear Bumper */}
        <RoundedBox
          args={[0.42, 0.38, 1.68]}
          radius={0.08}
          position={[2.25 + 0.85 * t, 0.32, 0]}
        >
          {getMaterial('bumpers', '#334155')}
        </RoundedBox>
      </group>

      {/* 9. HOOD / BONNET */}
      <group
        position={[-1.38 - 0.45 * t, 0.58 + 0.65 * t, 0]}
        rotation={[0, 0, -0.06 * (1 - t)]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('hood');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('hood');
        }}
      >
        <RoundedBox args={[1.35, 0.06, 1.55]} radius={0.03} position={[0, 0, 0]}>
          {getMaterial('hood', '#64748b')}
        </RoundedBox>
      </group>

      {/* 10. CABIN & ACOUSTIC GLASS */}
      <group
        position={[0.25, 0.85 + 0.75 * t, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('cabin_glass');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('cabin_glass');
        }}
      >
        {/* Windshield */}
        <mesh position={[-0.82, 0.12, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.04, 0.82, 1.42]} />
          {getMaterial('cabin_glass', '#38bdf8', true)}
        </mesh>
        {/* Rear Window */}
        <mesh position={[1.15, 0.12, 0]} rotation={[0, 0, Math.PI / 4.2]}>
          <boxGeometry args={[0.04, 0.78, 1.38]} />
          {getMaterial('cabin_glass', '#38bdf8', true)}
        </mesh>
        {/* Side Windows Left & Right */}
        <mesh position={[0.15, 0.12, 0.78]}>
          <boxGeometry args={[1.65, 0.48, 0.02]} />
          {getMaterial('cabin_glass', '#38bdf8', true)}
        </mesh>
        <mesh position={[0.15, 0.12, -0.78]}>
          <boxGeometry args={[1.65, 0.48, 0.02]} />
          {getMaterial('cabin_glass', '#38bdf8', true)}
        </mesh>
      </group>

      {/* 11. ROOF PANEL */}
      <group
        position={[0.22, 1.25 + 1.25 * t, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart('roof');
        }}
        onPointerOut={() => onHoverPart(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClickPart('roof');
        }}
      >
        <RoundedBox args={[1.82, 0.06, 1.38]} radius={0.03} position={[0, 0, 0]}>
          {getMaterial('roof', '#475569')}
        </RoundedBox>
      </group>
    </group>
  );
}

// Custom OrbitControls that zooms only with pinch or Ctrl+wheel
function CustomOrbitControls({ autoRotate }: { autoRotate: boolean }) {
  const controlsRef = useRef<any>(null);
  const { gl } = useThree();
  const [ctrlPressed, setCtrlPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.metaKey) setCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.metaKey) setCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={ctrlPressed}
      enablePan={false}
      autoRotate={autoRotate}
      autoRotateSpeed={1.2}
      minDistance={4}
      maxDistance={12}
      minPolarAngle={0.6}
      maxPolarAngle={1.45}
    />
  );
}

export default function VehicleScene({ progress = 0 }: { progress?: number }) {
  const [exploded, setExploded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);

  // Esc key closes active part info card
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePartId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Displayed info card part (clicked part has priority, then hovered)
  const displayedPart = activePartId
    ? VEHICLE_PARTS[activePartId]
    : hoveredPartId
      ? VEHICLE_PARTS[hoveredPartId]
      : null;

  const handleReset = () => {
    setExploded(false);
    setAutoRotate(true);
    setActivePartId(null);
    setHoveredPartId(null);
  };

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden select-none bg-background/50 border border-border/80">
      {/* 3D WebGL Canvas */}
      <Canvas
        camera={{ position: [-5.8, 3.4, 5.2], fov: 38 }}
        dpr={[1, 1.5]}
        className="cursor-grab active:cursor-grabbing"
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[-4, 7, 4]} intensity={3.5} />
        <directionalLight position={[4, 3, -4]} intensity={2.8} />
        <directionalLight position={[0, -2, 0]} intensity={0.5} />

        <SchematicSedan
          exploded={exploded}
          activePart={activePartId || hoveredPartId}
          onHoverPart={setHoveredPartId}
          onClickPart={setActivePartId}
          scrollProgress={progress}
        />

        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.45}
          scale={14}
          blur={2.2}
          far={4.5}
        />

        <CustomOrbitControls autoRotate={autoRotate} />
      </Canvas>

      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Status Label */}
        <div className="pointer-events-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border border-border/80 bg-background/80 text-foreground backdrop-blur-xs shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            CONCEPT · ILLUSTRATIVE VEHICLE
          </span>
        </div>

        {/* Control Pill Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border/80 bg-background/90 p-1 shadow-xs backdrop-blur-xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExploded(!exploded)}
            className="h-7 rounded-full px-3 text-xs font-medium text-foreground hover:bg-muted"
          >
            {exploded ? (
              <>
                <Minimize2 className="h-3.5 w-3.5 mr-1" />
                Assemble
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 mr-1" />
                Explode
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`h-7 rounded-full px-2.5 text-xs font-medium ${
              autoRotate ? 'text-foreground bg-secondary' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle Auto Rotation"
          >
            <RotateCw className="h-3.5 w-3.5 mr-1" />
            Rotate
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            title="Reset to default view"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Bottom Floating Info Card (when part is hovered or clicked) */}
      {displayedPart && (
        <div className="absolute bottom-16 left-4 z-20 max-w-sm rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-xs text-xs animate-in fade-in-50 duration-200">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                {displayedPart.category}
              </span>
              <h4 className="text-sm font-medium text-foreground">
                {displayedPart.name}
              </h4>
            </div>
            {activePartId && (
              <button
                type="button"
                onClick={() => setActivePartId(null)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded-md"
                aria-label="Close component info"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <p className="text-muted-foreground text-[11px] leading-relaxed mb-2.5">
            {displayedPart.purpose}
          </p>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Location: {displayedPart.location}</span>
            {activePartId && <span className="opacity-70">(Press Esc to close)</span>}
          </div>
        </div>
      )}

      {/* Bottom Keyboard Navigation & Part Selection Chips Bar */}
      <div className="absolute bottom-3 left-4 right-4 z-20 overflow-x-auto no-scrollbar py-1">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
            <Layers className="h-3 w-3" />
            Components:
          </span>
          {Object.values(VEHICLE_PARTS).map((part) => {
            const isSelected = (activePartId || hoveredPartId) === part.id;
            return (
              <button
                key={part.id}
                type="button"
                tabIndex={0}
                onClick={() => {
                  if (activePartId === part.id) {
                    setActivePartId(null);
                  } else {
                    setActivePartId(part.id);
                    setExploded(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActivePartId(part.id);
                    setExploded(true);
                  }
                }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-foreground text-background shadow-xs ring-1 ring-foreground'
                    : 'border border-border/80 bg-background/80 text-muted-foreground hover:text-foreground hover:border-foreground/40'
                }`}
              >
                {part.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
