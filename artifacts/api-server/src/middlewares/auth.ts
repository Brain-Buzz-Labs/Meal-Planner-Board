import { Request, Response, NextFunction } from "express";
import * as jose from "jose";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

const NEON_AUTH_URL = process.env.NEON_AUTH_URL;

const JWKS = NEON_AUTH_URL
  ? jose.createRemoteJWKSet(new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`))
  : null;

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!JWKS) {
    res.status(500).json({ error: "Auth not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: new URL(NEON_AUTH_URL!).origin,
    });

    if (!payload.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
