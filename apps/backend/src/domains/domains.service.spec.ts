import { BadRequestException } from '@nestjs/common';
import { DomainsService, verificationTxtValue } from './domains.service';

/**
 * A minimal fake standing in for PrismaService/OrganizationsService/
 * AuditLogsService — real unit test of the verification matching logic
 * itself (does the real TXT lookup actually get compared correctly),
 * distinct from this repo's e2e coverage of the membership/authorization
 * path against a real domain that legitimately has no verification record.
 */
function makeService(domain: {
  organizationId: string;
  verified: boolean;
  verificationToken: string | null;
}) {
  const updated: { data?: unknown } = {};
  const prisma = {
    domain: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'domain-1', name: 'example.com', ...domain }),
      update: jest.fn().mockImplementation(({ data }) => {
        updated.data = data;
        return Promise.resolve({
          id: 'domain-1',
          name: 'example.com',
          ...domain,
          ...data,
        });
      }),
    },
  };
  const organizationsService = {
    getMembership: jest.fn().mockResolvedValue({ id: 'membership-1' }),
  };
  const auditLogsService = { record: jest.fn().mockResolvedValue(undefined) };
  const dnsService = { lookup: jest.fn() };

  const service = new DomainsService(
    prisma as any,
    organizationsService as any,
    auditLogsService as any,
    dnsService as any,
  );

  return { service, prisma, dnsService, auditLogsService, updated };
}

describe('DomainsService.verify', () => {
  it('marks the domain verified when the real TXT record is present', async () => {
    const { service, dnsService, updated } = makeService({
      organizationId: 'org-1',
      verified: false,
      verificationToken: 'abc123',
    });
    dnsService.lookup.mockResolvedValue({
      txt: [['unrelated=record'], [verificationTxtValue('abc123')]],
    });

    const result = await service.verify('user-1', 'domain-1');

    expect(result.verified).toBe(true);
    expect(updated.data).toEqual({ verified: true });
  });

  it('refuses to verify when the TXT record is missing', async () => {
    const { service, dnsService } = makeService({
      organizationId: 'org-1',
      verified: false,
      verificationToken: 'abc123',
    });
    dnsService.lookup.mockResolvedValue({ txt: [['unrelated=record']] });

    await expect(service.verify('user-1', 'domain-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('is a no-op (does not re-check DNS) once already verified', async () => {
    const { service, dnsService } = makeService({
      organizationId: 'org-1',
      verified: true,
      verificationToken: 'abc123',
    });

    const result = await service.verify('user-1', 'domain-1');

    expect(result.verified).toBe(true);
    expect(dnsService.lookup).not.toHaveBeenCalled();
  });
});
