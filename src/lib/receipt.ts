// ============================================================
// Shared Receipt HTML Generator
// Digunakan oleh: POS.tsx (cetak struk baru) &
//                 Laporan.tsx (reprint dari riwayat)
// ============================================================

/** Escape HTML special chars — cegah XSS di struk HTML */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export type ReceiptItem = {
  name: string;
  quantity: number;
  price: number;
  unit?: string;
  signa?: string;
};

export type ReceiptData = {
  transactionNumber: string;      // TRX/2026/03/0001 atau fallback ID
  date: string;                   // string sudah diformat
  items: ReceiptItem[];
  total: number;
  discount: number;               // total semua diskon
  paymentMethod: string;
  cashReceived?: number;
  customerName?: string;
  // Profil apotek
  pharmacyName: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  apotekerName?: string;
  siaNumber?: string;
  sipaNumber?: string;
  logoUrl?: string | null;
  /** Lebar kertas struk: 58mm (default), 80mm, atau A4 */
  receiptWidth?: '58mm' | '80mm' | 'A4';
};

export type ApographItem = {
  medicine_name: string;
  quantity: number;
  dispensed_quantity: number;
  signa?: string;
  /** Jumlah iterasi (pengulangan) resep jika ada */
  iter?: number | null;
};

export type ApographData = {
  prescriptionNumber: string;
  prescriptionDate: string;
  patientName: string;
  patientAge?: number | null;
  doctorName: string;
  doctorSip?: string | null;
  items: ApographItem[];
  // Profil apotek
  pharmacyName: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  apotekerName?: string;
  siaNumber?: string;
  sipaNumber?: string;
};
/** Hasilkan HTML receipt siap print (lebar configurable: 58mm/80mm/A4) */
export function generateReceiptHTML(receipt: ReceiptData): string {
  const {
    transactionNumber,
    date,
    items,
    total,
    discount,
    paymentMethod,
    cashReceived,
    pharmacyName,
    pharmacyAddress,
    pharmacyPhone,
    apotekerName,
    siaNumber,
    sipaNumber,
    logoUrl,
    receiptWidth = '58mm',
  } = receipt;

  // Determine CSS width and font size based on paper width
  const widthCSS = receiptWidth === 'A4' ? '210mm' : receiptWidth;
  const fontSize = receiptWidth === 'A4' ? '14px' : receiptWidth === '80mm' ? '13px' : '12px';
  const titleSize = receiptWidth === 'A4' ? '18px' : receiptWidth === '80mm' ? '16px' : '14px';
  const totalSize = receiptWidth === 'A4' ? '18px' : receiptWidth === '80mm' ? '16px' : '14px';
  const logoHeight = receiptWidth === 'A4' ? '80px' : '56px';

  const paymentLabel: Record<string, string> = {
    cash: 'Tunai',
    qris: 'QRIS',
    transfer: 'Transfer',
  };

  const changeAmount =
    paymentMethod === 'cash' && cashReceived && cashReceived > total
      ? cashReceived - total
      : 0;

  // Escape semua nilai user-supplied untuk cegah XSS
  const safeName    = escapeHtml(pharmacyName);
  const safeAddress = pharmacyAddress ? escapeHtml(pharmacyAddress) : '';
  const safePhone   = pharmacyPhone   ? escapeHtml(pharmacyPhone)   : '';
  const safeApt     = apotekerName    ? escapeHtml(apotekerName)    : '';
  const safeSipa    = sipaNumber      ? escapeHtml(sipaNumber)      : '';
  const safeSia     = siaNumber       ? escapeHtml(siaNumber)       : '';
  const safeTrxNo   = escapeHtml(transactionNumber);
  const safeDate    = escapeHtml(date);
  const safePayment = escapeHtml(paymentLabel[paymentMethod] ?? paymentMethod);

  const itemsHTML = items
    .map(
      (i) => `
      <tr><td colspan="2">${escapeHtml(i.name)}</td></tr>
      <tr>
        <td>${i.quantity} x ${i.price.toLocaleString('id-ID')}</td>
        <td class="right">${(i.quantity * i.price).toLocaleString('id-ID')}</td>
      </tr>`
    )
    .join('');

  return `<html>
<head>
<meta charset="UTF-8"/>
<style>
  body {
    font-family: monospace;
    font-size: ${fontSize};
    width: ${widthCSS};
    margin: 0;
    padding: 8px;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .small  { font-size: 10px; }
  hr      { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table   { width: 100%; border-collapse: collapse; }
  td      { padding: 1px 0; vertical-align: top; }
</style>
</head>
<body>
  ${logoUrl && /^(https?:\/\/|data:image\/)/.test(logoUrl) ? `<div class="center" style="margin-bottom:6px;"><img src="${escapeHtml(logoUrl)}" alt="" style="max-height:${logoHeight}; max-width:90%; object-fit:contain;"/></div>` : ''}
  <div class="center bold" style="font-size:${titleSize};">${safeName}</div>
  ${safeAddress ? `<div class="center small">${safeAddress}</div>` : ''}
  ${safePhone   ? `<div class="center small">Telp: ${safePhone}</div>` : ''}
  ${safeApt     ? `<div class="center small">Apt: ${safeApt}${safeSipa ? `, SIPA: ${safeSipa}` : ''}</div>` : ''}
  ${safeSia     ? `<div class="center small">SIA: ${safeSia}</div>` : ''}
  <hr/>
  <div>No  : ${safeTrxNo}</div>
  <div>Tgl : ${safeDate}</div>
  <div>Bayar: ${safePayment}</div>
  <hr/>
  <table>${itemsHTML}</table>
  <hr/>
  ${discount > 0 ? `<div>Diskon: -Rp ${discount.toLocaleString('id-ID')}</div>` : ''}
  <div class="right bold" style="font-size:${totalSize};">TOTAL: Rp ${total.toLocaleString('id-ID')}</div>
  ${cashReceived ? `<div>Tunai : Rp ${cashReceived.toLocaleString('id-ID')}</div>` : ''}
  ${changeAmount > 0 ? `<div>Kembali: Rp ${changeAmount.toLocaleString('id-ID')}</div>` : ''}
  <hr/>
  <div class="center small">Terima kasih,<br/>Semoga lekas sembuh!</div>
  <div class="center small" style="margin-top:4px; color:#999;">Powered by MediSir</div>
</body>
</html>`;
}

