import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { GetCurrentUser } from 'src/common/decorators';
import { userReq } from 'src/common/types';
import { UpdateProfileDto, UpdatePasswordDto } from './dto';
import { User } from './entities/user.entity';

@ApiTags('user')
@ApiBearerAuth('JWT-auth')
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: User,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getCurrentUser(@GetCurrentUser() user: userReq): Promise<User> {
    return await this.userService.getCurrentUser(user.userId);
  }

  @Patch('/me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
    type: User,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateProfile(
    @GetCurrentUser() user: userReq,
    @Body() dto: UpdateProfileDto,
  ): Promise<User> {
    return await this.userService.updateProfile(user.userId, dto);
  }

  @Patch('/me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user password' })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Password updated successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid current password',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updatePassword(
    @GetCurrentUser() user: userReq,
    @Body() dto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    return await this.userService.updatePassword(user.userId, dto);
  }
}
