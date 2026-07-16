import path from "node:path";

const directory = path.resolve(process.argv[2]);
const port = Number(process.argv[3]);

Bun.serve({
  port,
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const resolved = path.resolve(directory, relative);
    if (!resolved.startsWith(`${directory}${path.sep}`) && resolved !== directory) {
      return new Response("Not found", { status: 404 });
    }
    let file = Bun.file(resolved);
    if (!(await file.exists())) file = Bun.file(path.join(directory, "index.html"));
    return new Response(file);
  },
});

console.log(`Serving ${directory} on ${port}`);
