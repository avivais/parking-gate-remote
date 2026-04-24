import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
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