/** Cetak receipt: inject HTML ke iframe tersembunyi lalu print */
export function printReceipt(receipt: ReceiptData): void {
  const html = generateReceiptHTML(receipt);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-9999px';
  document.body.appendChild(iframe);
  iframe.contentDocument?.write(html);
  iframe.contentDocument?.close();
  iframe.contentWindow?.focus();

  const removeIframe = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  // Gunakan onafterprint agar iframe dihapus SETELAH print dialog ditutup
  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = removeIframe;
  }
  iframe.contentWindow?.print();
  // Fallback untuk browser yang tidak support onafterprint
  setTimeout(removeIframe, 60_000);
}

/** Hasilkan HTML etiket (aturan pakai) untuk satu obat (label print) */
export function generateEtiketHTML(item: ReceiptItem, receipt: ReceiptData): string {
  const safePharmacyName = escapeHtml(receipt.pharmacyName);
  const safeApoteker     = escapeHtml(receipt.apotekerName || '');
  const safeSipa         = escapeHtml(receipt.sipaNumber || '');
  const safeDate         = escapeHtml(receipt.date.split(',')[0]); // Take date only if possible
  const safePatient      = escapeHtml(receipt.customerName || 'Pasien Umum');
  const safeMedName      = escapeHtml(item.name);
  const safeQty          = escapeHtml(item.quantity.toString() + (item.unit ? ' ' + item.unit : ''));
  const safeSigna        = escapeHtml(item.signa || '-');

  // Menyesuaikan ukuran label etiket standar puskesmas/apotek misal 50x30mm atau 60x40mm
  return `<html>
<head>
<meta charset="UTF-8"/>
<style>
  body {
    font-family: Arial, sans-serif;
    width: 60mm;
    margin: 0;
    padding: 4px;
    box-sizing: border-box;
    font-size: 11px;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .border { border: 1px solid #000; padding: 4px; border-radius: 4px; }
  .header { font-size: 10px; border-bottom: 2px solid #000; padding-bottom: 2px; margin-bottom: 4px; }
  .rx { font-family: serif; font-size: 16px; font-weight: bold; font-style: italic; margin-right: 4px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .instructions { margin: 6px 0; font-size: 12px; font-weight: bold; text-align: center; border: 1px dashed #000; padding: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  td { padding: 1px 0; vertical-align: top; }
</style>
</head>
<body>
  <div class="border">
    <div class="header center">
      <div class="bold" style="font-size:12px;">${safePharmacyName}</div>
      ${safeApoteker ? `<div>Apt: ${safeApoteker}</div>` : ''}
      ${safeSipa ? `<div>SIPA: ${safeSipa}</div>` : ''}
    </div>
    <div class="row">
      <span>Tgl: ${safeDate}</span>
    </div>
    <div style="margin-bottom:4px;">
      Nama: <b>${safePatient}</b>
    </div>
    <table>
      <tr>
        <td style="width:15px;"><span class="rx">R/</span></td>
        <td>
          <div class="bold" style="font-size:12px;">${safeMedName}</div>
          <div>Jumlah: ${safeQty}</div>
        </td>
      </tr>
    </table>
    <div class="instructions">${safeSigna}</div>
    <div class="center" style="font-size: 9px;">SEMOGA LEKAS SEMBUH</div>
  </div>
</body>
</html>`;
}

