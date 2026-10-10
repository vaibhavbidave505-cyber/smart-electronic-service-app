import "dotenv/config";
import app from "./src/app.js";
import prisma from "./src/config/prisma.js";

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in .env");
}

const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

const shutdown = async () => {
  console.log("\nShutting down...");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
