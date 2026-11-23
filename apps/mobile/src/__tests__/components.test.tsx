import type { MedicineSummary } from '@meddexa/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import '../i18n';
import { AssessmentBanner } from '../components/medicine/Assessment';
import { MedicineCard } from '../components/medicine/MedicineCard';
import { MedicineImage } from '../components/medicine/MedicineImage';
import { CategoryTile } from '../components/CategoryTile';
import { ToastProvider } from '../components/ui/Toast';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCompare } from '../store/compare';
import { ThemeProvider } from '../theme/ThemeProvider';

const wrap = (ui: ReactNode) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );

const medicine: MedicineSummary = {
  id: 'm1',
  name: 'Paradex Plus 500 mg/65 mg tablets',
  brand: 'Paradex Plus',
  manufacturer: 'Nordvale Laboratories (demo)',
  countryCode: 'HU',
  atcCode: 'N02BE51',
  form: { code: 'TABLET', name: 'Tablet', group: 'ORAL_SOLID' },
  route: 'ORAL',
  release: 'IMMEDIATE',
  prescription: 'OTC',
  packageSize: { quantity: 24, unit: 'tablet' },
  ingredients: [
    { substanceId: 'p', substanceName: 'paracetamol', moietyId: null, moietyName: null, amount: 500, unit: 'mg', perAmount: null, perUnit: null, basis: 'SUBSTANCE', display: '500 mg' },
    { substanceId: 'c', substanceName: 'caffeine', moietyId: null, moietyName: null, amount: 65, unit: 'mg', perAmount: null, perUnit: null, basis: 'SUBSTANCE', display: '65 mg' },
  ],
  imageUrl: null,
  imageCredit: null,
  rating: { average: 4.2, count: 3 },
  lowestPrice: { amount: 3.85, currency: 'EUR', converted: true, countryCode: 'HU' },
  isDemo: true,
};

describe('MedicineCard', () => {
  beforeEach(() => useCompare.setState({ items: [] }));

  it('shows exact ingredient quantities, demo label and an estimated price', async () => {
    await wrap(<MedicineCard medicine={medicine} testID="card" />);
    expect(screen.getByText('Paradex Plus 500 mg/65 mg tablets')).toBeTruthy();
    expect(screen.getByText('paracetamol 500 mg + caffeine 65 mg')).toBeTruthy();
    expect(screen.getByText('Demo data')).toBeTruthy();
    expect(screen.getByText(/≈/)).toBeTruthy();
  });

  it('adds the medicine to the comparison', async () => {
    await wrap(<MedicineCard medicine={medicine} testID="card" />);
    await fireEvent.press(screen.getByTestId('card-compare'));
    expect(useCompare.getState().items).toEqual([{ id: 'm1', name: medicine.name }]);
    expect(screen.getByLabelText('In comparison')).toBeTruthy();
  });
});

describe('AssessmentBanner', () => {
  it('explains important differences without recommending substitution', async () => {
    await wrap(<AssessmentBanner assessment="IMPORTANT_DIFFERENCES" composition="SIMILAR_COMPOSITION" critical={2} major={0} />);
    expect(screen.getByText('Important pharmaceutical differences')).toBeTruthy();
    expect(screen.getByText(/2 critical differences/)).toBeTruthy();
    expect(screen.getByText(/Do not swap them without professional advice/)).toBeTruthy();
  });
});

describe('MedicineImage', () => {
  it('shows the official photo with its credit', async () => {
    await wrap(<MedicineImage medicine={{ ...medicine, imageUrl: 'https://cima.aemps.es/x.jpg', imageCredit: 'AEMPS · CIMA' }} size="hero" />);
    expect(screen.getByLabelText(`Photo of ${medicine.name}`)).toBeTruthy();
    expect(screen.getByText('Photo: AEMPS · CIMA')).toBeTruthy();
  });

  it('falls back to a labelled dosage-form illustration, never a stock photo', async () => {
    await wrap(<MedicineImage medicine={medicine} size="hero" />);
    expect(screen.getByLabelText('No official photo')).toBeTruthy();
    expect(screen.getByText(/illustration of the dosage form/)).toBeTruthy();
  });
});

describe('CategoryTile', () => {
  it('uses the translated everyday name', async () => {
    const onPress = jest.fn();
    await wrap(<CategoryTile slug="pain" icon="pain" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Pain relief'));
    expect(onPress).toHaveBeenCalled();
  });
});
