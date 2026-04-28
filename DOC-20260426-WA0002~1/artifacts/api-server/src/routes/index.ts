import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import authRouter from "./auth";
import productsRouter from "./products";
import reviewsRouter from "./reviews";
import ordersRouter from "./orders";
import adminRouter from "./admin";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(productsRouter);
router.use(reviewsRouter);
router.use(ordersRouter);

router.use((req, res, next) => {
  if (req.path.startsWith("/admin/") && !req.path.startsWith("/admin/auth/")) {
    return requireAdmin(req, res, next);
  }
  if (req.path.startsWith("/storage/uploads/")) {
    return requireAdmin(req, res, next);
  }
  next();
});

router.use(adminRouter);

export default router;
