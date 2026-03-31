import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SetPendingCommandDto {
    @IsIn(['none', 'reboot', 'rebuild_ppp'])
    action: 'none' | 'reboot' | 'rebuild_ppp';

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(24 * 60 * 60)
    ttlSeconds?: number;
}

