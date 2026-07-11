// Reasonably strict hostname validation: labels of alphanumerics/hyphens,
// dot-separated, no leading/trailing hyphen per label. Not a full RFC 1035
// validator, but enough to reject garbage/script-injection-shaped input at
// the API boundary before it ever reaches a scan job. Shared by every DTO
// that accepts a raw hostname (tracked domains, the public free-scan
// endpoint) so the validation rule can't drift between them.
export const HOSTNAME_REGEX =
  /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;
