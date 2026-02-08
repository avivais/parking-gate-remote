import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'קישור איפוס לא תקף' })
    token: string;

    @IsString()
    @IsNotEmpty({ message: 'סיסמה היא שדה חובה' })
    @MinLength(6, { message: 'הסיסמה חייבת להכיל לפחות 6 תווים' })
    newPassword: string;
}
