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

export function acceptsMarkdown(value = "") {
  return value.split(",").some((entry) => {
    const [mediaType, ...parameters] = entry.split(";").map((part) => part.trim().toLowerCase());
    if (mediaType !== "text/markdown") return false;

    const quality = parameters.find((parameter) => parameter.startsWith("q="));
    return quality ? Number.parseFloat(quality.slice(2)) > 0 : true;
  });
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

function markdownResponse(body, status, method) {
  return new Response(method === "HEAD" ? null : body, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const negotiatesMarkdown = acceptsMarkdown(request.headers.get("Accept") ?? "");
    const canNegotiate = request.method === "GET" || request.method === "HEAD";

    if (canNegotiate && url.pathname === "/" && negotiatesMarkdown) {
      return markdownResponse(HOME_MARKDOWN, 200, request.method);
    }

    const response = await env.ASSETS.fetch(request);

    if (canNegotiate && response.status === 404 && negotiatesMarkdown) {
      return markdownResponse(NOT_FOUND_MARKDOWN, 404, request.method);
    }

    if (canNegotiate && (url.pathname === "/" || response.status === 404)) {
      const headers = new Headers(response.headers);
      appendVary(headers, "Accept");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return response;
  },
};
