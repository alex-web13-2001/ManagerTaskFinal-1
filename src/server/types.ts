// Type definitions for server
import { Request } from 'express';
import { JwtPayload } from '../lib/auth';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
