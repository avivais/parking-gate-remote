import { IsOptional, IsString } from 'class-validator';

export class ResetDeviceDto {
    @IsOptional()
    @IsString()
    deviceId?: string;
}

