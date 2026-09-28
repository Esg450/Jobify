import { OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateUserDto } from '../users/users.dto.js';

export class LoginDto {
  @IsString()
  @MaxLength(100)
  username!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

/** Self-service sign-up; the role is always "user". */
export class RegisterDto extends OmitType(CreateUserDto, ['role'] as const) {}

export class SetupDto extends OmitType(CreateUserDto, ['role'] as const) {
  /** Required when upgrading an instance that was protected with JOBIFY_PASSWORD. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  setupPassword?: string;
}

export class RegistrationSettingsDto {
  @IsBoolean()
  open!: boolean;
}
