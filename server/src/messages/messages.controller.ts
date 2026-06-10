import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { MessagesService } from './messages.service';

class ListMessagesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query() query: ListMessagesQuery,
  ) {
    return this.messagesService.list(
      user.userId,
      query.page,
      query.pageSize,
    );
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { userId: string }) {
    return this.messagesService.unreadCount(user.userId);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.messagesService.markRead(user.userId, id);
  }
}
