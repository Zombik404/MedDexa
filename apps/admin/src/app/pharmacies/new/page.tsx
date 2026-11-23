'use client';
import { useRouter } from 'next/navigation';
import { PharmacyForm } from '@/components/PharmacyForm';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';

export default function NewPharmacy() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="New pharmacy" subtitle="Only mark contact details as verified after confirming them with an official registry or the pharmacy." />
      <PharmacyForm
        submitLabel="Create pharmacy"
        initial={{ name: '', street: '', city: null, postcode: null, countryCode: '', lat: 0, lng: 0, phone: null, phoneVerified: false, website: null, websiteVerified: false, email: null, status: 'ACTIVE', verification: 'UNVERIFIED' }}
        onSubmit={async (v) => {
          const p = await api<{ id: string }>('/admin/pharmacies', { method: 'POST', body: v });
          router.push(`/pharmacies/${p.id}`);
        }}
      />
    </>
  );
}
