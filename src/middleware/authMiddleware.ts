import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: "Access Denied",
      errors: "No authorization token provided in request headers.",
    });
    return;
  }

  // Handle standard "Authorization: <token>" or "Authorization: Bearer <token>"
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET,
    ) as AuthenticatedRequest["user"];
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

export const requireRole = (role: "maintainer") => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({
        success: false,
        message: "Forbidden Operation",
        errors: `Privileged action restricted to users holding the "${role}" role permission context.`,
      });
      return;
    }
    next();
  };
};