/** Cetak Etiket Aturan Pakai */
export function printEtiket(item: ReceiptItem, receipt: ReceiptData): void {
  const html = generateEtiketHTML(item, receipt);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-9999px';
  document.body.appendChild(iframe);
  iframe.contentDocument?.write(html);
  iframe.contentDocument?.close();
  iframe.contentWindow?.focus();

  const removeIframe = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = removeIframe;
  }
  iframe.contentWindow?.print();
  setTimeout(removeIframe, 60_000);
}

/** Buat teks pesan WhatsApp dari data receipt */
export function generateWhatsAppText(receipt: ReceiptData): string {
  const paymentLabel: Record<string, string> = {
    cash: 'Tunai',
    qris: 'QRIS',
    transfer: 'Transfer',
  };
  let text = `*${receipt.pharmacyName}*\n`;
  if (receipt.siaNumber) text += `SIA: ${receipt.siaNumber}\n`;
  text += `No: ${receipt.transactionNumber}\n`;
  text += `Tgl: ${receipt.date}\n`;
  text += `--------------------------------\n`;
  receipt.items.forEach((item) => {
    text += `${item.name}\n`;
    text += `${item.quantity} x ${item.price.toLocaleString('id-ID')} = ${(item.quantity * item.price).toLocaleString('id-ID')}\n`;
  });
  text += `--------------------------------\n`;
  if (receipt.discount > 0)
    text += `Diskon: -Rp ${receipt.discount.toLocaleString('id-ID')}\n`;
  text += `*TOTAL: Rp ${receipt.total.toLocaleString('id-ID')}*\n`;
  text += `Metode: ${paymentLabel[receipt.paymentMethod] ?? receipt.paymentMethod}\n`;
  text += `\nTerima kasih, semoga lekas sembuh!`;
  return text;
}

