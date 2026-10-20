import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Fuel, Settings2, MapPin, Layers } from 'lucide-react';
import type { GroupedModel, PublicCar } from '@/lib/catalogue.functions';
import { getModelImage } from '@/lib/catalogue.functions';
import { lakhs } from '@/lib/cdms';
import { CarSilhouettePlaceholder } from './car-placeholder';

export { getModelImage as carImage };

export function ModelCard({ model }: { model: GroupedModel }) {
  const [imageError, setImageError] = useState(false);
  const imageSrc = model.image;

  const availabilityBadgeClass =
    model.availability === 'Available'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : model.availability === 'Limited'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'border-muted-foreground/30 bg-muted/60 text-muted-foreground';

  const availabilityDotClass =
    model.availability === 'Available'
      ? 'bg-emerald-500'
      : model.availability === 'Limited'
        ? 'bg-amber-500'
        : 'bg-muted-foreground';

  return (
    <Link
      to="/cars/$id"
      params={{ id: model.slug }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xs transition-all duration-200 hover:border-foreground/30 hover:shadow-md"
    >
      {/* Photo / Silhouette Area */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/30">
        {!imageError && imageSrc ? (
          <img
            src={imageSrc}
            alt={`${model.brand} ${model.model}`}
            width={1024}
            height={640}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={() => setImageError(true)}
          />
        ) : (
          <CarSilhouettePlaceholder brand={model.brand} model={model.model} variant="card" />
        )}

        {/* Live Availability Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-xs ${availabilityBadgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${availabilityDotClass}`} />
            {model.availability}
            {model.availableCount > 0 && ` (${model.availableCount})`}
          </span>
        </div>

        {/* Floating Quick Action Arrow */}
        <div className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/80 text-foreground shadow-xs backdrop-blur-xs transition-all duration-200 group-hover:bg-foreground group-hover:text-background group-hover:scale-105">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          {/* Eyebrow & Model Title */}
          <div className="mb-3">
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {model.brand}
            </span>
            <h3 className="text-xl font-light tracking-tight text-foreground mt-0.5">
              {model.model}
            </h3>
          </div>

          {/* Variants and Branches metrics */}
          <div className="flex flex-wrap items-center gap-2 mb-3.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground border border-border/60">
              <Layers className="h-3 w-3 text-muted-foreground" />
              {model.variantCount} {model.variantCount === 1 ? 'Variant' : 'Variants'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground border border-border/60">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              {model.branchCount} {model.branchCount === 1 ? 'Branch' : 'Branches'}
            </span>
          </div>

          {/* Specs Chips: Fuel & Transmission */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {model.fuelTypes.map((fuel) => (
              <span
                key={fuel}
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background/70 px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
              >
                <Fuel className="h-2.5 w-2.5" />
                {fuel}
              </span>
            ))}
            {model.transmissions.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background/70 px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
              >
                <Settings2 className="h-2.5 w-2.5" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Pricing Block */}
        <div className="border-t border-border/60 pt-3.5 flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground font-light">From</span>
              <span className="text-lg font-medium tracking-tight text-foreground">
                {lakhs(model.minPrice)}
              </span>
              {model.availability === 'Unavailable' && (
                <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400 ml-1">
                  (Unavailable)
                </span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              Sample ex-showroom price
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-medium text-muted-foreground">
              {model.availableCount > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {model.availableCount} ready
                </span>
              ) : (
                <span className="text-muted-foreground">On Demand</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Legacy CarCard adapter if needed
export function CarCard({ car, branches }: { car: PublicCar; branches: any[] }) {
  const branch = branches.find((b) => b.id === car.branch_id);
  const imageSrc = getModelImage(car.brand, car.model);

  return (
    <Link
      to="/cars/$id"
      params={{ id: car.id }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xs transition-all duration-200 hover:border-foreground/30 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/30">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={`${car.brand} ${car.model}`}
            width={1024}
            height={640}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <CarSilhouettePlaceholder brand={car.brand} model={car.model} variant="card" />
        )}
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border/80 bg-background/80 text-foreground backdrop-blur-xs">
            {car.status}
          </span>
        </div>
      </div>

      <div className="p-5">
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {car.brand}
        </span>
        <h3 className="text-xl font-light tracking-tight text-foreground mt-0.5">
          {car.model}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">{car.variant}</p>
        <div className="border-t border-border/60 pt-3 flex items-center justify-between">
          <div>
            <span className="text-base font-medium text-foreground">{lakhs(car.price)}</span>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Sample ex-showroom price
            </p>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {branch?.city || 'HQ'}
          </span>
        </div>
      </div>
    </Link>
  );
}
