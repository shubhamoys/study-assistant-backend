import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
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
    verificationToken?: string;
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

  async update(id: string, partial: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, partial);
    return (await this.findById(id))!;
  }
}
