import { Module } from '@nestjs/common';
import { GateService } from './gate.service';
import { GateController } from './gate.controller';

@Module({
    providers: [GateService],
    controllers: [GateController],
})
export class GateModule {}
