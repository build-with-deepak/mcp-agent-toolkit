import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { McpHostService } from './mcp-host.service';

@Module({
  imports: [DbModule],
  providers: [McpHostService],
  exports: [McpHostService],
})
export class McpModule {}
