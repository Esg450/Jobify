import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { USER_ROLES, type UserRole } from '../database/schema.js';

export const MIN_PASSWORD_LENGTH = 8;

export class PasswordDto {
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters`,
  })
  @MaxLength(200)
  password!: string;
}

export class CreateUserDto extends PasswordDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,32}$/, {
    message: 'Usernames are 3-32 characters: letters, numbers, dots, dashes and underscores',
  })
  username!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UpdateAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;
}

export class ChangePasswordDto extends PasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword!: string;
}
