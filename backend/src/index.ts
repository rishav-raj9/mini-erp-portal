import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-secret';

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Mini ERP API is running',
    endpoints: {
      auth: '/api/auth/login',
      customers: '/api/customers',
      products: '/api/products',
      challans: '/api/challans',
    },
  });
});

// Auth Middleware
const authenticateToken = (req: any, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// 1. AUTH
app.get('/api/auth/login', (req: Request, res: Response) => {
  res.status(405).json({
    message: 'This login endpoint requires POST. Send email and password in JSON body.',
    example: {
      email: 'admin@erp.com',
      password: 'password123',
    },
  });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

// 2. CUSTOMERS
app.get('/api/customers', authenticateToken, async (req: Request, res: Response) => {
  const { search } = req.query;
  const where = search
    ? {
        OR: [
          { name: { contains: String(search) } },
          { businessName: { contains: String(search) } },
        ],
      }
    : {};
  const customers = await prisma.customer.findMany({ where, include: { notesList: true } });
  res.json(customers);
});

app.post('/api/customers', authenticateToken, async (req: Request, res: Response) => {
  const { name, mobile, email, businessName, gstNumber, customerType, address, status, followUpDate, notes } = req.body;
  const customer = await prisma.customer.create({
    data: { name, mobile, email, businessName, gstNumber, customerType, address, status, followUpDate, notes },
  });
  res.status(201).json(customer);
});

app.post('/api/customers/:id/notes', authenticateToken, async (req: any, res: Response) => {
  const customerId = Number(req.params.id);
  const { note } = req.body;
  const newNote = await prisma.customerNote.create({
    data: { customerId, note, createdBy: req.user.name },
  });
  res.status(201).json(newNote);
});

// 3. PRODUCTS & INVENTORY
app.get('/api/products', authenticateToken, async (req: Request, res: Response) => {
  const products = await prisma.product.findMany();
  res.json(products);
});

app.post('/api/products', authenticateToken, async (req: Request, res: Response) => {
  const { name, sku, category, unitPrice, currentStock, minStockAlert, location } = req.body;
  const product = await prisma.product.create({
    data: {
      name,
      sku,
      category,
      unitPrice: parseFloat(unitPrice),
      currentStock: parseInt(currentStock),
      minStockAlert: parseInt(minStockAlert),
      location,
    },
  });
  res.status(201).json(product);
});

app.get('/api/inventory/logs', authenticateToken, async (req: Request, res: Response) => {
  const logs = await prisma.stockMovementLog.findMany({
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(logs);
});

// 4. SALES CHALLANS (ATOMIC TRANSACTION)
app.get('/api/challans', authenticateToken, async (req: Request, res: Response) => {
  const challans = await prisma.salesChallan.findMany({
    include: { customer: true, items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(challans);
});

app.post('/api/challans', authenticateToken, async (req: any, res: Response) => {
  const { customerId, items, status } = req.body;
  const challanNumber = `CH-${Date.now().toString().slice(-6)}`;
  const totalQuantity = items.reduce((acc: number, cur: any) => acc + parseInt(cur.quantity), 0);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Stock Check if Confirmed
      if (status === 'Confirmed') {
        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Product not found (ID: ${item.productId})`);
          if (product.currentStock < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${item.quantity}`);
          }
        }
      }

      // Fetch snapshot data
      const productIds = items.map((i: any) => i.productId);
      const dbProducts = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      // Create Challan
      const challan = await tx.salesChallan.create({
        data: {
          challanNumber,
          customerId: parseInt(customerId),
          totalQuantity,
          status,
          createdBy: req.user.name,
          items: {
            create: items.map((item: any) => {
              const p = productMap.get(item.productId)!;
              return {
                productId: p.id,
                productNameSnapshot: p.name,
                skuSnapshot: p.sku,
                unitPriceSnapshot: p.unitPrice,
                quantity: parseInt(item.quantity),
              };
            }),
          },
        },
        include: { items: true },
      });

      // Deduct stock & create movement log if Confirmed
      if (status === 'Confirmed') {
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: parseInt(item.quantity) } },
          });
          await tx.stockMovementLog.create({
            data: {
              productId: item.productId,
              quantityChanged: -parseInt(item.quantity),
              movementType: 'OUT',
              reason: `Challan Confirmed #${challanNumber}`,
              createdBy: req.user.name,
            },
          });
        }
      }

      return challan;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));