import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePOSStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import { getExpiryStatus, formatRupiah } from '../lib/types';
import { ShoppingCart } from '@phosphor-icons/react';
import type { Medicine, PaymentMethod } from '../lib/types';
import type { ReceiptData } from '../lib/receipt';
import { usePOSInventory } from '../hooks/usePOSInventory';
import { useFEFOAllocations } from '../hooks/useFEFOAllocations';
import { queueTransaction } from '../lib/offlineQueue';

// Sub-components
import { MedicineCatalog } from '../components/pos/MedicineCatalog';
import { CartPanel } from '../components/pos/CartPanel';
import { CheckoutModal } from '../components/pos/CheckoutModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { BarcodeScanner } from '../components/pos/BarcodeScanner';
import { ApotekerApprovalModal, hasRestrictedMedicines } from '../components/pos/ApotekerApproval';
import { ShiftModal } from '../components/pos/ShiftModal';
import { CloseShiftModal } from '../components/pos/CloseShiftModal';
import { NarcoticHandoverModal, type NarcoticHandoverData } from '../components/NarcoticHandoverModal';

export default function POS() {
  const { user, profile, effectiveUserId } = useAuth();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadedResepId = useRef<string | null>(null); // prevent double-load

  // Inventory hook (handles fetch, search, realtime, catalog restore)
  const {
    medicines, loading, fetchInventory,
    searchInventory, restoreCatalog, validateCartItems,
  } = usePOSInventory();

  // Modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showApotekerApproval, setShowApotekerApproval] = useState(false);
  const [pendingCheckoutData, setPendingCheckoutData] = useState<{
    paymentMethod: PaymentMethod;
    cashReceived: number;
    customerName: string;
    customerPhone: string;
  } | null>(null);
  const [medicineCategories, setMedicineCategories] = useState<Record<string, string>>({});
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showNarcoticHandover, setShowNarcoticHandover] = useState(false);

  // Receipt
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);

  // Shift Management
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [checkingShift, setCheckingShift] = useState(true);

  // FEFO Allocations for cart visualization
  const { allocations: cartAllocations } = useFEFOAllocations(effectiveUserId);

  // Build medicine category map for restricted medicine check
  useEffect(() => {
    const categories: Record<string, string> = {};
    medicines.forEach(med => {
      categories[med.id] = med.category || 'umum';
    });
    setMedicineCategories(categories);
  }, [medicines]);

  // Check active shift
  useEffect(() => {
    if (!user || !effectiveUserId) return;
    const checkActiveShift = async () => {
      try {
        const { data, error } = await supabase
          .from('cashier_shifts')
          .select('id')
          .eq('cashier_id', user.id)
          .eq('pharmacy_id', effectiveUserId)
          .eq('status', 'open')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) throw error;
        if (data) {
          setActiveShiftId(data.id);
        } else {
          setActiveShiftId(null);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error("Error checking shift:", err);
        toast.error('Gagal memeriksa shift: ' + (err?.message ?? 'Terjadi kesalahan'));
      } finally {
        setCheckingShift(false);
      }
    };
    checkActiveShift();
  }, [user, effectiveUserId]);

  // Store
  const {
    cart, globalDiscount, prescriptionId, searchQuery,
    addToCart, removeFromCart, restoreItem, updateQuantity,
    updateItemDiscount, updateItemSigna, setGlobalDiscount, setPrescriptionId,
    clearCart, setSearchQuery,
  } = usePOSStore();

  // ── Keyboard Shortcuts (using refs to avoid re-creating listener) ──
  const cartRef = useRef(cart);
  const showScannerRef = useRef(showScanner);
  cartRef.current = cart;
  showScannerRef.current = showScanner;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'F4') { e.preventDefault(); setShowScanner(s => !s); }
      if (e.key === 'F8' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (cartRef.current.length > 0) setShowCheckoutModal(true);
      }
      if (e.key === 'Escape') {
        setShowCheckoutModal(false);
        setShowReceiptModal(false);
        setShowMobileCart(false);
        setShowShortcutHelp(false);
        if (showScannerRef.current) setShowScanner(false);
      }
      // ? key = show shortcut help (only when not typing in an input)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowShortcutHelp(s => !s);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // empty deps — uses refs

  // ── Debounced server-side search (for >150 SKU pharmacies) ──
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      // When search is cleared, restore original catalog
      if (searchQuery === '') restoreCatalog();
      return;
    }

    const localHasResult = medicines.some(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.barcode && m.barcode.includes(searchQuery))
    );
    if (localHasResult) return;

    const timer = setTimeout(() => searchInventory(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, medicines, searchInventory, restoreCatalog]);

  // ── Pre-fill cart from prescription ──
  useEffect(() => {
    const resepId = searchParams.get('resep_id');
    if (!resepId || !user || !effectiveUserId) return;
    if (loadedResepId.current === resepId) return; // already loaded, prevent double-trigger
    loadedResepId.current = resepId;

    const loadPrescription = async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          id, prescription_number, patient_name, status,
          prescription_items (
            id, medicine_name, medicine_id, signa, quantity,
            medicines ( id, name, sell_price, unit, stock, expiry_date )
          )
        `)
        .eq('id', resepId)
        .eq('user_id', effectiveUserId)
        .single();

      if (error || !data) { toast.error('Resep tidak ditemukan'); return; }

      const prescriptionData = data as unknown as {
        id: string;
        prescription_number: string;
        patient_name: string;
        status: string;
        prescription_items: Array<{
          id: string;
          medicine_name: string;
          medicine_id: string | null;
          signa: string;
          quantity: number;
          medicines: { id: string; name: string; sell_price: number; unit: string; stock: number; expiry_date: string } | null;
        }>;
      };

      if (prescriptionData.status === 'dispensed') { toast.warning('Resep ini sudah pernah ditebus'); return; }

      clearCart();
      setPrescriptionId(resepId);

      const items = prescriptionData.prescription_items || [];
      let loadedCount = 0;

      for (const pi of items) {
        let med = pi.medicines ?? null;

        // Fallback: jika medicine_id null (resep lama), cari by nama di stok apotek
        if (!med && pi.medicine_name?.trim()) {
          const { data: fallbackMed } = await supabase
            .from('medicines')
            .select('id, name, sell_price, unit, stock, expiry_date')
            .eq('user_id', effectiveUserId)
            .ilike('name', pi.medicine_name.trim())
            .limit(1)
            .maybeSingle();
          med = fallbackMed ?? null;
        }

        if (!med) {
          toast.warning(`"${pi.medicine_name}" tidak ditemukan di stok, dilewati`);
          continue;
        }
        if (getExpiryStatus(med.expiry_date) === 'expired') {
          toast.warning(`${med.name} sudah expired, dilewati`);
          continue;
        }
        addToCart({
          id: med.id, name: med.name, price: med.sell_price,
          quantity: Math.min(pi.quantity, med.stock),
          stock: med.stock, unit: med.unit || 'pcs',
          expiry_date: med.expiry_date, discount: 0,
          signa: pi.signa || undefined,
        });
        loadedCount++;
      }

      if (loadedCount > 0) {
        toast.success(`Resep ${prescriptionData.prescription_number} — ${prescriptionData.patient_name}: ${loadedCount} obat dimuat ke keranjang`);
      } else {
        toast.error('Tidak ada obat dari resep ini yang ditemukan di stok apotek');
      }
    };

    loadPrescription();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, effectiveUserId]);

  // ── Revalidate persisted cart on mount (stale stock/price fix) ──
  const hasRevalidated = useRef(false);
  useEffect(() => {
    if (hasRevalidated.current || cart.length === 0 || !effectiveUserId || loading) return;
    hasRevalidated.current = true;

    (async () => {
      const { valid, updates } = await validateCartItems(cart.map(i => i.id));
      if (!valid) return;

      for (const item of cart) {
        const latest = updates[item.id];
        if (!latest) {
          removeFromCart(item.id);
          toast.info(`"${item.name}" sudah tidak tersedia, dihapus dari keranjang`);
          continue;
        }
        if (latest.stock !== item.stock || latest.price !== item.price) {
          restoreItem({ ...item, stock: latest.stock, price: latest.price });
          if (latest.stock < item.quantity) {
            if (latest.stock > 0) {
              updateQuantity(item.id, latest.stock);
              toast.info(`Stok "${item.name}" berubah, qty disesuaikan ke ${latest.stock}`);
            } else {
              removeFromCart(item.id);
              toast.info(`"${item.name}" stok habis, dihapus dari keranjang`);
            }
          }
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId, loading]);

  // ── Cart calculations ──
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity) - item.discount, 0);
  const totalAmount = Math.max(0, subtotal - globalDiscount);

  // ── Handler: remove with undo ──
  const handleRemoveFromCart = useCallback((item: typeof cart[0]) => {
    removeFromCart(item.id);
    toast('Item dihapus dari keranjang', {
      action: { label: 'Batalkan', onClick: () => restoreItem(item) },
      duration: 4000,
    });
  }, [removeFromCart, restoreItem]);

  // ── Handler: add medicine to cart ──
  const handleAddToCart = useCallback((med: Medicine) => {
    addToCart({
      id: med.id, name: med.name, price: med.sell_price,
      quantity: 1, stock: med.stock, unit: med.unit || 'pcs',
      expiry_date: med.expiry_date, discount: 0,
    });
  }, [addToCart]);

  // ── Handler: open checkout with cart validation ──
  const handleOpenCheckout = useCallback(async () => {
    if (cart.length === 0) return;

    // Re-validate cart against latest prices/stock before showing checkout
    const { valid, updates } = await validateCartItems(cart.map(i => i.id));
    if (!valid) {
      toast.error('Gagal memvalidasi stok. Periksa koneksi internet.');
      return;
    }

    let hasIssues = false;
    const cartItemIds = cart.map(i => i.id);
    for (const id of cartItemIds) {
      const latest = updates[id];
      if (!latest) {
        toast.error('Obat di keranjang sudah tidak tersedia. Silakan perbarui keranjang.');
        hasIssues = true;
        break;
      }
      const cartItem = cart.find(i => i.id === id);
      if (!cartItem) continue;

      if (latest.stock < cartItem.quantity) {
        toast.warning(`Stok "${latest.name}" berubah. Tersedia: ${latest.stock}, di keranjang: ${cartItem.quantity}. Qty akan disesuaikan.`);
        if (latest.stock > 0) {
          updateQuantity(id, latest.stock);
        } else {
          removeFromCart(id);
        }
        hasIssues = true;
      }
      if (latest.price !== cartItem.price) {
        toast.info(`Harga "${latest.name}" berubah dari ${formatRupiah(cartItem.price)} ke ${formatRupiah(latest.price)}`);
        // Update store cart item price — piggyback on restoreItem
        restoreItem({ ...cartItem, price: latest.price, stock: latest.stock });
      }
    }

    if (!hasIssues) {
      setShowCheckoutModal(true);
    }
  }, [cart, validateCartItems, updateQuantity, removeFromCart, restoreItem]);

  // ── Handler: checkout ──
  const handleCheckout = async (paymentMethod: PaymentMethod, cashReceived: number, customerName: string, customerPhone: string) => {
    if (cart.length === 0 || !user || isProcessing) return;

    // Block expired items
    const expiredItems = cart.filter(i => getExpiryStatus(i.expiry_date) === 'expired');
    if (expiredItems.length > 0) {
      toast.error(`${expiredItems.length} item sudah EXPIRED! Hapus dari keranjang.`);
      return;
    }

    if (paymentMethod === 'cash' && cashReceived > 0 && cashReceived < totalAmount) {
      toast.warning('Uang yang diterima kurang dari total pembayaran');
      return;
    }

    // Check for restricted medicines (narkotika/psikotropika) - requires apoteker approval
    const restrictedItems = hasRestrictedMedicines(cart, medicineCategories);
    if (restrictedItems.length > 0 && !pendingCheckoutData) {
      // Store checkout data and show approval modal
      setPendingCheckoutData({ paymentMethod, cashReceived, customerName, customerPhone });
      setShowCheckoutModal(false);
      setShowApotekerApproval(true);
      return;
    }

    await executeCheckout(paymentMethod, cashReceived, customerName, customerPhone);
  };

  // ── Execute checkout after all validations ──
  const executeCheckout = async (paymentMethod: PaymentMethod, cashReceived: number, customerName: string, customerPhone: string) => {
    setIsProcessing(true);
    const totalDiscount = globalDiscount + cart.reduce((s, i) => s + i.discount, 0);

    try {
      // ── OFFLINE MODE: queue transaction for later sync ──
      if (!navigator.onLine) {
        const queuedId = await queueTransaction({
          totalAmount,
          discountTotal: totalDiscount,
          paymentMethod,
          items: cart.map(item => ({
            medicine_id: item.id,
            quantity: item.quantity,
            price_at_transaction: item.price,
            discount_amount: item.discount,
          })),
          prescriptionId: prescriptionId || undefined,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
        });

        // Generate local receipt with queued transaction ID
        setLastReceipt({
          transactionNumber: `OFFLINE-${queuedId.substring(0, 8).toUpperCase()}`,
          date: new Date().toLocaleString('id-ID'),
          items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, unit: i.unit, signa: i.signa })),
          total: totalAmount,
          discount: totalDiscount,
          paymentMethod,
          cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
          customerName: customerName.trim() || undefined,
          pharmacyName: profile?.pharmacy_name || 'KLINIK & APOTEK MEDISIR',
          pharmacyAddress: profile?.pharmacy_address || '',
          pharmacyPhone: profile?.phone || '',
          apotekerName: profile?.apoteker_name || undefined,
          siaNumber: profile?.sia_number || undefined,
          sipaNumber: profile?.sipa_number || undefined,
          logoUrl: profile?.logo_url || undefined,
        });

        setShowCheckoutModal(false);
        setShowReceiptModal(true);
        toast.success('Transaksi disimpan offline! Akan disinkronkan saat online.');
        clearCart();
        return;
      }

      // ── ONLINE MODE: process checkout via RPC ──
      // Atomic RPC: p_user_id removed — function uses auth context internally
      const { data: result, error: rpcError } = await supabase.rpc('process_checkout', {
        p_total_amount:    totalAmount,
        p_discount_total:  totalDiscount,
        p_payment_method:  paymentMethod,
        p_items: cart.map(item => ({
          medicine_id:           item.id,
          quantity:              item.quantity,
          price_at_transaction:  item.price,
          discount_amount:       item.discount,
        })),
        p_prescription_id: prescriptionId || null,
        p_customer_name:   customerName.trim() || null,
        p_customer_phone:  customerPhone.trim() || null,
      });

      if (rpcError) throw rpcError;

      const { transaction_number: transactionNumber } = result as {
        transaction_id: string;
        transaction_number: string;
      };

      setLastReceipt({
        transactionNumber,
        date: new Date().toLocaleString('id-ID'),
        items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, unit: i.unit, signa: i.signa })),
        total: totalAmount,
        discount: totalDiscount,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
        customerName: customerName.trim() || undefined,
        pharmacyName: profile?.pharmacy_name || 'KLINIK & APOTEK MEDISIR',
        pharmacyAddress: profile?.pharmacy_address || '',
        pharmacyPhone: profile?.phone || '',
        apotekerName: profile?.apoteker_name || undefined,
        siaNumber: profile?.sia_number || undefined,
        sipaNumber: profile?.sipa_number || undefined,
        logoUrl: profile?.logo_url || undefined,
      });

      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      toast.success('Transaksi berhasil!');
      clearCart();
      fetchInventory();
    } catch (error: unknown) {
      toast.error('Gagal memproses transaksi: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Handler: apoteker approval confirmed ──
  const handleApotekerApproval = () => {
    if (!pendingCheckoutData) return;
    setShowApotekerApproval(false);

    // Check if cart has specifically narkotika items → require handover proof
    const narcoticItems = cart.filter(item => medicineCategories[item.id] === 'narkotika');
    if (narcoticItems.length > 0) {
      setShowNarcoticHandover(true);
      return;
    }

    executeCheckout(
      pendingCheckoutData.paymentMethod,
      pendingCheckoutData.cashReceived,
      pendingCheckoutData.customerName,
      pendingCheckoutData.customerPhone
    );
    setPendingCheckoutData(null);
  };

  // ── Handler: narcotic handover confirmed ──
  const handleNarcoticHandoverConfirm = (data: NarcoticHandoverData) => {
    if (!pendingCheckoutData || !effectiveUserId) return;
    setShowNarcoticHandover(false);

    // Store handover record in localStorage
    const storedHandovers = localStorage.getItem(`narcotic_handovers_${effectiveUserId}`);
    const handovers: NarcoticHandoverData[] = storedHandovers ? JSON.parse(storedHandovers) : [];
    handovers.unshift(data);
    localStorage.setItem(`narcotic_handovers_${effectiveUserId}`, JSON.stringify(handovers.slice(0, 500)));

    executeCheckout(
      pendingCheckoutData.paymentMethod,
      pendingCheckoutData.cashReceived,
      pendingCheckoutData.customerName,
      pendingCheckoutData.customerPhone
    );
    setPendingCheckoutData(null);
  };

  const handleApotekerCancel = () => {
    setShowApotekerApproval(false);
    setShowNarcoticHandover(false);
    setPendingCheckoutData(null);
    setShowCheckoutModal(true);
  };

  // ── Handler: barcode scanned ──
  const handleBarcodeScanned = useCallback((barcode: string) => {
    setSearchQuery(barcode);
    const found = medicines.find(m => m.barcode === barcode);
    if (found && found.stock > 0) {
      handleAddToCart(found);
      toast.success(`${found.name} ditambahkan ke keranjang`);
    } else if (found && found.stock <= 0) {
      toast.warning(`${found.name} stok habis`);
    } else {
      toast.info(`Barcode ${barcode} tidak ditemukan`);
    }
  }, [medicines, handleAddToCart, setSearchQuery]);

  return (
    <div className="font-sans text-slate-800 dark:text-slate-100 antialiased min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <main className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden">
        {checkingShift ? (
          <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-slate-400">
             <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
             <p className="text-sm">Memeriksa status shift...</p>
          </div>
        ) : !activeShiftId ? (
          <ShiftModal 
            effectiveUserId={effectiveUserId!} 
            onShiftOpened={(id) => setActiveShiftId(id)} 
          />
        ) : (
          <MedicineCatalog
            medicines={medicines}
            loading={loading}
            searchQuery={searchQuery}
            searchInputRef={searchInputRef}
            onSearchChange={setSearchQuery}
            onAddToCart={handleAddToCart}
            onStartScanner={() => setShowScanner(true)}
          />
        )}
        {/* Desktop cart — always visible */}
        <div className="hidden lg:flex lg:w-1/3 h-full">
          <CartPanel
            cart={cart}
            globalDiscount={globalDiscount}
            totalAmount={totalAmount}
            subtotal={subtotal}
            onRemove={handleRemoveFromCart}
            onUpdateQuantity={updateQuantity}
            onUpdateItemDiscount={updateItemDiscount}
            onUpdateItemSigna={updateItemSigna}
            onSetGlobalDiscount={setGlobalDiscount}
            onClearCart={clearCart}
            onCheckout={handleOpenCheckout}
            onCloseShift={() => setShowCloseShift(true)}
            allocations={cartAllocations}
          />
        </div>
      </main>

      {/* Mobile cart bottom sheet */}
      {showMobileCart && (
        <CartPanel
          cart={cart}
          globalDiscount={globalDiscount}
          totalAmount={totalAmount}
          subtotal={subtotal}
          onRemove={handleRemoveFromCart}
          onUpdateQuantity={updateQuantity}
          onUpdateItemDiscount={updateItemDiscount}
          onUpdateItemSigna={updateItemSigna}
          onSetGlobalDiscount={setGlobalDiscount}
          onClearCart={clearCart}
          onCheckout={handleOpenCheckout}
          onCloseShift={() => setShowCloseShift(true)}
          isMobileSheet
          onClose={() => setShowMobileCart(false)}
          allocations={cartAllocations}
        />
      )}

      {/* Mobile cart FAB */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowMobileCart(true)}
          className="lg:hidden fixed bottom-20 right-4 z-50 bg-blue-500 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center gap-2"
        >
          <ShoppingCart weight="fill" className="w-6 h-6" />
          <span className="font-bold text-lg">{cart.length}</span>
          <span className="text-xs ml-1">{formatRupiah(totalAmount)}</span>
        </button>
      )}

      {showCheckoutModal && (
        <CheckoutModal
          cart={cart}
          totalAmount={totalAmount}
          globalDiscount={globalDiscount}
          effectiveUserId={effectiveUserId}
          isProcessing={isProcessing}
          onCheckout={handleCheckout}
          onClose={() => setShowCheckoutModal(false)}
        />
      )}

      {showReceiptModal && lastReceipt && (
        <ReceiptModal
          receipt={lastReceipt}
          defaultWANumber={profile?.phone || '62'}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {showScanner && (
        <BarcodeScanner
          onScanned={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showApotekerApproval && (
        <ApotekerApprovalModal
          restrictedItems={hasRestrictedMedicines(cart, medicineCategories)}
          onApprove={handleApotekerApproval}
          onCancel={handleApotekerCancel}
          apotekerName={profile?.apoteker_name || profile?.full_name}
        />
      )}

      {showNarcoticHandover && (
        <NarcoticHandoverModal
          narcoticItems={cart
            .filter(item => medicineCategories[item.id] === 'narkotika')
            .map(item => ({ medicine_name: item.name, quantity: item.quantity, unit: item.unit }))}
          onConfirm={handleNarcoticHandoverConfirm}
          onClose={() => {
            setShowNarcoticHandover(false);
            setPendingCheckoutData(null);
            setShowCheckoutModal(true);
          }}
        />
      )}

      {showCloseShift && activeShiftId && (
        <CloseShiftModal
          shiftId={activeShiftId}
          onClose={() => setShowCloseShift(false)}
          onClosed={() => {
            setShowCloseShift(false);
            setActiveShiftId(null);
          }}
        />
      )}

      {/* Keyboard Shortcut Help Overlay */}
      {showShortcutHelp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowShortcutHelp(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">⌨️ Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              {[
                { key: 'F2', desc: 'Cari obat / fokus pencarian' },
                { key: 'F4', desc: 'Toggle scanner barcode' },
                { key: 'F8', desc: 'Buka checkout / bayar' },
                { key: 'Ctrl+Enter', desc: 'Buka checkout / bayar' },
                { key: 'Esc', desc: 'Tutup modal / batal' },
                { key: '?', desc: 'Tampilkan bantuan ini' },
              ].map(s => (
                <div key={s.key} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-slate-600 dark:text-slate-300">{s.desc}</span>
                  <kbd className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded text-xs font-mono font-bold">{s.key}</kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcutHelp(false)}
              className="mt-4 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
