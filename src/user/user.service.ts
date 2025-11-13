import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto, UpdatePasswordDto } from './dto';
import * as argon from 'argon2';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      this.logger.warn('User not found', { userId });
      throw new NotFoundException('User not found');
    }

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      this.logger.warn('User not found for profile update', { userId });
      throw new NotFoundException('User not found');
    }

    if (dto.firstName) {
      user.firstName = dto.firstName;
    }
    if (dto.lastName) {
      user.lastName = dto.lastName;
    }

    let updatedUser: User;
    try {
      updatedUser = await this.userRepository.save(user);
    } catch (error) {
      this.logger.error('Failed to update user profile', { userId, error });
      throw new InternalServerErrorException('Failed to update user profile');
    }

    if (!updatedUser) {
      this.logger.error('Failed to update user profile', { userId });
      throw new InternalServerErrorException('Failed to update user profile');
    }

    this.logger.info('User profile updated successfully', {
      userId,
      email: updatedUser.email,
      updatedFields: Object.keys(dto),
    });

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }

  async updatePassword(
    userId: string,
    dto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      this.logger.warn('User not found for password update', { userId });
      throw new NotFoundException('User not found');
    }

    const pwMatches = await argon.verify(user.password, dto.currentPassword);

    if (!pwMatches) {
      this.logger.warn('Incorrect current password provided', {
        userId,
        email: user.email,
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await argon.hash(dto.newPassword);
    user.password = newPasswordHash;

    let updatedUser: User;
    try {
      updatedUser = await this.userRepository.save(user);
    } catch (error) {
      this.logger.error('Failed to update user password', { userId, error });
      throw new InternalServerErrorException('Failed to update password');
    }

    if (!updatedUser) {
      this.logger.error('Failed to update user password', { userId });
      throw new InternalServerErrorException('Failed to update password');
    }

    this.logger.info('User password updated successfully', {
      userId,
      email: updatedUser.email,
    });

    return { message: 'Password updated successfully' };
  }
}
