import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import exploded from '@/assets/exploded-car.jpg';

type Part = { id: string; name: string; x: number; y: number; title: string; story: string; points: string[] };
const PARTS: Part[] = [
  { id: 'body', name: 'Body Shell', x: 52, y: 14, title: 'Body & safety structure', story: 'A rigid passenger cell with crumple zones at the front and rear absorbs impact energy before it reaches occupants.', points: ['High-strength steel cage', 'Front and rear crumple zones', 'Aerodynamic panels'] },
  { id: 'interior', name: 'Interior', x: 47, y: 38, title: 'Cabin & comfort', story: 'Seats, dashboard and infotainment are designed around the driver, with controls placed for minimal distraction.', points: ['Ergonomic seating', 'Central touchscreen', 'Climate zones'] },
  { id: 'engine', name: 'Engine', x: 29, y: 54, title: 'Engine details', story: 'The powertrain converts fuel into motion. Cooling, intake and exhaust work together to keep it efficient and responsive.', points: ['Radiator & cooling loop', 'Turbocharged intake', 'Emission control'] },
  { id: 'transmission', name: 'Transmission', x: 46, y: 53, title: 'Transmission & drivetrain', story: 'Gears multiply engine torque and send it through the driveshaft to the wheels, smoothly at every speed.', points: ['Automatic gear selection', 'Driveshaft to axles', 'Smooth shift logic'] },
  { id: 'electronics', name: 'Battery & Electronics', x: 66, y: 52, title: 'Battery & electronics', story: 'Control units monitor the car thousands of times per second — managing power, safety systems and driver assistance.', points: ['Power management', 'Driver-assist sensors', 'Hybrid-ready battery'] },
  { id: 'suspension', name: 'Suspension', x: 18, y: 63, title: 'Suspension', story: 'Springs and dampers keep the tyres planted on the road while isolating the cabin from bumps.', points: ['Independent struts', 'Tuned dampers', 'Stable cornering'] },
  { id: 'brakes', name: 'Brakes', x: 32, y: 76, title: 'Braking system', story: 'Ventilated discs and multi-piston calipers turn motion into heat to stop the car reliably and repeatedly.', points: ['Ventilated discs', 'ABS & stability control', 'Regenerative-ready'] },
  { id: 'chassis', name: 'Chassis & Wheels', x: 55, y: 74, title: 'Chassis & wheels', story: 'The floor platform ties everything together; alloy wheels and performance tyres are the car’s only contact with the road.', points: ['Low centre of gravity', 'Alloy wheels', 'Performance tyres'] },
];

export const Route = createFileRoute('/engineering')({
  head: () => ({ meta: [
    { title: 'Engineering Explorer — CDMS' },
    { name: 'description', content: 'Explore an exploded view of a modern car and learn what each component does.' },
    { property: 'og:title', content: 'Engineering Explorer — CDMS' },
    { property: 'og:description', content: 'See what’s inside a modern car, part by part.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Explorer,
});

function Explorer() {
  const [active, setActive] = useState<Part>(PARTS[2]!);
  return (
    <main className="explorer-page">
      <div className="content-width">
        <span className="eyebrow">ENGINEERING EXPLORER</span>
        <h1 className="explorer-title">Inside the machine.</h1>
        <p className="explorer-sub">Select a component to learn how it works. Illustrative concept vehicle — not the specification of any car in our catalogue.</p>
        <div className="explorer-stage">
          <img src={exploded} alt="Exploded view of a modern sedan" width={1920} height={1088} />
          {PARTS.map(p => (
            <button key={p.id} type="button" className={`hotspot ${active.id === p.id ? 'active' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setActive(p)} aria-label={p.name} aria-pressed={active.id === p.id}>
              <span className="hotspot-dot" /><span className="hotspot-label">{p.name}</span>
            </button>
          ))}
          <aside className="explorer-panel" aria-live="polite">
            <span className="eyebrow">{active.name.toUpperCase()}</span>
            <h2>{active.title}</h2>
            <p>{active.story}</p>
            <ul>{active.points.map(pt => <li key={pt}>{pt}</li>)}</ul>
          </aside>
        </div>
        <div className="explorer-cards">
          {PARTS.map(p => (
            <button key={p.id} type="button" className={`explorer-card ${active.id === p.id ? 'active' : ''}`} onClick={() => setActive(p)}>
              <strong>{p.name}</strong><span>{p.points[0]}</span>
            </button>
          ))}
        </div>
        <Button asChild variant="silver" className="mt-10"><Link to="/cars" search={{ search: false }}>Explore real cars <ArrowRight /></Link></Button>
      </div>
    </main>
  );
}
