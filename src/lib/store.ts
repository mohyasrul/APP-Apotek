import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';

export type CartItem = {
  id: string; // medicine_id
  name: string;
  price: number;
  quantity: number;
  stock: number;
  unit: string;
  expiry_date: string;
  discount: number; // discount per-item in Rupiah
  signa?: string; // Aturan Pakai (opsional, untuk etiket)
  allocations?: {
    batch_id: string;
    batch_number: string;
    quantity: number;
    expiry_date: string;
  }[];
};

interface POSStore {
  cart: CartItem[];
  globalDiscount: number;
  prescriptionId: string | null;   // ID resep yang sedang ditebus
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  restoreItem: (item: CartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItemDiscount: (id: string, discount: number) => void;
  updateItemSigna: (id: string, signa: string) => void;
  setGlobalDiscount: (discount: number) => void;
  setPrescriptionId: (id: string | null) => void;
  clearCart: () => void;
  resetStore: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const initialState = {
  cart: [] as CartItem[],
  globalDiscount: 0,
  prescriptionId: null as string | null,
  searchQuery: '',
};

export const usePOSStore = create<POSStore>()(
  persist(
    (set) => ({
      ...initialState,
      addToCart: (item) => set((state) => {
        const existingItem = state.cart.find((i) => i.id === item.id);
        if (existingItem) {
          if (existingItem.quantity >= item.stock) {
            toast.warning(`Stok tidak mencukupi. Sisa stok: ${item.stock} ${item.unit}`);
            return state;
          }
          return {
            cart: state.cart.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          };
        }
        return { cart: [...state.cart, { ...item, quantity: 1, discount: 0 }] };
      }),
      removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter((i) => i.id !== id),
      })),
      restoreItem: (item) => set((state) => ({
        // Kembalikan item ke posisi semula jika ada, insert di depan jika sudah hilang
        cart: state.cart.find(i => i.id === item.id)
          ? state.cart.map(i => i.id === item.id ? item : i)
          : [item, ...state.cart],
      })),
      updateQuantity: (id, quantity) => set((state) => {
        if (quantity < 1) return state;

        const item = state.cart.find(i => i.id === id);
        if (item && quantity > item.stock) {
          toast.warning(`Stok maksimal: ${item.stock} ${item.unit}`);
          return state;
        }

        return {
          cart: state.cart.map((i) =>
            i.id === id
              ? { ...i, quantity, discount: Math.min(i.discount, i.price * quantity) }
              : i
          ),
        };
      }),
      updateItemDiscount: (id, discount) => set((state) => ({
        cart: state.cart.map((i) =>
          i.id === id
            ? { ...i, discount: Math.min(Math.max(0, discount), i.price * i.quantity) }
            : i
        ),
      })),
      updateItemSigna: (id, signa) => set((state) => ({
        cart: state.cart.map((i) =>
          i.id === id ? { ...i, signa } : i
        ),
      })),
      setGlobalDiscount: (discount) => set({ globalDiscount: Math.max(0, discount) }),
      setPrescriptionId: (id) => set({ prescriptionId: id }),
      clearCart: () => set({ cart: [], globalDiscount: 0, prescriptionId: null }),
      resetStore: () => set(initialState),
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'medisir-pos-cart',
      partialize: (state) => ({ cart: state.cart, globalDiscount: state.globalDiscount, prescriptionId: state.prescriptionId }),
    }
  )
);
