import { describe, it, expect } from 'vitest';
import { generateReceiptHTML, generateWhatsAppText } from '../lib/receipt';
import type { ReceiptData } from '../lib/receipt';

const baseReceipt: ReceiptData = {
  transactionNumber: 'TRX/2026/03/0001',
  date: '13 Mar 2026, 14:30',
  items: [
    { name: 'Paracetamol 500mg', quantity: 2, price: 5000, unit: 'tablet' },
    { name: 'Amoxicillin 500mg', quantity: 1, price: 8000, unit: 'kapsul' },
  ],
  total: 18000,
  discount: 0,
  paymentMethod: 'cash',
  cashReceived: 20000,
  pharmacyName: 'Apotek Sehat Farma',
  pharmacyAddress: 'Jl. Contoh No. 123',
  pharmacyPhone: '08123456789',
};

describe('generateReceiptHTML', () => {
  it('generates valid HTML with pharmacy info', () => {
    const html = generateReceiptHTML(baseReceipt);
    expect(html).toContain('Apotek Sehat Farma');
    expect(html).toContain('TRX/2026/03/0001');
    expect(html).toContain('Paracetamol 500mg');
    expect(html).toContain('Tunai');
  });

  it('shows correct change amount for cash payment', () => {
    const html = generateReceiptHTML(baseReceipt);
    expect(html).toContain('Kembali');
    expect(html).toContain('2.000'); // 20000 - 18000 = 2000
  });

  it('does not show change for non-cash payment', () => {
    const receipt = { ...baseReceipt, paymentMethod: 'qris', cashReceived: undefined };
    const html = generateReceiptHTML(receipt);
    expect(html).not.toContain('Kembali');
    expect(html).toContain('QRIS');
  });

  it('shows discount when present', () => {
    const receipt = { ...baseReceipt, discount: 3000 };
    const html = generateReceiptHTML(receipt);
    expect(html).toContain('Diskon');
    expect(html).toContain('3.000');
  });

  it('escapes HTML in pharmacy name (XSS prevention)', () => {
    const receipt = { ...baseReceipt, pharmacyName: '<script>alert("xss")</script>' };
    const html = generateReceiptHTML(receipt);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in transaction number — prevents tag injection', () => {
    const receipt = { ...baseReceipt, transactionNumber: '"><img onerror=alert(1) src=x>' };
    const html = generateReceiptHTML(receipt);
    // The <img tag must be escaped — it should appear as &lt;img, not as a real tag
    expect(html).not.toContain('<img onerror='); // no real unescaped <img tag
    expect(html).toContain('&lt;img');           // properly escaped
    expect(html).toContain('&quot;');            // quotes escaped
  });

  it('sanitizes logoUrl — blocks javascript: protocol', () => {
    const receipt = { ...baseReceipt, logoUrl: 'javascript:alert(1)' };
    const html = generateReceiptHTML(receipt);
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
  });

  it('sanitizes logoUrl — blocks data:text', () => {
    const receipt = { ...baseReceipt, logoUrl: 'data:text/html,<script>alert(1)</script>' };
    const html = generateReceiptHTML(receipt);
    expect(html).not.toContain('data:text/html');
  });

  it('allows safe https logoUrl', () => {
    const receipt = { ...baseReceipt, logoUrl: 'https://example.com/logo.png' };
    const html = generateReceiptHTML(receipt);
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/logo.png');
  });

  it('allows safe data:image logoUrl', () => {
    const receipt = { ...baseReceipt, logoUrl: 'data:image/png;base64,iVBOR' };
    const html = generateReceiptHTML(receipt);
    expect(html).toContain('<img');
    expect(html).toContain('data:image/png');
  });

  it('escapes item names', () => {
    const receipt = {
      ...baseReceipt,
      items: [{ name: '<b>Bold</b>', quantity: 1, price: 1000 }],
    };
    const html = generateReceiptHTML(receipt);
    expect(html).not.toContain('<b>Bold</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

describe('generateWhatsAppText', () => {
  it('generates WhatsApp text with item list', () => {
    const text = generateWhatsAppText(baseReceipt);
    expect(text).toContain('Apotek Sehat Farma');
    expect(text).toContain('Paracetamol 500mg');
    expect(text).toContain('TRX/2026/03/0001');
    expect(text).toContain('Tunai');
  });

  it('shows discount in WhatsApp text', () => {
    const receipt = { ...baseReceipt, discount: 2000 };
    const text = generateWhatsAppText(receipt);
    expect(text).toContain('Diskon');
  });
});
