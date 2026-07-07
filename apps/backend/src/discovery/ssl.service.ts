import { Injectable, Logger } from '@nestjs/common';
import { connect, TLSSocket, PeerCertificate } from 'tls';

export interface SslInspectionResult {
  valid: boolean;
  reason?: string;
  subject?: string;
  issuer?: string;
  validFrom?: Date;
  validTo?: Date;
  daysUntilExpiry?: number;
  subjectAltNames?: string[];
  protocol?: string | null;
  serialNumber?: string;
  fingerprint256?: string;
  selfSigned?: boolean;
}

const CONNECT_TIMEOUT_MS = 8000;

/**
 * Opens a raw TLS connection (no HTTP involved) to inspect the certificate
 * actually presented on port 443, independent of what any HTTP client's
 * cert validation would report — this is what lets us flag things like
 * "expires in 3 days" or "self-signed" even where the browser/HTTP client
 * would otherwise treat the connection as fine (or refuse it entirely,
 * hiding the actual expiry/issuer details from a normal HTTP-level check).
 */
@Injectable()
export class SslService {
  private readonly logger = new Logger(SslService.name);

  inspect(hostname: string, port = 443): Promise<SslInspectionResult> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: SslInspectionResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      const socket: TLSSocket = connect(
        {
          host: hostname,
          port,
          servername: hostname, // SNI
          rejectUnauthorized: false, // we want to inspect even invalid certs, not just reject
          timeout: CONNECT_TIMEOUT_MS,
        },
        () => {
          try {
            const cert: PeerCertificate = socket.getPeerCertificate(true);
            if (!cert || Object.keys(cert).length === 0) {
              finish({ valid: false, reason: 'No certificate presented' });
              return;
            }

            const validFrom = new Date(cert.valid_from);
            const validTo = new Date(cert.valid_to);
            const daysUntilExpiry = Math.floor(
              (validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );

            const authError = (
              socket as unknown as { authorizationError?: string }
            ).authorizationError;

            const subjectAltNames = (cert.subjectaltname ?? '')
              .split(',')
              .map((s) => s.trim().replace(/^DNS:/, ''))
              .filter(Boolean);

            // Node's typings allow a certificate's CN to be a single string
            // or (rarely, for multi-value RDNs) an array — normalize to the
            // first value since that's what every consumer here expects.
            const asSingleString = (
              value: string | string[] | undefined,
            ): string | undefined => (Array.isArray(value) ? value[0] : value);

            finish({
              valid: socket.authorized,
              reason: socket.authorized ? undefined : authError,
              subject: asSingleString(cert.subject?.CN),
              issuer: asSingleString(cert.issuer?.CN),
              validFrom,
              validTo,
              daysUntilExpiry,
              subjectAltNames,
              protocol: socket.getProtocol(),
              serialNumber: cert.serialNumber,
              fingerprint256: cert.fingerprint256,
              selfSigned:
                !!cert.issuer &&
                !!cert.subject &&
                cert.issuer.CN === cert.subject.CN,
            });
          } catch (error) {
            this.logger.debug(
              `SSL inspection parse error for ${hostname}: ${(error as Error).message}`,
            );
            finish({ valid: false, reason: 'Failed to parse certificate' });
          }
        },
      );

      socket.on('timeout', () =>
        finish({ valid: false, reason: 'Connection timed out' }),
      );
      socket.on('error', (error: Error) =>
        finish({ valid: false, reason: error.message }),
      );
    });
  }
}
