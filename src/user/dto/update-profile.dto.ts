import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message:
      'Firstname can only contain letters, spaces, hyphens, and apostrophes',
  })
  firstName?: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message:
      'Lastname can only contain letters, spaces, hyphens, and apostrophes',
  })
  lastName?: string;
}
