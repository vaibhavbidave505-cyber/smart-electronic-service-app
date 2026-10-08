PRODUCT REGISTRATION STEP

Copy these files into your existing backend folder:
- src/controllers/product.controller.js
- src/routes/product.routes.js
- src/app.js
- prisma/schema.prisma

IMPORTANT:
If your current schema.prisma already contains Technician or Complaint models, do NOT replace the entire schema with this sample schema.
Instead, add the Product model and add `products Product[]` inside the existing User model.

After copying:
npx prisma validate
npx prisma generate
npx prisma migrate dev --name add_products
npm run dev

TEST 1 — Create Product
POST http://localhost:5000/api/products

Auth:
Bearer Token -> use your login JWT

Body JSON:
{
  "category": "Air Conditioner",
  "brand": "LG",
  "name": "1.5 Ton Split AC",
  "modelNumber": "LG-AC-1500",
  "serialNumber": "LGAC20260001",
  "purchaseDate": "2026-09-15",
  "warrantyEnd": "2027-09-15",
  "billUrl": "https://example.com/bill.pdf"
}

TEST 2 — List Products
GET http://localhost:5000/api/products
Bearer token required

TEST 3 — Get One Product
GET http://localhost:5000/api/products/1
Bearer token required
