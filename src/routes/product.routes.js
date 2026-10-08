import { Router } from "express";
import {
  createProduct,
  getMyProducts,
  getProductById,
} from "../controllers/product.controller.js";
import { protect, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect);
router.use(allowRoles("CUSTOMER"));

router.post("/", createProduct);
router.get("/", getMyProducts);
router.get("/:id", getProductById);

export default router;
