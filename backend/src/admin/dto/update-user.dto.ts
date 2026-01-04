import {
    IsOptional,
    IsString,
    IsEnum,
    IsNumber,
    IsNotEmpty,
    Matches,
    ValidateIf,
    Validate,
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus, USER_STATUS } from '../../users/schemas/user.schema';

@ValidatorConstraint({ name: 'rejectionReasonRequired', async: false })
export class RejectionReasonValidator implements ValidatorConstraintInterface {
    validate(
        rejectionReason: string | null | undefined,
        args: ValidationArguments,
    ): boolean {
        const obj = args.object as UpdateUserDto;
        if (obj.status === USER_STATUS.REJECTED) {
            return (
                rejectionReason !== null &&
                rejectionReason !== undefined &&
                rejectionReason.trim().length > 0
            );
        }
        return true;
    }

    defaultMessage(): string {
        return 'סיבת דחייה נדרשת כאשר הסטטוס הוא "נדחה"';
    }
}

@ValidatorConstraint({ name: 'rejectionReasonMustBeNull', async: false })
export class RejectionReasonNullValidator implements ValidatorConstraintInterface {
    validate(
        rejectionReason: string | null | undefined,
        args: ValidationArguments,
    ): boolean {
        const obj = args.object as UpdateUserDto;
        if (obj.status && obj.status !== USER_STATUS.REJECTED) {
            return (
                rejectionReason === null ||
                rejectionReason === undefined ||
                rejectionReason.trim().length === 0
            );
        }
        return true;
    }

    defaultMessage(): string {
        return 'סיבת דחייה חייבת להיות ריקה כאשר הסטטוס אינו "נדחה"';
    }
}

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    firstName?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    lastName?: string;

    @IsOptional()
    @Matches(/^0(2|3|4|5[0-9]|8|9)[0-9]{7}$/, {
        message: 'מספר טלפון לא תקין',
    })
    phone?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @IsNotEmpty()
    apartmentNumber?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @IsNotEmpty()
    floor?: number;

    @IsOptional()
    @IsEnum([
        USER_STATUS.PENDING,
        USER_STATUS.APPROVED,
        USER_STATUS.REJECTED,
        USER_STATUS.ARCHIVED,
    ])
    status?: UserStatus;

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @ValidateIf((o) => o.status === USER_STATUS.REJECTED)
    @Validate(RejectionReasonValidator)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    @ValidateIf((o) => o.status && o.status !== USER_STATUS.REJECTED)
    @Validate(RejectionReasonNullValidator)
    @IsString()
    rejectionReason?: string | null;
}
