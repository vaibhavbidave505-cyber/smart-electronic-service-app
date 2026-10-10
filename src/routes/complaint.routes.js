import { Router } from "express";
import {
  createComplaint,
  getMyComplaints,
  getComplaintById,
} from "../controllers/complaint.controller.js";
import { protect, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect);
router.use(allowRoles("CUSTOMER"));

router.post("/", createComplaint);
router.get("/", getMyComplaints);
router.get("/:id", getComplaintById);

export default router;
