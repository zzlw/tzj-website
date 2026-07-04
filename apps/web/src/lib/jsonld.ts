import { siteConfig } from "@/lib/site";
import { resolveMediaUrl } from "@/lib/media-url";

export function organizationJsonLd({
  legalName,
  brandName,
  description,
  phone,
  email,
  streetAddress,
  addressLocality,
  addressRegion,
}: {
  legalName: string;
  brandName: string;
  description: string;
  phone: string;
  email: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: legalName,
    alternateName: brandName,
    url: siteConfig.url,
    logo: resolveMediaUrl(siteConfig.social.logo),
    description,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: phone,
      email,
      contactType: "sales",
      areaServed: "CN",
      availableLanguage: ["Chinese", "English"],
    },
    address: {
      "@type": "PostalAddress",
      addressLocality,
      addressRegion,
      addressCountry: "CN",
      streetAddress,
    },
  };
}

export function productJsonLd({
  name,
  description,
  path,
  image,
}: {
  name: string;
  description: string;
  path: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    brand: {
      "@type": "Brand",
      name: siteConfig.name,
    },
    manufacturer: {
      "@type": "Organization",
      name: siteConfig.legalName,
    },
    url: `${siteConfig.url}${path}`,
    image: image ? resolveMediaUrl(image) : undefined,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.path}`,
    })),
  };
}

export function articleJsonLd({
  title,
  description,
  path,
  image,
  datePublished,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  datePublished?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: `${siteConfig.url}${path}`,
    image: image ? resolveMediaUrl(image) : undefined,
    datePublished,
    author: {
      "@type": "Organization",
      name: siteConfig.legalName,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.legalName,
      logo: {
        "@type": "ImageObject",
        url: resolveMediaUrl(siteConfig.social.logo),
      },
    },
  };
}
