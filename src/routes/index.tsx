import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, ShieldCheck, ChevronDown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { catalogueQuery } from '@/lib/catalogue-query';
import { ModelCard } from '@/components/cdms/car-card';
import { Engineering } from '@/components/cdms/engineering';
import hero from '@/assets/showroom-hero.jpg';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'CDMS — Your Next Drive Starts Here' },
      {
        name: 'description',
        content:
          'Explore exceptional new cars and discover live availability across CDMS branches in India.',
      },
      { property: 'og:title', content: 'CDMS — Your Next Drive Starts Here' },
      {
        property: 'og:description',
        content: 'A premium new-car experience, connected across every branch.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogueQuery),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(catalogueQuery);
  const [category, setCategory] = useState('All cars');
  const [brand, setBrand] = useState('');
  const [branch, setBranch] = useState('');

  // Distinct models filtering from data.models (no VIN or duplicate model repeats)
  const models = (data.models || []).filter((m) => {
    if (brand && m.brand !== brand) return false;
    if (branch && !m.branchAvailability.some((b) => b.branchId === branch && b.availableCount > 0)) {
      return false;
    }

    if (category === 'Electric') {
      return m.fuelTypes.some(
        (f) => f.toLowerCase().includes('electric') || f.toLowerCase().includes('ev')
      );
    }
    if (category === 'SUVs') {
      const lower = `${m.brand} ${m.model}`.toLowerCase();
      return (
        lower.includes('creta') ||
        lower.includes('seltos') ||
        lower.includes('thar') ||
        lower.includes('xuv') ||
        lower.includes('vitara') ||
        lower.includes('fortuner') ||
        lower.includes('nexon') ||
        lower.includes('innova')
      );
    }
    if (category === 'Sedans') {
      const lower = `${m.brand} ${m.model}`.toLowerCase();
      return (
        lower.includes('city') ||
        lower.includes('3 series') ||
        lower.includes('c-class') ||
        lower.includes('a4')
      );
    }
    return true;
  });

  // Prioritize premium brands first while showing 6 to 8 distinct models
  const sortedModels = [...models].sort((a, b) => {
    const priority = ['BMW', 'Mercedes-Benz', 'Audi', 'Toyota', 'Mahindra', 'Hyundai', 'Tata', 'Maruti Suzuki'];
    const iA = priority.indexOf(a.brand);
    const iB = priority.indexOf(b.brand);
    return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
  });

  const featuredModels = sortedModels.slice(0, 8);

  return (
    <>
      <section className="hero">
        <img
          className="hero-image"
          src={hero}
          alt="Graphite performance car on an alpine road"
          width={1920}
          height={1024}
          fetchPriority="high"
        />
        <div className="content-width hero-content">
          <div className="hero-eyebrow">EXCEPTIONAL CARS. EXTRAORDINARY POSSIBILITIES.</div>
          <h1>
            Your Next Drive<span>Starts Here.</span>
          </h1>
          <p className="hero-copy">
            Explore new cars, discover branch-wise availability,
            <br className="hidden sm:block" /> and experience a smarter way to buy.
          </p>
          <div className="hero-buttons">
            <Button asChild variant="onImage">
              <a href="#catalogue">
                Explore Cars <ArrowUpRight />
              </a>
            </Button>
            <Button asChild variant="onImageOutline">
              <Link to="/cars" search={{ search: false }}>
                Find Your Car <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
        <div className="content-width hero-bottom">
          <a href="#catalogue" className="scroll-indicator">
            <span />
            SCROLL TO DISCOVER
            <ChevronDown size={12} />
          </a>
          <div className="hero-caption">
            BUILT AROUND YOUR NEXT CHAPTER.<span>NEW CARS. NO COMPROMISES.</span>
          </div>
        </div>
      </section>

      <section className="brand-band" aria-label="Explore automotive brands">
        <div className="content-width">
          <span className="eyebrow">
            THE BRANDS YOU LOVE.
            <br />
            ALL IN ONE PLACE.
          </span>
          <span className="manufacturer">BMW</span>
          <span className="manufacturer mercedes">Mercedes-Benz</span>
          <span className="audi-rings" aria-label="Audi">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="manufacturer hyundai">HYUNDAI</span>
          <span className="manufacturer tata">TATA</span>
          <span className="manufacturer toyota">TOYOTA</span>
        </div>
      </section>

      <section id="catalogue" className="content-width catalogue-section scroll-mt-20">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CURATED FOR YOUR NEXT CHAPTER</span>
            <h2>Find your kind of drive.</h2>
            <p>Exceptional new cars. Available at a branch near you.</p>
          </div>
          <Link to="/cars" search={{ search: false }}>
            View all cars <ArrowUpRight size={15} />
          </Link>
        </div>

        <div className="filters">
          <div className="filter-tabs">
            {['All cars', 'Sedans', 'SUVs', 'Electric'].map((c) => (
              <Button
                key={c}
                variant={category === c ? 'silver' : 'ghost'}
                onClick={() => setCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>
          <select
            aria-label="Filter by brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="">All brands</option>
            {[...new Set(data.cars.map((c) => c.brand))].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select
            aria-label="Filter by branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">All branches</option>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.city}
              </option>
            ))}
          </select>
        </div>

        {featuredModels.length ? (
          <div className="car-grid">
            {featuredModels.map((m) => (
              <ModelCard key={m.slug} model={m} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            No available cars match these filters.
            <Button asChild variant="link">
              <Link to="/cars" search={{ search: false }}>
                Request your preferred car <ArrowRight />
              </Link>
            </Button>
          </div>
        )}

        <div className="catalogue-note">
          <ShieldCheck size={13} />
          New cars only <span>·</span> Transparent sample pricing <span>·</span>
          <MapPin size={12} /> {data.branches.length} connected branches
        </div>
      </section>

      <Engineering />

      <section className="content-width journey-preview">
        <div>
          <span className="eyebrow">FROM THE FIRST LOOK TO THE FIRST DRIVE</span>
          <h2>Your journey. Seamlessly connected.</h2>
          <p>Discover, enquire, test drive, and make it yours.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/how-it-works">
            How it works <ArrowUpRight />
          </Link>
        </Button>
      </section>
    </>
  );
}
