export function buildConversationShareUrl(locationHref: string, conversationId: string) {
  const url = new URL(locationHref);
  url.searchParams.set("conversation", conversationId);
  return url.toString();
}

export function getConversationIdFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URL(window.location.href).searchParams.get("conversation");
}

export function setConversationIdInLocation(conversationId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (conversationId) {
    url.searchParams.set("conversation", conversationId);
  } else {
    url.searchParams.delete("conversation");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function getConversationShareUrl(conversationId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return buildConversationShareUrl(window.location.href, conversationId);
}
