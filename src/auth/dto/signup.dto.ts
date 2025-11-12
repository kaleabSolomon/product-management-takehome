import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from 'src/common/validators';

export class SignupDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
    minLength: 6,
    maxLength: 12,
  })
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(12)
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Password confirmation (must match password)',
    example: 'password123',
    minLength: 6,
    maxLength: 12,
  })
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(12)
  @IsString()
  @Match('password', {
    message: 'Password confirmation does not match password',
  })
  passwordConfirm: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message:
      'Firstname can only contain letters, spaces, hyphens, and apostrophes',
  })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message:
      'lastName can only contain letters, spaces, hyphens, and apostrophes',
  })
  lastName: string;
}
