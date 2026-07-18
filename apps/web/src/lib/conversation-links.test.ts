import { describe, expect, it } from "vitest";
import { buildConversationShareUrl } from "./conversation-links";

describe("conversation link helpers", () => {
  it("adds the selected conversation id to the current URL", () => {
    expect(
      buildConversationShareUrl("http://localhost:3000/chat", "con_123"),
    ).toBe("http://localhost:3000/chat?conversation=con_123");
  });

  it("replaces an existing conversation query parameter", () => {
    expect(
      buildConversationShareUrl(
        "http://localhost:3000/?conversation=con_old&view=chat",
        "con_new",
      ),
    ).toBe("http://localhost:3000/?conversation=con_new&view=chat");
  });
});
