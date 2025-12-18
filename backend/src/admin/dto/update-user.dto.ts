import {
    IsOptional,
    IsString,
    IsEnum,
    IsNumber,
    IsNotEmpty,
    ValidateIf,
    Validate,
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from '../../users/schemas/user.schema';

@ValidatorConstraint({ name: 'rejectionReasonRequired', async: false })
export class RejectionReasonValidator implements ValidatorConstraintInterface {
    validate(rejectionReason: string | null | undefined, args: ValidationArguments): boolean {
        const obj = args.object as UpdateUserDto;
        if (obj.status === 'rejected') {
            return rejectionReason !== null && rejectionReason !== undefined && rejectionReason.trim().length > 0;
        }
        return true;
    }

    defaultMessage(_args: ValidationArguments): string {
        return 'סיבת דחייה נדרשת כאשר הסטטוס הוא "נדחה"';
    }
}

@ValidatorConstraint({ name: 'rejectionReasonMustBeNull', async: false })
export class RejectionReasonNullValidator implements ValidatorConstraintInterface {
    validate(rejectionReason: string | null | undefined, args: ValidationArguments): boolean {
        const obj = args.object as UpdateUserDto;
        if (obj.status && obj.status !== 'rejected') {
            return rejectionReason === null || rejectionReason === undefined || rejectionReason.trim().length === 0;
        }
        return true;
    }

    defaultMessage(_args: ValidationArguments): string {
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
    @IsString()
    @IsNotEmpty()
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
    @IsEnum(['pending', 'approved', 'rejected', 'archived'])
    status?: UserStatus;

    @IsOptional()
    @ValidateIf((o) => o.status === 'rejected')
    @Validate(RejectionReasonValidator)
    @ValidateIf((o) => o.status && o.status !== 'rejected')
    @Validate(RejectionReasonNullValidator)
    @IsString()
    rejectionReason?: string | null;
}

