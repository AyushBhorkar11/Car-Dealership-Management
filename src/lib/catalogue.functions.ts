import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export function getModelSlug(brand: string, model: string): string {
  return `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getModelImage(brand: string, model: string): string | null {
  const b = (brand || '').toLowerCase();
  const m = (model || '').toLowerCase();

  if (b.includes('audi') && m.includes('a4')) return '/cars/audi-a4.jpg';

  if (m.includes('3 series')) return '/cars/bmw-3-series.jpg';
  if (m.includes('city')) return '/cars/honda-city.jpg';
  if (m.includes('creta')) return '/cars/hyundai-creta.jpg';
  if (m.includes('seltos')) return '/cars/kia-seltos.jpg';
  if (m.includes('thar')) return '/cars/mahindra-thar.jpg';
  if (m.includes('xuv700') || m.includes('xuv 700')) return '/cars/mahindra-xuv700.jpg';
  if (m.includes('grand vitara') || m.includes('vitara')) return '/cars/maruti-grand-vitara.jpg';
  if (m.includes('c-class')) return '/cars/mercedes-c-class.jpg';
  if (m.includes('nexon')) return '/cars/tata-nexon.jpg';
  if (m.includes('fortuner')) return '/cars/toyota-fortuner.jpg';
  if (m.includes('innova') || m.includes('hycross')) return '/cars/toyota-innova.jpg';

  return null;
}

export interface PublicCar {
  id: string;
  brand: string;
  model: string;
  variant: string;
  year: number;
  price: string;
  color: string;
  fuel_type: string;
  transmission: string;
  status: string;
  branch_id: string | null;
  image_key?: string;
  created_at: string;
}

export interface GroupedModel {
  slug: string;
  brand: string;
  model: string;
  image: string | null;
  minPrice: number;
  maxPrice: number;
  availableCount: number;
  totalCount: number;
  availability: 'Available' | 'Limited' | 'Unavailable';
  variantCount: number;
  branchCount: number;
  fuelTypes: string[];
  transmissions: string[];
  colors: string[];
  years: number[];
  variants: {
    name: string;
    minPrice: number;
    availableCount: number;
    fuelTypes: string[];
    transmissions: string[];
    colors: string[];
  }[];
  branchAvailability: {
    branchId: string;
    branchName: string;
    city: string;
    availableCount: number;
    totalCount: number;
  }[];
}

export const getCatalogue = createServerFn({ method: 'GET' }).handler(async () => {
  const { db, schema } = await import('../server/db');
  const [carsList, branchesList] = await Promise.all([
    db.select().from(schema.cars),
    db.select().from(schema.branches),
  ]);

  // Sanitize cars: Public catalogue NEVER receives vin_chassis_no or supplier fields!
  const cars: PublicCar[] = carsList.map((c) => ({
    id: c.id,
    brand: c.brand,
    model: c.model,
    variant: c.variant,
    year: c.manufacturingYear,
    price: String(c.price),
    color: c.color,
    fuel_type: c.fuelType,
    transmission: c.transmission,
    status: c.status,
    branch_id: c.branchId,
    image_key: c.imageKey,
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  }));

  const branches = branchesList.map((b) => ({
    id: b.id,
    branch_name: b.branchName,
    city: b.city,
    address: b.address,
    phone: b.phone,
    demand_threshold: b.demandThreshold,
    created_at: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString(),
  }));

  // Group cars by brand and model
  const modelMap = new Map<string, PublicCar[]>();
  for (const car of cars) {
    const key = `${car.brand}:::${car.model}`;
    const list = modelMap.get(key) || [];
    list.push(car);
    modelMap.set(key, list);
  }

  const models: GroupedModel[] = [];

  for (const [key, groupCars] of modelMap.entries()) {
    const [brand, model] = key.split(':::');
    const slug = getModelSlug(brand, model);
    const availableCars = groupCars.filter((c) => c.status === 'Available');

    // Price calculation: lowest among available cars; if none available, lowest among all cars
    const prices = (availableCars.length > 0 ? availableCars : groupCars).map((c) => Number(c.price));
    const allPrices = groupCars.map((c) => Number(c.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...allPrices);

    // Availability status rule:
    // Available if > 2, Limited if 1-2, Unavailable if 0
    let availability: 'Available' | 'Limited' | 'Unavailable' = 'Unavailable';
    if (availableCars.length > 2) {
      availability = 'Available';
    } else if (availableCars.length > 0) {
      availability = 'Limited';
    }

    // Distinct variants
    const variantMap = new Map<string, PublicCar[]>();
    for (const c of groupCars) {
      const vList = variantMap.get(c.variant) || [];
      vList.push(c);
      variantMap.set(c.variant, vList);
    }

    const variants = Array.from(variantMap.entries())
      .map(([vName, vCars]) => ({
        name: vName,
        minPrice: Math.min(...vCars.map((c) => Number(c.price))),
        availableCount: vCars.filter((c) => c.status === 'Available').length,
        fuelTypes: [...new Set(vCars.map((c) => c.fuel_type))],
        transmissions: [...new Set(vCars.map((c) => c.transmission))],
        colors: [...new Set(vCars.map((c) => c.color))],
      }))
      .sort((a, b) => a.minPrice - b.minPrice);

    // Branch availability breakdown
    const branchMap = new Map<string, { branchName: string; city: string; available: number; total: number }>();
    for (const b of branches) {
      branchMap.set(b.id, { branchName: b.branch_name, city: b.city, available: 0, total: 0 });
    }
    for (const c of groupCars) {
      if (c.branch_id && branchMap.has(c.branch_id)) {
        const item = branchMap.get(c.branch_id)!;
        item.total += 1;
        if (c.status === 'Available') {
          item.available += 1;
        }
      }
    }

    const branchAvailability = Array.from(branchMap.entries())
      .filter(([_, data]) => data.total > 0)
      .map(([branchId, data]) => ({
        branchId,
        branchName: data.branchName,
        city: data.city,
        availableCount: data.available,
        totalCount: data.total,
      }));

    models.push({
      slug,
      brand,
      model,
      image: getModelImage(brand, model),
      minPrice,
      maxPrice,
      availableCount: availableCars.length,
      totalCount: groupCars.length,
      availability,
      variantCount: variants.length,
      branchCount: branchAvailability.filter((b) => b.availableCount > 0).length,
      fuelTypes: [...new Set(groupCars.map((c) => c.fuel_type))],
      transmissions: [...new Set(groupCars.map((c) => c.transmission))],
      colors: [...new Set(groupCars.map((c) => c.color))],
      years: [...new Set(groupCars.map((c) => c.year))],
      variants,
      branchAvailability,
    });
  }

  return { cars, branches, models };
});

// Book a car directly with server-side concurrency check
export const bookCarDirectlyServerFn = createServerFn({ method: 'POST' })
  .validator((d: {
    brand: string;
    model: string;
    variant?: string;
    branchId?: string;
    fuelType?: string;
    transmission?: string;
    color?: string;
    carId?: string;
    remarks?: string;
  }) => {
    return z
      .object({
        brand: z.string().min(1),
        model: z.string().min(1),
        variant: z.string().optional(),
        branchId: z.string().optional(),
        fuelType: z.string().optional(),
        transmission: z.string().optional(),
        color: z.string().optional(),
        carId: z.string().optional(),
        remarks: z.string().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const { getSessionUser } = await import('../server/auth');
    const { db, schema } = await import('../server/db');
    const { eq, and, sql } = await import('drizzle-orm');
    const crypto = await import('node:crypto');

    const user = await getSessionUser();
    if (!user) {
      throw new Error('Please sign in to book a vehicle.');
    }

    // Server-side availability re-check
    let carQuery = db
      .select()
      .from(schema.cars)
      .where(
        and(
          eq(schema.cars.brand, data.brand),
          eq(schema.cars.model, data.model),
          eq(schema.cars.status, 'Available')
        )
      );

    const availableCars = await carQuery;

    // Filter by requested specs
    let chosenCar = availableCars.find((c) => {
      if (data.carId && c.id !== data.carId) return false;
      if (data.variant && c.variant !== data.variant) return false;
      if (data.branchId && c.branchId !== data.branchId) return false;
      if (data.fuelType && c.fuelType !== data.fuelType) return false;
      if (data.transmission && c.transmission !== data.transmission) return false;
      if (data.color && c.color !== data.color) return false;
      return true;
    });

    // Fallback to any available car of this model/variant/branch if exact spec has a flex
    if (!chosenCar && availableCars.length > 0) {
      chosenCar = availableCars.find((c) => {
        if (data.variant && c.variant !== data.variant) return false;
        if (data.branchId && c.branchId !== data.branchId) return false;
        return true;
      }) || availableCars[0];
    }

    if (!chosenCar) {
      throw new Error(
        'Selected vehicle is no longer available in stock. Another customer may have just reserved it. You can place a procurement request instead.'
      );
    }

    // Ensure customer profile exists
    let customerId: string;
    const [existingCust] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.userId, user.id));

    const tokenAmount = Math.round(Number(chosenCar.price) * 0.05); // 5% standard booking token
    const enquiryId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      // Pessimistic lock on the selected car to prevent concurrent double-booking
      const [lockedCar] = await tx
        .select()
        .from(schema.cars)
        .where(eq(schema.cars.id, chosenCar.id))
        .for('update');

      if (!lockedCar || lockedCar.status !== 'Available' || lockedCar.inventoryStatus !== 'IN_STOCK') {
        throw new Error('This car was just reserved by another customer. Please choose another.');
      }

      // Ensure customer profile exists
      let customerId: string;
      const [existingCust] = await tx
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.userId, user.id));

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        customerId = crypto.randomUUID();
        await tx.insert(schema.customers).values({
          id: customerId,
          name: user.name || 'Valued Customer',
          email: user.email,
          phone: '',
          address: 'Direct Online Booking',
          city: '',
          userId: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Concurrency protection: Reserve car
      await tx
        .update(schema.cars)
        .set({
          status: 'Reserved',
          inventoryStatus: 'RESERVED',
          updatedAt: new Date(),
        })
        .where(eq(schema.cars.id, chosenCar.id));

      await tx.insert(schema.enquiries).values({
        id: enquiryId,
        customerId,
        branchId: chosenCar.branchId || data.branchId || null,
        carId: chosenCar.id,
        enquiryType: 'Booking Request',
        stage: 'BOOKED',
        status: 'Booked',
        bookingAmount: String(tokenAmount),
        remarks: `Direct online booking confirmed by ${user.name}. Token Amount: ₹${tokenAmount.toLocaleString('en-IN')}. ${data.remarks || ''}`,
        requestedBrand: chosenCar.brand,
        requestedModel: chosenCar.model,
        requestedVariant: chosenCar.variant,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { writeAudit } = await import('../server/audit');
      await writeAudit({
        tx,
        actor: {
          userId: user.id,
          role: user.role || 'CUSTOMER',
          branchId: chosenCar.branchId || data.branchId || null,
        },
        action: 'booking.confirmed',
        entity: 'enquiry',
        entityId: enquiryId,
        oldValue: { status: 'Available', inventoryStatus: 'IN_STOCK' },
        newValue: { status: 'Reserved', inventoryStatus: 'RESERVED', bookingAmount: tokenAmount },
        summary: `Customer ${user.name} directly booked ${chosenCar.brand} ${chosenCar.model} ${chosenCar.variant} (Token: ₹${tokenAmount.toLocaleString('en-IN')})`,
      });
    });

    return {
      success: true,
      enquiryId,
      carId: chosenCar.id,
      tokenAmount,
      car: {
        brand: chosenCar.brand,
        model: chosenCar.model,
        variant: chosenCar.variant,
        price: chosenCar.price,
      },
    };
  });

// Request an unavailable car (creates or updates demand count)
export const requestUnavailableCarServerFn = createServerFn({ method: 'POST' })
  .validator((d: {
    brand: string;
    model: string;
    variant?: string;
    branchId: string;
    fuelType?: string;
    transmission?: string;
    color?: string;
    remarks?: string;
  }) => {
    return z
      .object({
        brand: z.string().min(1),
        model: z.string().min(1),
        variant: z.string().optional(),
        branchId: z.string().min(1, 'Please select a preferred branch'),
        fuelType: z.string().optional(),
        transmission: z.string().optional(),
        color: z.string().optional(),
        remarks: z.string().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const { getSessionUser } = await import('../server/auth');
    const { db, schema } = await import('../server/db');
    const { eq } = await import('drizzle-orm');
    const crypto = await import('node:crypto');

    const user = await getSessionUser();
    let customerId: string;

    const enquiryId = crypto.randomUUID();
    const fullRemarks = [
      `Customer requested unavailable model: ${data.brand} ${data.model} ${data.variant || ''}`,
      data.fuelType ? `Fuel: ${data.fuelType}` : '',
      data.transmission ? `Transmission: ${data.transmission}` : '',
      data.color ? `Preferred Colour: ${data.color}` : '',
      data.remarks ? `Notes: ${data.remarks}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    await db.transaction(async (tx) => {
      if (user) {
        const [existingCust] = await tx
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.userId, user.id));
        if (existingCust) {
          customerId = existingCust.id;
        } else {
          customerId = crypto.randomUUID();
          await tx.insert(schema.customers).values({
            id: customerId,
            name: user.name || 'Guest Customer',
            email: user.email,
            phone: '',
            address: 'Demand Procurement Request',
            city: '',
            userId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        customerId = crypto.randomUUID();
        await tx.insert(schema.customers).values({
          id: customerId,
          name: 'Guest Customer',
          email: '',
          phone: '',
          address: 'Demand Procurement Request',
          city: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await tx.insert(schema.enquiries).values({
        id: enquiryId,
        customerId,
        branchId: data.branchId,
        carId: null,
        enquiryType: 'Unavailable Car Request',
        stage: 'NEW',
        status: 'New',
        remarks: fullRemarks,
        requestedBrand: data.brand,
        requestedModel: data.model,
        requestedVariant: data.variant || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { writeAudit } = await import('../server/audit');
      await writeAudit({
        tx,
        actor: {
          userId: user?.id || customerId,
          role: user?.role || 'CUSTOMER',
          branchId: data.branchId,
        },
        action: 'lead.procurement_requested',
        entity: 'enquiry',
        entityId: enquiryId,
        oldValue: null,
        newValue: { ...data, customerId, fullRemarks },
        summary: `Demand procurement enquiry submitted for ${data.brand} ${data.model} at branch ${data.branchId}`,
      });
    });

    return { success: true, enquiryId };
  });
