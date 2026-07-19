import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { AuthRequest } from "../lib/auth.js";

type AsyncRequestHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(
  handler: AsyncRequestHandler,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(
      handler(req as AuthRequest, res, next),
    ).catch(next);
  };
}