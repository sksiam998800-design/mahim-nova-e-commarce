import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearCart, setDivision } from '../features/cart/cartSlice';
import { openAuthModal, updateUserAddresses, UserAddress } from '../features/auth/authSlice';
import { addToast } from '../features/toast/toastSlice';
import {
  ShieldCheck,
  Truck,
  CreditCard,
  MapPin,
  CheckCircle2,
  Lock,
  ArrowRight,
  Package,
} from 'lucide-react';

interface CheckoutPageProps {
  onOrderSuccess: (order: any) => void;
  onNavigateToShop: () => void;
}

const BD_DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
];

const BD_DISTRICTS: Record<string, string[]> = {
  Dhaka: ['Dhaka', 'Gazipur', 'Narayanganj', 'Tangail', 'Faridpur', 'Narsingdi'],
  Chattogram: ['Chattogram', 'Cox\'s Bazar', 'Cumilla', 'Feni', 'Noakhali', 'Brahmanbaria'],
  Rajshahi: ['Rajshahi', 'Bogura', 'Pabna', 'Sirajganj', 'Naogaon'],
  Khulna: ['Khulna', 'Jashore', 'Kushtia', 'Satkhira'],
  Barishal: ['Barishal', 'Patuakhali', 'Bhola'],
  Sylhet: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  Rangpur: ['Rangpur', 'Dinajpur', 'Kurigram'],
  Mymensingh: ['Mymensingh', 'Jamalpur', 'Netrokona'],
};

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  onOrderSuccess,
  onNavigateToShop,
}) => {
  const dispatch = useAppDispatch();
  const { items, subtotal, discount, coupon, shippingFee, finalTotal } = useAppSelector(
    (state) => state.cart
  );
  const { user, isAuthenticated, token } = useAppSelector((state) => state.auth);

  // Address fields
  const [recipientName, setRecipientName] = useState(user?.name || '');
  const [recipientPhone, setRecipientPhone] = useState(user?.phone || '');
  const [selectedDivision, setSelectedDivision] = useState('Dhaka');
  const [selectedDistrict, setSelectedDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('Dhanmondi');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash' | 'card'>('cod');
  const [submitting, setSubmitting] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  // Auto-populate from saved address if available
  useEffect(() => {
    if (user && user.addresses && user.addresses.length > 0) {
      const defaultAddr = user.addresses.find((a) => a.isDefault) || user.addresses[0];
      setRecipientName(defaultAddr.name || user.name);
      setRecipientPhone(defaultAddr.phone || user.phone || '');
      setSelectedDivision(defaultAddr.division || 'Dhaka');
      setSelectedDistrict(defaultAddr.district || 'Dhaka');
      setUpazila(defaultAddr.upazila || '');
      setStreet(defaultAddr.street || '');
      setLandmark(defaultAddr.landmark || '');
      dispatch(setDivision(defaultAddr.division || 'Dhaka'));
    }
  }, [user, dispatch]);

  // Handle division change and recalculate shipping fee
  const handleDivisionChange = (div: string) => {
    setSelectedDivision(div);
    const districts = BD_DISTRICTS[div] || [];
    setSelectedDistrict(districts[0] || div);
    dispatch(setDivision(div));
  };

  // If not logged in, enforce authentication prompt
  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-2">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Customer Authentication Required
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
          In accordance with Novara Commerce security standards, all orders require a verified customer account. Your cart has been safely preserved.
        </p>
        <button
          onClick={() => dispatch(openAuthModal({ mode: 'login', returnUrl: '/checkout' }))}
          className="px-8 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md"
        >
          Sign In or Register to Continue
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <Package className="w-12 h-12 text-gray-300 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Your Cart is Empty</h2>
        <p className="text-xs text-gray-500">
          Add items to your cart before proceeding to checkout.
        </p>
        <button
          onClick={onNavigateToShop}
          className="px-6 py-2.5 bg-emerald-800 text-white font-semibold text-xs rounded-xl"
        >
          Explore Catalog
        </button>
      </div>
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !recipientPhone.trim() || !street.trim()) {
      dispatch(
        addToast({
          type: 'warning',
          message: 'Please complete all required shipping address fields.',
        })
      );
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        items,
        shippingAddress: {
          name: recipientName.trim(),
          phone: recipientPhone.trim(),
          division: selectedDivision,
          district: selectedDistrict,
          upazila: upazila.trim(),
          street: street.trim(),
          landmark: landmark.trim(),
        },
        paymentMethod,
        couponCode: coupon?.code,
      };

      const res = await fetch('/api/checkout/place-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to place order');
      }

      // If requested, save address to customer profile
      if (saveAsDefault && token) {
        try {
          const addrRes = await fetch('/api/auth/address', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: recipientName,
              phone: recipientPhone,
              division: selectedDivision,
              district: selectedDistrict,
              upazila,
              street,
              landmark,
              isDefault: true,
            }),
          });
          const addrData = await addrRes.json();
          if (addrData.success && addrData.addresses) {
            dispatch(updateUserAddresses(addrData.addresses));
          }
        } catch {}
      }

      dispatch(clearCart());
      dispatch(
        addToast({
          type: 'success',
          title: 'Order Confirmed!',
          message: `Order #${data.order.orderNumber} successfully placed.`,
        })
      );

      onOrderSuccess(data.order);
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Order Failed', message: err.message }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Secure Checkout
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Ordering as <strong className="text-gray-800">{user.email}</strong>
        </p>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Form: Delivery Address & Payment (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* 1. Saved Addresses Picker (if any) */}
          {user.addresses && user.addresses.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-3">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                Select Saved Address
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {user.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    onClick={() => {
                      setRecipientName(addr.name);
                      setRecipientPhone(addr.phone);
                      handleDivisionChange(addr.division);
                      setSelectedDistrict(addr.district);
                      setUpazila(addr.upazila || '');
                      setStreet(addr.street);
                      setLandmark(addr.landmark || '');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer text-xs transition ${
                      street === addr.street && recipientName === addr.name
                        ? 'border-emerald-700 bg-emerald-50/70 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-gray-900 flex items-center justify-between">
                      <span>{addr.name}</span>
                      {addr.isDefault && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 mt-1">{addr.street}, {addr.upazila}</div>
                    <div className="text-gray-500">{addr.district}, {addr.division}</div>
                    <div className="text-gray-600 font-medium mt-1">{addr.phone}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Bangladesh Address Hierarchy Form */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <MapPin className="w-4 h-4 text-emerald-800" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Delivery Address (Bangladesh)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Recipient Name *
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Sarah Khan"
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+880 17XX XXXXXX"
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            {/* Division & District Dependent Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Division *</label>
                <select
                  value={selectedDivision}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700 bg-white cursor-pointer"
                >
                  {BD_DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">District *</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700 bg-white cursor-pointer"
                >
                  {(BD_DISTRICTS[selectedDivision] || [selectedDivision]).map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Upazila / Thana *
                </label>
                <input
                  type="text"
                  required
                  value={upazila}
                  onChange={(e) => setUpazila(e.target.value)}
                  placeholder="e.g. Dhanmondi, Gulshan"
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Street Address / House / Road *
              </label>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="House 42, Road 9/A, Sector 3..."
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Landmark / Delivery Note (Optional)
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Near Lake, Opposite Mosque, Call upon arrival..."
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="saveDefault"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="accent-emerald-800 rounded"
              />
              <label htmlFor="saveDefault" className="text-xs text-gray-700 cursor-pointer">
                Save this as my primary address for future orders
              </label>
            </div>
          </div>

          {/* 3. Payment Method Selection */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <CreditCard className="w-4 h-4 text-emerald-800" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Payment Method
              </h2>
            </div>

            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  paymentMethod === 'cod'
                    ? 'border-emerald-800 bg-emerald-50/70 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                  className="mt-0.5 accent-emerald-800"
                />
                <div>
                  <div className="text-xs font-bold text-gray-900">Cash on Delivery (COD)</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Pay with cash when your package is delivered to your doorstep.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  paymentMethod === 'bkash'
                    ? 'border-emerald-800 bg-emerald-50/70 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'bkash'}
                  onChange={() => setPaymentMethod('bkash')}
                  className="mt-0.5 accent-emerald-800"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">bKash / Nagad Mobile Wallet</span>
                    <span className="px-2 py-0.5 rounded bg-[#E2136E] text-white font-extrabold text-[10px]">
                      bKash
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Instant secure mobile payment verified by server API.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  paymentMethod === 'card'
                    ? 'border-emerald-800 bg-emerald-50/70 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="mt-0.5 accent-emerald-800"
                />
                <div>
                  <div className="text-xs font-bold text-gray-900">Credit / Debit Card</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Visa, Mastercard, Amex secured by 256-bit encryption.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Summary: Order Review & Placement (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-3 border-b border-gray-100">
              Order Items ({items.length})
            </h2>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId || 'std'}`}
                  className="flex items-center gap-3 text-xs"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-12 h-12 rounded-lg object-cover bg-gray-50 border border-gray-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{item.name}</div>
                    <div className="text-gray-400 text-[11px]">
                      Qty: {item.quantity} × ${(item.salePrice || item.price).toFixed(2)}
                    </div>
                  </div>
                  <div className="font-bold text-gray-900">
                    ${((item.salePrice || item.price) * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations breakdown */}
            <div className="pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Coupon Discount ({coupon?.code})</span>
                  <span className="font-bold">-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping ({selectedDivision})</span>
                <span className="font-semibold text-gray-900">
                  {shippingFee === 0 ? <span className="text-emerald-700">FREE</span> : `$${shippingFee}`}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-gray-900 pt-3 border-t border-gray-200">
                <span>Total Amount</span>
                <span className="text-emerald-950">${finalTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Confirm & Place Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Server-validated order total & inventory reserve</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
