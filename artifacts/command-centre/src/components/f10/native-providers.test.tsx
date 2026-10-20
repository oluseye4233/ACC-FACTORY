// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProviderOnboarding, validateProviderConfig, validatePublicHttpsEndpoint, PROVIDER_TARGETS } from "./native-providers";

describe("native provider config", () => {
  it("exposes new targets", () => {
    expect(PROVIDER_TARGETS.SLACK).toEqual(["SLACK_NOTIFICATIONS", "SLACK_AGENT"]);
    expect(PROVIDER_TARGETS.LANGCHAIN).toEqual(["LANGCHAIN_APP"]);
    expect(PROVIDER_TARGETS.LANGSMITH).toEqual(["LANGSMITH_DATASET"]);
  });
  it("rejects unsafe endpoints", () => {
    expect(validatePublicHttpsEndpoint("http://x.example.com")).toBeTruthy();
    expect(validatePublicHttpsEndpoint("https://u:p@x.example.com")).toBeTruthy();
    expect(validatePublicHttpsEndpoint("https://x.example.com/a?t=1")).toBeTruthy();
    expect(validatePublicHttpsEndpoint("https://x.example.com/a#h")).toBeTruthy();
    expect(validatePublicHttpsEndpoint("https://localhost/a")).toBeTruthy();
    expect(validatePublicHttpsEndpoint("https://agent.example.com/run")).toBeNull();
  });
  it("requires agentEndpoint only for SLACK_AGENT", () => {
    const base = { workspaceId: "T1", channelId: "C1" };
    expect(validateProviderConfig("SLACK", "SLACK_NOTIFICATIONS", base)).toEqual({});
    expect(validateProviderConfig("SLACK", "SLACK_AGENT", base)).toHaveProperty("agentEndpoint");
  });
  it("requires LangChain and LangSmith fields", () => {
    expect(Object.keys(validateProviderConfig("LANGCHAIN", "LANGCHAIN_APP", {}))).toEqual(["runtimeEndpoint", "deploymentName"]);
    expect(Object.keys(validateProviderConfig("LANGSMITH", "LANGSMITH_DATASET", {}))).toEqual(["workspaceId", "datasetName"]);
  });
});

describe("ProviderOnboarding", () => {
  it("offers authorization and official signup link", () => {
    const onConnect = vi.fn();
    render(<ProviderOnboarding provider="SLACK" target="SLACK_AGENT" onConnect={onConnect} connecting={false} hasActiveConnection={false} />);
    fireEvent.click(screen.getByRole("button", { name: /authorize slack/i }));
    expect(onConnect).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /create a slack workspace/i }).getAttribute("href")).toBe("https://slack.com/get-started");
  });
  it("shows LangChain docs and LangSmith signup", () => {
    const { rerender } = render(<ProviderOnboarding provider="LANGCHAIN" target="LANGCHAIN_APP" onConnect={() => {}} connecting={false} hasActiveConnection />);
    expect(screen.getByRole("link", { name: /framework docs/i }).getAttribute("href")).toBe("https://docs.langchain.com/oss/javascript/langchain/overview");
    rerender(<ProviderOnboarding provider="LANGSMITH" target="LANGSMITH_DATASET" onConnect={() => {}} connecting={false} hasActiveConnection={false} />);
    expect(screen.getByRole("link", { name: /sign up for langsmith/i }).getAttribute("href")).toBe("https://smith.langchain.com/");
    expect(screen.getByText(/does not run evaluations/i)).toBeTruthy();
  });
});
