import type { RequestHandler } from "express";

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.session?.isAdmin) {
    next();
    return;
  }
  res.status(401).json({ error: "Admin authentication required" });
};
