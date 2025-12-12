import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
    @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
    @IsNotEmpty({ message: 'אימייל הוא שדה חובה' })
    email: string;

    @IsNotEmpty({ message: 'סיסמה היא שדה חובה' })
    @MinLength(6, { message: 'הסיסמה חייבת להכיל לפחות 6 תווים' })
    password: string;
}
