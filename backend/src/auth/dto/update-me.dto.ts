import { IsOptional, IsString, IsNotEmpty, IsNumber, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMeDto {
    @IsOptional()
    @IsString({ message: 'שם פרטי חייב להיות מחרוזת' })
    @IsNotEmpty({ message: 'שם פרטי הוא שדה חובה' })
    firstName?: string;

    @IsOptional()
    @IsString({ message: 'שם משפחה חייב להיות מחרוזת' })
    @IsNotEmpty({ message: 'שם משפחה הוא שדה חובה' })
    lastName?: string;

    @IsOptional()
    @Matches(/^0(2|3|4|5[0-9]|8|9)[0-9]{7}$/, {
        message: 'מספר טלפון לא תקין',
    })
    phone?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'מספר דירה חייב להיות מספר' })
    @IsNotEmpty({ message: 'מספר דירה הוא שדה חובה' })
    apartmentNumber?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'קומה חייבת להיות מספר' })
    @IsNotEmpty({ message: 'קומה היא שדה חובה' })
    floor?: number;
}