/** Hasilkan HTML Salinan Resep (Apograph) siap print (kertas stempel / A5 size) */
export function generateApographHTML(data: ApographData): string {
  const safeName    = escapeHtml(data.pharmacyName);
  const safeAddress = data.pharmacyAddress ? escapeHtml(data.pharmacyAddress) : '';
  const safePhone   = data.pharmacyPhone   ? escapeHtml(data.pharmacyPhone)   : '';
  const safeApt     = data.apotekerName    ? escapeHtml(data.apotekerName)    : '';
  const safeSipa    = data.sipaNumber      ? escapeHtml(data.sipaNumber)      : '';
  const safeSia     = data.siaNumber       ? escapeHtml(data.siaNumber)       : '';
  
  const safeTrxNo   = escapeHtml(data.prescriptionNumber);
  const safeDate    = escapeHtml(data.prescriptionDate);
  const safePatient = escapeHtml(data.patientName + (data.patientAge ? ` (${data.patientAge} thn)` : ''));
  const safeDoctor  = escapeHtml(data.doctorName);
  const safeDocSip  = data.doctorSip ? escapeHtml(data.doctorSip) : '';

  const itemsHTML = data.items.map((i) => {
    // det: sudah diberikan, nedet: belum diberikan
    let statusText = '';
    if (i.dispensed_quantity >= i.quantity) {
      statusText = '<i>det</i>';
    } else if (i.dispensed_quantity > 0) {
      statusText = `<i>det ${i.dispensed_quantity}</i>`;
    } else {
      statusText = '<i>nedet</i>';
    }

    // iter (pengulangan resep)
    const iterText = i.iter && i.iter > 0 ? `<div style="font-size:11px; margin-top:2px; color:#555;"><i>iter ${i.iter}x</i></div>` : '';

    return `
      <tr>
        <td style="width:24px; padding-top:4px;"><span style="font-family:serif; font-size:16px; font-weight:bold; font-style:italic;">R/</span></td>
        <td style="padding-top:4px;">
          <div style="font-weight:bold; font-size:13px;">${escapeHtml(i.medicine_name)}</div>
          <div style="font-size:11px; margin-top:2px;">No: ${i.quantity}</div>
          <div style="font-size:11px; margin-top:2px;">S: ${escapeHtml(i.signa || '-')}</div>
          ${iterText}
        </td>
      </tr>
      <tr>
        <td></td>
        <td style="text-align:right; font-size:11px; padding-bottom:8px; border-bottom:1px dashed #ccc;">
          ${statusText}
        </td>
      </tr>
    `;
  }).join('');

  return `<html>
<head>
<meta charset="UTF-8"/>
<style>
  body {
    font-family: Arial, sans-serif;
    color: #000;
    margin: 0;
    padding: 20px;
    box-sizing: border-box;
    font-size: 12px;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .border { border: 1px solid #000; padding: 16px; border-radius: 8px; max-width: 148mm; margin: 0 auto; }
  .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 16px; font-family: serif; text-decoration: underline; letter-spacing: 1px; }
  .info-table { width: 100%; margin-bottom: 16px; font-size: 12px; }
  .info-table td { padding: 2px 4px; vertical-align: top; }
  .rx-table { width: 100%; border-collapse: collapse; }
  .rx-table td { padding: 0; vertical-align: top; }
  .print-footer { margin-top: 32px; display: flex; justify-content: flex-end; }
  .signature { text-align: center; width: 160px; }
  .pcc { font-weight: bold; font-family: serif; font-size: 14px; font-style: italic; }
  @media print {
    body { padding: 0; }
    .border { padding: 10mm; max-width: 100%; border: none; }
  }
</style>
</head>
<body>
  <div class="border">
    <div class="header center">
      <div class="bold" style="font-size:16px;">${safeName}</div>
      ${safeAddress ? `<div>${safeAddress}</div>` : ''}
      ${safePhone   ? `<div>Telp: ${safePhone}</div>` : ''}
      ${safeApt     ? `<div style="margin-top:4px;">Apt: ${safeApt}</div>` : ''}
      ${safeSia     ? `<div>SIA: ${safeSia}</div>` : ''}
      ${safeSipa    ? `<div>SIPA: ${safeSipa}</div>` : ''}
    </div>
    
    <div class="title">SALINAN RESEP / APOGRAPH</div>

    <table class="info-table">
      <tr>
        <td style="width:90px;">No. Resep</td><td style="width:10px;">:</td><td>${safeTrxNo}</td>
        <td style="width:90px;">Dokter</td><td style="width:10px;">:</td><td>dr. ${safeDoctor}</td>
      </tr>
      <tr>
        <td>Tanggal</td><td>:</td><td>${safeDate}</td>
        <td>SIP</td><td>:</td><td>${safeDocSip || '-'}</td>
      </tr>
      <tr>
        <td>Nama Pasien</td><td>:</td><td colspan="4"><b>${safePatient}</b></td>
      </tr>
    </table>

    <hr style="border:none; border-top:1px solid #000; margin: 8px 0;"/>

    <table class="rx-table">
      ${itemsHTML}
    </table>

    <div class="print-footer">
      <div class="signature">
        <div class="pcc">p.c.c</div>
        <div style="margin-top:50px; border-bottom:1px solid #000; margin-bottom:4px;"></div>
        ${safeApt ? `<div style="font-size:11px; font-weight:bold;">${safeApt}</div>` : ''}
        ${safeSipa ? `<div style="font-size:9px;">SIPA: ${safeSipa}</div>` : ''}
        <div style="font-size:10px;">Apoteker Penanggung Jawab</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Cetak Apograph (Salinan Resep) */
export function printApograph(data: ApographData): void {
  const html = generateApographHTML(data);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-9999px';
  document.body.appendChild(iframe);
  iframe.contentDocument?.write(html);
  iframe.contentDocument?.close();
  iframe.contentWindow?.focus();

  const removeIframe = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = removeIframe;
  }
  iframe.contentWindow?.print();
  setTimeout(removeIframe, 60_000);
}

// ============================================================
// Etiket Obat (Medicine Label) - multi-label sesuai PMK 73/2016
// PMK 73/2016: setiap obat yang diserahkan wajib diberi etiket
// Berbeda dari printEtiket (POS struk), ini mendukung beberapa
// label sekaligus dengan data pasien dan jenis obat yang lengkap
// ============================================================

export type EtiketItem = {
  medicineName: string;
  signa: string;           // Aturan pakai, mis: "3 x sehari 1 tablet sesudah makan"
  quantity: number;
  unit: string;
  patientName: string;
  patientAge?: number | null;
  prescriptionDate: string;
  prescriptionNumber?: string;
  /** 'oral' (putih) | 'topikal' (biru) | 'injeksi' (kuning) */
  jenis: 'oral' | 'topikal' | 'injeksi';
  notes?: string;          // Catatan tambahan, mis: "Kocok dulu sebelum digunakan"
  pharmacyName: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  apotekerName?: string;
};

function generateEtiketObatHTML(items: EtiketItem[]): string {
  const colorMap: Record<string, { bg: string; border: string; label: string }> = {
    oral:     { bg: '#fff',    border: '#334155', label: 'OBAT DALAM' },
    topikal:  { bg: '#eff6ff', border: '#1d4ed8', label: 'OBAT LUAR' },
    injeksi:  { bg: '#fefce8', border: '#ca8a04', label: 'INJEKSI' },
  };

  const labelsHTML = items.map((item) => {
    const safe = (s?: string | null) => escapeHtml(s || '');
    const colors = colorMap[item.jenis] || colorMap['oral'];
    const tanggal = item.prescriptionDate
      ? new Date(item.prescriptionDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';

    return `
    <div class="label" style="background:${colors.bg}; border-color:${colors.border};">
      <div class="label-header" style="border-bottom-color:${colors.border};">
        <div class="pharmacy-name">${safe(item.pharmacyName)}</div>
        ${item.pharmacyAddress ? `<div class="pharmacy-sub">${safe(item.pharmacyAddress)}</div>` : ''}
        ${item.pharmacyPhone ? `<div class="pharmacy-sub">Telp: ${safe(item.pharmacyPhone)}</div>` : ''}
      </div>
      <div class="label-body">
        <div class="jenis-badge" style="color:${colors.border};">${colors.label}</div>
        <div class="medicine-name">${safe(item.medicineName)}</div>
        <div class="qty">Jumlah: <b>${item.quantity} ${safe(item.unit)}</b></div>
        <div class="signa">${safe(item.signa)}</div>
        ${item.notes ? `<div class="notes">${safe(item.notes)}</div>` : ''}
      </div>
      <div class="label-footer">
        <div class="patient">
          <span class="label-key">Pasien:</span>
          <b>${safe(item.patientName)}</b>${item.patientAge ? ` (${item.patientAge} th)` : ''}
        </div>
        <div class="meta">
          <span>${tanggal}</span>
          ${item.prescriptionNumber ? `<span class="rx-no">No: ${safe(item.prescriptionNumber)}</span>` : ''}
        </div>
        ${item.apotekerName ? `<div class="apoteker">Apt: ${safe(item.apotekerName)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, sans-serif;
    background: #f1f5f9;
    padding: 16px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72mm, 1fr));
    gap: 8px;
    max-width: 210mm;
    margin: 0 auto;
  }
  .label {
    border: 2px solid #334155;
    border-radius: 6px;
    padding: 8px;
    font-size: 11px;
    min-width: 72mm;
    break-inside: avoid;
  }
  .label-header {
    border-bottom: 1px solid #334155;
    padding-bottom: 5px;
    margin-bottom: 5px;
  }
  .pharmacy-name { font-weight: bold; font-size: 12px; }
  .pharmacy-sub { font-size: 9px; color: #475569; }
  .label-body { padding: 4px 0; border-bottom: 1px dashed #94a3b8; margin-bottom: 4px; }
  .jenis-badge { font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px; }
  .medicine-name { font-weight: bold; font-size: 13px; margin-bottom: 3px; }
  .qty { font-size: 10px; color: #475569; margin-bottom: 2px; }
  .signa { font-size: 11px; font-weight: bold; color: #0f172a; padding: 3px 0; }
  .notes { font-size: 9px; color: #6b7280; font-style: italic; padding-top: 2px; }
  .label-footer { font-size: 9px; color: #475569; }
  .patient { margin-bottom: 2px; }
  .label-key { color: #64748b; }
  .meta { display: flex; justify-content: space-between; align-items: center; }
  .rx-no { color: #6b7280; }
  .apoteker { color: #6b7280; margin-top: 2px; }
  @media print {
    body { background: white; padding: 8px; }
    .grid { gap: 6px; }
  }
</style>
</head>
<body>
  <div class="grid">
    ${labelsHTML}
  </div>
</body>
</html>`;
}

/** Cetak Etiket Obat lengkap (multi-label) untuk resep dan racikan */
export function printEtiketObat(items: EtiketItem[]): void {
  if (items.length === 0) return;
  const html = generateEtiketObatHTML(items);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-9999px';
  document.body.appendChild(iframe);
  iframe.contentDocument?.write(html);
  iframe.contentDocument?.close();
  iframe.contentWindow?.focus();

  const removeIframe = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = removeIframe;
  }
  iframe.contentWindow?.print();
  setTimeout(removeIframe, 60_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Print SP (Surat Pesanan) — Permenkes No. 3/2015
// Format resmi: header apotek, info SP, tabel item, blok tanda tangan APJ
// ─────────────────────────────────────────────────────────────────────────────
export type SPItem = {
  no: number;
  medicine_name: string;
  quantity: number;
  unit: string;
  estimated_price: number;
};

export type SPData = {
  order_number: string;
  order_date: string;
  order_type: string;
  supplier_name: string;
  supplier_address?: string | null;
  pharmacy_name: string;
  pharmacy_address?: string | null;
  sia_number?: string | null;
  apoteker_name?: string | null;
  sipa_number?: string | null;
  items: SPItem[];
};

export function printSuratPesanan(data: SPData): void {
  const esc = escapeHtml;

  const typeLabel: Record<string, string> = {
    reguler: 'REGULER',
    narkotika: 'NARKOTIKA (Per Permenkes No. 3/2015)',
    psikotropika: 'PSIKOTROPIKA (Per Permenkes No. 3/2015)',
    prekursor: 'PREKURSOR FARMASI',
    oot: 'OBAT-OBAT TERTENTU (OOT)',
  };

  const isNarkPsiko = data.order_type === 'narkotika' || data.order_type === 'psikotropika';

  const rows = data.items.map(item => `
    <tr>
      <td class="center">${item.no}</td>
      <td>${esc(item.medicine_name)}</td>
      <td class="right">${item.quantity}</td>
      <td class="center">${esc(item.unit)}</td>
      <td class="right">${item.estimated_price > 0 ? item.estimated_price.toLocaleString('id-ID') : '-'}</td>
    </tr>
  `).join('');

  const narcNote = isNarkPsiko
    ? `<div class="narco-note">
        &#9888; SP ${esc(typeLabel[data.order_type])} ini harus dicetak pada kertas resmi (3 rangkap) dan
        ditandatangani basah oleh Apoteker Penanggung Jawab (APJ) sebelum diserahkan ke PBF.
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>SP ${esc(data.order_number)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20mm 15mm; }
    .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
    .pharmacy-name { font-size: 16px; font-weight: bold; }
    .pharmacy-info { font-size: 10px; color: #333; line-height: 1.5; }
    .sp-title { text-align: right; }
    .sp-title h2 { font-size: 14px; font-weight: bold; text-transform: uppercase; }
    .sp-title .sp-type { font-size: 11px; color: #444; margin-top: 2px; }
    .sp-title .sp-number { font-size: 11px; font-weight: bold; margin-top: 4px; }
    .meta { display: flex; gap: 20px; margin-bottom: 12px; }
    .meta-block { flex: 1; }
    .meta-block label { font-weight: bold; font-size: 10px; color: #555; display: block; margin-bottom: 2px; }
    .meta-block p { font-size: 11px; border-bottom: 1px solid #aaa; padding-bottom: 2px; min-height: 18px; }
    table.items { width: 100%; border-collapse: collapse; margin: 10px 0; }
    table.items th { background: #f0f0f0; border: 1px solid #999; padding: 5px 6px; font-size: 10px; text-align: left; }
    table.items td { border: 1px solid #ccc; padding: 4px 6px; font-size: 10px; }
    .center { text-align: center; }
    .right { text-align: right; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
    .sig-box { text-align: center; width: 45%; }
    .sig-box .role { font-size: 10px; font-weight: bold; margin-bottom: 50px; }
    .sig-box .name-line { border-top: 1px solid #000; padding-top: 4px; font-size: 10px; min-height: 20px; }
    .narco-note { background: #fff8e1; border: 1px solid #e6a817; border-radius: 4px; padding: 8px 10px; font-size: 10px; margin: 10px 0; color: #856404; }
    .footer-note { font-size: 9px; color: #666; margin-top: 8px; }
    @media print { body { padding: 15mm 12mm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="pharmacy-name">${esc(data.pharmacy_name)}</div>
      <div class="pharmacy-info">
        ${data.pharmacy_address ? esc(data.pharmacy_address) + '<br>' : ''}
        ${data.sia_number ? 'No. SIA: ' + esc(data.sia_number) : ''}
      </div>
    </div>
    <div class="sp-title">
      <h2>SURAT PESANAN</h2>
      <div class="sp-type">${esc(typeLabel[data.order_type] || data.order_type.toUpperCase())}</div>
      <div class="sp-number">No: ${esc(data.order_number)}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-block">
      <label>KEPADA (PBF)</label>
      <p>${esc(data.supplier_name)}${data.supplier_address ? ' \u2013 ' + esc(data.supplier_address) : ''}</p>
    </div>
    <div class="meta-block">
      <label>TANGGAL</label>
      <p>${new Date(data.order_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
  </div>

  ${narcNote}

  <p style="margin-bottom:8px">Yang bertanda tangan di bawah ini, kami meminta dengan hormat agar Saudara berkenan mengirimkan obat-obatan sebagai berikut:</p>

  <table class="items">
    <thead>
      <tr>
        <th class="center" style="width:30px">No.</th>
        <th>Nama Obat / Sediaan / Kekuatan</th>
        <th class="right" style="width:60px">Jml</th>
        <th class="center" style="width:50px">Satuan</th>
        <th class="right" style="width:100px">Harga Est. (Rp)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <p class="footer-note">* Harga estimasi, dapat berubah sesuai faktur PBF.</p>

  <div class="signatures">
    <div class="sig-box">
      <div class="role">Apoteker Pemesan</div>
      <div class="name-line">
        ${esc(data.apoteker_name || '-')}<br>
        ${data.sipa_number ? '<small>SIPA: ' + esc(data.sipa_number) + '</small>' : ''}
      </div>
    </div>
    <div class="sig-box">
      <div class="role">Mengetahui,</div>
      <div class="name-line">&nbsp;</div>
    </div>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=960,height=720');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  }
}
