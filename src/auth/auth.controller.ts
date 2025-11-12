import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { NoAuth } from 'src/common/decorators';
import { SigninDto, SignupDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @NoAuth()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - user already exists',
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('/signup')
  async localSignup(@Body() dto: SignupDto) {
    const tokens = await this.authService.signup(dto);
    return tokens;
  }

  @NoAuth()
  @ApiOperation({ summary: 'Sign in an existing user' })
  @ApiBody({ type: SigninDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully signed in',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
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
    description: 'Unauthorized - invalid credentials',
  })
  @HttpCode(HttpStatus.OK)
  @Post('/signin')
  async localSignin(@Body() dto: SigninDto) {
    const tokens = await this.authService.signin(dto);
    return tokens;
  }
}
