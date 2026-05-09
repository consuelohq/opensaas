const DANGEROUS_HREF_PROTOCOL_REGEX = /^\s*(javascript|data|vbscript):/i;

export const isHrefContentValid = (href: string | null | undefined): boolean => {
  if (href === null || href === undefined) {
    return false;
  }

  return !DANGEROUS_HREF_PROTOCOL_REGEX.test(href);
};

export const sanitizeHref = (href: string | null | undefined): string => {
  if (!isHrefContentValid(href)) {
    return '';
  }

  return href;
};
