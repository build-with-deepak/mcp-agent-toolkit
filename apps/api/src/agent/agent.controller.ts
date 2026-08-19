import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SseWriter } from '../common/sse';
import { AgentService } from './agent.service';
import { AskDto } from './dto/ask.dto';

@Controller('api/agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  /** POST + manual SSE — see the note on SseWriter for why not @Sse. */
  @Post('stream')
  async stream(@Body() dto: AskDto, @Res() res: Response): Promise<void> {
    const writer = new SseWriter(res);
    try {
      await this.agent.run(dto.question, (type, data) =>
        writer.send(type, data),
      );
    } catch (err) {
      // run() is designed not to throw; backstop so a surprise never leaves
      // the response hanging open.
      writer.send('error', {
        message: (err as Error).message || 'Something went wrong.',
      });
    } finally {
      writer.end();
    }
  }
}
