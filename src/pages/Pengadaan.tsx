import { useState } from 'react';
import { Truck, BookBookmark, Storefront, Receipt } from '@phosphor-icons/react';
import { SupplierList } from '../components/pengadaan/SupplierList';
import { PurchaseOrderList } from '../components/pengadaan/PurchaseOrderList';
import { DefectaList } from '../components/pengadaan/DefectaList';
import { InvoiceList } from '../components/pengadaan/InvoiceList';
import { PageHeader, Tabs } from '../components/ui';
import type { TabItem } from '../components/ui';

const tabItems: TabItem[] = [
  { value: 'surat-pesanan', label: 'Surat Pesanan', icon: <Truck aria-hidden="true" className="w-4 h-4" /> },
  { value: 'faktur', label: 'Faktur PBF (A/P)', icon: <Receipt aria-hidden="true" className="w-4 h-4" /> },
  { value: 'defecta', label: 'Buku Defecta', icon: <BookBookmark aria-hidden="true" className="w-4 h-4" /> },
  { value: 'supplier', label: 'Suplier (PBF)', icon: <Storefront aria-hidden="true" className="w-4 h-4" /> },
];

export default function Pengadaan() {
  const [activeTab, setActiveTab] = useState('surat-pesanan');

  return (
    <div className="flex-1 overflow-x-hidden p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
      <PageHeader
        title="Pengadaan & Pembelian"
        subtitle="Manajemen Surat Pesanan, Buku Defecta, dan PBF"
      />

      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} className="mb-6" />

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-e1 border border-slate-100 dark:border-slate-800 min-h-[400px]">
        {activeTab === 'surat-pesanan' && <PurchaseOrderList />}
        {activeTab === 'faktur' && <InvoiceList />}
        {activeTab === 'defecta' && <DefectaList />}
        {activeTab === 'supplier' && <SupplierList />}
      </div>
    </div>
  );
}
