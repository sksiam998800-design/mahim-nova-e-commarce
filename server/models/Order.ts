import mongoose, { Schema, Document } from 'mongoose';
import { OrderStatus } from '../../src/utils/ecommerceRules';

export interface IOrderItemSnapshot {
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
  image: string;
}

export interface IOrderTimelineItem {
  status: OrderStatus;
  timestamp: Date;
  actor: string;
  note?: string;
}

export interface IOrderAddressSnapshot {
  name: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  street: string;
  landmark?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: IOrderItemSnapshot[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  shippingFee: number;
  tax: number;
  finalTotal: number;
  shippingAddress: IOrderAddressSnapshot;
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'card' | 'sslcommerz';
  paymentStatus: 'unpaid' | 'paid' | 'failed' | 'refunded';
  paymentTransactionId?: string;
  status: OrderStatus;
  statusTimeline: IOrderTimelineItem[];
  staffNotes?: string;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSnapshotSchema = new Schema<IOrderItemSnapshot>(
  {
    productId: { type: String, required: true },
    variantId: { type: String },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true },
    image: { type: String, required: true },
  },
  { _id: false }
);

const OrderTimelineItemSchema = new Schema<IOrderTimelineItem>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, required: true },
    note: { type: String },
  },
  { _id: false }
);

const OrderAddressSnapshotSchema = new Schema<IOrderAddressSnapshot>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    division: { type: String, required: true },
    district: { type: String, required: true },
    upazila: { type: String, required: true },
    street: { type: String, required: true },
    landmark: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, index: true },
    customerPhone: { type: String, required: true },
    items: [OrderItemSnapshotSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String },
    shippingFee: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    finalTotal: { type: Number, required: true },
    shippingAddress: { type: OrderAddressSnapshotSchema, required: true },
    paymentMethod: {
      type: String,
      enum: ['cod', 'bkash', 'nagad', 'card', 'credit_card', 'sslcommerz'],
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'failed', 'refunded'],
      default: 'unpaid',
      index: true,
    },
    paymentTransactionId: { type: String },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'packed',
        'shipped',
        'delivered',
        'cancelled',
        'returned',
        'refunded',
      ],
      default: 'pending',
      index: true,
    },
    statusTimeline: [OrderTimelineItemSchema],
    staffNotes: { type: String },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

export const OrderModel = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
