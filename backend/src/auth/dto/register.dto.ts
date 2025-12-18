import { IsEmail, IsNotEmpty, MinLength, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterDto {
    @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
    @IsNotEmpty({ message: 'אימייל הוא שדה חובה' })
    email: string;

    @IsNotEmpty({ message: 'סיסמה היא שדה חובה' })
    @MinLength(6, { message: 'הסיסמה חייבת להכיל לפחות 6 תווים' })
    password: string;

    @IsString({ message: 'שם פרטי חייב להיות מחרוזת' })
    @IsNotEmpty({ message: 'שם פרטי הוא שדה חובה' })
    firstName: string;

    @IsString({ message: 'שם משפחה חייב להיות מחרוזת' })
    @IsNotEmpty({ message: 'שם משפחה הוא שדה חובה' })
    lastName: string;

    @IsString({ message: 'טלפון חייב להיות מחרוזת' })
    @IsNotEmpty({ message: 'טלפון הוא שדה חובה' })
    phone: string;

    @Type(() => Number)
    @IsNumber({}, { message: 'מספר דירה חייב להיות מספר' })
    @IsNotEmpty({ message: 'מספר דירה הוא שדה חובה' })
    apartmentNumber: number;

    @Type(() => Number)
    @IsNumber({}, { message: 'קומה חייבת להיות מספר' })
    @IsNotEmpty({ message: 'קומה היא שדה חובה' })
    floor: number;
}

