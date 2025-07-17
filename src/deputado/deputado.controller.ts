import { Body, Controller, Get } from '@nestjs/common';

@Controller('deputado')
export class DeputadoController {
    @Get('list')
    listDeputados() {
        // Logic to search deputados would go here
        return 'Search Deputados';
    }
}
