export interface JwtPayload {
  /** User ID */
  sub: number;
  /** User email */
  email: string;
  /** Username */
  username: string;
  /** User role: user | admin | editor */
  role: string;
  /** Plan slug (null if no plan assigned) */
  planSlug: string | null;
  /** Plan level (0 if no plan assigned) */
  planLevel: number;
  /** JWT unique identifier */
  jti: string;
  /** Issued at (epoch seconds) */
  iat: number;
  /** Expiration (epoch seconds) */
  exp: number;
}

/**
 * Payload shape for the reset-password token.
 * Separate from JwtPayload because it carries a "purpose" claim.
 */
export interface ResetTokenPayload {
  sub: number;
  purpose: 'reset_password';
  jti: string;
  iat: number;
  exp: number;
}
