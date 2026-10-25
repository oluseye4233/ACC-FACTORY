import { useEffect } from "react";
import { useDocumentMeta } from "@/hooks/use-document-meta";

/** Title/description via the shared hook, plus Open Graph tags for public pages. */
export function useMarketingMeta(title: string, description: string) {
  useDocumentMeta(title, description);
  useEffect(() => {
    const set = (property: string, content: string) => {
      let tag = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      const created = !tag;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      const prev = tag.content;
      tag.content = content;
      return () => { if (created) tag?.remove(); else if (tag) tag.content = prev; };
    };
    const undo = [
      set("og:title", title),
      set("og:description", description),
      set("og:type", "website"),
      set("og:image", `${window.location.origin}${import.meta.env.BASE_URL}atanda-logo.png`),
    ];
    return () => undo.forEach((u) => u());
  }, [title, description]);
}
