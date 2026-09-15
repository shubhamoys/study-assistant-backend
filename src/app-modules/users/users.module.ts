import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvatarUploadController } from './avatar-upload.controller';
import { User } from './entities/user.entity';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AvatarUploadController],
  providers: [UsersService, UsersResolver],
  exports: [UsersService],
})
export class UsersModule {}
