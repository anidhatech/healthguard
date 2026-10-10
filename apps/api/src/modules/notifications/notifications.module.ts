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
  'dose.reminder': {
    'en-IN': {
      title: 'Medicine reminder',
      body: 'Time for {medication} ({time}). Open HealthGuard to mark it taken, skipped or snooze.',
    },
    'hi-IN': {
      title: 'दवा की याद',
      body: '{medication} लेने का समय ({time})। ली, छोड़ी या बाद में याद दिलाएँ — HealthGuard में बताएँ।',
    },
    'te-IN': {
      title: 'మందుల గుర్తు',
      body: '{medication} తీసుకునే సమయం ({time}). తీసుకున్నారా, వదిలేశారా లేదా తర్వాత గుర్తు చేయాలా — HealthGuard‌లో తెలపండి.',
    },
  },
  'care.callback_requested': {
    'en-IN': {
      title: 'Call-back requested',
      body: 'A patient asked the care team to call back. See the care queue.',
    },
    'hi-IN': {
      title: 'कॉल-बैक का अनुरोध',
      body: 'एक मरीज़ ने केयर टीम से कॉल-बैक माँगा है। केयर क्यू देखें।',
    },
    'te-IN': {
      title: 'కాల్-బ్యాక్ అభ్యర్థన',
      body: 'ఒక రోగి కేర్ టీమ్ నుండి కాల్-బ్యాక్ కోరారు. కేర్ క్యూ చూడండి.',
    },
  },
  'care.callback_missed_doses': {
    'en-IN': {
      title: 'Missed doses: call-back due',
      body: 'Doses were recorded as missed twice in a row. See the care queue.',
    },
    'hi-IN': {
      title: 'छूटी खुराकें: कॉल-बैक करें',
      body: 'लगातार दो खुराकें छूटी दर्ज हुई हैं। केयर क्यू देखें।',
    },
    'te-IN': {
      title: 'తప్పిన మోతాదులు: కాల్-బ్యాక్',
      body: 'వరుసగా రెండు మోతాదులు తప్పినట్లు నమోదైంది. కేర్ క్యూ చూడండి.',
    },
  },
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
  'appointment.proposed': {
    'en-IN': {
      title: 'New appointment time',
      body: '{clinician} proposed {time}. Open Appointments to approve or decline.',
    },
    'hi-IN': {
      title: 'अपॉइंटमेंट का नया समय',
      body: '{clinician} ने {time} का समय सुझाया है। मंज़ूर या मना करने के लिए "अपॉइंटमेंट" खोलें।',
    },
    'te-IN': {
      title: 'కొత్త అపాయింట్‌మెంట్ సమయం',
      body: '{clinician} {time} సమయం సూచించారు. ఆమోదించడానికి లేదా తిరస్కరించడానికి "అపాయింట్‌మెంట్లు" తెరవండి.',
    },
  },
  'appointment.confirmed': {
    'en-IN': { title: 'Appointment confirmed', body: 'You are seeing {clinician} on {time}.' },
    'hi-IN': { title: 'अपॉइंटमेंट पक्का हुआ', body: 'आप {time} को {clinician} से मिलेंगे।' },
    'te-IN': { title: 'అపాయింట్‌మెంట్ ఖరారైంది', body: 'మీరు {time}కి {clinician}ని కలుస్తారు.' },
  },
  'appointment.cancelled': {
    'en-IN': {
      title: 'Appointment cancelled',
      body: 'Your appointment with {clinician} on {time} was cancelled. The care team will contact you.',
    },
    'hi-IN': {
      title: 'अपॉइंटमेंट रद्द हुआ',
      body: '{time} को {clinician} के साथ आपका अपॉइंटमेंट रद्द हो गया। केयर टीम आपसे संपर्क करेगी।',
    },
    'te-IN': {
      title: 'అపాయింట్‌మెంట్ రద్దయింది',
      body: '{time}కి {clinician}తో మీ అపాయింట్‌మెంట్ రద్దయింది. కేర్ టీమ్ మిమ్మల్ని సంప్రదిస్తుంది.',
    },
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
