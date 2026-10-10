import { Router } from "express";
import { listTechnicians, assignTechnician, updateComplaintStatus, getMyJobs } from "../controllers/technician.controller.js";
import { protect, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", protect, allowRoles("ADMIN"), listTechnicians);
router.get("/me/jobs", protect, allowRoles("TECHNICIAN"), getMyJobs);
router.put("/complaints/:id/assign", protect, allowRoles("ADMIN"), assignTechnician);
router.put("/complaints/:id/status", protect, allowRoles("ADMIN","TECHNICIAN"), updateComplaintStatus);

export default router;
