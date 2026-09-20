const HOME_MARKDOWN = `# Vadivam Icons

Vadivam is a free, open-source set of pixel-perfect 24px outline icons for designers and developers.

Use optimized SVG assets or native components for React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact.

- [Browse the icon catalog](https://vadivam.praveenjuge.com/)
- [Read the documentation](https://vadivam.praveenjuge.com/docs)
- [Choose a package](https://vadivam.praveenjuge.com/docs/installation)
- [Use Vadivam with AI agents](https://vadivam.praveenjuge.com/docs/ai-agents)
- [View the source](https://github.com/praveenjuge/vadivam)
`;

const NOT_FOUND_MARKDOWN = `# Page not found

This path does not exist. Continue with the [documentation](https://vadivam.praveenjuge.com/docs), [icon catalog](https://vadivam.praveenjuge.com/), or [LLM index](https://vadivam.praveenjuge.com/llms.txt).
`;

function parseAccept(value = "") {
  return value.split(",").map((entry) => {
    const [mediaType, ...parameters] = entry
      .split(";")
      .map((part) => part.trim().toLowerCase());
    const quality = parameters.find(
      (parameter) => parameter.split("=", 1)[0].trim() === "q",
    );
    const parsedQuality = quality
      ? Number.parseFloat(quality.split("=", 2)[1])
      : 1;
    return {
      mediaType,
      quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
    };
  });
}

function qualityFor(ranges, mediaType) {
  const [type] = mediaType.split("/");
  const exact = ranges.find((range) => range.mediaType === mediaType);
  if (exact) return exact.quality;
  const typeWildcard = ranges.find((range) => range.mediaType === `${type}/*`);
  if (typeWildcard) return typeWildcard.quality;
  return ranges.find((range) => range.mediaType === "*/*")?.quality ?? 0;
}

export function acceptsMarkdown(value = "") {
  const ranges = parseAccept(value);
  const markdown = qualityFor(ranges, "text/markdown");
  const html = qualityFor(ranges, "text/html");
  const explicitlyRequestsMarkdown = ranges.some(
    (range) => range.mediaType === "text/markdown",
  );
  const explicitlyRequestsHtml = ranges.some(
    (range) => range.mediaType === "text/html",
  );

  return (
    markdown > 0 &&
    (markdown > html ||
      (markdown === html &&
        explicitlyRequestsMarkdown &&
        !explicitlyRequestsHtml))
  );
}

export function appendVary(headers, value) {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", value);
    return;
  }

  if (current.trim() === "*") return;

  const values = current.split(",").map((item) => item.trim());
  if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
    headers.set("Vary", `${current}, ${value}`);
  }
}

function markdownResponse(body, status, method, sourceHeaders) {
  const headers = new Headers(sourceHeaders);
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.delete("Content-Encoding");
  headers.delete("Content-Length");
  appendVary(headers, "Accept");

  return new Response(method === "HEAD" ? null : body, { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const negotiatesMarkdown = acceptsMarkdown(
      request.headers.get("Accept") ?? "",
    );
    const canNegotiate = request.method === "GET" || request.method === "HEAD";

    if (canNegotiate && url.pathname === "/" && negotiatesMarkdown) {
      return markdownResponse(HOME_MARKDOWN, 200, request.method);
    }

    const response = await env.ASSETS.fetch(request);

    if (canNegotiate && response.status === 404 && negotiatesMarkdown) {
      return markdownResponse(
        NOT_FOUND_MARKDOWN,
        404,
        request.method,
        response.headers,
      );
    }

    if (canNegotiate && (url.pathname === "/" || response.status === 404)) {
      const forwarded = new Response(response.body, response);
      appendVary(forwarded.headers, "Accept");
      return forwarded;
    }

    return response;
  },
};
