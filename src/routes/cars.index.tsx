import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  FilterX,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { catalogueQuery } from '@/lib/catalogue-query';
import { ModelCard } from '@/components/cdms/car-card';
import { EnquiryForm } from '@/components/cdms/enquiry-form';
import type { GroupedModel, PublicCar } from '@/lib/catalogue.functions';
import { getModelImage, getModelSlug } from '@/lib/catalogue.functions';

interface CarsSearchParams {
  q?: string;
  brand?: string;
  branch?: string;
  fuel?: string;
  transmission?: string;
  max?: string;
  available?: boolean;
  sort?: 'low' | 'high' | 'brand' | 'year';
  page?: number;
  request?: boolean;
}

export const Route = createFileRoute('/cars/')({
  validateSearch: (s: Record<string, unknown>): CarsSearchParams => ({
    q: typeof s.q === 'string' ? s.q : undefined,
    brand: typeof s.brand === 'string' ? s.brand : undefined,
    branch: typeof s.branch === 'string' ? s.branch : undefined,
    fuel: typeof s.fuel === 'string' ? s.fuel : undefined,
    transmission: typeof s.transmission === 'string' ? s.transmission : undefined,
    max: typeof s.max === 'string' ? s.max : undefined,
    available: s.available === undefined ? true : s.available === true || s.available === 'true',
    sort: (['low', 'high', 'brand', 'year'].includes(s.sort as string)
      ? (s.sort as any)
      : 'brand'),
    page: typeof s.page === 'number' ? s.page : Number(s.page) || 1,
    request: s.request === true || s.request === 'true',
  }),
  head: () => ({
    meta: [
      { title: 'Explore New Cars — CDMS Model Catalogue' },
      {
        name: 'description',
        content:
          'Explore new car models grouped by brand, with live branch availability, transparent ex-showroom pricing, and demand-driven procurement.',
      },
      { property: 'og:title', content: 'Explore New Cars — CDMS Model Catalogue' },
      {
        property: 'og:description',
        content: 'Discover your next drive across connected dealership branches in India.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogueQuery),
  component: CarsCatalogue,
});

function CarsCatalogue() {
  const { data } = useSuspenseQuery(catalogueQuery);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const q = search.q || '';
  const brand = search.brand || '';
  const branch = search.branch || '';
  const fuel = search.fuel || '';
  const transmission = search.transmission || '';
  const max = search.max || '';
  const availableOnly = search.available !== false;
  const sort = search.sort || 'brand';
  const page = search.page || 1;
  const showRequestForm = search.request || false;

  const updateFilters = (newParams: Partial<CarsSearchParams>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...newParams,
        page: newParams.page !== undefined ? newParams.page : 1,
      }),
      replace: true,
    });
  };

  const clearAllFilters = () => {
    navigate({
      search: () => ({
        available: true,
        sort: 'brand',
        page: 1,
      }),
      replace: true,
    });
  };

  // 1. Filter underlying cars based on all criteria
  const matchingCars = useMemo(() => {
    return data.cars.filter((c: PublicCar) => {
      if (availableOnly && c.status !== 'Available') return false;
      if (brand && c.brand.toLowerCase() !== brand.toLowerCase()) return false;
      if (branch && c.branch_id !== branch) return false;
      if (fuel && c.fuel_type.toLowerCase() !== fuel.toLowerCase()) return false;
      if (transmission && c.transmission.toLowerCase() !== transmission.toLowerCase()) return false;
      if (max && Number(c.price) > Number(max)) return false;
      if (q) {
        const query = q.toLowerCase();
        const searchStr = `${c.brand} ${c.model} ${c.variant} ${c.color}`.toLowerCase();
        if (!searchStr.includes(query)) return false;
      }
      return true;
    });
  }, [data.cars, availableOnly, brand, branch, fuel, transmission, max, q]);

  // 2. Group the matching cars into one card per model
  const groupedModels = useMemo<GroupedModel[]>(() => {
    const map = new Map<string, PublicCar[]>();
    for (const c of matchingCars) {
      const key = `${c.brand}:::${c.model}`;
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    }

    const result: GroupedModel[] = [];

    for (const [key, modelCars] of map.entries()) {
      const [bName, mName] = key.split(':::');
      const slug = getModelSlug(bName, mName);
      const availableUnits = modelCars.filter((c) => c.status === 'Available');

      const prices = (availableUnits.length > 0 ? availableUnits : modelCars).map((c) => Number(c.price));
      const allPrices = modelCars.map((c) => Number(c.price));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...allPrices);

      let availability: 'Available' | 'Limited' | 'Unavailable' = 'Unavailable';
      if (availableUnits.length > 2) {
        availability = 'Available';
      } else if (availableUnits.length > 0) {
        availability = 'Limited';
      }

      // Variant summary
      const vMap = new Map<string, PublicCar[]>();
      for (const c of modelCars) {
        const vList = vMap.get(c.variant) || [];
        vList.push(c);
        vMap.set(c.variant, vList);
      }
      const variants = Array.from(vMap.entries()).map(([name, cars]) => ({
        name,
        minPrice: Math.min(...cars.map((c) => Number(c.price))),
        availableCount: cars.filter((c) => c.status === 'Available').length,
        fuelTypes: [...new Set(cars.map((c) => c.fuel_type))],
        transmissions: [...new Set(cars.map((c) => c.transmission))],
        colors: [...new Set(cars.map((c) => c.color))],
      }));

      // Branch summary
      const brSet = new Set(modelCars.map((c) => c.branch_id).filter(Boolean));
      const branchAvailability = Array.from(brSet).map((bId) => {
        const brObj = data.branches.find((b: any) => b.id === bId);
        const bCars = modelCars.filter((c) => c.branch_id === bId);
        return {
          branchId: bId!,
          branchName: brObj?.branch_name || 'Branch',
          city: brObj?.city || 'HQ',
          availableCount: bCars.filter((c) => c.status === 'Available').length,
          totalCount: bCars.length,
        };
      });

      result.push({
        slug,
        brand: bName,
        model: mName,
        image: getModelImage(bName, mName),
        minPrice,
        maxPrice,
        availableCount: availableUnits.length,
        totalCount: modelCars.length,
        availability,
        variantCount: variants.length,
        branchCount: branchAvailability.filter((b) => b.availableCount > 0).length || branchAvailability.length,
        fuelTypes: [...new Set(modelCars.map((c) => c.fuel_type))],
        transmissions: [...new Set(modelCars.map((c) => c.transmission))],
        colors: [...new Set(modelCars.map((c) => c.color))],
        years: [...new Set(modelCars.map((c) => c.year))],
        variants,
        branchAvailability,
      });
    }

    // Sort models
    return result.sort((a, b) => {
      if (sort === 'low') return a.minPrice - b.minPrice;
      if (sort === 'high') return b.minPrice - a.minPrice;
      if (sort === 'year') {
        const yA = Math.max(...a.years, 0);
        const yB = Math.max(...b.years, 0);
        return yB - yA;
      }
      return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);
    });
  }, [matchingCars, data.branches, sort]);

  // Pagination: 6 model cards per page
  const PAGE_SIZE = 6;
  const totalPages = Math.max(1, Math.ceil(groupedModels.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedModels = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return groupedModels.slice(start, start + PAGE_SIZE);
  }, [groupedModels, currentPage]);

  // Filter option lists
  const allBrands = useMemo(() => [...new Set(data.cars.map((c: any) => c.brand))].sort(), [data.cars]);
  const allFuelTypes = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];
  const allTransmissions = ['Automatic', 'Manual'];

  const hasActiveFilters = Boolean(q || brand || branch || fuel || transmission || max || !availableOnly);

  return (
    <main className="content-width page-body pb-20">
      {/* Intro Heading */}
      <div className="page-intro">
        <span className="eyebrow">THE COLLECTION</span>
        <h1 className="page-title">Your next drive awaits.</h1>
        <p className="page-description">
          Explore authentic models across all connected branches. Transparent pricing, no duplicate cards, demand-driven fulfillment.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="filters">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <input
            className="search-field w-full pl-9"
            placeholder="Search brand, model, or variant..."
            aria-label="Search models"
            value={q}
            onChange={(e) => updateFilters({ q: e.target.value })}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Brand Select */}
        <select
          aria-label="Filter by brand"
          value={brand}
          onChange={(e) => updateFilters({ brand: e.target.value })}
        >
          <option value="">All Brands</option>
          {allBrands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Branch Select */}
        <select
          aria-label="Filter by branch"
          value={branch}
          onChange={(e) => updateFilters({ branch: e.target.value })}
        >
          <option value="">All Branches</option>
          {data.branches.map((b: any) => (
            <option key={b.id} value={b.id}>
              {b.city} ({b.branch_name})
            </option>
          ))}
        </select>

        {/* Fuel Type Select */}
        <select
          aria-label="Filter by fuel type"
          value={fuel}
          onChange={(e) => updateFilters({ fuel: e.target.value })}
        >
          <option value="">All Fuel Types</option>
          {allFuelTypes.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        {/* Transmission Select */}
        <select
          aria-label="Filter by transmission"
          value={transmission}
          onChange={(e) => updateFilters({ transmission: e.target.value })}
        >
          <option value="">All Transmissions</option>
          {allTransmissions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Price Cap Select */}
        <select
          aria-label="Filter by maximum price"
          value={max}
          onChange={(e) => updateFilters({ max: e.target.value })}
        >
          <option value="">Any Price</option>
          <option value="2000000">Under ₹20 lakh</option>
          <option value="3500000">Under ₹35 lakh</option>
          <option value="5000000">Under ₹50 lakh</option>
          <option value="7500000">Under ₹75 lakh</option>
          <option value="10000000">Under ₹1 crore</option>
        </select>

        {/* Sorting Select */}
        <select
          aria-label="Sort models"
          value={sort}
          onChange={(e) => updateFilters({ sort: e.target.value as any })}
        >
          <option value="brand">Brand (A–Z)</option>
          <option value="low">Price: Low to High</option>
          <option value="high">Price: High to Low</option>
          <option value="year">Newest Model Year</option>
        </select>

        {/* Available Only Checkbox */}
        <label className="flex items-center gap-2 text-xs font-normal text-foreground cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            className="w-auto rounded accent-foreground cursor-pointer"
            checked={availableOnly}
            onChange={(e) => updateFilters({ available: e.target.checked })}
          />
          Available only
        </label>

        {/* Reset Filters Button if active */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground h-9"
          >
            <FilterX className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Metrics note */}
      <div className="flex items-center justify-between mb-6 text-xs text-muted-foreground">
        <p className="sample-label">
          Showing {groupedModels.length} distinct {groupedModels.length === 1 ? 'model' : 'models'} (
          {matchingCars.length} vehicles matching) · Demo inventory & sample prices
        </p>
      </div>

      {/* Grouped Models Grid */}
      {groupedModels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {paginatedModels.map((m) => (
            <ModelCard key={m.slug} model={m} />
          ))}
        </div>
      ) : (
        <div className="empty-state py-16 text-center border border-dashed border-border rounded-2xl bg-card/40 my-8">
          <Search className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No matching models found.
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            We couldn't find vehicles matching your active criteria. Try broadening your branch or price filters, or submit a demand request to have us procure it from the manufacturer.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearAllFilters}>
                Clear All Filters
              </Button>
            )}
            <Button onClick={() => updateFilters({ request: true })}>
              Request a car <Plus className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="pagination flex items-center justify-center gap-3 mt-8 mb-12">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => updateFilters({ page: currentPage - 1 })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={currentPage >= totalPages}
            onClick={() => updateFilters({ page: currentPage + 1 })}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Request an Unavailable Car Banner */}
      <div className="request-banner mt-12 rounded-2xl border border-border bg-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-base font-medium text-foreground">
            Looking for something specific?
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your request triggers manufacturer demand-driven procurement for your chosen branch.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => updateFilters({ request: !showRequestForm })}
        >
          {showRequestForm ? 'Close request form' : 'Request an unavailable car'}
          <Plus className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      {/* Expanded Request Form */}
      {showRequestForm && (
        <div className="request-form-section mt-6 p-6 rounded-2xl border border-border bg-card shadow-xs">
          <EnquiryForm branches={data.branches} type="Unavailable Car Request" />
        </div>
      )}
    </main>
  );
}
