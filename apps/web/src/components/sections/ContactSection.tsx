"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { SitePublicSettings } from "@tzj/types";
import { useLocale } from "next-intl";
import { submitContact } from "@/lib/api";
import {
  validateContactForm,
  isHoneypotTriggered,
  type ContactFormValues,
  type ContactFieldErrors,
} from "@/lib/validation/contact";
import {
  AliyunCaptchaEmbed,
  SUBMIT_BUTTON_ID,
  useAliyunCaptchaConfig,
  type CaptchaLanguage,
} from "@/components/AliyunCaptcha";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import { Container, Eyebrow } from "@/components/ui";
import { SocialConnectPanel } from "@/components/contact/SocialConnectPanel";
import { resolveAllSocialQrChannels } from "@/lib/resolve-social-channels";

const FIELD_CLASS =
  "w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-500 transition-colors focus:border-neutral-900 focus:outline-none";
const FIELD_ERROR_CLASS = "border-red-600 focus:border-red-600";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-neutral-700";

const INITIAL_FORM: ContactFormValues = {
  name: "",
  phone: "",
  email: "",
  company: "",
  message: "",
  website: "",
};

function localeToCaptchaLanguage(locale: string): CaptchaLanguage {
  if (locale === "zh-TW") return "tw";
  if (locale === "en") return "en";
  return "cn";
}

