export type PrivacyNoticeConfig = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  requestUrl: string;
};

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

export function getPrivacyNoticeConfig(): PrivacyNoticeConfig {
  return {
    contactName: clean(process.env.NEXT_PUBLIC_LGPD_CONTACT_NAME) || "Time de Privacidade e RH",
    contactEmail: clean(process.env.NEXT_PUBLIC_LGPD_CONTACT_EMAIL),
    contactPhone: clean(process.env.NEXT_PUBLIC_LGPD_CONTACT_PHONE),
    requestUrl: clean(process.env.NEXT_PUBLIC_LGPD_REQUEST_URL),
  };
}
