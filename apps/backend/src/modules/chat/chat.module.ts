import { Module } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { ChatContextAssemblerService } from './chat-context-assembler.service';
import { ChatController } from './chat.controller';
import { ChatStreamService } from './chat-stream.service';
import { ChatThreadService } from './chat-thread.service';
import { ProjectKnowledgeController } from './project-knowledge.controller';
import { ProjectKnowledgeService } from './project-knowledge.service';

@Module({
  imports: [DatabaseModule, AuditModule, AIGatewayModule],
  controllers: [ChatController, ProjectKnowledgeController],
  providers: [
    ChatThreadService,
    ChatStreamService,
    ChatContextAssemblerService,
    ProjectKnowledgeService,
  ],
  exports: [
    ChatThreadService,
    ChatStreamService,
    ChatContextAssemblerService,
    ProjectKnowledgeService,
  ],
})
export class ChatModule {}
