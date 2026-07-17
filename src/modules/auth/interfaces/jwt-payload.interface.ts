export interface JwtPayload {
  sub: number;
  email: string;
  username: string;
  role: string;
  planSlug: string | null;
  planLevel: number;
  jti: string;
  iat: number;
  exp: number;
}
export interface ResetTokenPayload {
  sub: number;
  purpose: 'reset_password';
  jti: string;
  iat: number;
  exp: number;
}
