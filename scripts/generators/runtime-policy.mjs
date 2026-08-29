export const svgElementTypes = [
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
];

export const svgElementTypeSource = svgElementTypes
  .map((tag) => JSON.stringify(tag))
  .join(" | ");

function buildRuntimePolicy(typeScript = false) {
  const types = {
    unknown: typeScript ? ": unknown" : "",
    string: typeScript ? ": string" : "",
    iconTag: typeScript ? ": SVGElementType" : "",
    recordGuard: typeScript ? ": value is Record<string, unknown>" : "",
    safeValueGuard: typeScript ? ": value is string | number | boolean" : "",
    unknownReturn: typeScript ? ": unknown" : "",
    iconNodeReturn: typeScript ? ": IconNode" : "",
    rootReturn: typeScript ? ": Record<string, unknown>" : "",
    styleRecord: typeScript ? ": Record<string, string | number>" : "",
    iconAttributes: typeScript ? ": Record<string, string | number | boolean>" : "",
    rootAttributes: typeScript ? ": Record<string, unknown>" : "",
    nodes: typeScript ? ": [SVGElementType, Record<string, string | number | boolean>, IconNode?][]" : "",
    traversalArguments: typeScript ? ": unknown, activeArrays: WeakSet<object>, state: { count: number }, depth: number" : ", activeArrays, state, depth",
    nodeCast: typeScript ? " as [SVGElementType, Record<string, unknown>, unknown?]" : "",
    regexMatch: typeScript ? ": RegExpExecArray | null" : "",
  };
  return `const SAFE_ICON_TAGS = new Set(${JSON.stringify(svgElementTypes)});
const GEOMETRY_ATTRIBUTES = {
  circle: new Set(["cx", "cy", "r"]),
  ellipse: new Set(["cx", "cy", "rx", "ry"]),
  line: new Set(["x1", "y1", "x2", "y2"]),
  path: new Set(["d", "pathLength"]),
  polygon: new Set(["points", "pathLength"]),
  polyline: new Set(["points", "pathLength"]),
  rect: new Set(["x", "y", "width", "height", "rx", "ry", "pathLength"]),
};
const PRESENTATION_ATTRIBUTES = new Set([
  "class", "className", "id", "role", "key", "opacity", "transform",
  "clip-rule", "clipRule", "fill", "fill-opacity", "fillOpacity", "fill-rule", "fillRule",
  "shape-rendering", "shapeRendering", "stroke", "stroke-dasharray", "strokeDasharray",
  "stroke-dashoffset", "strokeDashoffset", "stroke-linecap", "strokeLinecap",
  "stroke-linejoin", "strokeLinejoin", "stroke-miterlimit", "strokeMiterlimit",
  "stroke-opacity", "strokeOpacity", "stroke-width", "strokeWidth", "vector-effect", "vectorEffect",
]);
const SAFE_ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const SAFE_DATA_ATTRIBUTE = /^data-[A-Za-z0-9_.-]+$/;
const SAFE_ARIA_ATTRIBUTE = /^aria-[A-Za-z0-9_.-]+$/;
const SAFE_STYLE_NAME = /^(?:--[A-Za-z0-9_-]+|[A-Za-z_][A-Za-z0-9_-]*)$/;
const SAFE_EVENT_NAME = /^on(?::[A-Za-z][A-Za-z0-9_.-]*|[A-Za-z][A-Za-z0-9_.-]*)$/;
const UNSAFE_ROOT_ATTRIBUTE = /^(?:dangerouslySetInnerHTML|innerHTML|innerText|textContent|children|href|xlinkHref|src|srcdoc)$/i;
const URL_VALUE_ATTRIBUTE = /^(?:fill|stroke|filter|clipPath|clip-path|mask|marker|markerStart|marker-start|markerMid|marker-mid|markerEnd|marker-end|cursor)$/;
const SCRIPT_SCHEME = /(?:java|vb)script\\s*:/i;
const URL_FUNCTION = /url\\s*\\(/i;
const COMPLETE_URL_FUNCTION = /url\\s*\\(\\s*(["']?)([^"')\\s]+)\\1\\s*\\)/gi;
const EXTERNAL_SCHEME = /(?:https?|data|blob|file|ftp)\\s*:/i;
const CSS_ESCAPE = /\\\\/;
const CSS_RESOURCE_FUNCTION = /(?:image-set|cross-fade|image|src)\\s*\\(/i;
const CSS_IMPORT = /@import\\b/i;
const MAX_ICON_DEPTH = 32;
const MAX_ICON_NODES = 1024;

function isRecord(value${types.unknown})${types.recordGuard} {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeValue(name${types.string}, value${types.unknown})${types.safeValueGuard} {
  if (value === undefined || value === null || typeof value === "function") return false;
  if (typeof value === "object") return false;
  if (typeof value === "string" && SCRIPT_SCHEME.test(value)) return false;
  if ((name === "fill" || name === "stroke") && typeof value === "string" && hasExternalUrl(value)) return false;
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function hasExternalUrl(value${types.string}) {
  if (!URL_FUNCTION.test(value)) return false;
  COMPLETE_URL_FUNCTION.lastIndex = 0;
  let matched = false;
  let match${types.regexMatch};
  while ((match = COMPLETE_URL_FUNCTION.exec(value)) !== null) {
    matched = true;
    if (!match[2].startsWith("#")) return true;
  }
  return !matched;
}

function hasUnsafeStyleValue(value${types.string}) {
  return SCRIPT_SCHEME.test(value) || EXTERNAL_SCHEME.test(value) || CSS_ESCAPE.test(value) ||
    CSS_RESOURCE_FUNCTION.test(value) || CSS_IMPORT.test(value) || hasExternalUrl(value);
}

function isSafeIconAttribute(tag${types.iconTag}, name${types.string}) {
  return SAFE_ATTRIBUTE_NAME.test(name) && (
    GEOMETRY_ATTRIBUTES[tag]?.has(name) ||
    PRESENTATION_ATTRIBUTES.has(name) ||
    SAFE_DATA_ATTRIBUTE.test(name) ||
    SAFE_ARIA_ATTRIBUTE.test(name)
  );
}

function sanitizeStyle(value${types.unknown})${types.unknownReturn} {
  if (typeof value === "string") return hasUnsafeStyleValue(value) ? undefined : value;
  if (Array.isArray(value)) {
    const safeValues = value.map(sanitizeStyle).filter((entry) => entry !== undefined);
    return safeValues.length ? safeValues : undefined;
  }
  if (!isRecord(value)) return undefined;
  const safeStyle${types.styleRecord} = {};
  for (const [name, entry] of Object.entries(value)) {
    if (!SAFE_STYLE_NAME.test(name) || (typeof entry !== "string" && typeof entry !== "number")) continue;
    if (typeof entry === "string" && hasUnsafeStyleValue(entry)) continue;
    safeStyle[name] = entry;
  }
  return Object.keys(safeStyle).length ? safeStyle : undefined;
}

function safeRootValue(name${types.string}, value${types.unknown})${types.unknownReturn} {
  if (name === "style") return sanitizeStyle(value);
  if (value === undefined || value === null || typeof value === "object" || typeof value === "function") return undefined;
  if (typeof value === "string" && URL_VALUE_ATTRIBUTE.test(name) && (SCRIPT_SCHEME.test(value) || hasExternalUrl(value))) return undefined;
  return value;
}

function sanitizeNodes(iconNode${types.traversalArguments})${types.iconNodeReturn} {
  if (!Array.isArray(iconNode) || depth > MAX_ICON_DEPTH || activeArrays.has(iconNode)) return [];
  activeArrays.add(iconNode);
  const safeNodes${types.nodes} = [];
  for (const node of iconNode) {
    state.count += 1;
    if (state.count > MAX_ICON_NODES) break;
    if (!Array.isArray(node) || typeof node[0] !== "string" || !SAFE_ICON_TAGS.has(node[0]) || !isRecord(node[1])) continue;
    const [tag, attrs, children] = node${types.nodeCast};
    const safeAttrs${types.iconAttributes} = {};
    for (const [name, value] of Object.entries(attrs)) {
      if (isSafeIconAttribute(tag, name) && isSafeValue(name, value)) safeAttrs[name] = value;
    }
    const safeChildren = sanitizeNodes(children, activeArrays, state, depth + 1);
    safeNodes.push(safeChildren.length ? [tag, safeAttrs, safeChildren] : [tag, safeAttrs]);
  }
  activeArrays.delete(iconNode);
  return safeNodes;
}

export function sanitizeIconNode(iconNode${types.unknown})${types.iconNodeReturn} {
  return sanitizeNodes(iconNode, new WeakSet(), { count: 0 }, 0);
}

export function sanitizeRootAttributes(attrs${types.unknown}, allowEventFunctions = false)${types.rootReturn} {
  if (!isRecord(attrs)) return {};
  const safeAttrs${types.rootAttributes} = {};
  for (const name of Object.keys(attrs)) {
    const value = attrs[name];
    if (/^on/i.test(name)) {
      if (allowEventFunctions && typeof value === "function" && SAFE_EVENT_NAME.test(name)) {
        Object.defineProperty(safeAttrs, name, { enumerable: true, get: () => typeof attrs[name] === "function" ? attrs[name] : undefined });
      }
      continue;
    }
    if (!SAFE_ATTRIBUTE_NAME.test(name) || UNSAFE_ROOT_ATTRIBUTE.test(name) || /^prop/i.test(name)) continue;
    if (safeRootValue(name, value) === undefined) continue;
    Object.defineProperty(safeAttrs, name, { enumerable: true, get: () => safeRootValue(name, attrs[name]) });
  }
  return safeAttrs;
}
`;
}

export const runtimePolicySource = buildRuntimePolicy();
export const runtimePolicyTypeScriptSource = buildRuntimePolicy(true);
