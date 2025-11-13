import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from 'src/common/validators';

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'oldpassword123',
    minLength: 6,
    maxLength: 12,
  })
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(12)
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    example: 'newpassword123',
    minLength: 6,
    maxLength: 12,
  })
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(12)
  @IsString()
  newPassword: string;

  @ApiProperty({
    description: 'New password confirmation (must match new password)',
    example: 'newpassword123',
    minLength: 6,
    maxLength: 12,
  })
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(12)
  @IsString()
  @Match('newPassword', {
    message: 'Password confirmation does not match new password',
  })
  newPasswordConfirm: string;
}
