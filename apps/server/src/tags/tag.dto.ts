import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { TAG_COLORS, type TagColor } from './tag.constants.js';

export class SaveTagDto {
  @IsString()
  @Matches(/^[^,]*\S[^,]*$/, { message: 'name must not be blank or contain commas' })
  @MaxLength(50)
  name!: string;

  @IsIn(TAG_COLORS)
  color!: TagColor;
}
