/**
 * Tests for FeatureGate, FeatureBadge, and useFeatures.
 *
 * SubscriptionContext is mocked to control checkFeature() return value.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { FeatureGate, FeatureBadge, useFeatures } from '../components/FeatureGate';

// ── Mock SubscriptionContext ──────────────────────────────────────────────────
// We control checkFeature() per test via the mock implementation variable below.

let mockCheckFeature = vi.fn().mockReturnValue(true);
let mockLoading = false;
let mockSubscription: { plan: { name: string } } | null = null;

vi.mock('../lib/SubscriptionContext', () => ({
  useSubscription: () => ({
    checkFeature: mockCheckFeature,
    loading: mockLoading,
    subscription: mockSubscription,
  }),
}));

// Helper to render with MemoryRouter (Link in FeatureGate needs router context)
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// ── FeatureGate ───────────────────────────────────────────────────────────────

describe('FeatureGate', () => {
  it('renders children when feature is available', () => {
    mockCheckFeature = vi.fn().mockReturnValue(true);
    renderWithRouter(
      <FeatureGate feature="export_csv">
        <span>Premium Content</span>
      </FeatureGate>
    );
    expect(screen.getByText('Premium Content')).toBeInTheDocument();
  });

  it('renders upgrade prompt when feature is NOT available', () => {
    mockCheckFeature = vi.fn().mockReturnValue(false);
    renderWithRouter(
      <FeatureGate feature="export_csv">
        <span>Premium Content</span>
      </FeatureGate>
    );
    expect(screen.queryByText('Premium Content')).not.toBeInTheDocument();
    expect(screen.getByText('Fitur Premium')).toBeInTheDocument();
    expect(screen.getByText('Lihat Paket Upgrade')).toBeInTheDocument();
  });

  it('shows plan name in upgrade prompt', () => {
    mockCheckFeature = vi.fn().mockReturnValue(false);
    mockSubscription = { plan: { name: 'Gratis' } };
    renderWithRouter(
      <FeatureGate feature="sipnap">
        <span>SIPNAP Content</span>
      </FeatureGate>
    );
    expect(screen.getByText('Gratis')).toBeInTheDocument();
    mockSubscription = null;
  });

  it('renders nothing while loading', () => {
    mockLoading = true;
    mockCheckFeature = vi.fn().mockReturnValue(false);
    const { container } = renderWithRouter(
      <FeatureGate feature="export_csv">
        <span>Premium Content</span>
      </FeatureGate>
    );
    // While loading, FeatureGate returns null
    expect(container).toBeEmptyDOMElement();
    mockLoading = false;
  });

  it('renders nothing in silent mode when feature not available', () => {
    mockCheckFeature = vi.fn().mockReturnValue(false);
    const { container } = renderWithRouter(
      <FeatureGate feature="export_csv" silent>
        <span>Premium Content</span>
      </FeatureGate>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders custom fallback when feature not available', () => {
    mockCheckFeature = vi.fn().mockReturnValue(false);
    renderWithRouter(
      <FeatureGate feature="export_csv" fallback={<span>Custom Fallback</span>}>
        <span>Premium Content</span>
      </FeatureGate>
    );
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
    expect(screen.queryByText('Premium Content')).not.toBeInTheDocument();
  });

  it('calls checkFeature with the correct feature name', () => {
    mockCheckFeature = vi.fn().mockReturnValue(true);
    renderWithRouter(
      <FeatureGate feature="laporan_keuangan">
        <span>Content</span>
      </FeatureGate>
    );
    expect(mockCheckFeature).toHaveBeenCalledWith('laporan_keuangan');
  });

  it('upgrade link points to /billing', () => {
    mockCheckFeature = vi.fn().mockReturnValue(false);
    renderWithRouter(
      <FeatureGate feature="export_csv">
        <span>Content</span>
      </FeatureGate>
    );
    const link = screen.getByRole('link', { name: /upgrade/i });
    expect(link).toHaveAttribute('href', '/billing');
  });
});

// ── FeatureBadge ──────────────────────────────────────────────────────────────

describe('FeatureBadge', () => {
  it('renders nothing when feature is available', () => {
    mockCheckFeature = vi.fn().mockReturnValue(true);
    const { container } = renderWithRouter(<FeatureBadge feature="export_csv" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Premium badge when feature is NOT available', () => {
    mockCheckFeature = vi.fn().mockReturnValue(false);
    renderWithRouter(<FeatureBadge feature="export_csv" />);
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });
});

// ── useFeatures hook ──────────────────────────────────────────────────────────

describe('useFeatures', () => {
  it('returns a map of feature → boolean', () => {
    mockCheckFeature = vi.fn((f: string) => f === 'sipnap');

    // Test hook via a tiny component
    let featuresResult: Record<string, boolean> = {};
    function HookConsumer() {
      featuresResult = useFeatures(['sipnap', 'export_csv', 'laporan_keuangan']);
      return null;
    }

    renderWithRouter(<HookConsumer />);
    expect(featuresResult['sipnap']).toBe(true);
    expect(featuresResult['export_csv']).toBe(false);
    expect(featuresResult['laporan_keuangan']).toBe(false);
  });
});
