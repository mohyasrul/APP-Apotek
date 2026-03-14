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
};

export type ApographItem = {
  medicine_name: string;
  quantity: number;
  dispensed_quantity: number;
  signa?: string;
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
/** Hasilkan HTML receipt siap print (lebar 58mm, font monospace) */
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
  } = receipt;

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
    font-size: 12px;
    width: 58mm;
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
  ${logoUrl && /^(https?:\/\/|data:image\/)/.test(logoUrl) ? `<div class="center" style="margin-bottom:6px;"><img src="${escapeHtml(logoUrl)}" alt="" style="max-height:56px; max-width:90%; object-fit:contain;"/></div>` : ''}
  <div class="center bold" style="font-size:14px;">${safeName}</div>
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
  <div class="right bold" style="font-size:14px;">TOTAL: Rp ${total.toLocaleString('id-ID')}</div>
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

    return `
      <tr>
        <td style="width:24px; padding-top:4px;"><span style="font-family:serif; font-size:16px; font-weight:bold; font-style:italic;">R/</span></td>
        <td style="padding-top:4px;">
          <div style="font-weight:bold; font-size:13px;">${escapeHtml(i.medicine_name)}</div>
          <div style="font-size:11px; margin-top:2px;">No: ${i.quantity}</div>
          <div style="font-size:11px; margin-top:2px;">S: ${escapeHtml(i.signa || '-')}</div>
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
        <div style="font-size:10px;">stempel & tanda tangan</div>
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
