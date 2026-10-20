import React from 'react';

interface CarSilhouettePlaceholderProps {
  brand: string;
  model: string;
  className?: string;
  variant?: 'card' | 'hero';
}

export function CarSilhouettePlaceholder({
  brand,
  model,
  className = '',
  variant = 'card',
}: CarSilhouettePlaceholderProps) {
  const isHero = variant === 'hero';

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-card/60 select-none border-b border-border/60 ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 50%, var(--muted) 0%, transparent 70%)',
      }}
    >
      {/* Background subtle technical grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--foreground) 1px, transparent 1px), linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Modern Minimalist Sedan Silhouette SVG */}
      <div className={`relative z-10 flex flex-col items-center text-muted-foreground ${isHero ? 'scale-125 my-4' : 'scale-95'}`}>
        <svg
          viewBox="0 0 320 120"
          className={isHero ? 'w-64 h-28' : 'w-44 h-20'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Car Body Contour */}
          <path
            d="M 28 84 
               L 42 84 
               A 16 16 0 0 1 74 84 
               L 220 84 
               A 16 16 0 0 1 252 84 
               L 292 84 
               C 300 84 306 78 304 70 
               L 298 56 
               C 294 48 286 46 270 46 
               L 230 46 
               L 182 22 
               C 178 20 172 18 160 18 
               L 104 18 
               C 92 18 84 22 76 30 
               L 48 46 
               L 26 50 
               C 18 52 14 58 14 66 
               L 14 74 
               C 14 80 20 84 28 84 Z"
            className="stroke-foreground/70"
            fill="var(--background)"
            fillOpacity="0.4"
          />

          {/* Roof line & Cabin Windows */}
          <path
            d="M 80 44 L 106 24 L 158 24 L 160 44 Z"
            className="stroke-foreground/50"
            fill="var(--muted)"
            fillOpacity="0.3"
          />
          <path
            d="M 168 44 L 166 24 L 216 44 Z"
            className="stroke-foreground/50"
            fill="var(--muted)"
            fillOpacity="0.3"
          />

          {/* Wheel Arches & Wheels */}
          <circle cx="58" cy="84" r="14" className="stroke-foreground/80 fill-card" />
          <circle cx="58" cy="84" r="6" className="stroke-muted-foreground/60 fill-muted" />

          <circle cx="236" cy="84" r="14" className="stroke-foreground/80 fill-card" />
          <circle cx="236" cy="84" r="6" className="stroke-muted-foreground/60 fill-muted" />

          {/* Ground reflection shadow */}
          <line x1="16" y1="102" x2="304" y2="102" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.3" />
        </svg>

        {/* Brand & Model typography badge */}
        <div className="text-center mt-1 z-10">
          <div className="text-[10px] font-semibold tracking-[0.25em] uppercase text-foreground/80">
            {brand}
          </div>
          <div className="text-xs font-light tracking-wide text-muted-foreground">
            {model}
          </div>
        </div>
      </div>

      {/* Quiet pill watermark */}
      <div className="absolute bottom-2.5 right-3 z-10">
        <span className="text-[9px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground border border-border/80">
          Photo Pending
        </span>
      </div>
    </div>
  );
}
