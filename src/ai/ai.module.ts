import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { McpService } from './mcp/mcp.service';

@Module({
  imports: [],
  controllers: [AiController],
  providers: [AiService, McpService],
  exports: [AiService],
})
export class AiModule {}
