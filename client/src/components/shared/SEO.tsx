import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
}

const DEFAULT_TITLE = 'Future Driving School — Customer & Vehicle Document Management';
const DEFAULT_DESC =
  'Future Driving School management platform for vehicle documentation, FC, Insurance, Road Tax, Driving License tracking, automated expiry alerts, and renewals.';

export function useSEO({ title, description, canonical }: SEOProps = {}) {
  useEffect(() => {
    // 1. Update Document Title
    const formattedTitle = title ? `${title} | Future Driving School` : DEFAULT_TITLE;
    document.title = formattedTitle;

    // 2. Update Meta Description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description || DEFAULT_DESC);
    }

    // 3. Update Open Graph Meta
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', formattedTitle);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', description || DEFAULT_DESC);
    }

    // 4. Update Canonical if provided
    if (canonical) {
      let linkCanonical = document.querySelector('link[rel="canonical"]');
      if (linkCanonical) {
        linkCanonical.setAttribute('href', canonical);
      }
    }
  }, [title, description, canonical]);
}

export default function SEO(props: SEOProps) {
  useSEO(props);
  return null;
}