export function ContactSection({
  settings,
  address,
}: {
  settings: SitePublicSettings;
  address: string;
}) {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [formData, setFormData] = useState<ContactFormValues>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const { config: captchaConfig, enabled: captchaEnabled } = useAliyunCaptchaConfig();

  const validationMessages = useMemo(
    () => ({
      nameRequired: t("validation.nameRequired"),
      nameMinLength: t("validation.nameMinLength"),
      phoneRequired: t("validation.phoneRequired"),
      phoneInvalid: t("validation.phoneInvalid"),
      emailInvalid: t("validation.emailInvalid"),
    }),
    [t],
  );

  const socialConnectChannels = useMemo(
    () => resolveAllSocialQrChannels(settings, (key) => t(key as Parameters<typeof t>[0])),
    [settings, t],
  );

  const contactInfo = useMemo(
    () => [
      {
        icon: Phone,
        label: t("phoneLabel"),
        value: settings.contact.phone,
        href: `tel:${settings.contact.phone.replace(/-/g, "")}`,
      },
      {
        icon: Mail,
        label: t("emailLabel"),
        value: settings.contact.email,
        href: `mailto:${settings.contact.email}`,
      },
      {
        icon: MapPin,
        label: t("addressLabel"),
        value: address,
        href: undefined,
      },
    ],
    [settings, address, t],
  );

  const submitPayload = useCallback(async (captchaVerifyParam?: string) => {
    if (isHoneypotTriggered(formData)) {
      setStatus("success");
      setStatusMessage(t("status.success"));
      return true;
    }

    const errors = validateContactForm(formData, validationMessages);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatusMessage(t("validation.formFix"));
      return false;
    }

    setStatus("loading");
    try {
      await submitContact({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        company: formData.company.trim() || undefined,
        message: formData.message.trim() || t("emptyMessage"),
        source: "website",
        captchaVerifyParam,
      });
      setStatus("success");
      setStatusMessage(t("status.success"));
      setFormData(INITIAL_FORM);
      return true;
    } catch {
      setStatus("error");
      setStatusMessage(t("status.error"));
      return false;
    }
  }, [formData, t, validationMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaEnabled) return;
    setFieldErrors({});
    setStatusMessage("");
    await submitPayload();
  };

  const updateField = useCallback(
    (field: keyof ContactFormValues, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (fieldErrors[field]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [fieldErrors],
  );

  return (
    <section id="contact" className="bg-white py-20 lg:py-28">
      <Container>
        <div className="mb-10 h-px bg-neutral-300 md:mb-12" />
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h2 className="rb-h2 mt-5 text-neutral-900">{t("title")}</h2>
            <p className="mb-8 mt-4 leading-relaxed text-secondary-text">{t("description")}</p>

            <div className="space-y-4">
              {contactInfo.map((info) => {
                const Icon = info.icon;
                return info.href ? (
                  <a key={info.label} href={info.href} className="group flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary/10 transition-colors group-hover:bg-primary/15">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-xs text-secondary-text">{info.label}</div>
                      <div className="font-display font-bold text-neutral-900 transition-colors group-hover:text-primary">
                        {info.value}
                      </div>
                    </div>
                  </a>
                ) : (
                  <div key={info.label} className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-xs text-secondary-text">{info.label}</div>
                      <div className="font-display font-bold text-neutral-900">{info.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {socialConnectChannels.length > 0 ? (
              <SocialConnectPanel
                channels={socialConnectChannels}
                sectionTitle={t("instantContact")}
              />
            ) : null}
          </div>

          <div className="border border-neutral-300 bg-neutral-100 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={formData.website}
                  onChange={(e) => updateField("website", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className={LABEL_CLASS}>
                    {t("form.nameLabel")}
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder={t("form.namePlaceholder")}
                    required
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? "name-error" : undefined}
                    className={`${FIELD_CLASS} ${fieldErrors.name ? FIELD_ERROR_CLASS : ""}`}
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                  {fieldErrors.name && (
                    <p id="name-error" className="mt-1 text-xs text-red-600" role="alert">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="phone" className={LABEL_CLASS}>
                    {t("form.phoneLabel")}
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder={t("form.phonePlaceholder")}
                    required
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                    className={`${FIELD_CLASS} ${fieldErrors.phone ? FIELD_ERROR_CLASS : ""}`}
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                  {fieldErrors.phone && (
                    <p id="phone-error" className="mt-1 text-xs text-red-600" role="alert">
                      {fieldErrors.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className={LABEL_CLASS}>
                    {t("form.emailLabel")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder={t("form.emailPlaceholder")}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    className={`${FIELD_CLASS} ${fieldErrors.email ? FIELD_ERROR_CLASS : ""}`}
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                  {fieldErrors.email && (
                    <p id="email-error" className="mt-1 text-xs text-red-600" role="alert">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="company" className={LABEL_CLASS}>
                    {t("form.companyLabel")}
                  </label>
                  <input
                    id="company"
                    type="text"
                    placeholder={t("form.companyPlaceholder")}
                    className={FIELD_CLASS}
                    value={formData.company}
                    onChange={(e) => updateField("company", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className={LABEL_CLASS}>
                  {t("form.messageLabel")}
                </label>
                <textarea
                  id="message"
                  rows={10}
                  placeholder={t("form.messagePlaceholder")}
                  className={FIELD_CLASS}
                  value={formData.message}
                  onChange={(e) => updateField("message", e.target.value)}
                />
              </div>

              {captchaEnabled && captchaConfig ? (
                <AliyunCaptchaEmbed
                  config={captchaConfig}
                  language={localeToCaptchaLanguage(locale)}
                  onSubmit={async (captchaVerifyParam) => {
                    setFieldErrors({});
                    setStatusMessage("");
                    return submitPayload(captchaVerifyParam);
                  }}
                  onSuccess={() => {}}
                  onError={() => {
                    if (status !== "error") {
                      setStatus("error");
                      setStatusMessage(t("status.error"));
                    }
                  }}
                />
              ) : null}

              <button
                id={captchaEnabled ? SUBMIT_BUTTON_ID : undefined}
                type="submit"
                disabled={status === "loading"}
                className="group inline-flex w-full items-center justify-center gap-2 bg-primary py-3.5 font-display text-base font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {status === "loading" ? t("form.submitting") : t("form.submit")}
              </button>

              <div role="status" aria-live="polite" aria-atomic="true">
                {statusMessage && (
                  <p
                    className={`text-center text-sm font-medium ${
                      status === "success"
                        ? "text-primary"
                        : status === "error"
                          ? "text-red-600"
                          : "text-secondary-text"
                    }`}
                  >
                    {statusMessage}
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </Container>
    </section>
  );
}
