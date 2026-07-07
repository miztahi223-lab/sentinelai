export const SCAN_QUEUE = 'scans';
export const REPORT_QUEUE = 'reports';
export const NOTIFICATION_QUEUE = 'notifications';

export interface ScanJobData {
  scanId: string;
  domainId: string;
  hostname: string;
}

export interface ReportJobData {
  reportId: string;
  organizationId: string;
  scanId?: string;
}

export interface NotificationJobData {
  alertId: string;
}
