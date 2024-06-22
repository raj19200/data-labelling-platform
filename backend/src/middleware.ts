import jwt from "jsonwebtoken";
import { JWT_SECRET_KEY, WORKER_SECRET_KEY } from "./config";
import { NextFunction, Request, Response } from "express";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"] ?? "";
  try {
    const decoded = jwt.verify(authHeader, JWT_SECRET_KEY);
    // @ts-ignore
    if (decoded.userId) {
      // @ts-ignore
      req.userId = decoded.userId;
      return next();
    } else {
      return res.status(403).json({
        message: "You are not logged in",
      });
    }
  } catch (e) {
    return res.status(403).json({
      message: "You are not logged in",
    });
  }
}

export function workerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"] ?? "";
  try {
    const decoded = jwt.verify(authHeader, WORKER_SECRET_KEY);
    // @ts-ignore
    if (decoded.userId) {
      // @ts-ignore
      req.userId = decoded.userId;
      return next();
    } else {
      return res.status(403).json({
        message: "You are not logged in",
      });
    }
  } catch (e) {
    return res.status(403).json({
      message: "You are not logged in",
    });
  }
}
