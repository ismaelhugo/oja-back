import { Body, Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
import { DeputadoService } from './deputado.service';
import { Deputado } from './deputado.entity';

@Controller('deputado')
export class DeputadoController {
    constructor(private readonly deputadoService: DeputadoService) {}

    @Get('list')
    async listDeputados() {
        return this.deputadoService.findAll();
    }

    @Post('create')
    async createDeputado(@Body() deputado: Partial<Deputado>) {
        return this.deputadoService.create(deputado);
    }

    @Get(':id')
    async getDeputado(@Param('id') id: number) {
        return this.deputadoService.findOne(id);
    }

    @Put('update/:id')
    async updateDeputado(@Param('id') id: number, @Body() deputado: Partial<Deputado>) {
        return this.deputadoService.update(id, deputado);
    }

    @Delete('delete/:id')
    async deleteDeputado(@Param('id') id: number) {
        await this.deputadoService.remove(id);
        return { message: 'Deputado deletado com sucesso' };
    }
}
