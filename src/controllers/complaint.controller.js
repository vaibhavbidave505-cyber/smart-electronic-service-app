import prisma from "../config/prisma.js";

const makeComplaintNumber = () => {
  const d = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const r = Math.floor(1000 + Math.random() * 9000);
  return `CMP-${d}-${r}`;
};

export const createComplaint = async (req, res, next) => {
  try {
    const { productId, title, description, priority = "MEDIUM" } = req.body;
    const numericProductId = Number(productId);

    if (!Number.isInteger(numericProductId)) {
      return res.status(400).json({ success: false, message: "Valid productId is required" });
    }

    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Title and description are required" });
    }

    const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Priority must be LOW, MEDIUM, HIGH or URGENT",
      });
    }

    const product = await prisma.product.findFirst({
      where: { id: numericProductId, customerId: req.user.id },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found for this customer",
      });
    }

    let complaintNumber = makeComplaintNumber();
    while (await prisma.complaint.findUnique({ where: { complaintNumber } })) {
      complaintNumber = makeComplaintNumber();
    }

    const complaint = await prisma.complaint.create({
      data: {
        complaintNumber,
        customerId: req.user.id,
        productId: numericProductId,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: "REGISTERED",
      },
      include: { product: true },
    });

    return res.status(201).json({
      success: true,
      message: "Complaint registered successfully",
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyComplaints = async (req, res, next) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { customerId: req.user.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaintById = async (req, res, next) => {
  try {
    const complaintId = Number(req.params.id);

    if (!Number.isInteger(complaintId)) {
      return res.status(400).json({ success: false, message: "Invalid complaint id" });
    }

    const complaint = await prisma.complaint.findFirst({
      where: { id: complaintId, customerId: req.user.id },
      include: { product: true },
    });

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    return res.json({ success: true, complaint });
  } catch (error) {
    next(error);
  }
};
