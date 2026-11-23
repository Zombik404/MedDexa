import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthTokens, AuthUser, LoginInput, RegisterInput } from '@meddexa/shared';
import type { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;
/** Hash compared against when the email does not exist, so timing does not reveal accounts. */
let dummyHash: string | null = null;
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_ROUNDS));

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
  ) {}

  toAuthUser(u: User): AuthUser {
    return { id: u.id, email: u.email, displayName: u.displayName, role: u.role, createdAt: u.createdAt.toISOString() };
  }

  async register(input: RegisterInput, userAgent?: string): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException({ message: 'Email already registered', code: 'EMAIL_TAKEN' });
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        displayName: input.displayName ?? null,
        preferences: { create: { language: input.locale?.slice(0, 2) ?? 'en' } },
      },
    });
    return this.issueTokens(user, userAgent);
  }

  async login(input: LoginInput, userAgent?: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !ok || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user, userAgent);
  }

  /**
   * Rotates a refresh token. Presenting an already-rotated token revokes every session of
   * the user (token theft detection).
   */
  async refresh(refreshToken: string, userAgent?: string): Promise<AuthTokens> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException({ message: 'Invalid refresh token', code: 'REFRESH_INVALID' });
    if (session.revokedAt) {
      await this.prisma.session.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException({ message: 'Refresh token reuse detected', code: 'REFRESH_REUSED' });
    }
    if (session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ message: 'Session expired', code: 'REFRESH_EXPIRED' });
    }
    const tokens = await this.issueTokens(session.user, userAgent);
    const next = await this.prisma.session.findUniqueOrThrow({ where: { tokenHash: sha256(tokens.refreshToken) } });
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date(), replacedById: next.id } });
    return tokens;
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Always succeeds from the caller's point of view, to avoid account enumeration. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${this.config.get('PUBLIC_APP_URL', { infer: true })}reset-password?token=${token}`;
    await this.mail.send(
      user.email,
      'Reset your MedDexa password',
      `Someone asked to reset the password of your MedDexa account.\n\nOpen this link within one hour to choose a new password:\n${link}\n\nIf this wasn't you, you can ignore this email.`,
    );
  }

  async resetPassword(token: string, password: string) {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException({ message: 'Invalid or expired reset link', code: 'RESET_INVALID' });
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
      }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return !!user && (await bcrypt.compare(password, user.passwordHash));
  }

  private async issueTokens(user: User, userAgent?: string): Promise<AuthTokens> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role }, { expiresIn });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        userAgent: userAgent?.slice(0, 200),
        expiresAt: new Date(Date.now() + this.config.get('REFRESH_TTL_DAYS', { infer: true }) * 86_400_000),
      },
    });
    return { accessToken, refreshToken, expiresIn, user: this.toAuthUser(user) };
  }
}
