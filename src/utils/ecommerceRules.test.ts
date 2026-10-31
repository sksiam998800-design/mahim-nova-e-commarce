import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  getEffectivePrice,
  isValidOrderTransition,
  mergeCartLines,
  expandSearchQuery,
  filterAndSortSliders,
  filterBannersByPlacement,
  isAdEligible,
  isSessionActiveOnline,
  type CartItemInput,
  type CouponRule,
} from './ecommerceRules';

test('getEffectivePrice returns salePrice if lower than basePrice', () => {
  assert.equal(getEffectivePrice(100, 80), 80);
  assert.equal(getEffectivePrice(100, 120), 100);
  assert.equal(getEffectivePrice(100, undefined), 100);
  assert.equal(getEffectivePrice(100, 0), 100);
});

test('calculateCartTotals calculates subtotal, shipping, and discount correctly', () => {
  const items: CartItemInput[] = [
    {
      productId: 'p1',
      sku: 'SKU-1',
      name: 'Wireless Earbuds',
      price: 50,
      salePrice: 40,
      quantity: 2,
      image: '/test.jpg',
      stock: 10,
    },
    {
      productId: 'p2',
      sku: 'SKU-2',
      name: 'Men T-shirt',
      price: 25,
      quantity: 1,
      image: '/test.jpg',
      stock: 5,
    },
  ];

  // subtotal: (40 * 2) + (25 * 1) = 105
  // Dhaka shipping: 60 (subtotal < 5000)
  // lineItemsCount: 2
  const result = calculateCartTotals(items, null, 'Dhaka');
  assert.equal(result.subtotal, 105);
  assert.equal(result.shippingFee, 60);
  assert.equal(result.finalTotal, 165);
  assert.equal(result.lineItemsCount, 2);
  assert.equal(result.totalQuantity, 3);
});

test('calculateCartTotals applies percentage coupon with cap', () => {
  const items: CartItemInput[] = [
    {
      productId: 'p1',
      sku: 'SKU-1',
      name: 'Smart Watch',
      price: 1000,
      quantity: 2,
      image: '/test.jpg',
      stock: 10,
    },
  ];

  const coupon: CouponRule = {
    code: 'SAVE20',
    discountType: 'percentage',
    discountValue: 20, // 20% of 2000 = 400
    minOrderAmount: 500,
    maxDiscount: 300, // capped at 300
    validFrom: '2020-01-01',
    validTo: '2030-01-01',
    isActive: true,
  };

  const result = calculateCartTotals(items, coupon, 'Dhaka');
  assert.equal(result.subtotal, 2000);
  assert.equal(result.discount, 300);
  assert.equal(result.shippingFee, 60);
  assert.equal(result.finalTotal, 1760);
});

test('isValidOrderTransition rejects invalid status jumps', () => {
  assert.equal(isValidOrderTransition('pending', 'confirmed'), true);
  assert.equal(isValidOrderTransition('confirmed', 'processing'), true);
  assert.equal(isValidOrderTransition('processing', 'shipped'), false); // must go to packed first
  assert.equal(isValidOrderTransition('cancelled', 'delivered'), false);
  assert.equal(isValidOrderTransition('delivered', 'returned'), true);
});

test('mergeCartLines combines duplicates and respects stock caps', () => {
  const existing: CartItemInput[] = [
    {
      productId: 'p1',
      variantId: 'v1',
      sku: 'SKU-A',
      name: 'Shoes',
      price: 100,
      quantity: 2,
      image: '',
      stock: 5,
    },
  ];

  const incoming: CartItemInput[] = [
    {
      productId: 'p1',
      variantId: 'v1',
      sku: 'SKU-A',
      name: 'Shoes',
      price: 100,
      quantity: 4,
      image: '',
      stock: 5,
    },
    {
      productId: 'p2',
      sku: 'SKU-B',
      name: 'Hat',
      price: 20,
      quantity: 1,
      image: '',
      stock: 10,
    },
  ];

  const merged = mergeCartLines(existing, incoming);
  assert.equal(merged.length, 2);
  // capped at stock 5
  assert.equal(merged[0].quantity, 5);
  assert.equal(merged[1].quantity, 1);
});

test('expandSearchQuery handles Bangla to English mapping', () => {
  const tokens = expandSearchQuery('বই');
  assert.ok(tokens.includes('বই'));
  assert.ok(tokens.includes('book'));
  assert.ok(tokens.includes('literature'));
});

test('filterAndSortSliders filters inactive sliders and orders by displayOrder', () => {
  const sampleSliders = [
    { id: 's1', displayOrder: 3, isActive: true, headline: 'Slide 3' },
    { id: 's2', displayOrder: 1, isActive: true, headline: 'Slide 1' },
    { id: 's3', displayOrder: 2, isActive: false, headline: 'Slide 2 Hidden' },
  ];

  const activeOrdered = filterAndSortSliders(sampleSliders, true);
  assert.equal(activeOrdered.length, 2);
  assert.equal(activeOrdered[0].id, 's2');
  assert.equal(activeOrdered[1].id, 's1');

  const allOrdered = filterAndSortSliders(sampleSliders, false);
  assert.equal(allOrdered.length, 3);
  assert.equal(allOrdered[0].id, 's2');
  assert.equal(allOrdered[1].id, 's3');
  assert.equal(allOrdered[2].id, 's1');
});

