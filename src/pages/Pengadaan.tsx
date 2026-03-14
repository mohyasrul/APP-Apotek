import { useState } from 'react';
import { Truck, BookBookmark, Storefront, Receipt } from '@phosphor-icons/react';
import { SupplierList } from '../components/pengadaan/SupplierList';
import { PurchaseOrderList } from '../components/pengadaan/PurchaseOrderList';
import { DefectaList } from '../components/pengadaan/DefectaList';
import { InvoiceList } from '../components/pengadaan/InvoiceList';

export default function Pengadaan() {
  const [activeTab, setActiveTab] = useState<'surat-pesanan' | 'defecta' | 'supplier' | 'faktur'>('surat-pesanan');

  return (
    <div className="flex-1 overflow-x-hidden p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Pengadaan & Pembelian
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manajemen Surat Pesanan, Buku Defecta, dan PBF
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('surat-pesanan')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'surat-pesanan'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          <Truck weight={activeTab === 'surat-pesanan' ? 'fill' : 'regular'} className="w-4 h-4" />
          Surat Pesanan
        </button>
        <button
          onClick={() => setActiveTab('faktur')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'faktur'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          <Receipt weight={activeTab === 'faktur' ? 'fill' : 'regular'} className="w-4 h-4" />
          Faktur PBF (A/P)
        </button>
        <button
          onClick={() => setActiveTab('defecta')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'defecta'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          <BookBookmark weight={activeTab === 'defecta' ? 'fill' : 'regular'} className="w-4 h-4" />
          Buku Defecta
        </button>
        <button
          onClick={() => setActiveTab('supplier')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'supplier'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          <Storefront weight={activeTab === 'supplier' ? 'fill' : 'regular'} className="w-4 h-4" />
          Suplier (PBF)
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 min-h-[400px]">
        {activeTab === 'surat-pesanan' && (
          <PurchaseOrderList />
        )}
        {activeTab === 'faktur' && (
          <InvoiceList />
        )}
        {activeTab === 'defecta' && (
          <DefectaList />
        )}
        {activeTab === 'supplier' && (
          <SupplierList />
        )}
      </div>
    </div>
  );
}
