import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { X, FileText, Buildings, Plus, Trash, MagnifyingGlass, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatRupiah } from '../../lib/types';
import type { Supplier } from './SupplierList';

type MedicineOption = {
  id: string;
  name: string;
  unit: string;
  sell_price: number;
};

type OrderItem = {
  medicine_id: string;
  name: string;
  quantity: number;
  unit: string;
  estimated_price: number;
};

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export function PurchaseOrderModal({ onClose, onSuccess }: Props) {
  const { effectiveUserId } = useAuth();
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [orderType, setOrderType] = useState('reguler');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initData = async () => {
      if (!effectiveUserId) return;
      try {
        const { data: supData, error: supErr } = await supabase
          .from('suppliers')
          .select('*')
          .eq('pharmacy_id', effectiveUserId)
          .order('name');
        if (supErr) throw supErr;
        setSuppliers(supData || []);

        const { data: medData, error: medErr } = await supabase
          .from('medicines')
          .select('id, name, unit, sell_price')
          .eq('user_id', effectiveUserId)
          .order('name');
        if (medErr) throw medErr;
        setMedicines(medData || []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        toast.error('Gagal memuat data master: ' + err.message);
      }
    };
    initData();
  }, [effectiveUserId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMedicines = medicines.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !items.find(i => i.medicine_id === m.id)
  ).slice(0, 10);

  const addItem = (med: MedicineOption) => {
    setItems([...items, {
      medicine_id: med.id,
      name: med.name,
      quantity: 1,
      unit: med.unit || 'Pcs',
      estimated_price: Math.floor(med.sell_price * 0.8) // default estimate 80% of sell price
    }]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.medicine_id !== id));

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) qty = 1;
    setItems(items.map(i => i.medicine_id === id ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (id: string, price: number) => {
    if (price < 0) price = 0;
    setItems(items.map(i => i.medicine_id === id ? { ...i, estimated_price: price } : i));
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.estimated_price), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return toast.error('Pilih PBF terlebih dahulu');
    if (items.length === 0) return toast.error('Pilih minimal 1 obat untuk dipesan');

    setIsSubmitting(true);
    try {
      // 1. Generate Order Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const d = new Date();
      const uniqueSuffix = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      const typePrefix = orderType === 'reguler' ? 'REG' : orderType.substring(0, 3).toUpperCase();
      const orderNumber = `SP-${typePrefix}-${dateStr}-${uniqueSuffix}`;

      // 2. Insert PO
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert({
          pharmacy_id: effectiveUserId,
          supplier_id: selectedSupplier,
          order_number: orderNumber,
          order_type: orderType,
          total_amount: totalAmount,
          status: 'draft'
        })
        .select('id')
        .single();
      
      if (poErr) throw poErr;

      // 3. Insert Items
      const poItems = items.map(item => ({
        po_id: po.id,
        medicine_id: item.medicine_id,
        quantity: item.quantity,
        unit: item.unit,
        estimated_price: item.estimated_price
      }));

      const { error: itemsErr } = await supabase.from('purchase_order_items').insert(poItems);
      if (itemsErr) throw itemsErr;

      toast.success('Surat Pesanan berhasil dibuat');
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal membuat Surat Pesanan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-xl flex flex-col h-[95vh] sm:h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-500" />
              Buat Surat Pesanan (SP)
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Buat draft pesanan baru ke PBF</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-6">
            
            {/* SP Details Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Pilih Suplier (PBF) *</label>
                <div className="relative">
                  <select 
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100 text-sm appearance-none"
                    required
                  >
                    <option value="" disabled>-- Pilih PBF --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <Buildings className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Jenis SP *</label>
                <div className="relative">
                  <select 
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100 text-sm appearance-none"
                    required
                  >
                    <option value="reguler">Reguler</option>
                    <option value="narkotika">Narkotika</option>
                    <option value="psikotropika">Psikotropika</option>
                    <option value="prekursor">Prekursor</option>
                    <option value="oot">OOT (Obat Obat Tertentu)</option>
                  </select>
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
              </div>
            </div>

            {orderType !== 'reguler' && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-3 text-sm text-amber-700 dark:text-amber-400">
                <Warning weight="fill" className="w-5 h-5 shrink-0 mt-0.5" />
                <p>SP {orderType.toUpperCase()} harus dicetak secara terpisah dan ditandatangani basah oleh Apoteker (SIPA) sebelum diserahkan ke PBF.</p>
              </div>
            )}

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Medicine Search */}
            <div className="relative" ref={searchRef}>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tambah Obat ke Pesanan</label>
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                  placeholder="Ketik nama obat untuk mencari..."
                />
              </div>

              {/* Search Results Dropdown */}
              {showDropdown && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-60">
                  {filteredMedicines.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">Tidak ada obat ditemukan</div>
                  ) : (
                    filteredMedicines.map(med => (
                      <button
                        key={med.id}
                        type="button"
                        onClick={() => addItem(med)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex align-center justify-between border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{med.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{med.unit}</span>
                          <Plus className="w-4 h-4 text-blue-500" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Items List */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
                <span>Daftar Item ({items.length})</span>
                <span className="text-blue-600 dark:text-blue-400">Total: {formatRupiah(totalAmount)}</span>
              </h3>
              
              {items.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
                  Belum ada obat yang ditambahkan
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={item.medicine_id} className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl items-start sm:items-center">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-400 mb-1 block">#{idx + 1}</span>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</h4>
                      </div>
                      
                      <div className="flex w-full sm:w-auto items-center gap-3">
                        <div className="flex-1 sm:w-28 flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Qty</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity || ''}
                              onChange={(e) => updateQuantity(item.medicine_id, parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{item.unit}</span>
                          </div>
                        </div>

                        <div className="flex-1 sm:w-36 flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Estimasi Harga Beli</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">Rp</span>
                            <input
                              type="number"
                              min="0"
                              value={item.estimated_price || ''}
                              onChange={(e) => updatePrice(item.medicine_id, parseInt(e.target.value) || 0)}
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold"
                            />
                          </div>
                        </div>

                        <div className="flex-col pt-4">
                          <button
                            type="button"
                            onClick={() => removeItem(item.medicine_id)}
                            className="p-2 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-lg shrink-0 transition-colors"
                          >
                            <Trash className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0 || !selectedSupplier}
              className="px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-full shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Buat SP Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
