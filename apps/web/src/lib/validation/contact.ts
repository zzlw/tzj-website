export interface ContactFormValues {
  name: string;
  phone: string;
  email: string;
  company: string;
  message: string;
  website?: string;
}

export type ContactFieldErrors = Partial<Record<keyof ContactFormValues, string>>;

export interface ContactValidationMessages {
  nameRequired: string;
  nameMinLength: string;
  phoneRequired: string;
  phoneInvalid: string;
  emailInvalid: string;
}

const PHONE_RE = /^(\+?86[-\s]?)?1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$|^400-?\d{3}-?\d{4}$/;

export function validateContactForm(
  values: ContactFormValues,
  messages: ContactValidationMessages,
): ContactFieldErrors {
  const errors: ContactFieldErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = messages.nameRequired;
  } else if (name.length < 2) {
    errors.name = messages.nameMinLength;
  }

  const phone = values.phone.trim();
  if (!phone) {
    errors.phone = messages.phoneRequired;
  } else if (!PHONE_RE.test(phone.replace(/\s/g, ""))) {
    errors.phone = messages.phoneInvalid;
  }

  const email = values.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = messages.emailInvalid;
  }

  return errors;
}

export function isHoneypotTriggered(values: ContactFormValues): boolean {
  return Boolean(values.website?.trim());
}
