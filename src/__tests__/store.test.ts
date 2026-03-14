import { describe, it, expect, beforeEach } from 'vitest';

// We test the store logic without React — Zustand works in Node
// But we need to mock the persist middleware
import { usePOSStore, CartItem } from '../lib/store';

const mockItem: CartItem = {
  id: 'med-1',
  name: 'Paracetamol 500mg',
  price: 5000,
  quantity: 1,
  stock: 10,
  unit: 'tablet',
  expiry_date: '2027-12-31',
  discount: 0,
};

const mockItem2: CartItem = {
  id: 'med-2',
  name: 'Amoxicillin 500mg',
  price: 8000,
  quantity: 1,
  stock: 5,
  unit: 'kapsul',
  expiry_date: '2027-06-15',
  discount: 0,
};

describe('POSStore', () => {
  beforeEach(() => {
    usePOSStore.getState().resetStore();
  });

  describe('addToCart', () => {
    it('adds new item to cart with quantity 1', () => {
      usePOSStore.getState().addToCart(mockItem);
      const cart = usePOSStore.getState().cart;
      expect(cart).toHaveLength(1);
      expect(cart[0].id).toBe('med-1');
      expect(cart[0].quantity).toBe(1);
    });

    it('increments quantity for existing item', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().addToCart(mockItem);
      const cart = usePOSStore.getState().cart;
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(2);
    });

    it('does not exceed stock limit', () => {
      const lowStockItem = { ...mockItem, stock: 2 };
      usePOSStore.getState().addToCart(lowStockItem);
      usePOSStore.getState().addToCart(lowStockItem);
      // Third add should be blocked
      usePOSStore.getState().addToCart(lowStockItem);
      const cart = usePOSStore.getState().cart;
      expect(cart[0].quantity).toBe(2);
    });
  });

  describe('removeFromCart', () => {
    it('removes item by id', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().addToCart(mockItem2);
      usePOSStore.getState().removeFromCart('med-1');
      const cart = usePOSStore.getState().cart;
      expect(cart).toHaveLength(1);
      expect(cart[0].id).toBe('med-2');
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity to valid value', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().updateQuantity('med-1', 5);
      expect(usePOSStore.getState().cart[0].quantity).toBe(5);
    });

    it('does not allow quantity below 1', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().updateQuantity('med-1', 0);
      expect(usePOSStore.getState().cart[0].quantity).toBe(1);
    });

    it('does not allow quantity above stock', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().updateQuantity('med-1', 15);
      expect(usePOSStore.getState().cart[0].quantity).toBe(1); // unchanged
    });

    it('re-clamps discount when quantity decreases', () => {
      usePOSStore.getState().addToCart(mockItem); // price=5000, qty=1
      usePOSStore.getState().updateQuantity('med-1', 3); // qty=3, max discount=15000
      usePOSStore.getState().updateItemDiscount('med-1', 12000);
      expect(usePOSStore.getState().cart[0].discount).toBe(12000);

      usePOSStore.getState().updateQuantity('med-1', 2); // qty=2, max discount=10000
      expect(usePOSStore.getState().cart[0].discount).toBe(10000); // re-clamped
    });
  });

  describe('updateItemDiscount', () => {
    it('sets per-item discount', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().updateItemDiscount('med-1', 1000);
      expect(usePOSStore.getState().cart[0].discount).toBe(1000);
    });

    it('clamps discount to item total', () => {
      usePOSStore.getState().addToCart(mockItem); // price=5000, qty=1
      usePOSStore.getState().updateItemDiscount('med-1', 10000);
      expect(usePOSStore.getState().cart[0].discount).toBe(5000); // clamped
    });

    it('does not allow negative discount', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().updateItemDiscount('med-1', -500);
      expect(usePOSStore.getState().cart[0].discount).toBe(0);
    });
  });

  describe('globalDiscount', () => {
    it('sets global discount', () => {
      usePOSStore.getState().setGlobalDiscount(5000);
      expect(usePOSStore.getState().globalDiscount).toBe(5000);
    });

    it('does not allow negative global discount', () => {
      usePOSStore.getState().setGlobalDiscount(-1000);
      expect(usePOSStore.getState().globalDiscount).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('clears cart and resets discount', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().setGlobalDiscount(5000);
      usePOSStore.getState().setPrescriptionId('rx-1');
      usePOSStore.getState().clearCart();

      const state = usePOSStore.getState();
      expect(state.cart).toHaveLength(0);
      expect(state.globalDiscount).toBe(0);
      expect(state.prescriptionId).toBeNull();
    });
  });

  describe('restoreItem', () => {
    it('restores removed item to cart', () => {
      usePOSStore.getState().addToCart(mockItem);
      usePOSStore.getState().removeFromCart('med-1');
      usePOSStore.getState().restoreItem(mockItem);
      expect(usePOSStore.getState().cart).toHaveLength(1);
      expect(usePOSStore.getState().cart[0].id).toBe('med-1');
    });
  });
});