test('filterBannersByPlacement filters correctly by placement identifier', () => {
  const sampleBanners = [
    { id: 'b1', placement: 'homepage-main', displayOrder: 1, isActive: true },
    { id: 'b2', placement: 'homepage-secondary', displayOrder: 2, isActive: true },
    { id: 'b3', placement: 'homepage-secondary', displayOrder: 1, isActive: true },
    { id: 'b4', placement: 'homepage-promotion', displayOrder: 1, isActive: false },
  ];

  const secondary = filterBannersByPlacement(sampleBanners, 'homepage-secondary', true);
  assert.equal(secondary.length, 2);
  assert.equal(secondary[0].id, 'b3'); // order 1
  assert.equal(secondary[1].id, 'b2'); // order 2

  const activePromos = filterBannersByPlacement(sampleBanners, 'homepage-promotion', true);
  assert.equal(activePromos.length, 0); // b4 is inactive
});

test('isAdEligible respects active flag and scheduled date windows', () => {
  const now = new Date('2025-06-15T12:00:00Z');

  // Active with valid dates
  assert.equal(
    isAdEligible(
      {
        id: 'ad1',
        priority: 1,
        isActive: true,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        frequency: 'once_per_session',
      },
      now
    ),
    true
  );

  // Inactive ad
  assert.equal(
    isAdEligible(
      {
        id: 'ad2',
        priority: 1,
        isActive: false,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        frequency: 'once_per_session',
      },
      now
    ),
    false
  );

  // Expired ad
  assert.equal(
    isAdEligible(
      {
        id: 'ad3',
        priority: 1,
        isActive: true,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        frequency: 'once_per_session',
      },
      now
    ),
    false
  );
});

test('isSessionActiveOnline correctly detects presence within 5 minutes', () => {
  const now = 1750000000000;
  const recent = now - 2 * 60 * 1000; // 2 minutes ago
  const stale = now - 6 * 60 * 1000; // 6 minutes ago

  assert.equal(isSessionActiveOnline(recent, now, 5 * 60 * 1000), true);
  assert.equal(isSessionActiveOnline(stale, now, 5 * 60 * 1000), false);
});

test('calculateCartTotals matches reference image exact values: $303.95 subtotal, -$56.98 discount, $246.97 total', () => {
  const referenceItems: CartItemInput[] = [
    { productId: 'p1', sku: 'SKU-1', name: 'Soundcore Life Q30', price: 99.99, salePrice: 74.99, quantity: 1, image: '', stock: 25, selected: true },
    { productId: 'p2', sku: 'SKU-2', name: 'Smart Watch', price: 99.99, salePrice: 68.99, quantity: 1, image: '', stock: 32, selected: true },
    { productId: 'p3', sku: 'SKU-3', name: 'Wireless Earbuds', price: 69.99, salePrice: 39.99, quantity: 1, image: '', stock: 80, selected: true },
    { productId: 'p4', sku: 'SKU-4', name: 'Laptop Backpack', price: 79.99, salePrice: 49.99, quantity: 1, image: '', stock: 60, selected: true },
    { productId: 'p5', sku: 'SKU-5', name: 'Running Shoes', price: 89.99, salePrice: 69.99, quantity: 1, image: '', stock: 28, selected: true },
  ];

  const shopmaxCoupon: CouponRule = {
    code: 'SHOPMAX',
    discountType: 'fixed',
    discountValue: 56.98,
    minOrderAmount: 0,
    validFrom: '2024-01-01',
    validTo: '2030-12-31',
    isActive: true,
  };

  const totals = calculateCartTotals(referenceItems, shopmaxCoupon, 'US');
  assert.equal(totals.subtotal, 303.95);
  assert.equal(totals.shippingFee, 0);
  assert.equal(totals.discount, 56.98);
  assert.equal(totals.finalTotal, 246.97);
  assert.equal(totals.lineItemsCount, 5);
  assert.equal(totals.selectedItemsCount, 5);
  assert.equal(totals.isFreeShipping, true);
});

test('calculateCartTotals dynamically updates when an item is unselected', () => {
  const referenceItems: CartItemInput[] = [
    { productId: 'p1', sku: 'SKU-1', name: 'Item 1', price: 100, salePrice: 75, quantity: 1, image: '', stock: 25, selected: true },
    { productId: 'p2', sku: 'SKU-2', name: 'Item 2', price: 50, salePrice: 25, quantity: 1, image: '', stock: 30, selected: false },
  ];

  const totals = calculateCartTotals(referenceItems, null, 'US');
  // Only Item 1 is selected
  assert.equal(totals.subtotal, 75);
  assert.equal(totals.lineItemsCount, 2);
  assert.equal(totals.selectedItemsCount, 1);
  assert.equal(totals.finalTotal, 75);
});


