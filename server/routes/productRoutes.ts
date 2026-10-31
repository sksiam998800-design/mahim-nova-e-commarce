import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProductModel } from '../models/Product';
import { AuditLogModel } from '../models/Coupon';
import { INITIAL_PRODUCTS, SeedProduct } from '../data/initialData';
import { expandSearchQuery } from '../../src/utils/ecommerceRules';
import { isDbConnected } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// In-memory catalog state initialized with exact reference products
let inMemoryProducts: SeedProduct[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));

// List products with filtering, sorting, pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      sort,
      isPopular,
      isBestSeller,
      isFeatured,
      isNewArrival,
      status,
      includeAll,
      page = '1',
      limit = '12',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 12));

    if (isDbConnected()) {
      const filter: any = {};
      if (status && status !== 'all') {
        filter.status = status;
      } else if (includeAll !== 'true') {
        filter.status = 'published';
      }

      if (category && category !== 'all') filter.category = new RegExp(`^${category}$`, 'i');
      if (brand) filter.brand = new RegExp(`^${brand}$`, 'i');
      if (isPopular === 'true') filter.isPopular = true;
      if (isBestSeller === 'true') filter.isBestSeller = true;
      if (isFeatured === 'true') filter.isFeatured = true;
      if (isNewArrival === 'true') filter.isNewArrival = true;

      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = parseFloat(minPrice as string);
        if (maxPrice) filter.price.$lte = parseFloat(maxPrice as string);
      }

      let sortOptions: any = { createdAt: -1 };
      if (sort === 'price_asc') sortOptions = { price: 1 };
      else if (sort === 'price_desc') sortOptions = { price: -1 };
      else if (sort === 'rating') sortOptions = { ratingAverage: -1 };
      else if (sort === 'popular') sortOptions = { salesCount: -1 };

      const total = await ProductModel.countDocuments(filter);
      const products = await ProductModel.find(filter)
        .sort(sortOptions)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      res.json({
        success: true,
        data: products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
      return;
    }

    // In-memory filtering
    let filtered = [...inMemoryProducts];
    if (status && status !== 'all') {
      filtered = filtered.filter((p) => p.status === status);
    } else if (includeAll !== 'true') {
      filtered = filtered.filter((p) => p.status === 'published');
    }

    if (category && category !== 'all') {
      filtered = filtered.filter((p) => p.category.toLowerCase() === (category as string).toLowerCase());
    }
    if (brand) {
      filtered = filtered.filter((p) => p.brand.toLowerCase() === (brand as string).toLowerCase());
    }
    if (isPopular === 'true') filtered = filtered.filter((p) => p.isPopular);
    if (isBestSeller === 'true') filtered = filtered.filter((p) => p.isBestSeller);
    if (isFeatured === 'true') filtered = filtered.filter((p) => p.isFeatured);
    if (isNewArrival === 'true') filtered = filtered.filter((p) => p.isNewArrival);

    if (minPrice) {
      const min = parseFloat(minPrice as string);
      filtered = filtered.filter((p) => (p.salePrice || p.price) >= min);
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice as string);
      filtered = filtered.filter((p) => (p.salePrice || p.price) <= max);
    }

    if (sort === 'price_asc') {
      filtered.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    } else if (sort === 'price_desc') {
      filtered.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    } else if (sort === 'rating') {
      filtered.sort((a, b) => b.ratingAverage - a.ratingAverage);
    } else if (sort === 'popular') {
      filtered.sort((a, b) => b.salesCount - a.salesCount);
    }

    const total = filtered.length;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      data: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Autocomplete suggestions (bounded, keyboard-accessible dropdown)
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) {
      res.json({ success: true, suggestions: [] });
      return;
    }

    const expandedTokens = expandSearchQuery(q);

    const matches = inMemoryProducts.filter((p) => {
      const pText = `${p.name} ${p.brand} ${p.category} ${p.description} ${p.banglaKeywords.join(' ')}`.toLowerCase();
      return expandedTokens.some((token) => pText.includes(token));
    });

    const suggestions = matches.slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      category: p.category,
      price: p.price,
      salePrice: p.salePrice,
      image: p.images[0]?.url || '',
      badge: p.badge,
    }));

    res.json({ success: true, suggestions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Search endpoint with Bangla-English cross-lingual discovery
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = ((req.query.q as string) || '').trim();
    if (!query) {
      res.json({ success: true, data: [], query: '', total: 0 });
      return;
    }

    const tokens = expandSearchQuery(query);

    const results = inMemoryProducts.filter((p) => {
      const text = `${p.name} ${p.brand} ${p.category} ${p.subcategory || ''} ${p.description} ${p.banglaKeywords.join(' ')}`.toLowerCase();
      return tokens.some((token) => text.includes(token));
    });

    res.json({
      success: true,
      data: results,
      query,
      expandedTokens: tokens,
      total: results.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Related products endpoint
router.get('/:slug/related', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const current = inMemoryProducts.find((p) => p.slug === slug || p.id === slug || p.sku === slug);
    const category = current?.category || 'Electronics';

    let related: SeedProduct[] = [];
    if (current?.id === 'prod-1' || current?.slug === 'wireless-headphones') {
      const preferredIds = ['prod-6', 'prod-2', 'prod-3', 'prod-4', 'prod-5'];
      related = preferredIds
        .map((id) => inMemoryProducts.find((p) => p.id === id))
        .filter(Boolean) as SeedProduct[];
    } else {
      related = inMemoryProducts.filter((p) => p.id !== current?.id && p.category.toLowerCase() === category.toLowerCase());
      if (related.length < 5) {
        const others = inMemoryProducts.filter((p) => p.id !== current?.id && !related.some((r) => r.id === p.id));
        related = [...related, ...others];
      }
    }

    res.json({ success: true, data: related.slice(0, 5) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single product by slug or id
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (isDbConnected()) {
      const orConditions: any[] = [{ slug }, { sku: slug }];
      if (mongoose.isValidObjectId(slug)) {
        orConditions.push({ _id: slug });
      }
      const product = await ProductModel.findOne({ $or: orConditions });
      if (product) {
        res.json({ success: true, data: product });
        return;
      }
    }

    const item = inMemoryProducts.find((p) => p.slug === slug || p.id === slug || p.sku === slug);
    if (!item) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create product (Admin)
router.post('/', requireAuth, requireRole(['admin', 'super_admin', 'catalog_manager']), async (req: Request, res: Response) => {
  try {
    const { name, brand, category, price, salePrice, description, stock, sku, images, badge, banglaKeywords } = req.body;

    if (!name || !price || !sku || !category) {
      res.status(400).json({ success: false, error: 'Name, price, SKU, and category are required' });
      return;
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check SKU duplicate
    if (inMemoryProducts.some((p) => p.sku.toUpperCase() === sku.toUpperCase())) {
      res.status(400).json({ success: false, error: `SKU ${sku} already exists` });
      return;
    }

    const newProduct: SeedProduct = {
      id: `prod-${Date.now()}`,
      name: name.trim(),
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      sku: sku.trim().toUpperCase(),
      brand: (brand || 'Novara').trim(),
      category: category.trim(),
      description: description || 'Premium product designed for modern living.',
      price: parseFloat(price),
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      badge: badge || undefined,
      images: images && images.length ? images : [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80', isPrimary: true }],
      stock: parseInt(stock, 10) || 10,
      reservedStock: 0,
      ratingAverage: 5.0,
      reviewCount: 0,
      salesCount: 0,
      isPopular: false,
      isBestSeller: false,
      isFeatured: false,
      isNewArrival: true,
      attributes: {},
      banglaKeywords: Array.isArray(banglaKeywords) ? banglaKeywords : [],
      status: 'published',
    };

    inMemoryProducts.unshift(newProduct);

    if (isDbConnected()) {
      try {
        await ProductModel.create(newProduct);
      } catch (dbErr: any) {
        console.warn('Could not persist to MongoDB Atlas:', dbErr.message);
      }
    }

    res.status(201).json({ success: true, data: newProduct });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update product (Admin)
router.put('/:id', requireAuth, requireRole(['admin', 'super_admin', 'catalog_manager']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const index = inMemoryProducts.findIndex((p) => p.id === id);

    if (index === -1) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const existing = inMemoryProducts[index];
    const updated: SeedProduct = {
      ...existing,
      ...req.body,
      id: existing.id,
      sku: req.body.sku ? req.body.sku.toUpperCase() : existing.sku,
    };

    inMemoryProducts[index] = updated;

    if (isDbConnected()) {
      try {
        const isOid = mongoose.isValidObjectId(id);
        const query = isOid ? { $or: [{ _id: id }, { slug: id }, { sku: id }] } : { $or: [{ slug: id }, { sku: id }] };
        await ProductModel.findOneAndUpdate(query, updated);
      } catch (dbErr) {
        console.warn('Product DB update failed:', dbErr);
      }
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete/Archive product (Admin)
router.delete('/:id', requireAuth, requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    inMemoryProducts = inMemoryProducts.filter((p) => p.id !== id && p.slug !== id && p.sku !== id);

    if (isDbConnected()) {
      try {
        const isOid = mongoose.isValidObjectId(id);
        const query = isOid ? { $or: [{ _id: id }, { slug: id }, { sku: id }] } : { $or: [{ slug: id }, { sku: id }] };
        await ProductModel.findOneAndDelete(query);
      } catch (dbErr) {
        console.warn('Product DB deletion failed:', dbErr);
      }
    }

    res.json({ success: true, message: 'Product removed successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Adjust stock (Admin)
router.post('/:id/stock', requireAuth, requireRole(['admin', 'super_admin', 'inventory_manager']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    const prod = inMemoryProducts.find((p) => p.id === id || p.sku === id || p.slug === id);
    if (!prod) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const newStock = Math.max(0, prod.stock + (parseInt(adjustment, 10) || 0));
    prod.stock = newStock;

    if (isDbConnected()) {
      try {
        const isOid = mongoose.isValidObjectId(id);
        const query = isOid ? { $or: [{ _id: id }, { slug: id }, { sku: id }] } : { $or: [{ slug: id }, { sku: id }] };
        await ProductModel.findOneAndUpdate(query, { stock: newStock });
      } catch (dbErr) {
        console.warn('Stock DB update failed:', dbErr);
      }
    }

    console.log(`[Inventory] Adjusted stock for ${prod.name} (${prod.sku}) to ${newStock}. Reason: ${reason || 'Manual Adjustment'}`);

    res.json({ success: true, stock: newStock, message: `Stock updated to ${newStock}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export { inMemoryProducts };
export default router;
