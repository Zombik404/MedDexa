'use client';
import { useRouter } from 'next/navigation';
import { MedicineForm } from '@/components/MedicineForm';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';

export default function NewMedicine() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="New medicine" subtitle="Create the central identity first, then add exact ingredient quantities, packages and registrations." />
      <MedicineForm
        submitLabel="Create medicine"
        initial={{ name: '', brand: null, manufacturerId: null, atcCode: null, formCode: null, route: null, release: 'UNKNOWN', prescription: 'UNKNOWN', countryCode: null, status: 'DRAFT', verification: 'UNVERIFIED' }}
        onSubmit={async (v) => {
          const m = await api<{ id: string }>('/admin/medicines', { method: 'POST', body: v });
          router.push(`/medicines/${m.id}`);
        }}
      />
    </>
  );
}
