import { describe, expect, it } from "vitest";

import { assertAllowedUrl, fetchPage, isPrivateAddress } from "./fetch-page";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1", "127.1.2.3", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fd12:3456::1", "fc00::1",
    "::ffff:192.168.0.1", "::ffff:127.0.0.1", "::ffff:c0a8:1", "ff02::1", "not-an-ip",
  ])("%s is private", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s is public",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});

describe("assertAllowedUrl", () => {
  it.each([
    "http://localhost/recipe", "http://localhost:3000/api/health", "http://foo.localhost/", "http://127.0.0.1/", "http://10.0.0.1/",
    "http://192.168.1.1/admin", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://[fe80::1]/",
    "http://printer.local/", "http://nas.internal/", "ftp://example.com/file", "file:///etc/passwd", "javascript:alert(1)",
    "https://user:pass@example.com/", "not a url",
  ])("refuses %s", (url) => {
    expect(() => assertAllowedUrl(url)).toThrow();
  });

  it("allows ordinary public addresses", () => {
    expect(assertAllowedUrl("https://www.bbcgoodfood.com/recipes/easy-chicken-curry").hostname).toBe("www.bbcgoodfood.com");
  });
});

describe("fetchPage", () => {
  it("refuses private addresses without connecting", async () => {
    await expect(fetchPage("http://127.0.0.1:1/")).rejects.toThrow(/reachable/);
    await expect(fetchPage("http://localhost:1/")).rejects.toThrow(/reachable/);
  });
});
