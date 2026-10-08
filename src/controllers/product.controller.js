import prisma from "../config/prisma.js";

export const createProduct = async (req, res, next) => {
  try {
    const {
      category,
      brand,
      name,
      modelNumber,
      serialNumber,
      purchaseDate,
      warrantyEnd,
      billUrl,
    } = req.body;

    if (!category || !brand || !name) {
      return res.status(400).json({
        success: false,
        message: "Category, brand and product name are required",
      });
    }

    const product = await prisma.product.create({
      data: {
        customerId: req.user.id,
        category: category.trim(),
        brand: brand.trim(),
        name: name.trim(),
        modelNumber: modelNumber?.trim() || null,
        serialNumber: serialNumber?.trim() || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null,
        billUrl: billUrl?.trim() || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Product registered successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyProducts = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { customerId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        customerId: req.user.id,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};
