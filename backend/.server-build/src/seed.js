"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const hashedPassword = await bcryptjs_1.default.hash('password123', 10);
    const users = [
        { name: 'Admin User', email: 'admin@erp.com', role: 'ADMIN' },
        { name: 'Sales Agent', email: 'sales@erp.com', role: 'SALES' },
        { name: 'Warehouse Staff', email: 'warehouse@erp.com', role: 'WAREHOUSE' },
        { name: 'Accounts Officer', email: 'accounts@erp.com', role: 'ACCOUNTS' },
    ];
    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: { ...u, password: hashedPassword },
        });
    }
    await prisma.product.upsert({
        where: { sku: 'SKU-001' },
        update: {},
        create: {
            name: 'Industrial Valve A1',
            sku: 'SKU-001',
            category: 'Fittings',
            unitPrice: 450.0,
            currentStock: 20,
            minStockAlert: 5,
            location: 'Warehouse Bay 3',
        },
    });
    console.log('Seeding finished successfully.');
}
main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map