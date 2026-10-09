import { Controller, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IdParamsSchema,
  resolveLocale,
  type IdParams,
  type NotificationView,
  type SupportedLocale,
} from '@healthguard/shared';
import { CurrentActor, type ActorContext } from '../../common/actor.js';
import { iso, isoOrNull } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { zod } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

type Template = Record<SupportedLocale, { title: string; body: string }>;

/** Reviewed notification templates. Parameters are inserted, never generated. */
export const NOTIFICATION_TEMPLATES: Record<string, Template> = {
  'lab.result_available': {
    'en-IN': {
      title: 'New lab result',
      body: 'Your {test} result is ready. Open Tests to see it.',
    },
    'hi-IN': {
      title: 'नई लैब रिपोर्ट',
      body: 'आपकी {test} रिपोर्ट आ गई है। देखने के लिए "जाँच" खोलें।',
    },
    'te-IN': {
      title: 'కొత్త ల్యాబ్ ఫలితం',
      body: 'మీ {test} ఫలితం సిద్ధంగా ఉంది. చూడటానికి "పరీక్షలు" తెరవండి.',
    },
  },
  'appointment.reminder': {
    'en-IN': { title: 'Appointment tomorrow', body: 'You are seeing {clinician} at {time}.' },
    'hi-IN': { title: 'कल अपॉइंटमेंट है', body: 'आप {time} बजे {clinician} से मिल रहे हैं।' },
    'te-IN': { title: 'రేపు అపాయింట్‌మెంట్', body: 'మీరు {time}కి {clinician}ని కలుస్తున్నారు.' },
  },
  'medication.course_completed': {
    'en-IN': {
      title: 'Medicine course finished',
      body: 'Your {medication} course has ended. Bring any questions to your next visit.',
    },
    'hi-IN': {
      title: 'दवा का कोर्स पूरा हुआ',
      body: 'आपका {medication} का कोर्स पूरा हो गया है। कोई सवाल हो तो अगली मुलाक़ात में पूछें।',
    },
    'te-IN': {
      title: 'మందుల కోర్సు పూర్తయింది',
      body: 'మీ {medication} కోర్సు పూర్తయింది. ఏవైనా ప్రశ్నలు ఉంటే తదుపరి సందర్శనలో అడగండి.',
    },
  },
};

export function renderNotification(
  templateKey: string,
  locale: string,
  params: Record<string, unknown>,
) {
  const template = NOTIFICATION_TEMPLATES[templateKey]?.[resolveLocale(locale)];
  if (!template) return { title: templateKey, body: '' };
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const value = params[key];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    });
  return { title: fill(template.title), body: fill(template.body) };
}

@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: "The signed-in user's in-app notifications (nothing is sent externally in this phase)",
  })
  async inbox(@CurrentActor() actor: ActorContext): Promise<NotificationView[]> {
    const rows = await this.prisma.db.notification.findMany({
      where: { recipientUserId: actor.userId, status: { not: 'CANCELLED' } },
      orderBy: { scheduledFor: 'desc' },
      take: 50,
    });
    return rows.map((row) => {
      const { title, body } = renderNotification(
        row.templateKey,
        actor.preferredLocale,
        (row.params ?? {}) as Record<string, unknown>,
      );
      return {
        id: row.id,
        channel: row.channel,
        templateKey: row.templateKey,
        title,
        body,
        status: row.status,
        scheduledFor: iso(row.scheduledFor),
        readAt: isoOrNull(row.readAt),
      };
    });
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark one of my notifications as read' })
  async markRead(
    @CurrentActor() actor: ActorContext,
    @Param(zod(IdParamsSchema)) params: IdParams,
  ): Promise<void> {
    const result = await this.prisma.db.notification.updateMany({
      where: { id: params.id, recipientUserId: actor.userId, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    if (result.count === 0) {
      const exists = await this.prisma.db.notification.count({
        where: { id: params.id, recipientUserId: actor.userId },
      });
      if (!exists) throw Problems.notFound('notification');
    }
  }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
