import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository, type QueryDeepPartialEntity } from 'typeorm';
import { UserRole } from '../../database/enums';
import { User } from './entities/user.entity';

export interface AdminUsersOptions {
  search?: string;
  role?: UserRole;
  page: number;
  limit: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    displayName: string;
    verificationToken?: string;
    role?: UserRole;
    isEmailVerified?: boolean;
  }): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  findByVerificationToken(hash: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ verificationToken: hash });
  }

  async findByValidResetToken(hash: string): Promise<User | null> {
    const user = await this.usersRepository.findOneBy({
      resetPasswordToken: hash,
    });
    if (!user?.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      return null;
    }
    return user;
  }

  // `QueryDeepPartialEntity<User>`, not `Partial<User>` — TypeORM's own
  // update() parameter type, matched exactly. Comparing a plain
  // `Partial<User>` against it (as this used to do) makes TS structurally
  // recurse through every relation on User to check assignability, and
  // adding Order (Phase 4 checkpoint 2) tipped that recursion over
  // TS's comparison-depth limit — spurious errors several relations deep,
  // unrelated to anything this method actually does with scalar columns.
  async update(
    id: string,
    partial: QueryDeepPartialEntity<User>,
  ): Promise<User> {
    await this.usersRepository.update(id, partial);
    return (await this.findById(id))!;
  }

  async findManyForAdmin(
    options: AdminUsersOptions,
  ): Promise<{ items: User[]; totalCount: number }> {
    const qb = this.usersRepository.createQueryBuilder('user');
    if (options.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.displayName ILIKE :search)',
        { search: `%${options.search}%` },
      );
    }
    if (options.role) {
      qb.andWhere('user.role = :role', { role: options.role });
    }
    qb.orderBy('user.createdAt', 'DESC');

    const totalCount = await qb.getCount();
    qb.skip((options.page - 1) * options.limit).take(options.limit);
    const items = await qb.getMany();
    return { items, totalCount };
  }

  /**
   * `currentUserId` is always the caller — blocks a super admin from
   * demoting themselves, which would otherwise be a self-service lockout
   * (nobody left who can manage admins short of rerunning the seeder).
   * `role` is only ever USER or ADMIN here — SUPER_ADMIN is exclusively
   * seeder-assigned (see the enum's doc comment), never grantable through
   * this or any other mutation, and a SUPER_ADMIN target's own role can't
   * be changed through this path at all.
   */
  async updateRole(
    currentUserId: string,
    targetId: string,
    role: UserRole,
  ): Promise<User> {
    if (role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Super admin can only be assigned by rerunning the seeder',
      );
    }
    if (currentUserId === targetId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('You cannot remove your own admin access');
    }
    const target = await this.findById(targetId);
    if (!target) {
      throw new NotFoundException('User not found');
    }
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("A super admin's role can't be changed");
    }
    return this.update(targetId, { role });
  }

  /**
   * The only way an ADMIN account gets created outside a manual promotion
   * (adminUpdateRole) — always role: ADMIN, never configurable. Skips email
   * verification: another admin is vouching for this account, unlike a
   * self-registered user who has to prove they own the inbox.
   */
  async createAdmin(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<User> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const saltRounds = this.configService.get<number>('jwt.bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);
    return this.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });
  }
}
