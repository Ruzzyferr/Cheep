import { intParam } from '../../utils/request-params.js';
import { type Request, type Response, type NextFunction } from 'express';
import * as AssistantService from './assistant.service.js';

// ============================================
// THREAD CRUD
// ============================================

/**
 * Yeni sohbet thread'i oluştur
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const thread = await AssistantService.createThread(req.user.id);

    res.status(201).json({
      success: true,
      data: thread,
      message: 'Sohbet başlatıldı',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Kullanıcının tüm thread'lerini listele
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const threads = await AssistantService.listThreads(req.user.id);

    res.status(200).json({
      success: true,
      data: threads,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tek bir thread'i mesajlarıyla getir
 */
export const get = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const thread = await AssistantService.getThread(intParam(req.params.id), req.user.id);

    res.status(200).json({
      success: true,
      data: thread,
    });
  } catch (e: any) {
    res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message });
  }
};

/**
 * Thread'i sil
 */
export const remove = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await AssistantService.deleteThread(intParam(req.params.id), req.user.id);

    res.status(200).json(result);
  } catch (e: any) {
    res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message });
  }
};

/**
 * Kullanıcı mesajı gönder ve asistan yanıtı al
 */
export const message = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await AssistantService.sendMessage(
      req.user.id,
      intParam(req.params.id),
      req.body.content,
      req.country?.currency ?? 'TRY',
      req.country?.id,
      req.lang,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    console.error('[assistant] message handler error:', e);
    if (e?.code === 'DAILY_LIMIT') {
      res.status(429).json({
        success: false, code: 'DAILY_LIMIT', remaining: 0,
        message: 'Günlük 5 mesaj hakkın doldu. Sınırsız için Premium\'a geç.',
      });
      return;
    }
    if ((e.statusCode ?? e.status) === 404) {
      res.status(404).json({ success: false, message: e.message });
      return;
    }
    const isQuota =
      /429|quota|too many requests/i.test(e.message ?? '') ||
      (e.statusCode ?? e.status) === 429;
    if (isQuota) {
      res.status(503).json({
        success: false,
        message: 'Asistan şu an çok yoğun, lütfen birazdan tekrar dene.',
      });
      return;
    }
    res.status(502).json({
      success: false,
      message: 'Asistan şu an yanıt veremedi, lütfen tekrar dene.',
    });
  }
};
