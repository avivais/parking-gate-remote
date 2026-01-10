import { Module } from '@nestjs/common';
import { TerminalGateway } from './terminal.gateway';
import { TerminalService } from './terminal.service';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [AuthModule, UsersModule, ConfigModule, JwtModule],
    providers: [TerminalGateway, TerminalService],
    exports: [TerminalService],
})
export class TerminalModule {}
