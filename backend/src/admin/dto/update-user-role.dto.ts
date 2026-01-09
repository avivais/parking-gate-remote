import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateUserRoleDto {
    @IsNotEmpty()
    @IsEnum(['user', 'admin'])
    role: 'user' | 'admin';
}

