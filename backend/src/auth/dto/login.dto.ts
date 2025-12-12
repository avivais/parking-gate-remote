import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
    @IsNotEmpty({ message: 'אימייל הוא שדה חובה' })
    email: string;

    @IsString({ message: 'סיסמה חייבת להיות מחרוזת' })
    @IsNotEmpty({ message: 'סיסמה היא שדה חובה' })
    password: string;

    @IsString({ message: 'מזהה מכשיר חייב להיות מחרוזת' })
    @IsNotEmpty({ message: 'מזהה מכשיר הוא שדה חובה' })
    deviceId: string;
}
