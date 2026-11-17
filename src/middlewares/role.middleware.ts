 
import type { Request, Response, NextFunction } from "express";

type UserRole = "customer" | "vendor" | "admin";

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You don't have permission.",
      });
    }

    next();
  };
};
