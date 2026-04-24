import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
    @IsNotEmpty({ message: 'אימייל הוא שדה חובה' })
    email: string;
}
