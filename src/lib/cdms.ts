export interface Car {
  id: string;
  brand: string;
  model: string;
  variant: string;
  price: string | number;
  year?: number;
  color?: string;
  fuel_type?: string;
  fuelType?: string;
  transmission?: string;
  seating_capacity?: number;
  mileage?: string;
  engine_cc?: number;
  status: string;
  branch_id?: string;
  branchId?: string;
  transfer_to?: string | null;
  vin_chassis_no?: string;
  vinChassisNo?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Branch {
  id: string;
  branch_name: string;
  city: string;
  address: string;
  phone: string;
  demand_threshold?: number;
  created_at?: string;
}

export const money = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value));

export const lakhs = (value: number | string) =>
  `₹${(Number(value) / 100000).toFixed(2)} lakh`;

export function paymentSummary(amount: number, paid: number) {
  if (amount <= 0 || paid < 0 || paid > amount)
    throw new Error('Invalid payment amount');
  return {
    outstanding: amount - paid,
    status: paid === amount ? 'Completed' : paid > 0 ? 'Partial' : 'Pending',
  };
}

export function aggregateDemand(
  rows: {
    requested_brand: string;
    requested_model: string;
    requested_variant: string;
    customer_id: string;
    branch_id: string;
  }[]
) {
  const groups = new Map<
    string,
    {
      brand: string;
      model: string;
      variant: string;
      branch_id: string;
      requests: number;
      customers: Set<string>;
    }
  >();
  rows.forEach((r) => {
    const key = [
      r.requested_brand.toLowerCase(),
      r.requested_model.toLowerCase(),
      r.requested_variant.toLowerCase(),
      r.branch_id,
    ].join('|');
    const g =
      groups.get(key) ?? {
        brand: r.requested_brand,
        model: r.requested_model,
        variant: r.requested_variant,
        branch_id: r.branch_id,
        requests: 0,
        customers: new Set<string>(),
      };
    g.requests++;
    g.customers.add(r.customer_id);
    groups.set(key, g);
  });
  return [...groups.values()].map((g) => ({
    ...g,
    customers: g.customers.size,
    repeats: g.requests - g.customers.size,
  }));
}
