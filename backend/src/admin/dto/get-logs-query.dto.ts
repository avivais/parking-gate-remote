import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum OpenedByFilter {
    USER = 'user',
    ADMIN_BACKDOOR = 'admin-backdoor',
    ALL = 'all',
}

export class GetLogsQueryDto {
    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsEnum(OpenedByFilter)
    openedBy?: OpenedByFilter = OpenedByFilter.ALL;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number = 50;
}
