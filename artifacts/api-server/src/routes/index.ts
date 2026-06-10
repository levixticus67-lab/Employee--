import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import authRouter from "./auth";
import productsRouter from "./products";
import reviewsRouter from "./reviews";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import adminRouter from "./admin";
import settingsRouter from "./settings";
import bundlesRouter from "./bundles";
import blogRouter from "./blog";
import receiptsRouter from "./receipts";
import shareRouter from "./share";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(reviewsRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(settingsRouter);
router.use(bundlesRouter);
router.use(blogRouter);
router.use(receiptsRouter);
router.use(shareRouter);

// Auth gate — must run before storageRouter and adminRouter so that
// /storage/uploads/* and /admin/* are protected before any route handler fires.
router.use((req, res, next) => {
  if (req.path.startsWith("/admin/") && !req.path.startsWith("/admin/auth/")) {
    requireAdmin(req, res, next);
    return;
  }
  if (req.path.startsWith("/storage/uploads/")) {
    requireAdmin(req, res, next);
    return;
  }
  next();
});

// storageRouter registered AFTER the auth gate so upload endpoints are protected.
// Public read endpoints (/storage/objects/*) pass through the gate via next().
router.use(storageRouter);
router.use(adminRouter);

export default router;
