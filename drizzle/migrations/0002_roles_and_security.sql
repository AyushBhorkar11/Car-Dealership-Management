-- Drizzle migration: 0002_roles_and_security.sql
-- Non-destructive extension of CDMS database schema with RBAC, audit logging, quotations, payments, and workflow tracking.

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role text NOT NULL,
    branch_id uuid REFERENCES public.branches(id),
    action text NOT NULL,
    entity text NOT NULL,
    entity_id text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_owner_read ON public.audit_logs 
    FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY audit_logs_insert ON public.audit_logs 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- 2. Create login_events table
CREATE TABLE IF NOT EXISTS public.login_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role text NOT NULL,
    branch_id uuid REFERENCES public.branches(id),
    event_type text NOT NULL CHECK (event_type IN ('login', 'logout', 'failed_login')),
    ip text NOT NULL DEFAULT '',
    user_agent text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY login_events_owner_read ON public.login_events 
    FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY login_events_insert ON public.login_events 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- 3. Create accessories_catalogue table
CREATE TABLE IF NOT EXISTS public.accessories_catalogue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name text NOT NULL,
    brand text NOT NULL DEFAULT '',
    price numeric(14,2) NOT NULL CHECK (price >= 0),
    category text NOT NULL DEFAULT 'General',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.accessories_catalogue TO anon, authenticated;
GRANT ALL ON public.accessories_catalogue TO service_role;
ALTER TABLE public.accessories_catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY accessories_public_read ON public.accessories_catalogue 
    FOR SELECT TO anon, authenticated 
    USING (true);

CREATE POLICY accessories_owner_write ON public.accessories_catalogue 
    FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'owner'))
    WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- 4. Create quotations table
CREATE TABLE IF NOT EXISTS public.quotations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number text UNIQUE NOT NULL,
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    employee_id uuid NOT NULL REFERENCES public.employees(id),
    branch_id uuid NOT NULL REFERENCES public.branches(id),
    car_id uuid REFERENCES public.cars(id),
    brand text NOT NULL,
    model text NOT NULL,
    variant text NOT NULL,
    color text NOT NULL DEFAULT '',
    ex_showroom_price numeric(14,2) NOT NULL CHECK (ex_showroom_price >= 0),
    gst_rate numeric(5,2) NOT NULL DEFAULT 28.00,
    gst_amount numeric(14,2) NOT NULL DEFAULT 0,
    insurance_amount numeric(14,2) NOT NULL DEFAULT 0,
    rto_tax numeric(14,2) NOT NULL DEFAULT 0,
    accessories_amount numeric(14,2) NOT NULL DEFAULT 0,
    discount_amount numeric(14,2) NOT NULL DEFAULT 0,
    max_allowed_discount numeric(14,2) NOT NULL DEFAULT 25000,
    discount_approval_status text NOT NULL DEFAULT 'APPROVED' CHECK (discount_approval_status IN ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    discount_approved_by uuid REFERENCES public.employees(id),
    discount_remarks text NOT NULL DEFAULT '',
    on_road_price numeric(14,2) NOT NULL CHECK (on_road_price >= 0),
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_CUSTOMER', 'CONVERTED_TO_BOOKING', 'EXPIRED', 'REJECTED')),
    valid_until date NOT NULL DEFAULT (current_date + interval '15 days'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotations_read ON public.quotations 
    FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'owner') OR public.branch_access(branch_id));

CREATE POLICY quotations_write ON public.quotations 
    FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'owner') OR public.branch_access(branch_id))
    WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.branch_access(branch_id));

-- 5. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_no text UNIQUE NOT NULL,
    sale_id uuid REFERENCES public.sales(id),
    enquiry_id uuid REFERENCES public.enquiries(id),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    branch_id uuid NOT NULL REFERENCES public.branches(id),
    recorded_by uuid NOT NULL REFERENCES public.employees(id),
    amount numeric(14,2) NOT NULL CHECK (amount > 0),
    payment_type text NOT NULL CHECK (payment_type IN ('BOOKING', 'DOWN_PAYMENT', 'BALANCE', 'REFUND')),
    payment_method text NOT NULL CHECK (payment_method IN ('cash', 'upi', 'cheque', 'loan', 'bank_transfer')),
    payment_status text NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED')),
    transaction_reference text NOT NULL DEFAULT '',
    remarks text NOT NULL DEFAULT '',
    payment_date timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_read ON public.payments 
    FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'owner') OR public.branch_access(branch_id));

CREATE POLICY payments_write ON public.payments 
    FOR INSERT TO authenticated 
    WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.branch_access(branch_id));

-- 6. Non-destructively alter existing tables with extension columns

-- Employees: add monthly target and active flag
ALTER TABLE public.employees 
    ADD COLUMN IF NOT EXISTS monthly_target integer NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Customers: add city and ID proof reference
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS id_proof_type text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS id_proof_number text NOT NULL DEFAULT '';

-- Enquiries: add workflow stage, budget, timeline, follow-up, test drive specifics, quotation link
ALTER TABLE public.enquiries 
    ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'NEW',
    ADD COLUMN IF NOT EXISTS preferred_budget numeric(14,2),
    ADD COLUMN IF NOT EXISTS expected_timeline text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS preferred_color text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS follow_up_date timestamptz,
    ADD COLUMN IF NOT EXISTS test_drive_feedback text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS test_drive_car_id uuid REFERENCES public.cars(id),
    ADD COLUMN IF NOT EXISTS test_drive_slot text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations(id),
    ADD COLUMN IF NOT EXISTS booking_amount numeric(14,2) NOT NULL DEFAULT 0;

-- Purchases: add demand-driven procurement stage and linkage
ALTER TABLE public.purchases 
    ADD COLUMN IF NOT EXISTS procurement_stage text NOT NULL DEFAULT 'REQUESTED',
    ADD COLUMN IF NOT EXISTS enquiry_id uuid REFERENCES public.enquiries(id),
    ADD COLUMN IF NOT EXISTS expected_delivery_date date,
    ADD COLUMN IF NOT EXISTS manager_approved_by uuid REFERENCES public.employees(id),
    ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS owner_approved_by uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS owner_approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS rejection_reason text NOT NULL DEFAULT '';

-- Cars: add inventory status workflow and allocation
ALTER TABLE public.cars 
    ADD COLUMN IF NOT EXISTS inventory_status text NOT NULL DEFAULT 'IN_STOCK',
    ADD COLUMN IF NOT EXISTS allocated_enquiry_id uuid REFERENCES public.enquiries(id),
    ADD COLUMN IF NOT EXISTS stock_arrival_date date DEFAULT current_date;

-- Sales: add delivery checklist and booking link
ALTER TABLE public.sales 
    ADD COLUMN IF NOT EXISTS booking_enquiry_id uuid REFERENCES public.enquiries(id),
    ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS rto_number text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS insurance_policy_number text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS documents_verified boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS handover_date date,
    ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'SCHEDULED';
