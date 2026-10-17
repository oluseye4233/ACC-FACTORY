import { useEffect } from "react";

export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !tag;
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "description";
      document.head.appendChild(tag);
    }
    const prevDesc = tag.content;
    tag.content = description;
    return () => {
      document.title = prev;
      if (created) tag?.remove();
      else if (tag) tag.content = prevDesc;
    };
  }, [title, description]);
}
