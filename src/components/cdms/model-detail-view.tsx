import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  Sparkles,
  ShieldCheck,
  Box,
  Fuel,
  Settings2,
  Palette,
  AlertCircle,
  Clock,
  Car as CarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { lakhs, money } from '@/lib/cdms';
import {
  getModelImage,
  bookCarDirectlyServerFn,
  requestUnavailableCarServerFn,
  type PublicCar,
  type GroupedModel,
} from '@/lib/catalogue.functions';
import { submitPublicEnquiry } from '@/lib/cdms.functions';
import { useSession } from './session';
import { CarSilhouettePlaceholder } from './car-placeholder';
import { toast } from 'sonner';

interface ModelDetailViewProps {
  model: GroupedModel;
  modelCars: PublicCar[];
  branches: any[];
  initialCarId?: string;
}

export function ModelDetailView({
  model,
  modelCars,
  branches,
  initialCarId,
}: ModelDetailViewProps) {
  const query = useQueryClient();
  const navigate = useNavigate();
  const { session } = useSession();

  const bookCarFn = useServerFn(bookCarDirectlyServerFn);
  const requestCarFn = useServerFn(requestUnavailableCarServerFn);
  const submitEnquiryFn = useServerFn(submitPublicEnquiry);

  // Initial variant selection
  const initialCar = modelCars.find((c) => c.id === initialCarId) || modelCars[0];
  const [selectedVariant, setSelectedVariant] = useState<string>(initialCar?.variant || model.variants[0]?.name || '');

  // Filter cars matching current variant
  const variantCars = useMemo(() => {
    return modelCars.filter((c) => c.variant === selectedVariant);
  }, [modelCars, selectedVariant]);

  // Available fuel types for current variant
  const availableFuels = useMemo(() => {
    return [...new Set(variantCars.map((c) => c.fuel_type))];
  }, [variantCars]);

  const [selectedFuel, setSelectedFuel] = useState<string>(initialCar?.fuel_type || availableFuels[0] || '');

  // Synchronize fuel if current selection doesn't exist for new variant
  React.useEffect(() => {
    if (!availableFuels.includes(selectedFuel) && availableFuels.length > 0) {
      setSelectedFuel(availableFuels[0]);
    }
  }, [availableFuels, selectedFuel]);

  // Available transmissions for variant + fuel
  const availableTransmissions = useMemo(() => {
    return [
      ...new Set(
        variantCars
          .filter((c) => c.fuel_type === selectedFuel)
          .map((c) => c.transmission)
      ),
    ];
  }, [variantCars, selectedFuel]);

  const [selectedTransmission, setSelectedTransmission] = useState<string>(
    initialCar?.transmission || availableTransmissions[0] || ''
  );

  React.useEffect(() => {
    if (!availableTransmissions.includes(selectedTransmission) && availableTransmissions.length > 0) {
      setSelectedTransmission(availableTransmissions[0]);
    }
  }, [availableTransmissions, selectedTransmission]);

  // Available colors for variant + fuel + transmission
  const availableColors = useMemo(() => {
    return [
      ...new Set(
        variantCars
          .filter(
            (c) =>
              c.fuel_type === selectedFuel &&
              c.transmission === selectedTransmission
          )
          .map((c) => c.color)
      ),
    ];
  }, [variantCars, selectedFuel, selectedTransmission]);

  const [selectedColor, setSelectedColor] = useState<string>(
    initialCar?.color || availableColors[0] || ''
  );

  React.useEffect(() => {
    if (!availableColors.includes(selectedColor) && availableColors.length > 0) {
      setSelectedColor(availableColors[0]);
    }
  }, [availableColors, selectedColor]);

  // Branch selection
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    initialCar?.branch_id || branches[0]?.id || null
  );

  // Check matching available car in stock
  const exactAvailableCar = useMemo(() => {
    return modelCars.find(
      (c) =>
        c.status === 'Available' &&
        c.variant === selectedVariant &&
        c.fuel_type === selectedFuel &&
        c.transmission === selectedTransmission &&
        c.color === selectedColor &&
        (!selectedBranchId || c.branch_id === selectedBranchId)
    );
  }, [
    modelCars,
    selectedVariant,
    selectedFuel,
    selectedTransmission,
    selectedColor,
    selectedBranchId,
  ]);

  // Fallback available car in any branch if not in selected branch
  const anyBranchAvailableCar = useMemo(() => {
    return (
      exactAvailableCar ||
      modelCars.find(
        (c) =>
          c.status === 'Available' &&
          c.variant === selectedVariant &&
          c.fuel_type === selectedFuel &&
          c.transmission === selectedTransmission &&
          c.color === selectedColor
      ) ||
      modelCars.find(
        (c) =>
          c.status === 'Available' &&
          c.variant === selectedVariant
      )
    );
  }, [exactAvailableCar, modelCars, selectedVariant, selectedFuel, selectedTransmission, selectedColor]);

  const isAvailable = Boolean(exactAvailableCar || anyBranchAvailableCar);
  const activeCar = exactAvailableCar || anyBranchAvailableCar || variantCars[0] || modelCars[0];

  // Dynamic price calculation
  const currentPrice = Number(activeCar?.price || model.minPrice);

  // Highest priced variant index for "Top variant" badge
  const highestVariantName = useMemo(() => {
    if (!model.variants.length) return '';
    const sorted = [...model.variants].sort((a, b) => b.minPrice - a.minPrice);
    return sorted[0].name;
  }, [model.variants]);

  // Dialog States
  const [activeDialog, setActiveDialog] = useState<
    'none' | 'book' | 'appointment' | 'enquire' | 'request_unavailable'
  >('none');
  const [busy, setBusy] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Handle direct booking
  const handleConfirmBooking = async () => {
    if (!session) {
      toast.error('Please sign in to confirm your booking.');
      navigate({ to: '/auth', search: { mode: 'login' } });
      return;
    }

    setBusy(true);
    try {
      const res = await bookCarFn({
        data: {
          brand: model.brand,
          model: model.model,
          variant: selectedVariant,
          fuelType: selectedFuel,
          transmission: selectedTransmission,
          color: selectedColor,
          branchId: selectedBranchId || undefined,
          carId: exactAvailableCar?.id || anyBranchAvailableCar?.id || undefined,
          remarks,
        },
      });

      if (res.success) {
        toast.success(`Booking confirmed for ${model.brand} ${model.model}! Token amount recorded.`);
        setActiveDialog('none');
        query.invalidateQueries();
        navigate({ to: '/workspace' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Booking could not be confirmed.');
    } finally {
      setBusy(false);
    }
  };

  // Handle unavailable demand request
  const handleConfirmRequest = async () => {
    setBusy(true);
    try {
      const res = await requestCarFn({
        data: {
          brand: model.brand,
          model: model.model,
          variant: selectedVariant,
          branchId: selectedBranchId || branches[0]?.id,
          fuelType: selectedFuel,
          transmission: selectedTransmission,
          color: selectedColor,
          remarks,
        },
      });

      if (res.success) {
        toast.success('Car procurement demand recorded! Our branch manager will notify you when allocation starts.');
        setActiveDialog('none');
        query.invalidateQueries();
      }
    } catch (err: any) {
      toast.error(err.message || 'Request could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  // Handle test drive / showroom appointment
  const handleConfirmAppointment = async () => {
    if (!appointmentDate) {
      toast.error('Please choose a preferred appointment date & time.');
      return;
    }
    setBusy(true);
    try {
      await submitEnquiryFn({
        data: {
          branchId: selectedBranchId || branches[0]?.id,
          carId: exactAvailableCar?.id || null,
          enquiryType: 'Appointment',
          remarks: `Showroom test drive appointment for ${model.brand} ${model.model} (${selectedVariant}). ${remarks}`,
          requestedBrand: model.brand,
          requestedModel: model.model,
          requestedVariant: selectedVariant,
          appointmentDate: new Date(appointmentDate).toISOString(),
        },
      });
      toast.success('Appointment scheduled! Your branch concierge will call to confirm.');
      setActiveDialog('none');
      query.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || 'Appointment could not be scheduled.');
    } finally {
      setBusy(false);
    }
  };

  // Image resolution
  const imageSrc = model.image;

  return (
    <div className="content-width page-body pb-24">
      {/* Back button */}
      <Link
        to="/cars"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the collection
      </Link>

      {/* Main Grid: Left Vehicle Visual & Specs, Right Interactive Configurator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Hero visual, 3D Link, Specs summary */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Main Visual Card */}
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={`${model.brand} ${model.model}`}
                className="h-full w-full object-cover"
                width={1280}
                height={720}
              />
            ) : (
              <CarSilhouettePlaceholder brand={model.brand} model={model.model} variant="hero" />
            )}

            {/* Availability Badge */}
            <div className="absolute top-4 left-4 z-10">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-xs ${
                  isAvailable
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-muted-foreground/30 bg-muted/70 text-muted-foreground'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isAvailable ? 'bg-emerald-500' : 'bg-muted-foreground'
                  }`}
                />
                {isAvailable ? 'In Stock Ready for Delivery' : 'Demand-Driven Procurement'}
              </span>
            </div>

            {/* 3D Engineering Section Link Pill */}
            <div className="absolute bottom-4 right-4 z-10">
              <Link
                to="/#engineering"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-xs transition-all hover:bg-foreground hover:text-background"
              >
                <Box className="h-3.5 w-3.5" />
                Explore components in 3D
              </Link>
            </div>
          </div>

          {/* Quick Specifications Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Fuel</span>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                {selectedFuel || 'Multi-fuel'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Transmission</span>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                {selectedTransmission || 'Automatic'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Exterior</span>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                {selectedColor || 'Multiple'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Warranty</span>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                3 Yr / 1,00,000 km
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Official dealership inventory · Sample ex-showroom price · Final on-road quotation includes RTO registration, GST, and insurance calculated per branch city.
          </p>
        </div>

        {/* Right Column (5 cols): Interactive Variant, Combos & Actions */}
        <div className="lg:col-span-5 flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
          {/* Header Title & Pricing */}
          <div>
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {model.brand}
            </span>
            <h1 className="text-3xl font-light tracking-tight text-foreground mt-0.5">
              {model.model}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedVariant} · Model Year {activeCar?.year || 2026}
            </p>

            {/* Dynamic Price Display */}
            <div className="mt-4 border-t border-border/60 pt-4 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-light tracking-tight text-foreground">
                  {lakhs(currentPrice)}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({money(currentPrice)})
                </span>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  Sample ex-showroom price
                </p>
              </div>

              {/* In-Stock or Unavailable indicator */}
              <div>
                {isAvailable ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    In Stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    On Demand
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 1. Variant Selector (Pill buttons ordered by price) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">Select Variant</span>
              <span className="text-[11px] text-muted-foreground">Ordered by price</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {model.variants.map((v) => {
                const isSelected = v.name === selectedVariant;
                const isTop = v.name === highestVariantName && model.variants.length > 1;

                return (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setSelectedVariant(v.name)}
                    className={`relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-foreground text-background shadow-xs'
                        : 'border border-border bg-card text-foreground hover:border-foreground/40'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span className="opacity-70 text-[11px]">{lakhs(v.minPrice)}</span>
                    {isTop && (
                      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full font-semibold ${
                        isSelected ? 'bg-background/20 text-background' : 'bg-secondary text-secondary-foreground'
                      }`}>
                        Top
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Powertrain & Transmission Combos (Only combinations that exist) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Fuel Type */}
            <div>
              <span className="text-xs font-medium text-foreground block mb-2">Powertrain</span>
              <div className="flex flex-wrap gap-1.5">
                {availableFuels.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFuel(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      f === selectedFuel
                        ? 'bg-foreground text-background'
                        : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Transmission */}
            <div>
              <span className="text-xs font-medium text-foreground block mb-2">Transmission</span>
              <div className="flex flex-wrap gap-1.5">
                {availableTransmissions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTransmission(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      t === selectedTransmission
                        ? 'bg-foreground text-background'
                        : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Colour Selection */}
          {availableColors.length > 0 && (
            <div>
              <span className="text-xs font-medium text-foreground block mb-2">Colour</span>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((color) => {
                  const isSelected = color === selectedColor;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? 'border border-foreground bg-secondary text-foreground font-semibold'
                          : 'border border-border bg-card text-muted-foreground hover:border-foreground/30'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full border border-border/80 bg-foreground/70" />
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Branch Live Availability List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">Branch Availability</span>
              <span className="text-[11px] text-muted-foreground">Select preferred showroom</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
              {branches.map((b) => {
                const countAtBranch = modelCars.filter(
                  (c) => c.branch_id === b.id && c.status === 'Available'
                ).length;
                const isSelected = b.id === selectedBranchId;

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBranchId(b.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-foreground/50 bg-secondary/80 text-foreground'
                        : 'border-border/60 bg-card text-muted-foreground hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{b.city}</span>
                      <span className="text-[11px] text-muted-foreground">({b.branch_name})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {countAtBranch > 0 ? (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          {countAtBranch} in stock
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Demand Order</span>
                      )}
                      {isSelected && <Check className="h-3.5 w-3.5 text-foreground" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Primary Action Buttons */}
          <div className="border-t border-border/60 pt-4 flex flex-col gap-2.5">
            {isAvailable ? (
              <>
                <Button
                  size="lg"
                  className="w-full text-sm font-medium"
                  onClick={() => setActiveDialog('book')}
                >
                  Book Car <ArrowLeft className="h-4 w-4 rotate-180 ml-1.5" />
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveDialog('appointment')}
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    Appointment
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveDialog('enquire')}
                  >
                    Enquire Now
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="w-full text-sm font-medium"
                  onClick={() => setActiveDialog('request_unavailable')}
                >
                  Request this car (Demand Procurement)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveDialog('enquire')}
                >
                  Enquire with Branch
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 6. Variant Comparison Table */}
      <div className="mt-16 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="mb-6">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            SPECIFICATION MATRIX
          </span>
          <h2 className="text-xl font-light tracking-tight text-foreground mt-0.5">
            {model.brand} {model.model} Variant Comparison
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Side-by-side comparison across engine options, transmissions, and ex-showroom pricing.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 text-muted-foreground">
                <th className="pb-3 font-semibold uppercase tracking-wider">Variant</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Ex-Showroom</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Fuel Options</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Transmission</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Available Colours</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Stock Status</th>
                <th className="pb-3 font-semibold uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {model.variants.map((v) => {
                const isSelected = v.name === selectedVariant;
                return (
                  <tr
                    key={v.name}
                    className={`transition-colors ${
                      isSelected ? 'bg-secondary/40 font-medium' : 'hover:bg-muted/30'
                    }`}
                  >
                    <td className="py-3.5 pr-4 text-foreground">
                      <div className="flex items-center gap-1.5">
                        {v.name}
                        {v.name === highestVariantName && model.variants.length > 1 && (
                          <span className="text-[9px] uppercase tracking-wider bg-secondary px-1.5 py-0.5 rounded-full font-semibold">
                            Top
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-foreground font-medium">{lakhs(v.minPrice)}</td>
                    <td className="py-3.5 pr-4 text-muted-foreground">{v.fuelTypes.join(', ')}</td>
                    <td className="py-3.5 pr-4 text-muted-foreground">{v.transmissions.join(', ')}</td>
                    <td className="py-3.5 pr-4 text-muted-foreground">{v.colors.join(', ')}</td>
                    <td className="py-3.5 pr-4">
                      {v.availableCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {v.availableCount} ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                          On Demand
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right">
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => setSelectedVariant(v.name)}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIALOG 1: Book Car Confirmation Dialog */}
      <Dialog open={activeDialog === 'book'} onOpenChange={(open) => !open && setActiveDialog('none')}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Confirm Vehicle Booking</DialogTitle>
            <DialogDescription>
              Reserve this vehicle directly from dealership inventory. Server will verify live availability before issuing your booking order.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 my-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle:</span>
              <span className="font-medium text-foreground">{model.brand} {model.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Variant:</span>
              <span className="font-medium text-foreground">{selectedVariant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Specifications:</span>
              <span className="font-medium text-foreground">{selectedFuel} · {selectedTransmission} · {selectedColor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Showroom:</span>
              <span className="font-medium text-foreground">
                {branches.find((b) => b.id === selectedBranchId)?.city || 'Assigned HQ'}
              </span>
            </div>
            <div className="border-t border-border/60 pt-2 flex justify-between text-sm">
              <span className="font-medium text-foreground">Ex-Showroom Price:</span>
              <span className="font-semibold text-foreground">{money(currentPrice)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Standard Token (5%):</span>
              <span className="font-medium text-foreground">{money(Math.round(currentPrice * 0.05))}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Customer Remarks or Delivery Requests (Optional)
            </label>
            <textarea
              className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-hidden"
              rows={2}
              placeholder="E.g., Preferred registration month, accessory packages..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setActiveDialog('none')} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBooking} disabled={busy}>
              {busy ? 'Verifying & Reserving...' : 'Confirm Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Request Appointment / Test Drive Dialog */}
      <Dialog open={activeDialog === 'appointment'} onOpenChange={(open) => !open && setActiveDialog('none')}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Schedule Showroom Appointment</DialogTitle>
            <DialogDescription>
              Book a test drive or showroom walkthrough for the {model.brand} {model.model}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 my-2 text-xs">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Preferred Date & Time Slot
              </label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Notes for the Branch Consultant (Optional)
              </label>
              <textarea
                className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-hidden"
                rows={2}
                placeholder="E.g., Interested in exchange evaluation or financing options..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setActiveDialog('none')} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAppointment} disabled={busy}>
              {busy ? 'Submitting...' : 'Confirm Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Unavailable Car Demand Procurement Dialog */}
      <Dialog open={activeDialog === 'request_unavailable'} onOpenChange={(open) => !open && setActiveDialog('none')}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Place Manufacturer Procurement Request</DialogTitle>
            <DialogDescription>
              This vehicle configuration is currently out of stock. Submitting this request creates an authentic customer demand record to initiate factory procurement.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2 text-xs my-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model & Variant:</span>
              <span className="font-medium text-foreground">{model.brand} {model.model} {selectedVariant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Specs:</span>
              <span className="font-medium text-foreground">{selectedFuel} · {selectedTransmission} · {selectedColor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fulfillment Branch:</span>
              <span className="font-medium text-foreground">
                {branches.find((b) => b.id === selectedBranchId)?.city || 'Assigned HQ'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Timeline or Specific Requirements (Optional)
            </label>
            <textarea
              className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-hidden"
              rows={2}
              placeholder="E.g., Need delivery within 30 days, flexible on colour..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setActiveDialog('none')} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRequest} disabled={busy}>
              {busy ? 'Submitting Demand...' : 'Submit Procurement Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: General Enquiry Dialog */}
      <Dialog open={activeDialog === 'enquire'} onOpenChange={(open) => !open && setActiveDialog('none')}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Enquire About {model.brand} {model.model}</DialogTitle>
            <DialogDescription>
              Submit an enquiry to get on-road pricing details, financing quotes, or accessories brochures.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Enquiry Details</label>
              <textarea
                className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-hidden"
                rows={3}
                placeholder="What would you like to know about this model?"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setActiveDialog('none')} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setBusy(true);
                try {
                  await submitEnquiryFn({
                    data: {
                      branchId: selectedBranchId || branches[0]?.id,
                      carId: activeCar?.id || null,
                      enquiryType: 'Car Enquiry',
                      remarks: `Enquiry on ${model.brand} ${model.model} ${selectedVariant}. ${remarks}`,
                      requestedBrand: model.brand,
                      requestedModel: model.model,
                      requestedVariant: selectedVariant,
                    },
                  });
                  toast.success('Enquiry sent! A customer consultant will contact you.');
                  setActiveDialog('none');
                } catch (e: any) {
                  toast.error(e.message || 'Failed to submit enquiry.');
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              {busy ? 'Sending...' : 'Send Enquiry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
