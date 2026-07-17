import type { Job } from 'bullmq';

export type SendOtpJobName = 'send_otp';
export type AuditLogJobName = 'audit_log';
export type EmailQueueJobName = SendOtpJobName | AuditLogJobName;

export interface SendOtpJobData {
  to: string;
  subject: string;
  otp: number | string;
}

export interface AuditLogJobData {
  userId: number | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export type EmailQueueJobData = SendOtpJobData | AuditLogJobData;
export type SendOtpJob = Job<SendOtpJobData, void, SendOtpJobName>;
export type AuditLogJob = Job<AuditLogJobData, void, AuditLogJobName>;
export type EmailQueueJob = SendOtpJob | AuditLogJob;
