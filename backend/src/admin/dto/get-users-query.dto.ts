import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum UserStatusFilter {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    ARCHIVED = 'archived',
    ALL = 'all',
}

export enum UserSortField {
    NAME = 'name',
    APARTMENT_NUMBER = 'apartmentNumber',
    CREATED_AT = 'createdAt',
    APPROVAL_DATE = 'approvalDate',
}

export enum UserSortOrder {
    ASC = 'asc',
    DESC = 'desc',
}

export class GetUsersQueryDto {
    @IsOptional()
    @IsEnum(UserStatusFilter)
    status?: UserStatusFilter = UserStatusFilter.PENDING;

    @IsOptional()
    @IsString()
    q?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @IsOptional()
    @IsEnum(UserSortField)
    sortField?: UserSortField = UserSortField.CREATED_AT;

    @IsOptional()
    @IsEnum(UserSortOrder)
    sortOrder?: UserSortOrder = UserSortOrder.DESC;
}
