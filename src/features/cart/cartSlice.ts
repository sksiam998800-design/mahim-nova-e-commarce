import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { calculateCartTotals, CartItemInput, CouponRule } from '../../utils/ecommerceRules';

export interface CartState {
  items: CartItemInput[];
  coupon: CouponRule | null;
  division: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  finalTotal: number;
  lineItemsCount: number;
  selectedItemsCount: number;
  totalQuantity: number;
  couponError: string | null;
  isCartDrawerOpen: boolean;
  isLoading: boolean;
}

const LOCAL_STORAGE_KEY = 'shopmax_cart_items_v2';
const LOCAL_STORAGE_COUPON_KEY = 'shopmax_cart_coupon_v2';

export const INITIAL_DEMO_CART_ITEMS: CartItemInput[] = [
  {
    productId: 'prod-1',
    variantId: 'var-1a',
    variantName: 'Color: Black',
    sku: 'NOV-AUD-001-BLK',
    name: 'Soundcore Life Q30 Wireless Noise Cancelling Headphones',
    price: 99.99,
    salePrice: 74.99,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80',
    stock: 25,
    selected: true,
  },
  {
    productId: 'prod-2',
    variantId: 'var-2a',
    variantName: 'Color: Black',
    sku: 'NOV-WCH-002-BLK',
    name: 'Smart Watch',
    price: 99.99,
    salePrice: 68.99,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80',
    stock: 32,
    selected: true,
  },
  {
    productId: 'prod-6',
    variantId: 'var-6a',
    variantName: 'Color: White',
    sku: 'NOV-EAR-006-WHT',
    name: 'Wireless Earbuds',
    price: 69.99,
    salePrice: 39.99,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&auto=format&fit=crop&q=80',
    stock: 80,
    selected: true,
  },
  {
    productId: 'prod-3',
    variantId: 'var-3a',
    variantName: 'Color: Black',
    sku: 'NOV-BAG-003-BLK',
    name: 'Laptop Backpack',
    price: 79.99,
    salePrice: 49.99,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=600&auto=format&fit=crop&q=80',
    stock: 60,
    selected: true,
  },
  {
    productId: 'prod-4',
    variantId: 'var-4a',
    variantName: 'Size: 42',
    sku: 'NOV-SHOE-004-42',
    name: 'Running Shoes',
    price: 89.99,
    salePrice: 69.99,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
    stock: 28,
    selected: true,
  },
];

export const DEFAULT_REFERENCE_COUPON: CouponRule = {
  code: 'SHOPMAX',
  discountType: 'fixed',
  discountValue: 56.98,
  minOrderAmount: 0,
  validFrom: '2024-01-01',
  validTo: '2030-12-31',
  isActive: true,
};

function loadInitialItems(): CartItemInput[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_CART_ITEMS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return INITIAL_DEMO_CART_ITEMS;
}

function loadInitialCoupon(): CouponRule | null {
  if (typeof window === 'undefined') return DEFAULT_REFERENCE_COUPON;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_COUPON_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    // Check if initial items are default demo items
    const rawItems = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!rawItems) {
      return DEFAULT_REFERENCE_COUPON;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

const initialItems = loadInitialItems();
const initialCoupon = loadInitialCoupon();
const initialTotals = calculateCartTotals(initialItems, initialCoupon, 'US');

const initialState: CartState = {
  items: initialItems,
  coupon: initialCoupon,
  division: 'US',
  subtotal: initialTotals.subtotal,
  discount: initialTotals.discount,
  shippingFee: initialTotals.shippingFee,
  finalTotal: initialTotals.finalTotal,
  lineItemsCount: initialTotals.lineItemsCount,
  selectedItemsCount: initialTotals.selectedItemsCount,
  totalQuantity: initialTotals.totalQuantity,
  couponError: null,
  isCartDrawerOpen: false,
  isLoading: false,
};

function saveItems(items: CartItemInput[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {}
  }
}

function saveCoupon(coupon: CouponRule | null) {
  if (typeof window !== 'undefined') {
    try {
      if (coupon) {
        localStorage.setItem(LOCAL_STORAGE_COUPON_KEY, JSON.stringify(coupon));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_COUPON_KEY);
      }
    } catch (e) {}
  }
}

