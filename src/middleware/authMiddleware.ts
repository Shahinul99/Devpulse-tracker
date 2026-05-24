import type { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

// Extend Express Request interface to securely append the decoded token payload
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    role: "contributor" | "maintainer";
  };
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  // 1. Check if header exists
  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: "Access Denied",
      errors: "No authorization token provided in request headers.",
    });
    return;
  }

// 2. Extract token safely
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  // Catch any edge case where token is missing or undefined before verification
  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access Denied",
      errors: "Malformed authentication token sequence.",
    });
    return;
  }

  // 3. Verify token
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
 } catch (error: any) {
    res.status(401).json({
      success: false,
      message: "Access Denied",
      errors: "Invalid or expired authentication token structural signature.",
    });
  }
};

export const requireRole = (role: "contributor" | "maintainer") => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({
        success: false,
        message: "Forbidden",
        errors: `Privileged action restricted to users holding the "${role}" role permission context.`,
      });
      return;
    }
    next();
  };
};