import { Test, TestingModule } from '@nestjs/testing';
import { GateController } from './gate.controller';

describe('GateController', () => {
    let controller: GateController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GateController],
        }).compile();

        controller = module.get<GateController>(GateController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