// Background sync helper with backend /api/cart
function syncToServer(endpoint: string, method: string = 'POST', body?: any) {
  try {
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('shopmax_session_id') || 'guest_default' : 'guest_default';
    fetch(`/api/cart${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => {
      // Offline fallback
    });
  } catch (e) {
    // ignore
  }
}

export const fetchServerCart = createAsyncThunk('cart/fetchServerCart', async () => {
  try {
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('shopmax_session_id') || 'guest_default' : 'guest_default';
    const res = await fetch('/api/cart', {
      headers: { 'x-session-id': sessionId },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return data;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
});

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItemInput>) => {
      const item = action.payload;
      const existingIndex = state.items.findIndex(
        (i) => i.productId === item.productId && (i.variantId || '') === (item.variantId || '')
      );

      if (existingIndex >= 0) {
        const currentQty = state.items[existingIndex].quantity;
        const availableStock = item.stock || state.items[existingIndex].stock || 99;
        state.items[existingIndex].quantity = Math.min(currentQty + item.quantity, availableStock);
        state.items[existingIndex].selected = true;
      } else {
        const availableStock = item.stock || 99;
        state.items.push({
          ...item,
          quantity: Math.min(item.quantity, availableStock),
          selected: true,
        });
      }

      saveItems(state.items);
      const totals = calculateCartTotals(state.items, state.coupon, state.division);
      state.subtotal = totals.subtotal;
      state.discount = totals.discount;
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;
      state.lineItemsCount = totals.lineItemsCount;
      state.selectedItemsCount = totals.selectedItemsCount;
      state.totalQuantity = totals.totalQuantity;
      state.couponError = totals.couponError;

      syncToServer('/add', 'POST', {
        productId: item.productId,
        variantId: item.variantId,
        variantName: item.variantName,
        quantity: item.quantity,
      });
    },
    removeFromCart: (state, action: PayloadAction<{ productId: string; variantId?: string }>) => {
      state.items = state.items.filter(
        (i) => !(i.productId === action.payload.productId && (i.variantId || '') === (action.payload.variantId || ''))
      );
      saveItems(state.items);
      const totals = calculateCartTotals(state.items, state.coupon, state.division);
      state.subtotal = totals.subtotal;
      state.discount = totals.discount;
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;
      state.lineItemsCount = totals.lineItemsCount;
      state.selectedItemsCount = totals.selectedItemsCount;
      state.totalQuantity = totals.totalQuantity;
      state.couponError = totals.couponError;

      syncToServer('/item', 'DELETE', {
        productId: action.payload.productId,
        variantId: action.payload.variantId,
      });
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ productId: string; variantId?: string; quantity: number }>
    ) => {
      const { productId, variantId, quantity } = action.payload;
      const index = state.items.findIndex(
        (i) => i.productId === productId && (i.variantId || '') === (variantId || '')
      );

      if (index >= 0) {
        if (quantity <= 0) {
          state.items.splice(index, 1);
        } else {
          const maxStock = state.items[index].stock || 99;
          state.items[index].quantity = Math.min(quantity, maxStock);
        }
      }

      saveItems(state.items);
      const totals = calculateCartTotals(state.items, state.coupon, state.division);
      state.subtotal = totals.subtotal;
      state.discount = totals.discount;
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;
      state.lineItemsCount = totals.lineItemsCount;
      state.selectedItemsCount = totals.selectedItemsCount;
      state.totalQuantity = totals.totalQuantity;
      state.couponError = totals.couponError;

      syncToServer('/update', 'PUT', {
        productId,
        variantId,
        quantity,
      });
    },
    toggleSelectItem: (
      state,
      action: PayloadAction<{ productId: string; variantId?: string }>
    ) => {
      const item = state.items.find(
        (i) => i.productId === action.payload.productId && (i.variantId || '') === (action.payload.variantId || '')
      );
      if (item) {
        item.selected = item.selected === false ? true : false;
      }
      saveItems(state.items);
      const totals = calculateCartTotals(state.items, state.coupon, state.division);
      state.subtotal = totals.subtotal;
      state.discount = totals.discount;
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;
      state.lineItemsCount = totals.lineItemsCount;
      state.selectedItemsCount = totals.selectedItemsCount;
      state.totalQuantity = totals.totalQuantity;

      if (item) {
        syncToServer('/select', 'POST', {
          productId: item.productId,
          variantId: item.variantId,
          selected: item.selected,
        });
      }
    },
    selectAllItems: (state, action: PayloadAction<boolean>) => {
      const selectAll = action.payload;
      state.items.forEach((item) => {
        item.selected = selectAll;
      });
      saveItems(state.items);
      const totals = calculateCartTotals(state.items, state.coupon, state.division);
      state.subtotal = totals.subtotal;
      state.discount = totals.discount;
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;
      state.lineItemsCount = totals.lineItemsCount;
      state.selectedItemsCount = totals.selectedItemsCount;
      state.totalQuantity = totals.totalQuantity;

      syncToServer('/select', 'POST', { selectAll });
    },
    applyCoupon: (state, action: PayloadAction<CouponRule>) => {
      state.coupon = action.payload;
      saveCoupon(state.coupon);
      const totals = calculateCartTotals(state.items, state.coupon, state.division);
      state.subtotal = totals.subtotal;
      state.discount = totals.discount;
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;
      state.couponError = totals.couponError;

      syncToServer('/coupon', 'POST', { couponCode: action.payload.code });
    },
    removeCoupon: (state) => {
      state.coupon = null;
      state.couponError = null;
      saveCoupon(null);
      const totals = calculateCartTotals(state.items, null, state.division);
      state.subtotal = totals.subtotal;
      state.discount = totals.discount;
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;

      syncToServer('/coupon', 'DELETE');
    },
    setDivision: (state, action: PayloadAction<string>) => {
      state.division = action.payload;
      const totals = calculateCartTotals(state.items, state.coupon, state.division);
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;
    },
    toggleCartDrawer: (state, action: PayloadAction<boolean | undefined>) => {
      state.isCartDrawerOpen = action.payload !== undefined ? action.payload : !state.isCartDrawerOpen;
    },
    clearCart: (state) => {
      state.items = [];
      state.coupon = null;
      state.couponError = null;
      state.subtotal = 0;
      state.discount = 0;
      state.shippingFee = 0;
      state.finalTotal = 0;
      state.lineItemsCount = 0;
      state.selectedItemsCount = 0;
      state.totalQuantity = 0;
      saveItems([]);
      saveCoupon(null);

      syncToServer('/clear', 'DELETE');
    },
    resetToDemoCart: (state) => {
      state.items = JSON.parse(JSON.stringify(INITIAL_DEMO_CART_ITEMS));
      state.coupon = DEFAULT_REFERENCE_COUPON;
      state.couponError = null;
      saveItems(state.items);
      saveCoupon(state.coupon);
      const totals = calculateCartTotals(state.items, state.coupon, state.division);
      state.subtotal = totals.subtotal;
      state.discount = totals.discount;
      state.shippingFee = totals.shippingFee;
      state.finalTotal = totals.finalTotal;
      state.lineItemsCount = totals.lineItemsCount;
      state.selectedItemsCount = totals.selectedItemsCount;
      state.totalQuantity = totals.totalQuantity;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchServerCart.fulfilled, (state, action) => {
      if (action.payload && action.payload.items) {
        state.items = action.payload.items;
        state.subtotal = action.payload.subtotal;
        state.discount = action.payload.discount;
        state.shippingFee = action.payload.shippingFee;
        state.finalTotal = action.payload.finalTotal;
        state.lineItemsCount = action.payload.lineItemsCount;
        state.selectedItemsCount = action.payload.selectedItemsCount;
        state.totalQuantity = action.payload.totalQuantity;
        if (action.payload.coupon) {
          state.coupon = action.payload.coupon;
        }
        saveItems(state.items);
      }
    });
  },
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  toggleSelectItem,
  selectAllItems,
  applyCoupon,
  removeCoupon,
  setDivision,
  toggleCartDrawer,
  clearCart,
  resetToDemoCart,
} = cartSlice.actions;

export default cartSlice.reducer;
