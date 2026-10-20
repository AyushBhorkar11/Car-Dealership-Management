import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { useSession } from './session';
import { Link } from '@tanstack/react-router';
import type { Branch, Car } from '@/lib/cdms';
import { submitPublicEnquiry } from '@/lib/cdms.functions';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function EnquiryForm({
  branches,
  car,
  type = 'Car Enquiry',
}: {
  branches: Branch[];
  car?: Car;
  type?: string;
}) {
  const { session } = useSession();
  const query = useQueryClient();
  const submitPublicEnquiryFn = useServerFn(submitPublicEnquiry);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [kind, setKind] = useState(type);

  if (!session) {
    return (
      <div className="signin-inline">
        <h3>Let’s make it your next drive.</h3>
        <p>Sign in to send an enquiry or request a test drive.</p>
        <Button asChild>
          <Link to="/auth" search={{ mode: 'login' }}>
            Sign in to continue <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="success-state">
        <CheckCircle2 />
        <h3>Request received.</h3>
        <p>Your branch team will follow up. Track the request in your account.</p>
        <Button asChild>
          <Link to="/workspace">
            View my requests <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          const date = String(f.get('appointment_date') ?? '');
          await submitPublicEnquiryFn({
            data: {
              branchId: String(f.get('branch_id')),
              carId: car?.id ?? null,
              enquiryType: kind,
              remarks: String(f.get('remarks') ?? ''),
              requestedBrand: car?.brand ?? String(f.get('brand') ?? ''),
              requestedModel: car?.model ?? String(f.get('model') ?? ''),
              requestedVariant: car?.variant ?? String(f.get('variant') ?? ''),
              appointmentDate: date ? new Date(date).toISOString() : null,
            },
          });
          setSent(true);
          query.invalidateQueries();
          toast.success('Your request has been submitted successfully!');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Request could not be saved');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Request type
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option>Car Enquiry</option>
          <option>Test Drive</option>
          <option>Appointment</option>
          <option>Booking Request</option>
          <option>Unavailable Car Request</option>
          <option>General Enquiry</option>
        </select>
      </label>

      <label>
        Preferred branch
        <select name="branch_id" defaultValue={car?.branch_id ?? branches[0]?.id} required>
          {branches.map((b) => (
            <option value={b.id} key={b.id}>
              {b.branch_name}
            </option>
          ))}
        </select>
      </label>

      {!car && (
        <>
          <label>
            Brand
            <input name="brand" required={kind === 'Unavailable Car Request'} />
          </label>
          <label>
            Model
            <input name="model" required={kind === 'Unavailable Car Request'} />
          </label>
          <label>
            Variant
            <input name="variant" />
          </label>
        </>
      )}

      {['Test Drive', 'Appointment'].includes(kind) && (
        <label>
          Preferred date and time
          <input
            name="appointment_date"
            type="datetime-local"
            min={new Date().toISOString().slice(0, 16)}
            required
          />
        </label>
      )}

      <label className="full-field">
        Message
        <textarea name="remarks" placeholder="Anything you’d like us to know?" rows={3} />
      </label>

      <Button disabled={busy} className="full-field">
        {busy ? 'Sending…' : 'Submit request'}
        <ArrowRight />
      </Button>
    </form>
  );
}
