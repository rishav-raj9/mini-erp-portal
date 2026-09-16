"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = 'secret_key_erp_2026';
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return res.status(401).json({ message: 'Token missing' });
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err)
            return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};
// 1. AUTH
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});
// 2. CUSTOMERS
app.get('/api/customers', authenticateToken, async (req, res) => {
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
app.post('/api/customers', authenticateToken, async (req, res) => {
    const { name, mobile, email, businessName, gstNumber, customerType, address, status, followUpDate, notes } = req.body;
    const customer = await prisma.customer.create({
        data: { name, mobile, email, businessName, gstNumber, customerType, address, status, followUpDate, notes },
    });
    res.status(201).json(customer);
});
app.post('/api/customers/:id/notes', authenticateToken, async (req, res) => {
    const customerId = Number(req.params.id);
    const { note } = req.body;
    const newNote = await prisma.customerNote.create({
        data: { customerId, note, createdBy: req.user.name },
    });
    res.status(201).json(newNote);
});
// 3. PRODUCTS & INVENTORY
app.get('/api/products', authenticateToken, async (req, res) => {
    const products = await prisma.product.findMany();
    res.json(products);
});
app.post('/api/products', authenticateToken, async (req, res) => {
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
app.get('/api/inventory/logs', authenticateToken, async (req, res) => {
    const logs = await prisma.stockMovementLog.findMany({
        include: { product: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(logs);
});
// 4. SALES CHALLANS (ATOMIC TRANSACTION)
app.get('/api/challans', authenticateToken, async (req, res) => {
    const challans = await prisma.salesChallan.findMany({
        include: { customer: true, items: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(challans);
});
app.post('/api/challans', authenticateToken, async (req, res) => {
    const { customerId, items, status } = req.body;
    const challanNumber = `CH-${Date.now().toString().slice(-6)}`;
    const totalQuantity = items.reduce((acc, cur) => acc + parseInt(cur.quantity), 0);
    try {
        const result = await prisma.$transaction(async (tx) => {
            // Stock Check if Confirmed
            if (status === 'Confirmed') {
                for (const item of items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product)
                        throw new Error(`Product not found (ID: ${item.productId})`);
                    if (product.currentStock < item.quantity) {
                        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${item.quantity}`);
                    }
                }
            }
            // Fetch snapshot data
            const productIds = items.map((i) => i.productId);
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
                        create: items.map((item) => {
                            const p = productMap.get(item.productId);
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
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
//# sourceMappingURL=index.js.map