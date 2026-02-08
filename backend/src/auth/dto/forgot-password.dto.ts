import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
    @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
    @IsNotEmpty({ message: 'אימייל הוא שדה חובה' })
    email: string;
}
